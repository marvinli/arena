import type { GameState } from "../../types";
import type { GqlInstruction } from "../types";

export function handlePlayerTurn(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const pt = inst.playerTurn;
  if (!pt) return state;

  const players = state.players.map((p) => ({
    ...p,
    isActive: p.id === pt.playerId,
  }));

  return { ...state, players };
}
