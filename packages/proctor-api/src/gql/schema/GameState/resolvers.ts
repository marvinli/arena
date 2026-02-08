import { getSession } from "../../../services/session/session-manager.js";
import type { QueryResolvers } from "../../resolverTypes.js";

const getChannelState: QueryResolvers["getChannelState"] = (
  _parent,
  { channelKey },
) => {
  const session = getSession(channelKey);
  if (!session) {
    return {
      channelKey,
      gameId: null,
      handNumber: 0,
      phase: null,
      players: [],
      communityCards: [],
      pots: [],
      lastInstruction: null,
    };
  }

  const lastState = session.lastGameState;
  return {
    channelKey,
    gameId: session.gameId,
    handNumber: session.handNumber,
    phase: lastState?.phase ?? null,
    players: lastState?.players ?? [],
    communityCards: lastState?.communityCards ?? [],
    pots: lastState?.pots ?? [],
    lastInstruction: session.lastInstruction,
  };
};

export const gameStateResolvers = {
  Query: { getChannelState },
};
