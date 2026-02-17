import type { GamePhase, GameState, GameView } from "../../types";
import { CHANNEL_KEY } from "../config";
import { buildPlayerMetaMaps, mapCard, mapPlayers, mapPots } from "../mappers";
import type { GqlChannelState } from "../types";
import { buildHoleCards } from "./shared";

export function handleReconnect(cs: GqlChannelState): GameState {
  const { avatars, personas } = buildPlayerMetaMaps(cs.playerMeta);

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
    avatar: avatars.get(p.id) ?? "",
    persona: personas.get(p.id) ?? null,
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
    playerAvatars: avatars,
    playerPersonas: new Map(
      [...personas].filter((e): e is [string, string] => e[1] != null),
    ),
  };
}
