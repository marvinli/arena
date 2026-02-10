export interface Config {
  /** URL of the front-end to capture */
  frontendUrl: string;
  /** RTMP ingest URL (e.g. rtmp://live.twitch.tv/app/KEY) — mutually exclusive with outputFile */
  rtmpUrl: string | undefined;
  /** Local file path to record to (e.g. recording.mp4) — mutually exclusive with rtmpUrl */
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

export function loadConfig(): Config {
  const rtmpUrl = process.env.RTMP_URL || undefined;
  const outputFile = process.env.OUTPUT_FILE || undefined;

  if (!rtmpUrl && !outputFile) {
    throw new Error(
      "Set RTMP_URL (for streaming) or OUTPUT_FILE (for local recording)",
    );
  }

  return {
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173/?autostart",
    rtmpUrl,
    outputFile,
    width: parseInt(process.env.CAPTURE_WIDTH ?? "1920", 10),
    height: parseInt(process.env.CAPTURE_HEIGHT ?? "1080", 10),
    fps: parseInt(process.env.CAPTURE_FPS ?? "30", 10),
    chromePath: process.env.CHROME_PATH || undefined,
  };
}
