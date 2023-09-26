require('dotenv').config();
const fs = require('fs');
const AWS = require('aws-sdk');
const chokidar = require('chokidar');
const path = require('path');
const express = require('express');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
app.listen(3001, () => {
  console.log(3001, '포트 번호로 서버가 실행되었습니다.');
});
const NodeMediaServer = require('node-media-server');
// s3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
});
const uploadFileToBucket = (filePath) => {
  const fileContent = fs.createReadStream(filePath);
  const fileName = path.basename(filePath);
  const folderNames = path.dirname(filePath).split('/');
  const folderName = folderNames[folderNames.length - 1];
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `videos/${folderName}/${fileName}`, // File name you want to save as in S3
    Body: fileContent,
  };
  s3.upload(params, function (err, data) {
    if (err) throw err;
    console.log(`File uploaded successfully. ${data.Location}`);
  });
};
// 썸네일 업로드
const uploadThumbnailToBucket = (filePath) => {
  const fileContent = fs.createReadStream(filePath);
  const fileName = path.basename(filePath);
  const folderNames = path.dirname(filePath).split("/");
  const folderName = folderNames[folderNames.length - 1];
  const liveId = filePath.split("/")[2];
  console.log("liveId", liveId);
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `images/thumbnails/${folderName}/${fileName}`, // File name you want to save as in S3
    Body: fileContent,
  };
  s3.upload(params, function (err, data) {
    if (err) throw err;
    console.log(`File uploaded successfully. ${data.Location}`);
    axios({
      method: "put",
      // url: `https://freelyb.site/api/lives/${liveId}/thumbnails`,
      url: `http://127.0.0.1:3000/api/lives/${liveId}/thumbnails`,
      // http://d2hv45obrzuf2s.cloudfront.net/images/thumbnails/${liveId}/thumbnail.png
      data: { thumbnailUrl: `http://d2hv45obrzuf2s.cloudfront.net/images/thumbnails/${liveId}/thumbnail.png` },
    });
  });
};
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 4096,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    mediaroot: "./media",
    allow_origin: "*",
  },
  trans: {
    ffmpeg: "/usr/bin/ffmpeg",
    tasks: [
      {
        app: "live",
        hls: true,
        hlsFlags: "[hls_time=1:hls_list_size=10000:hls_flags=delete_segments]", // hls_playlist_type=event <= 재생목록 유지 :omit_endlist hls_flags=delete_segments
        hlsKeep: false, // to prevent hls file delete after end the stream
        // dash: true,
        // dashFlags: "[f=dash:window_size=3:extra_window_size=5]",
        // dashKeep: false, // to prevent dash file delete after end the stream
      },
    ],
  },
};
const nms = new NodeMediaServer(config);
nms.run();
const baseDirectory = './media/live';
const watcher = chokidar.watch(baseDirectory, {
  ignored: /(^|[\/\\])\../, // Ignore dotfiles
  persistent: true,
  depth: 99,
});
const count = new Map();
watcher
  .on("add", (filePath) => {
    const streamPath = path.relative(baseDirectory, filePath); // id/index.ts(m3u8)
    const streamDirectory = streamPath.split("/")[0]; // id
    const playlistFilePath = path.join(
      baseDirectory,
      streamDirectory,
      "index.m3u8"
    ); // media/live/id/index.m3u8
    uploadFileToBucket(filePath);
    uploadFileToBucket(playlistFilePath);
    const liveId = filePath.split("/")[2];
    const thumbnailPath = `./thumbnails/${streamDirectory}`;
    !fs.existsSync(thumbnailPath) && fs.mkdirSync(thumbnailPath); // thumbnailPath 없으면 만들어줌
    if (!count.get(liveId)) {
      count.set(liveId, 0);
    }
    if (count.get(liveId) === 1) {
      ffmpeg(filePath)
        .setFfmpegPath("/usr/bin/ffmpeg")
        .output(`./thumbnails/${streamDirectory}/thumbnail.png`)
        .noAudio()
        .seek("0:01")
        .on("error", function (err) {
          console.log("An error occurred: " + err.message);
        })
        .on("end", function () {
          console.log("Processing finished !");
        })
        .run();
      count.set(liveId, count.get(liveId) + 1);
    } else if (count.get(liveId) === 2) {
      uploadThumbnailToBucket(`./thumbnails/${streamDirectory}/thumbnail.png`);
      count.set(liveId, count.get(liveId) + 1);
    } else if (
      count.get(liveId) < 15 &&
      (count.get(liveId) !== 1 || count.get(liveId) !== 2)
    ) {
      count.set(liveId, count.get(liveId) + 1);
    } else if (count.get(liveId) === 15) {
      count.set(liveId, 0);
    }
  })
  .on("error", (error) => {
    console.error(`Watcher error: ${error}`);
  });
// -------------------
// rtmp connection 관련 테스트 코드입니다.
// const blockIpList = []
//nms.on('preConnect', (id, args) => {
//  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
//  const session = nms.getSession(id);
//  if (blockIpList.includes(session.ip)) { 
//    session.reject();
//  }
//});
nms.on('postPublish', (id, streamPath, args) => {
  // rtmp connection 관련 테스트 코드입니다.
  // const session = nms.getSession(id)
  //setTimeout(() => {
  //  blockIpList.push(session.ip)
  //  session.reject();
  //}, 1800000);
  // --------
  const liveId = streamPath.split('/')[2];
  axios({
    method: 'post',
    // url: `https://freelyb.site/api/lives/start/${liveId}`,
    url: `http://127.0.0.1:3000/api/lives/start/${liveId}`,
  });
});
nms.on('donePublish', (id, streamPath, args) => {
  const liveId = streamPath.split('/')[2];
  axios({
    method: 'put',
    // url: `https://freelyb.site/api/lives/${liveId}/close-obs`,
    url: `http://127.0.0.1:3000/api/lives/${liveId}/close-obs`,
  });
});