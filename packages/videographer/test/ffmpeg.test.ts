import { EventEmitter } from "node:events";
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

// Mock child_process.spawn before importing
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { startFfmpeg } from "../src/ffmpeg.js";

const mockSpawn = spawn as unknown as MockInstance;

function createFakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    kill: MockInstance;
  };
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.kill = vi.fn();
  return proc;
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    frontendUrl: "http://localhost:5173/",
    rtmpUrl: undefined,
    outputFile: "test.mp4",
    width: 1920,
    height: 1080,
    fps: 30,
    chromePath: undefined,
    ...overrides,
  };
}

describe("startFfmpeg", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("spawns ffmpeg with correct args for file output", () => {
    const fakeProc = createFakeProcess();
    mockSpawn.mockReturnValue(fakeProc);

    const stream = new PassThrough();
    const config = makeConfig({ outputFile: "output.mp4" });
    startFfmpeg(stream, config);

    expect(mockSpawn).toHaveBeenCalledWith(
      "ffmpeg",
      expect.arrayContaining(["-i", "pipe:0", "output.mp4"]),
      expect.any(Object),
    );
    // File output should NOT include -f flv or -tune zerolatency
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).not.toContain("flv");
    expect(args).not.toContain("zerolatency");
  });

  it("spawns ffmpeg with RTMP args when rtmpUrl is set", () => {
    const fakeProc = createFakeProcess();
    mockSpawn.mockReturnValue(fakeProc);

    const stream = new PassThrough();
    const config = makeConfig({
      rtmpUrl: "rtmp://live.twitch.tv/app/key",
      outputFile: undefined,
    });
    startFfmpeg(stream, config);

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain("flv");
    expect(args).toContain("-tune");
    expect(args).toContain("zerolatency");
    expect(args[args.length - 1]).toBe("rtmp://live.twitch.tv/app/key");
  });

  it("throws if no output configured", () => {
    const stream = new PassThrough();
    const config = makeConfig({ rtmpUrl: undefined, outputFile: undefined });
    expect(() => startFfmpeg(stream, config)).toThrow(
      "No RTMP_URL or OUTPUT_FILE configured",
    );
  });

  it("done resolves on close event", async () => {
    const fakeProc = createFakeProcess();
    mockSpawn.mockReturnValue(fakeProc);

    const stream = new PassThrough();
    const { done } = startFfmpeg(stream, makeConfig());

    fakeProc.emit("close", 0, null);
    const result = await done;
    expect(result).toEqual({ code: 0, signal: null });
  });

  it("done rejects on error event", async () => {
    const fakeProc = createFakeProcess();
    mockSpawn.mockReturnValue(fakeProc);

    const stream = new PassThrough();
    const { done } = startFfmpeg(stream, makeConfig());

    const error = new Error("spawn ENOENT");
    fakeProc.emit("error", error);
    await expect(done).rejects.toThrow("spawn ENOENT");
  });

  it("handles stdin EPIPE without throwing", () => {
    const fakeProc = createFakeProcess();
    mockSpawn.mockReturnValue(fakeProc);

    const stream = new PassThrough();
    startFfmpeg(stream, makeConfig());

    const err = new Error("write EPIPE") as NodeJS.ErrnoException;
    err.code = "EPIPE";
    // Should not throw — the error handler logs it
    expect(() => fakeProc.stdin.emit("error", err)).not.toThrow();
  });

  it("handles input stream errors without throwing", () => {
    const fakeProc = createFakeProcess();
    mockSpawn.mockReturnValue(fakeProc);

    const stream = new PassThrough();
    startFfmpeg(stream, makeConfig());

    // Should not throw — the error handler logs it
    expect(() => stream.emit("error", new Error("stream error"))).not.toThrow();
  });
});
