import type { GameState } from "../../types";
import { mapPlayers } from "../mappers";
import type { GqlInstruction } from "../types";

export function handleGameStart(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const gs = inst.gameStart;
  if (!gs) return state;

  const playerAvatars = new Map(
    (gs.playerMeta ?? []).map((m) => [m.id, m.avatarUrl ?? ""]),
  );
  const playerPersonas = new Map(
    (gs.playerMeta ?? []).map((m) => [m.id, m.persona ?? null]),
  );
  const players = mapPlayers(gs.players, null, []).map((p) => ({
    ...p,
    avatar: playerAvatars.get(p.id) ?? "",
    persona: playerPersonas.get(p.id) ?? null,
  }));

  return {
    ...state,
    status: "running",
    currentView: "poker",
    gameId: gs.gameId,
    smallBlind: gs.smallBlind,
    bigBlind: gs.bigBlind,
    players,
    playerAvatars,
  };
}
