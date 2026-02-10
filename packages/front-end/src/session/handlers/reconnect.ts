import type { GamePhase, GameState } from "../../types";
import { CHANNEL_KEY } from "../config";
import { mapCard, mapPlayers, mapPots } from "../mappers";
import type { GqlChannelState } from "../types";
import { buildHoleCards } from "./shared";

export function handleReconnect(cs: GqlChannelState): GameState {
  const avatarMap = new Map(
    cs.playerMeta.map((m) => [m.id, m.avatarUrl ?? ""]),
  );

  const holeCards = buildHoleCards(cs.hands);

  const activePlayers = cs.players.filter((p) => p.status !== "BUSTED");
  const players = mapPlayers(activePlayers, cs.button, []).map((p) => ({
    ...p,
    avatar: avatarMap.get(p.id) ?? "",
    cards: holeCards.get(p.id) ?? null,
  }));

  const status = cs.status === "FINISHED" ? "finished" : "running";

  return {
    status,
    channelKey: CHANNEL_KEY,
    gameId: cs.gameId,
    handNumber: cs.handNumber,
    phase: (cs.phase as GamePhase) ?? "WAITING",
    smallBlind: cs.smallBlind,
    bigBlind: cs.bigBlind,
    button: cs.button,
    players,
    communityCards: cs.communityCards.map(mapCard),
    pots: mapPots(cs.pots),
    holeCards,
    speakingPlayerId: null,
    analysisText: null,
    isApiError: false,
    error: null,
  };
}
