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
    defaultViewport: {
      width: config.width,
      height: config.height,
    },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] ?? (await browser.newPage());
  await page.goto(config.frontendUrl, { waitUntil: "networkidle2" });

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
