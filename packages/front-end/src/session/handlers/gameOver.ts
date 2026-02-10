import type { Card, GameState, PlayerAction } from "../../types";
import type { GqlInstruction } from "../types";
import { buildPlayers } from "./shared";

export function handleGameOver(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const go = inst.gameOver;
  if (!go) return state;

  const players = buildPlayers(go.players, null, state.players, () => ({
    cards: null as [Card, Card] | null,
    lastAction: null as PlayerAction,
    isActive: false,
  }));

  return {
    ...state,
    status: "finished",
    players,
  };
}
