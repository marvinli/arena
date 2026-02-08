import * as gm from "../../../game-manager.js";
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
  return gm.submitAction(gameId, playerId, action.type, action.amount ?? undefined);
};

export const playerResolvers = {
  PlayerStatus: {
    ACTIVE: "active" as const,
    FOLDED: "folded" as const,
    ALL_IN: "all-in" as const,
    BUSTED: "busted" as const,
  },
  ActionType: {
    FOLD: "fold" as const,
    CHECK: "check" as const,
    CALL: "call" as const,
    BET: "bet" as const,
    RAISE: "raise" as const,
  },
  Query: { getMyTurn },
  Mutation: { submitAction },
};
