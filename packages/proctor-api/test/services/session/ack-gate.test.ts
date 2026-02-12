import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetAckGate,
  notifyAck,
  waitForAck,
} from "../../../src/services/session/ack-gate.js";

describe("ack-gate", () => {
  beforeEach(() => {
    _resetAckGate();
  });

  it("waitForAck resolves when notifyAck is called", async () => {
    const p = waitForAck("mod-1", "inst-1");
    notifyAck("mod-1", "inst-1");
    await expect(p).resolves.toBeUndefined();
  });

  it("notifyAck before waitForAck resolves immediately (pre-ack)", async () => {
    notifyAck("mod-1", "inst-1");
    // Should resolve without blocking
    await expect(waitForAck("mod-1", "inst-1")).resolves.toBeUndefined();
  });

  it("pre-ack is consumed — second waitForAck blocks", async () => {
    notifyAck("mod-1", "inst-1");
    await waitForAck("mod-1", "inst-1"); // consumes pre-ack

    // Second wait should block until a new notify
    let resolved = false;
    const p = waitForAck("mod-1", "inst-1").then(() => {
      resolved = true;
    });
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    notifyAck("mod-1", "inst-1");
    await p;
    expect(resolved).toBe(true);
  });

  it("resolves immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      waitForAck("mod-1", "inst-1", controller.signal),
    ).resolves.toBeUndefined();
  });

  it("resolves when signal is aborted while waiting", async () => {
    const controller = new AbortController();
    const p = waitForAck("mod-1", "inst-1", controller.signal);
    controller.abort();
    await expect(p).resolves.toBeUndefined();
  });

  it("different module/instruction keys are independent", async () => {
    const p1 = waitForAck("mod-1", "inst-1");
    const p2 = waitForAck("mod-2", "inst-1");

    notifyAck("mod-1", "inst-1");
    await p1;

    // p2 should still be pending
    let p2Resolved = false;
    void p2.then(() => {
      p2Resolved = true;
    });
    await Promise.resolve();
    expect(p2Resolved).toBe(false);

    notifyAck("mod-2", "inst-1");
    await p2;
  });

  it("_resetAckGate clears pending waiters and pre-acks", async () => {
    notifyAck("mod-1", "inst-1"); // pre-ack
    _resetAckGate();

    // Pre-ack should be gone — this should block
    let resolved = false;
    const p = waitForAck("mod-1", "inst-1").then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Clean up by notifying
    notifyAck("mod-1", "inst-1");
    await p;
  });
});
