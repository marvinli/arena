import { subscribe } from "../../../pubsub.js";
import { registerClient, unregisterClient } from "../../../session-manager.js";
import type { RenderInstruction } from "../../resolverTypes.js";

const renderInstructions = {
  subscribe: (_parent: unknown, { channelKey }: { channelKey: string }) => {
    const clientId = crypto.randomUUID();
    registerClient(channelKey, clientId);

    const iterable = subscribe(channelKey);
    const iterator = iterable[Symbol.asyncIterator]();

    return {
      [Symbol.asyncIterator]() {
        return {
          next: () => iterator.next(),
          return: async () => {
            unregisterClient(channelKey, clientId);
            return (
              iterator.return?.() ??
              Promise.resolve({ done: true as const, value: undefined })
            );
          },
        };
      },
    };
  },
  resolve: (payload: RenderInstruction) => payload,
};

export const renderInstructionResolvers = {
  Subscription: { renderInstructions },
};
