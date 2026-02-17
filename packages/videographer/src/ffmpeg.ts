import { type ChildProcess, spawn } from "node:child_process";
import type { Readable } from "node:stream";
import type { Config } from "./config.js";

export interface FfmpegProcess {
  process: ChildProcess;
  done: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export function startFfmpeg(stream: Readable, config: Config): FfmpegProcess {
  const output = config.rtmpUrl ?? config.outputFile;
  if (!output) throw new Error("No RTMP_URL or OUTPUT_FILE configured");

  const isRtmp = output.startsWith("rtmp");

  const args = [
    // Input: WebM from stdin
    "-i",
    "pipe:0",

    // Video: transcode VP8 → H.264
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    ...(isRtmp ? ["-tune", "zerolatency"] : []),
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(config.fps),
    "-g",
    String(config.fps * 2),
    "-b:v",
    "6000k",
    "-maxrate",
    "6000k",
    "-bufsize",
    "9000k",

    // Audio: transcode Opus → AAC
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "44100",
    // Fill small audio gaps with silence to prevent choppiness from
    // timestamp discontinuities in the tab-capture WebM stream
    "-af",
    "aresample=async=1",

    // Output
    ...(isRtmp ? ["-f", "flv"] : []),
    output,
  ];

  const ffmpeg = spawn("ffmpeg", args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Log stream errors to prevent unhandled exceptions
  stream.on("error", (err) => {
    console.error("[ffmpeg] input stream error:", err.message);
  });
  stream.on("end", () => {
    console.log("[ffmpeg] input stream ended");
  });

  if (ffmpeg.stdin) {
    stream.pipe(ffmpeg.stdin);
  }

  ffmpeg.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`[ffmpeg] ${line}`);
  });

  ffmpeg.stdin?.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") {
      console.error("[ffmpeg] stdin pipe broken (ffmpeg likely crashed)");
    } else {
      console.error("[ffmpeg] stdin error:", err.message);
    }
  });

  const done = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    ffmpeg.on("close", (code, signal) => {
      resolve({ code, signal });
    });
    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });

  return { process: ffmpeg, done };
}
