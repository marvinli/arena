import type { GamePhase, GameState, PlayerAction } from "../../types";
import { mapCard, mapPots } from "../mappers";
import type { GqlInstruction } from "../types";
import { buildPlayers } from "./shared";

export function handleHandResult(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const hr = inst.handResult;
  if (!hr) return state;

  const players = buildPlayers(
    hr.players,
    state.button,
    state.players,
    (p) => ({
      cards: state.holeCards.get(p.id) ?? null,
      lastAction: null as PlayerAction,
      isActive: false,
    }),
  );

  return {
    ...state,
    phase: "SHOWDOWN" as GamePhase,
    players,
    communityCards: hr.communityCards.map(mapCard),
    pots: mapPots(hr.pots),
  };
}
