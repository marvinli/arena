import { subscribe } from "../../../services/session/pubsub.js";
import type { RenderInstruction } from "../../resolverTypes.js";

const renderInstructions = {
  subscribe: (_parent: unknown, { channelKey }: { channelKey: string }) => {
    return subscribe(channelKey);
  },
  resolve: (payload: RenderInstruction) => payload,
};

export const renderInstructionResolvers = {
  Subscription: { renderInstructions },
};
