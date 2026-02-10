import { mergeResolvers } from "@graphql-tools/merge";
import type { Resolvers } from "../resolverTypes.js";
import { channelResolvers } from "./Channel/resolvers.js";
import { gameResolvers } from "./Game/resolvers.js";
import { gameStateResolvers } from "./GameState/resolvers.js";
import { handResolvers } from "./Hand/resolvers.js";
import { playerResolvers } from "./Player/resolvers.js";
import { renderInstructionResolvers } from "./RenderInstruction/resolvers.js";

export const mergedResolvers: Resolvers = mergeResolvers([
  channelResolvers,
  renderInstructionResolvers,
  gameStateResolvers,
  gameResolvers,
  playerResolvers,
  handResolvers,
]);
