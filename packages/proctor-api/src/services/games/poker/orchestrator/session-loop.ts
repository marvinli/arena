import type { BlindLevel } from "../../../../game-config.js";
import { getAgentMessages } from "../../../../persistence.js";
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

function isGameOver(state: GameState): boolean {
  const activePlayers = state.players.filter((p) => p.status !== "BUSTED");
  return activePlayers.length <= 1;
}

/** Returns the blind level for the given hand number based on the schedule. */
export function getBlindLevel(
  handNumber: number,
  schedule: BlindLevel[],
  handsPerLevel: number,
): BlindLevel {
  const levelIndex = Math.floor((handNumber - 1) / handsPerLevel);
  const clamped = Math.min(levelIndex, schedule.length - 1);
  return schedule[clamped];
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

/** Apply blind escalation if schedule is configured. */
function applyBlindEscalation(ctx: SessionContext): void {
  const { session } = ctx;
  const { blindSchedule, handsPerLevel } = session.config;
  if (!blindSchedule || !handsPerLevel) return;

  const level = getBlindLevel(
    session.handNumber + 1,
    blindSchedule,
    handsPerLevel,
  );
  if (
    level.smallBlind !== session.config.smallBlind ||
    level.bigBlind !== session.config.bigBlind
  ) {
    poker.setBlinds(ctx.gameId, level.smallBlind, level.bigBlind);
    session.config.smallBlind = level.smallBlind;
    session.config.bigBlind = level.bigBlind;
  }
}

/** Shared hand loop — plays hands until game over or abort. */
async function runHandLoop(ctx: SessionContext): Promise<void> {
  const { session, moduleId, signal } = ctx;

  while (!signal.aborted) {
    applyBlindEscalation(ctx);
    await playHand(ctx);

    if (signal.aborted) break;

    const postHandState = poker.getGameState(ctx.gameId);
    updateGameState(session, postHandState);

    if (
      isGameOver(postHandState)
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
      poker.deleteGame(ctx.gameId);
      return;
    }

    emit(
      moduleId,
      session,
      buildLeaderboard(postHandState.players, session.handNumber, {
        smallBlind: session.config.smallBlind,
        bigBlind: session.config.bigBlind,
      }),
    );
  }

  if (session.status === "RUNNING") {
    session.status = "STOPPED";
  }

  poker.deleteGame(ctx.gameId);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function runSession(
  session: Session,
  agentRunner: AgentRunner,
  moduleId: string,
): Promise<void> {
  const signal = session.abortController.signal;

  const shuffledPlayers = shuffle(session.config.players);

  const gameId = poker.createGame({
    players: shuffledPlayers.map((p) => ({
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

  const tournamentInfo = {
    startingChips: session.config.startingChips,
    blindSchedule: session.config.blindSchedule,
    handsPerLevel: session.config.handsPerLevel,
  };

  for (const p of session.config.players) {
    agentRunner.initAgent(
      p.playerId,
      buildPlayerConfig(p),
      moduleId,
      tournamentInfo,
    );
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

  await runHandLoop(ctx);
}

export interface RecoverySnapshot {
  handNumber: number;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    status: string;
  }>;
}

export async function resumeSession(
  session: Session,
  agentRunner: AgentRunner,
  moduleId: string,
  snapshot: RecoverySnapshot,
): Promise<void> {
  const signal = session.abortController.signal;

  // Filter to non-busted players with chips
  const activePlayers = snapshot.players.filter(
    (p) => p.status !== "BUSTED" && p.chips > 0,
  );

  if (activePlayers.length < 2) {
    console.log(
      "[session-loop] Not enough active players to resume, starting fresh",
    );
    return runSession(session, agentRunner, moduleId);
  }

  // Create poker game with recovered chip stacks
  const gameId = poker.createGame({
    players: session.config.players.flatMap((p) => {
      const sp = activePlayers.find((ap) => ap.id === p.playerId);
      if (!sp) return [];
      return [
        {
          id: p.playerId,
          name: `${p.name} ${p.modelName}`,
          chips: sp.chips,
        },
      ];
    }),
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
  session.handNumber = snapshot.handNumber;
  updateGameState(session, createState);

  // Initialize agents and restore conversation history
  const recoveryTournamentInfo = {
    startingChips: session.config.startingChips,
    blindSchedule: session.config.blindSchedule,
    handsPerLevel: session.config.handsPerLevel,
  };
  for (const p of session.config.players) {
    agentRunner.initAgent(
      p.playerId,
      buildPlayerConfig(p),
      moduleId,
      recoveryTournamentInfo,
    );
    if (agentRunner.restoreMessages) {
      const messages = getAgentMessages(moduleId, p.playerId);
      if (messages.length > 0) {
        agentRunner.restoreMessages(
          p.playerId,
          messages.map((m) => ({ role: m.role, content: m.content })),
        );
      }
    }
  }

  console.log(
    `[session-loop] Resuming session from hand ${snapshot.handNumber} with ${activePlayers.length} players`,
  );

  // Emit GAME_START so front-end resets cleanly
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

  await runHandLoop(ctx);
}
