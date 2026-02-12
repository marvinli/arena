import type { Card, GameAward, GameState, PlayerAction } from "../../types";
import { mapPlayers } from "../mappers";
import type { GqlInstruction } from "../types";

export function handleGameOver(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const go = inst.gameOver;
  if (!go) return state;

  // Include ALL players (including busted) for the endcard
  const players = mapPlayers(go.players, null, state.players).map((p) => ({
    ...p,
    cards: null as [Card, Card] | null,
    lastAction: null as PlayerAction,
    isActive: false,
    avatar: state.playerAvatars.get(p.id) ?? p.avatar,
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
