export interface Config {
  /** URL of the front-end to capture */
  frontendUrl: string;
  /** RTMP ingest URLs (Twitch, YouTube, etc.) */
  rtmpUrls: string[];
  /** Local file path to record to (e.g. recording.mp4) — used when no RTMP URLs are set */
  outputFile: string | undefined;
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Video framerate */
  fps: number;
  /** Path to Chrome/Chromium executable (puppeteer default if omitted) */
  chromePath: string | undefined;
}

const DEFAULT_CHROME_PATHS: Record<string, string> = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

export function loadConfig(): Config {
  const rtmpUrls = [
    process.env.TWITCH_RTMP_URL,
    process.env.YOUTUBE_RTMP_URL,
  ].filter((u): u is string => !!u);
  const outputFile = process.env.OUTPUT_FILE || undefined;

  if (rtmpUrls.length === 0 && !outputFile) {
    throw new Error(
      "Set TWITCH_RTMP_URL / YOUTUBE_RTMP_URL (for streaming) or OUTPUT_FILE (for local recording)",
    );
  }

  return {
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173/",
    rtmpUrls,
    outputFile,
    width: parseInt(process.env.CAPTURE_WIDTH ?? "1920", 10),
    height: parseInt(process.env.CAPTURE_HEIGHT ?? "1080", 10),
    fps: parseInt(process.env.CAPTURE_FPS ?? "30", 10),
    chromePath:
      process.env.CHROME_PATH || DEFAULT_CHROME_PATHS[process.platform],
  };
}
