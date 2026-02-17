import { createServer } from "node:http";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dirname, "../../../.env") });

import { type BrowserCapture, startCapture } from "./browser.js";
import { loadConfig } from "./config.js";
import { type FfmpegProcess, startFfmpeg } from "./ffmpeg.js";

const config = loadConfig();
let capture: BrowserCapture | null = null;
let ffmpeg: FfmpegProcess | null = null;
let shuttingDown = false;
let cleaning = false;
let status: "idle" | "starting" | "streaming" | "error" = "idle";

// ── Health server ────────────────────────────────────────

const HEALTH_PORT = process.env.HEALTH_PORT ?? 3001;

const healthServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status }));
    return;
  }
  res.writeHead(404);
  res.end();
});

healthServer.listen(HEALTH_PORT, () => {
  console.log(`[videographer] health server on :${HEALTH_PORT}`);
});

// ── Live flag polling ────────────────────────────────────

const PROCTOR_URL = process.env.PROCTOR_URL ?? "http://localhost:4001";
const CHANNEL_KEY = process.env.CHANNEL_KEY;
if (!CHANNEL_KEY) throw new Error("CHANNEL_KEY env var is required");
const POLL_INTERVAL_MS = 5000;

async function isLive(): Promise<boolean> {
  try {
    const res = await fetch(`${PROCTOR_URL}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query($ck:String!){ live(channelKey:$ck) }",
        variables: { ck: CHANNEL_KEY },
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { data?: { live: boolean } };
    return json.data?.live ?? false;
  } catch {
    return false;
  }
}

// ── Start / stop streaming ───────────────────────────────

async function startStreaming(): Promise<void> {
  status = "starting";
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

  status = "streaming";
}

async function stopStreaming(): Promise<void> {
  console.log("[videographer] stopping stream...");

  if (ffmpeg) {
    ffmpeg.process.kill("SIGTERM");
    const killTimer = setTimeout(() => ffmpeg?.process.kill("SIGKILL"), 5000);
    const timeout = new Promise<{ code: null; signal: null }>((r) =>
      setTimeout(() => r({ code: null, signal: null }), 10_000),
    );
    await Promise.race([ffmpeg.done.catch(() => {}), timeout]);
    clearTimeout(killTimer);
    ffmpeg = null;
  }

  if (capture) {
    const cleanupPromise = capture.cleanup().catch(() => {});
    const timeout = new Promise<void>((r) => setTimeout(r, 10_000));
    await Promise.race([cleanupPromise, timeout]);
    capture = null;
  }

  status = "idle";
  console.log("[videographer] stream stopped, idle");
}

// ── Shutdown ─────────────────────────────────────────────

async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[videographer] shutting down: ${reason}`);
  // Hard exit if graceful shutdown takes too long
  const hardExit = setTimeout(() => {
    console.error("[videographer] graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 15_000);
  hardExit.unref();
  await stopStreaming();
  healthServer.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Helpers ──────────────────────────────────────────────

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

// ── Main loop ────────────────────────────────────────────

/** Clean up any partially-initialized capture/ffmpeg from a failed start. */
async function cleanupPartial(): Promise<void> {
  if (cleaning) return;
  cleaning = true;
  try {
    if (ffmpeg) {
      try {
        ffmpeg.process.kill("SIGKILL");
      } catch {}
      ffmpeg = null;
    }
    if (capture) {
      const cleanupPromise = capture.cleanup().catch(() => {});
      const timeout = new Promise<void>((r) => setTimeout(r, 10_000));
      await Promise.race([cleanupPromise, timeout]);
      capture = null;
    }
  } finally {
    cleaning = false;
  }
}

async function run(): Promise<void> {
  while (!shuttingDown) {
    const live = await isLive();

    if (live && status === "idle") {
      try {
        await startStreaming();
      } catch (err) {
        console.error("[videographer] failed to start:", err);
        await cleanupPartial();
        status = "idle";
        // Wait before retrying
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }
      // Monitor ffmpeg — if it exits unexpectedly, clean up and go back to idle
      if (ffmpeg) {
        ffmpeg.done
          .then(async ({ code, signal }) => {
            if (
              !shuttingDown &&
              (status === "streaming" || status === "starting")
            ) {
              console.error(
                `[ffmpeg] exited unexpectedly (code=${code}, signal=${signal})`,
              );
              await cleanupPartial();
              status = "idle";
            }
          })
          .catch(async (err) => {
            if (!shuttingDown) {
              console.error("[ffmpeg] process error:", err.message);
              await cleanupPartial();
              status = "idle";
            }
          });
      }
    } else if (!live && status === "streaming") {
      await stopStreaming();
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

run().catch(async (err) => {
  console.error("[videographer] fatal error:", err);
  await shutdown("fatal error").catch(() => {});
  process.exit(1);
});
