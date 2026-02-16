import type { GameAward, GameState } from "../../types";
import { mapPlayers } from "../mappers";
import type { GqlInstruction } from "../types";
import { resetForEndcard } from "./shared";

export function handleGameOver(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const go = inst.gameOver;
  if (!go) return state;

  // Include ALL players (including busted) for the endcard
  const mapped = mapPlayers(go.players, null, state.players);
  const players = resetForEndcard(mapped, state.playerAvatars);

  return {
    ...state,
    status: "finished",
    currentView: "endcard",
    players,
    awards: (go.awards ?? []) as GameAward[],
  };
}
