import * as gm from "../../../services/games/poker/poker-engine/index.js";
import type { MutationResolvers, QueryResolvers } from "../../resolverTypes.js";

const getGameState: QueryResolvers["getGameState"] = (_parent, { gameId }) => {
  return gm.getGameState(gameId);
};

const createGame: MutationResolvers["createGame"] = (_parent, { input }) => {
  const gameId = gm.createGame(input);
  return gm.getGameState(gameId);
};

const startHand: MutationResolvers["startHand"] = (_parent, { gameId }) => {
  return gm.startHand(gameId);
};

const advanceGame: MutationResolvers["advanceGame"] = (_parent, { gameId }) => {
  return gm.advanceGame(gameId);
};

export const gameResolvers = {
  Query: { getGameState },
  Mutation: { createGame, startHand, advanceGame },
};
