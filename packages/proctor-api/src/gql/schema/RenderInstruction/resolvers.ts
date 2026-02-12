import { getChannelState, getInstructions } from "../../../persistence.js";
import { subscribe } from "../../../services/session/pubsub.js";
import type { RenderInstruction } from "../../resolverTypes.js";

const renderInstructions = {
  subscribe: async function* (
    _parent: unknown,
    { channelKey }: { channelKey: string },
  ) {
    const channelState = getChannelState(channelKey);

    // Subscribe to live pub-sub FIRST (sync — no instructions can be emitted
    // between this and the DB read below, so no deduplication needed).
    const live = subscribe(channelKey);

    // Replay unacked instructions from DB before switching to live.
    if (channelState?.moduleId) {
      const pending = getInstructions(
        channelState.moduleId,
        channelState.ackedInstructionTs ?? undefined,
      );
      for (const inst of pending) {
        yield {
          ...(JSON.parse(inst.payload) as RenderInstruction),
          moduleId: channelState.moduleId,
        };
      }
    }

    yield* live;
  },
  resolve: (payload: RenderInstruction) => payload,
};

export const renderInstructionResolvers = {
  Subscription: { renderInstructions },
};
