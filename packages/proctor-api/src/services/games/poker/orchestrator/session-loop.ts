import type { GameState } from "../../../../types.js";
import type { Session } from "../../../session/session-manager.js";
import type { AgentRunner, PlayerConfig } from "../agent-runner.js";
import {
  buildGameOver,
  buildGameStart,
  buildLeaderboard,
} from "../instruction-builder.js";
import * as poker from "../poker-engine/index.js";
import { emit, updateGameState } from "./emitter.js";
import { playHand } from "./hand-loop.js";
import type { SessionContext } from "./types.js";

function isGameOver(
  state: GameState,
  handsPerGame: number | null | undefined,
  handNumber: number,
): boolean {
  const activePlayers = state.players.filter((p) => p.status !== "BUSTED");
  if (activePlayers.length <= 1) return true;
  if (handsPerGame && handNumber >= handsPerGame) return true;
  return false;
}

function buildPlayerConfig(agentConfig: {
  playerId: string;
  name: string;
  modelId: string;
  modelName: string;
  provider: string;
  avatarUrl?: string | null;
  ttsVoice?: string | null;
  temperature?: number | null;
}): PlayerConfig {
  return {
    id: agentConfig.playerId,
    name: agentConfig.name,
    modelId: agentConfig.modelId,
    modelName: agentConfig.modelName,
    provider: agentConfig.provider,
    avatarUrl: agentConfig.avatarUrl ?? undefined,
    ttsVoice: agentConfig.ttsVoice ?? undefined,
    temperature: agentConfig.temperature ?? undefined,
  };
}

export async function runSession(
  session: Session,
  agentRunner: AgentRunner,
  moduleId: string,
): Promise<void> {
  const signal = session.abortController.signal;

  const gameId = poker.createGame({
    players: session.config.players.map((p) => ({
      id: p.playerId,
      name: `${p.name} ${p.modelName}`,
      chips: session.config.startingChips,
    })),
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
  });

  const ctx: SessionContext = {
    session,
    moduleId,
    gameId,
    agentRunner,
    signal,
  };

  const createState = poker.getGameState(gameId);
  session.gameId = gameId;
  updateGameState(session, createState);

  for (const p of session.config.players) {
    agentRunner.initAgent(p.playerId, buildPlayerConfig(p), moduleId);
  }

  emit(
    moduleId,
    session,
    buildGameStart(
      gameId,
      createState.players,
      {
        smallBlind: session.config.smallBlind,
        bigBlind: session.config.bigBlind,
      },
      session.config.players,
    ),
  );

  while (!signal.aborted) {
    await playHand(ctx);

    if (signal.aborted) break;

    const postHandState = poker.getGameState(gameId);
    updateGameState(session, postHandState);

    if (
      isGameOver(postHandState, session.config.handsPerGame, session.handNumber)
    ) {
      const activePlayers = postHandState.players.filter(
        (p) => p.status !== "BUSTED",
      );
      const winner =
        activePlayers.sort((a, b) => b.chips - a.chips)[0] ??
        postHandState.players[0];

      emit(
        moduleId,
        session,
        buildGameOver(
          winner.id,
          winner.name,
          postHandState.players,
          session.handNumber,
        ),
      );

      session.status = "FINISHED";
      poker.deleteGame(gameId);
      return;
    }

    emit(
      moduleId,
      session,
      buildLeaderboard(postHandState.players, session.handNumber),
    );
  }

  if (session.status === "RUNNING") {
    session.status = "STOPPED";
  }

  poker.deleteGame(gameId);
}
