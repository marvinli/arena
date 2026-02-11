import type { GameState } from "../../types";
import { mapPlayers } from "../mappers";
import type { GqlInstruction } from "../types";

export function handleGameStart(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const gs = inst.gameStart;
  if (!gs) return state;

  const avatarMap = new Map(
    (gs.playerMeta ?? []).map((m) => [m.id, m.avatarUrl ?? ""]),
  );
  const players = mapPlayers(gs.players, null, []).map((p) => ({
    ...p,
    avatar: avatarMap.get(p.id) ?? "",
  }));

  return {
    ...state,
    status: "running",
    currentView: "poker",
    gameId: gs.gameId,
    smallBlind: gs.smallBlind,
    bigBlind: gs.bigBlind,
    players,
  };
}
