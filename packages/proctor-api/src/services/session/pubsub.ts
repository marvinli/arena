import type { RenderInstruction } from "../../gql/resolverTypes.js";

interface Subscriber {
  push: (value: RenderInstruction) => void;
  done: () => void;
}

const channels = new Map<string, Set<Subscriber>>();

export function publish(
  channelKey: string,
  instruction: RenderInstruction,
): void {
  const subs = channels.get(channelKey);
  if (!subs) return;
  for (const sub of subs) {
    sub.push(instruction);
  }
}

export function subscribe(
  channelKey: string,
): AsyncIterable<RenderInstruction> {
  let subs = channels.get(channelKey);
  if (!subs) {
    subs = new Set();
    channels.set(channelKey, subs);
  }

  const queue: RenderInstruction[] = [];
  let resolve: ((result: IteratorResult<RenderInstruction>) => void) | null =
    null;
  let finished = false;

  const subscriber: Subscriber = {
    push(value) {
      if (finished) return;
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value, done: false });
      } else {
        queue.push(value);
      }
    },
    done() {
      finished = true;
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: undefined, done: true });
      }
    },
  };

  subs.add(subscriber);

  return {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<RenderInstruction>> {
          if (queue.length > 0) {
            const value = queue.shift() as RenderInstruction;
            return Promise.resolve({ value, done: false });
          }
          if (finished) {
            return Promise.resolve({
              value: undefined,
              done: true,
            });
          }
          return new Promise((r) => {
            resolve = r;
          });
        },
        return(): Promise<IteratorResult<RenderInstruction>> {
          finished = true;
          subs.delete(subscriber);
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
}

export function subscriberCount(channelKey: string): number {
  return channels.get(channelKey)?.size ?? 0;
}

export function _resetPubSub(): void {
  for (const subs of channels.values()) {
    for (const sub of subs) {
      sub.done();
    }
  }
  channels.clear();
}
