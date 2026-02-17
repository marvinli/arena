import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all config env vars
    delete process.env.RTMP_URL;
    delete process.env.OUTPUT_FILE;
    delete process.env.FRONTEND_URL;
    delete process.env.CAPTURE_WIDTH;
    delete process.env.CAPTURE_HEIGHT;
    delete process.env.CAPTURE_FPS;
    delete process.env.CHROME_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if neither RTMP_URL nor OUTPUT_FILE is set", () => {
    expect(() => loadConfig()).toThrow(
      "Set RTMP_URL (for streaming) or OUTPUT_FILE (for local recording)",
    );
  });

  it("loads config with RTMP_URL", () => {
    process.env.RTMP_URL = "rtmp://live.twitch.tv/app/key123";
    const config = loadConfig();
    expect(config.rtmpUrl).toBe("rtmp://live.twitch.tv/app/key123");
    expect(config.outputFile).toBeUndefined();
  });

  it("loads config with OUTPUT_FILE", () => {
    process.env.OUTPUT_FILE = "recording.mp4";
    const config = loadConfig();
    expect(config.outputFile).toBe("recording.mp4");
    expect(config.rtmpUrl).toBeUndefined();
  });

  it("uses default values for width, height, fps", () => {
    process.env.RTMP_URL = "rtmp://example.com/live";
    const config = loadConfig();
    expect(config.width).toBe(1920);
    expect(config.height).toBe(1080);
    expect(config.fps).toBe(30);
  });

  it("parses custom width, height, fps from env", () => {
    process.env.RTMP_URL = "rtmp://example.com/live";
    process.env.CAPTURE_WIDTH = "1280";
    process.env.CAPTURE_HEIGHT = "720";
    process.env.CAPTURE_FPS = "60";
    const config = loadConfig();
    expect(config.width).toBe(1280);
    expect(config.height).toBe(720);
    expect(config.fps).toBe(60);
  });

  it("uses default frontend URL", () => {
    process.env.RTMP_URL = "rtmp://example.com/live";
    const config = loadConfig();
    expect(config.frontendUrl).toBe("http://localhost:5173/");
  });

  it("reads custom frontend URL from env", () => {
    process.env.RTMP_URL = "rtmp://example.com/live";
    process.env.FRONTEND_URL = "http://localhost:3000/";
    const config = loadConfig();
    expect(config.frontendUrl).toBe("http://localhost:3000/");
  });

  it("reads CHROME_PATH from env", () => {
    process.env.RTMP_URL = "rtmp://example.com/live";
    process.env.CHROME_PATH = "/custom/chrome";
    const config = loadConfig();
    expect(config.chromePath).toBe("/custom/chrome");
  });
});
