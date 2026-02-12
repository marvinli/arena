import type { Card, GameAward, GameState, PlayerAction } from "../../types";
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

  const awards: GameAward[] = (go.awards ?? []).map(
    (a: {
      title: string;
      playerIds: string[];
      playerNames: string[];
      description: string;
    }) => ({
      title: a.title,
      playerIds: a.playerIds,
      playerNames: a.playerNames,
      description: a.description,
    }),
  );

  return {
    ...state,
    status: "finished",
    currentView: "endcard",
    players,
    awards,
  };
}
