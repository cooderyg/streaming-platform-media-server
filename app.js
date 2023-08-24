const chokidar = require("chokidar");
const path = require("path");
const express = require('express');

const app = express();

app.listen(3001, () => {
    console.log(3001, '포트 번호로 서버가 실행되었습니다.');
  });
  



const NodeMediaServer = require("node-media-server");

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
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
        hlsFlags: "[hls_time=1:hls_list_size=4:hls_flags=delete_segments]", // hls_playlist_type=event <= 재생목록 유지 :omit_endlist hls_flags=delete_segments
        hlsKeep: false, // to prevent hls file delete after end the stream
        // dash: true,
        // dashFlags: "[f=dash:window_size=3:extra_window_size=5]",
        // dashKeep: false, // to prevent dash file delete after end the stream
      },
    ],
  },
};

var nms = new NodeMediaServer(config);
nms.run();

// nms.on("postConnect", (id, args, aaa) => {
//   console.log(
//     "[NodeEvent on postConnect]",
//     `id=${id} args=${JSON.stringify(args)} `
//   );
// });

// nms.on("prePublish", (id, StreamPath, args) => {
//   console.log(
//     "[NodeEvent on prePublish]",
//     `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
//   );
//   // let session = nms.getSession(id);
//   // session.reject();
// });

nms.on("postPublish", async (id, streamPath, args) => {
  console.log(
    "[NodeEvent on postPublish]",
    `id=${id} StreamPath=${streamPath} args=${JSON.stringify(args)}`
  );

  const liveId = streamPath.split("/")[2];

  console.log("아이디아이디", liveId);
  try {
    const response = await fetch(
      `http://localhost:3000/api/lives/start/${liveId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.log(error);
  }
});

// nms.on("donePublish", (id, StreamPath, args) => {
//   console.log(
//     "[NodeEvent on donePublish]",
//     `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
//   );
// });

// nms.on("prePlay", (id, StreamPath, args) => {
//   console.log(
//     "[NodeEvent on prePlay]",
//     `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
//   );
//   // let session = nms.getSession(id);
//   // session.reject();
// });

// nms.on("postPlay", async (id, streamPath, args) => {
//   // console.log(
//   //   "[NodeEvent on postPlay]",
//   //   `id=${id} StreamPath=${streamPath} args=${JSON.stringify(args)}`
//   // );

//   const liveId = streamPath.split("/")[2];

//   console.log("아이디아이디", liveId);
//   try {
//     const response = await fetch(
//       `http://localhost:3000/api/lives/start/${liveId}`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     const data = response.json();
//     console.log(data);
//   } catch (error) {
//     console.log(error);
//   }
// });

// nms.on("donePlay", (id, StreamPath, args) => {
//   console.log(
//     "[NodeEvent on donePlay]",
//     `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
//   );
// });

// const baseDirectory = "./media/live"; // Modify this path to your base directory

// const watcher = chokidar.watch(baseDirectory, {
//   ignored: /(^|[\/\\])\../, // Ignore dotfiles
//   persistent: true,
//   depth: 99, // Set the depth for recursive watching
// });

// watcher
//   .on("add", (filePath) => {
//     console.log(`File added: ${path.relative(baseDirectory, filePath)}`);
//     // Perform actions when a new file is added within any subfolder
//   })
//   .on("error", (error) => {
//     console.error(`Watcher error: ${error}`);
//   });

// console.log(`Watching for new files in ${baseDirectory} and its subfolders...`);
