import { mergeResolvers } from "@graphql-tools/merge";
import type { Resolvers } from "../resolverTypes.js";
import { gameResolvers } from "./Game/resolvers.js";
import { handResolvers } from "./Hand/resolvers.js";
import { playerResolvers } from "./Player/resolvers.js";

export const mergedResolvers: Resolvers = mergeResolvers([
  gameResolvers,
  playerResolvers,
  handResolvers,
]);
