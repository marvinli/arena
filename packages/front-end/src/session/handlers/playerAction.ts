import type { GameState, PlayerAction } from "../../types";
import { mapPots } from "../mappers";
import type { GqlInstruction } from "../types";
import { buildPlayers } from "./shared";

export function handlePlayerAction(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const pa = inst.playerAction;
  if (!pa) return state;

  const players = buildPlayers(pa.players, state.button, state.players, (p) => {
    if (p.id === pa.playerId) {
      return {
        lastAction: pa.action as PlayerAction,
        isActive: false,
      };
    }
    return {};
  });

  return {
    ...state,
    players,
    pots: mapPots(pa.pots),
  };
}
