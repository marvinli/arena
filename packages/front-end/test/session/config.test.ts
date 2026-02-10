import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delay } from "../../src/session/config";

describe("delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the specified time", async () => {
    const controller = new AbortController();
    let resolved = false;
    delay(100, controller.signal).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(true);
  });

  it("resolves immediately when aborted", async () => {
    const controller = new AbortController();
    let resolved = false;
    delay(10_000, controller.signal).then(() => {
      resolved = true;
    });

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);
  });
});
