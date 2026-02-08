import { mergeResolvers } from "@graphql-tools/merge";
import type { Resolvers } from "../resolverTypes.js";
import { channelResolvers } from "./Channel/resolvers.js";
import { gameStateResolvers } from "./GameState/resolvers.js";
import { renderCompleteResolvers } from "./RenderComplete/resolvers.js";
import { renderInstructionResolvers } from "./RenderInstruction/resolvers.js";

export const mergedResolvers: Resolvers = mergeResolvers([
  channelResolvers,
  renderInstructionResolvers,
  gameStateResolvers,
  renderCompleteResolvers,
]);
