import "dotenv/config";
import { type BrowserCapture, startCapture } from "./browser.js";
import { loadConfig } from "./config.js";
import { type FfmpegProcess, startFfmpeg } from "./ffmpeg.js";

const config = loadConfig();
let capture: BrowserCapture | null = null;
let ffmpeg: FfmpegProcess | null = null;
let shuttingDown = false;

async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[videographer] shutting down: ${reason}`);

  if (ffmpeg) {
    ffmpeg.process.kill("SIGTERM");
    const timeout = setTimeout(() => ffmpeg?.process.kill("SIGKILL"), 5000);
    await ffmpeg.done;
    clearTimeout(timeout);
  }

  if (capture) {
    await capture.cleanup();
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function waitForFrontend(url: string): Promise<void> {
  const maxAttempts = 30;
  const intervalMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        console.log(`[videographer] front-end is up at ${url}`);
        return;
      }
    } catch {
      // Not up yet
    }
    console.log(
      `[videographer] waiting for front-end (${attempt}/${maxAttempts})...`,
    );
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Front-end not reachable at ${url} after ${maxAttempts} attempts`,
  );
}

async function start(): Promise<void> {
  const output = config.rtmpUrl ?? config.outputFile;
  console.log("[videographer] starting...");
  console.log(`[videographer] frontend: ${config.frontendUrl}`);
  console.log(`[videographer] output: ${output}`);
  console.log(
    `[videographer] resolution: ${config.width}x${config.height}@${config.fps}fps`,
  );

  await waitForFrontend(config.frontendUrl);

  capture = await startCapture(config);
  console.log("[videographer] browser capture started");

  ffmpeg = startFfmpeg(capture.stream, config);
  console.log(
    config.rtmpUrl
      ? "[videographer] ffmpeg started, streaming to RTMP"
      : `[videographer] ffmpeg started, recording to ${config.outputFile}`,
  );

  const { code, signal } = await ffmpeg.done;
  if (!shuttingDown) {
    console.error(
      `[ffmpeg] exited unexpectedly (code=${code}, signal=${signal})`,
    );
    await shutdown("ffmpeg exited");
  }
}

start().catch(async (err) => {
  console.error("[videographer] fatal error:", err);
  await shutdown("fatal error").catch(() => {});
  process.exit(1);
});
