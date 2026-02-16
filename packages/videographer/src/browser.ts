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

export async function startCapture(config: Config): Promise<BrowserCapture> {
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

  const stream = await getStream(page, {
    audio: true,
    video: true,
    mimeType: "video/webm;codecs=vp8,opus",
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
    frameSize: 20,
  });

  const cleanup = async () => {
    try {
      stream.destroy();
    } catch {}
    try {
      await page.close();
    } catch {}
    try {
      await browser.close();
    } catch {}
    try {
      (await wss).close();
    } catch {}
  };

  return { browser, page, stream, cleanup };
}
