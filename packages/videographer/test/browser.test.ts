import { PassThrough } from "node:stream";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import type { Config } from "../src/config.js";

// Mock child_process.execSync (used by killChrome)
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock puppeteer-stream — factory must not reference top-level variables
vi.mock("puppeteer-stream", () => ({
  launch: vi.fn(),
  getStream: vi.fn(),
  wss: Promise.resolve({ close: vi.fn() }),
}));

import { execSync } from "node:child_process";
import { getStream, launch } from "puppeteer-stream";
import { startCapture } from "../src/browser.js";

const mockExecSync = execSync as unknown as MockInstance;
const mockLaunch = launch as unknown as MockInstance;
const mockGetStream = getStream as unknown as MockInstance;

// Build mock objects that the mock launch/getStream will return
const mockPage = {
  waitForSelector: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  pages: vi.fn().mockResolvedValue([mockPage]),
  close: vi.fn().mockResolvedValue(undefined),
};

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    frontendUrl: "http://localhost:5173/",
    rtmpUrl: undefined,
    outputFile: "test.mp4",
    width: 1920,
    height: 1080,
    fps: 30,
    chromePath: "/usr/bin/google-chrome",
    ...overrides,
  };
}

describe("startCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Wire up mock return values
    mockLaunch.mockResolvedValue(mockBrowser);
    mockBrowser.pages.mockResolvedValue([mockPage]);
    mockBrowser.close.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(undefined);
    mockPage.close.mockResolvedValue(undefined);
    mockGetStream.mockResolvedValue(new PassThrough());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("kills Chrome before launching", async () => {
    await startCapture(makeConfig());
    expect(mockExecSync).toHaveBeenCalled();
    const firstExecCall = mockExecSync.mock.invocationCallOrder[0];
    const launchCall = mockLaunch.mock.invocationCallOrder[0];
    expect(firstExecCall).toBeLessThan(launchCall);
  });

  it("returns a capture with cleanup function", async () => {
    const capture = await startCapture(makeConfig());
    expect(capture.browser).toBe(mockBrowser);
    expect(capture.stream).toBeDefined();
    expect(typeof capture.cleanup).toBe("function");
  });

  it("cleanup calls stream.destroy, page.close, browser.close", async () => {
    const stream = new PassThrough();
    const destroySpy = vi.spyOn(stream, "destroy");
    mockGetStream.mockResolvedValue(stream);

    const capture = await startCapture(makeConfig());
    await capture.cleanup();

    expect(destroySpy).toHaveBeenCalled();
    expect(mockPage.close).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("cleans up browser if getStream fails", async () => {
    mockGetStream.mockRejectedValue(new Error("getStream failed"));

    await expect(startCapture(makeConfig())).rejects.toThrow(
      "getStream failed",
    );
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("cleanup does not block forever if browser.close hangs", async () => {
    mockBrowser.close.mockReturnValue(
      new Promise((r) => setTimeout(r, 30_000)),
    );

    const capture = await startCapture(makeConfig());

    const start = Date.now();
    await capture.cleanup();
    const elapsed = Date.now() - start;

    // withTimeout is 5s per operation, should complete well under 30s
    expect(elapsed).toBeLessThan(15_000);
  }, 20_000);
});
