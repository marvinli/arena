import { execSync } from "node:child_process";
import type { Readable } from "node:stream";
import type { Browser, Page } from "puppeteer";
import { getStream, launch, wss } from "puppeteer-stream";
import type { Config } from "./config.js";

export interface BrowserCapture {
  browser: Browser;
  page: Page;
  stream: Readable;
  cleanup: () => Promise<void>;
}

const CAPTURE_TIMEOUT_MS = 30_000;

export async function startCapture(config: Config): Promise<BrowserCapture> {
  // Kill any lingering Chrome processes from a previous run
  killChrome();

  const browser = await launch({
    executablePath: config.chromePath,
    // puppeteer-stream uses a Chrome extension for tab capture,
    // which requires a visible browser window (headless doesn't support extensions).
    headless: false,
    // Let the window size control the viewport directly (no CDP override)
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      // --app removes Chrome UI (tabs, address bar) so window size = content size
      `--app=${config.frontendUrl}`,
      `--window-size=${config.width},${config.height}`,
      "--autoplay-policy=no-user-gesture-required",
      "--hide-scrollbars",
      // Required for puppeteer-stream's tab capture extension on Chrome 135+
      "--allowlisted-extension-id=jjndjgheafjngoipoacpjgeicjeomjli",
    ],
  });

  try {
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());

    // --app already navigated, wait for the page to be ready
    await page.waitForSelector("body", { timeout: 30_000 });

    // Forward browser console to Node stdout so logs appear in CloudWatch
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error") console.error("[browser]", text);
      else if (type === "warn") console.warn("[browser]", text);
      else console.log("[browser]", text);
    });

    await new Promise((r) => setTimeout(r, 1000));

    const stream = await withTimeout(
      getStream(page, {
        audio: true,
        video: true,
        mimeType: "video/webm;codecs=vp8,opus",
        videoBitsPerSecond: 6_000_000,
        audioBitsPerSecond: 128_000,
        frameSize: 1000,
      }),
      CAPTURE_TIMEOUT_MS,
      "getStream timed out",
    );

    const cleanup = createCleanup(stream, page, browser);
    return { browser, page, stream, cleanup };
  } catch (err) {
    // If anything fails after browser launch, clean up before re-throwing
    await createCleanup(null, null, browser)();
    throw err;
  }
}

function createCleanup(
  stream: Readable | null,
  page: Page | null,
  browser: Browser,
): () => Promise<void> {
  return async () => {
    try {
      stream?.destroy();
    } catch {}
    try {
      await withTimeout(
        page?.close() ?? Promise.resolve(),
        5000,
        "page.close timed out",
      );
    } catch {}
    try {
      await withTimeout(browser.close(), 5000, "browser.close timed out");
    } catch {}
    try {
      const server = await wss;
      server.close();
    } catch {}
    // Final safety net — kill any Chrome processes that survived cleanup
    killChrome();
  };
}

function killChrome(): void {
  try {
    execSync("pkill -9 -f chrome 2>/dev/null || true", { stdio: "ignore" });
  } catch {}
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
