import type { GamePhase, GameState, PlayerAction } from "../../types";
import { mapPots } from "../mappers";
import type { GqlInstruction } from "../types";
import { buildHoleCards, buildPlayers } from "./shared";

export function handleDealHands(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const dh = inst.dealHands;
  if (!dh) return state;

  const holeCards = buildHoleCards(dh.hands);
  const players = buildPlayers(dh.players, dh.button, state.players, (p) => ({
    cards: holeCards.get(p.id) ?? null,
    lastAction: null as PlayerAction,
    isActive: false,
  }));

  return {
    ...state,
    handNumber: dh.handNumber,
    phase: "PREFLOP" as GamePhase,
    currentView: "poker",
    button: dh.button,
    players,
    communityCards: [],
    pots: mapPots(dh.pots),
    holeCards,
    ...(dh.smallBlind != null && { smallBlind: dh.smallBlind }),
    ...(dh.bigBlind != null && { bigBlind: dh.bigBlind }),
  };
}
