import type { GamePhase, GameState } from "../../types";
import { mapPlayers } from "../mappers";
import type { GqlInstruction } from "../types";
import { resetForEndcard } from "./shared";

export function handleLeaderboard(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const lb = inst.leaderboard;
  if (!lb) return state;

  // Include ALL players (including busted) for the leaderboard
  const mapped = mapPlayers(lb.players, null, state.players);
  const players = resetForEndcard(mapped, state.playerAvatars, state.playerPersonas);

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
