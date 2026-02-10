import type { GamePhase, GameState, PlayerAction } from "../../types";
import { mapCard, mapPots } from "../mappers";
import type { GqlInstruction } from "../types";

export function handleDealCommunity(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const dc = inst.dealCommunity;
  if (!dc) return state;

  const players = state.players.map((p) => ({
    ...p,
    lastAction: null as PlayerAction,
    currentBet: 0,
    isActive: false,
  }));

  return {
    ...state,
    phase: dc.phase as GamePhase,
    communityCards: dc.communityCards.map(mapCard),
    pots: mapPots(dc.pots),
    players,
  };
}
