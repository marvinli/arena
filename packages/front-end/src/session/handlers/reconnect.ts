import type { GamePhase, GameState, GameView } from "../../types";
import { CHANNEL_KEY } from "../config";
import { mapCard, mapPlayers, mapPots } from "../mappers";
import type { GqlChannelState } from "../types";
import { buildHoleCards } from "./shared";

export function handleReconnect(cs: GqlChannelState): GameState {
  const playerAvatars = new Map(
    cs.playerMeta.map((m) => [m.id, m.avatarUrl ?? ""]),
  );
  const playerPersonas = new Map(
    cs.playerMeta.map((m) => [m.id, m.persona ?? null]),
  );

  const holeCards = buildHoleCards(cs.hands);

  const status = cs.status === "FINISHED" ? "finished" : "running";
  const currentView: GameView =
    cs.phase === "WAITING" || cs.status === "FINISHED" ? "endcard" : "poker";

  // Include all players on endcard; filter busted during active play
  const rawPlayers =
    currentView === "endcard"
      ? cs.players
      : cs.players.filter((p) => p.status !== "BUSTED");
  const players = mapPlayers(rawPlayers, cs.button, []).map((p) => ({
    ...p,
    avatar: playerAvatars.get(p.id) ?? "",
    persona: playerPersonas.get(p.id) ?? null,
    cards: holeCards.get(p.id) ?? null,
  }));

  return {
    status,
    currentView,
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
    awards: [],
    playerAvatars,
  };
}
