import type { Card, GamePhase, GameState, PlayerAction } from "../../types";
import { mapPlayers } from "../mappers";
import type { GqlInstruction } from "../types";

export function handleLeaderboard(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const lb = inst.leaderboard;
  if (!lb) return state;

  // Include ALL players (including busted) for the leaderboard
  const players = mapPlayers(lb.players, null, state.players).map((p) => ({
    ...p,
    cards: null as [Card, Card] | null,
    lastAction: null as PlayerAction,
    isActive: false,
    isDealer: false,
    avatar: state.playerAvatars.get(p.id) ?? p.avatar,
  }));

  return {
    ...state,
    phase: "WAITING" as GamePhase,
    currentView: "endcard",
    players,
    communityCards: [],
    pots: [],
    button: null,
    holeCards: new Map(),
    ...(lb.smallBlind != null && { smallBlind: lb.smallBlind }),
    ...(lb.bigBlind != null && { bigBlind: lb.bigBlind }),
  };
}
