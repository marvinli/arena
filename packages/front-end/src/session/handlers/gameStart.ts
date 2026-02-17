import type { GameState } from "../../types";
import { buildPlayerMetaMaps, mapPlayers } from "../mappers";
import type { GqlInstruction } from "../types";

export function handleGameStart(
  state: GameState,
  inst: GqlInstruction,
): GameState {
  const gs = inst.gameStart;
  if (!gs) return state;

  const { avatars, personas } = buildPlayerMetaMaps(gs.playerMeta ?? []);
  const players = mapPlayers(gs.players, null, []).map((p) => ({
    ...p,
    avatar: avatars.get(p.id) ?? "",
    persona: personas.get(p.id) ?? null,
  }));

  return {
    ...state,
    status: "running",
    currentView: "poker",
    gameId: gs.gameId,
    smallBlind: gs.smallBlind,
    bigBlind: gs.bigBlind,
    players,
    playerAvatars: avatars,
    playerPersonas: new Map(
      [...personas].filter((e): e is [string, string] => e[1] != null),
    ),
  };
}
