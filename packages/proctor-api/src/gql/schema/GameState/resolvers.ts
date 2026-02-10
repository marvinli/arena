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
      status: null,
      gameId: null,
      handNumber: 0,
      phase: null,
      button: null,
      smallBlind: 0,
      bigBlind: 0,
      players: [],
      communityCards: [],
      pots: [],
      hands: [],
      playerMeta: [],
      lastInstruction: null,
    };
  }

  const lastState = session.lastGameState;
  return {
    channelKey,
    status: session.status,
    gameId: session.gameId,
    handNumber: session.handNumber,
    phase: lastState?.phase ?? null,
    button: lastState?.button ?? null,
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
    players: (lastState?.players ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      bet: p.bet,
      status: p.status,
      seatIndex: p.seatIndex,
    })),
    communityCards: lastState?.communityCards ?? [],
    pots: lastState?.pots ?? [],
    hands: session.currentHands,
    playerMeta: session.config.players.map((p) => ({
      id: p.playerId,
      ttsVoice: p.ttsVoice ?? null,
      avatarUrl: p.avatarUrl ?? null,
    })),
    lastInstruction: session.lastInstruction,
  };
};

export const gameStateResolvers = {
  Query: { getChannelState },
};
