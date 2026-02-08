import * as gm from "../../../services/games/poker/poker-engine.js";
import { requirePlayerId } from "../../context.js";
import type { MutationResolvers, QueryResolvers } from "../../resolverTypes.js";

const getMyTurn: QueryResolvers["getMyTurn"] = (_parent, { gameId }, ctx) => {
  const playerId = requirePlayerId(ctx);
  return gm.getMyTurn(gameId, playerId);
};

const submitAction: MutationResolvers["submitAction"] = (
  _parent,
  { gameId, action },
  ctx,
) => {
  const playerId = requirePlayerId(ctx);
  return gm.submitAction(
    gameId,
    playerId,
    action.type,
    action.amount ?? undefined,
  );
};

export const playerResolvers = {
  Query: { getMyTurn },
  Mutation: { submitAction },
};
