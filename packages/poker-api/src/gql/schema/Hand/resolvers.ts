import * as gm from "../../../game-manager.js";
import type { QueryResolvers } from "../../resolverTypes.js";

const getHistory: QueryResolvers["getHistory"] = (
  _parent,
  { gameId, lastN },
) => {
  return gm.getHistory(gameId, lastN ?? undefined);
};

export const handResolvers = {
  Query: { getHistory },
};
