import { beforeEach, describe, expect, it } from "vitest";
import type { RenderInstruction } from "../../../src/gql/resolverTypes.js";
import {
  _resetPubSub,
  publish,
  subscribe,
  subscriberCount,
} from "../../../src/services/session/pubsub.js";

function makeInstruction(id: string): RenderInstruction {
  return {
    instructionId: id,
    type: "GAME_START",
    timestamp: new Date().toISOString(),
  } as RenderInstruction;
}

describe("pubsub", () => {
  beforeEach(() => {
    _resetPubSub();
  });

  it("publish to channel with no subscribers does not throw", () => {
    const instruction = makeInstruction("test-1");
    expect(() => publish("no-subs", instruction)).not.toThrow();
  });

  it("subscribe creates a channel and subscriberCount reflects it", () => {
    expect(subscriberCount("ch1")).toBe(0);
    subscribe("ch1");
    expect(subscriberCount("ch1")).toBe(1);
  });

  it("publish delivers to subscriber", async () => {
    const iter = subscribe("ch1");
    const instruction = makeInstruction("msg-1");

    publish("ch1", instruction);

    const iterator = iter[Symbol.asyncIterator]();
    const result = await iterator.next();
    expect(result.done).toBe(false);
    expect(result.value).toBe(instruction);
  });

  it("multiple subscribers receive same message", async () => {
    const iter1 = subscribe("ch1");
    const iter2 = subscribe("ch1");
    expect(subscriberCount("ch1")).toBe(2);

    const instruction = makeInstruction("msg-2");
    publish("ch1", instruction);

    const it1 = iter1[Symbol.asyncIterator]();
    const it2 = iter2[Symbol.asyncIterator]();

    const [r1, r2] = await Promise.all([it1.next(), it2.next()]);
    expect(r1.value).toBe(instruction);
    expect(r2.value).toBe(instruction);
  });

  it("subscriber.return() removes subscriber and subscriberCount decreases", async () => {
    const iter = subscribe("ch1");
    expect(subscriberCount("ch1")).toBe(1);

    const iterator = iter[Symbol.asyncIterator]();
    await iterator.return!(undefined as never);

    expect(subscriberCount("ch1")).toBe(0);
  });

  it("messages queued before consumer reads are delivered in order", async () => {
    const iter = subscribe("ch1");

    const msg1 = makeInstruction("order-1");
    const msg2 = makeInstruction("order-2");
    const msg3 = makeInstruction("order-3");

    publish("ch1", msg1);
    publish("ch1", msg2);
    publish("ch1", msg3);

    const iterator = iter[Symbol.asyncIterator]();
    const r1 = await iterator.next();
    const r2 = await iterator.next();
    const r3 = await iterator.next();

    expect(r1.value).toBe(msg1);
    expect(r2.value).toBe(msg2);
    expect(r3.value).toBe(msg3);
  });

  it("_resetPubSub cleans up all channels", async () => {
    const iter = subscribe("ch1");
    subscribe("ch2");
    expect(subscriberCount("ch1")).toBe(1);
    expect(subscriberCount("ch2")).toBe(1);

    _resetPubSub();

    expect(subscriberCount("ch1")).toBe(0);
    expect(subscriberCount("ch2")).toBe(0);

    // Iterator should be done after reset
    const iterator = iter[Symbol.asyncIterator]();
    const result = await iterator.next();
    expect(result.done).toBe(true);
  });

  it("after subscriber.return(), further publishes are not received", async () => {
    const iter = subscribe("ch1");
    const iterator = iter[Symbol.asyncIterator]();

    // Deliver one message first
    const msg1 = makeInstruction("before-return");
    publish("ch1", msg1);
    const r1 = await iterator.next();
    expect(r1.value).toBe(msg1);

    // Unsubscribe
    await iterator.return!(undefined as never);

    // Publish after unsubscribe
    publish("ch1", makeInstruction("after-return"));

    // next() should indicate done
    const r2 = await iterator.next();
    expect(r2.done).toBe(true);
  });
});
