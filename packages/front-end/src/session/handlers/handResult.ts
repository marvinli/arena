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

  const winnerMap = new Map(hr.winners.map((w) => [w.playerId, w] as const));

  const players = buildPlayers(hr.players, state.button, state.players, (p) => {
    const win = winnerMap.get(p.id);
    if (win) {
      return {
        cards: state.holeCards.get(p.id) ?? null,
        lastAction: null as PlayerAction,
        isActive: false,
        isWinner: true,
        winAmount: win.amount,
        winHand: win.hand ?? null,
      };
    }
    // Non-winner who hasn't already folded → muck
    const alreadyFolded = p.isFolded;
    return {
      cards: state.holeCards.get(p.id) ?? null,
      lastAction: alreadyFolded
        ? (null as PlayerAction)
        : ("muck" as PlayerAction),
      isFolded: true,
      isActive: false,
      isWinner: false,
      winAmount: null,
      winHand: null,
    };
  });

  return {
    ...state,
    phase: "SHOWDOWN" as GamePhase,
    players,
    communityCards: hr.communityCards.map(mapCard),
    pots: mapPots(hr.pots),
  };
}
