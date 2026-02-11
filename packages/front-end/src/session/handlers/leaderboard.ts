import type { Card, GamePhase, GameState, PlayerAction } from "../../types";
import type { GqlInstruction } from "../types";
import { buildPlayers } from "./shared";

export function handleLeaderboard(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const lb = inst.leaderboard;
  if (!lb) return state;

  const players = buildPlayers(lb.players, null, state.players, () => ({
    cards: null as [Card, Card] | null,
    lastAction: null as PlayerAction,
    isActive: false,
    isDealer: false,
  }));

  return {
    ...state,
    phase: "WAITING" as GamePhase,
    currentView: "leaderboard",
    players,
    communityCards: [],
    pots: [],
    button: null,
    holeCards: new Map(),
  };
}
