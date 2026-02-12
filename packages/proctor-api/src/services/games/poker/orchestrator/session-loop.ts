import type { BlindLevel } from "../../../../game-config.js";
import { getAgentMessages } from "../../../../persistence.js";
import type { GameState } from "../../../../types.js";
import type { Session } from "../../../session/session-manager.js";
import type { AgentRunner, PlayerConfig } from "../agent-runner.js";
import {
  type GameAwardPayload,
  buildGameOver,
  buildGameStart,
} from "../instruction-builder.js";
import * as poker from "../poker-engine/index.js";
import { emit, updateGameState } from "./emitter.js";
import { playHand } from "./hand-loop.js";
import {
  type ActionTracker,
  createActionTracker,
  type SessionContext,
} from "./types.js";

function isGameOver(state: GameState): boolean {
  const activePlayers = state.players.filter((p) => p.status !== "BUSTED");
  return activePlayers.length <= 1;
}

function computeAwards(
  tracker: ActionTracker,
  players: GameState["players"],
): GameAwardPayload[] {
  const getName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id;

  const entries = [...tracker.entries()].map(([id, s]) => {
    const total = s.folds + s.calls + s.checks + s.bets + s.raises;
    return { id, stats: s, total };
  });

  if (entries.length === 0) return [];

  const awards: GameAwardPayload[] = [];

  /** Pick top scorers, including ties. */
  function topBy(
    sorted: typeof entries,
    score: (e: (typeof entries)[0]) => number,
  ): typeof entries {
    const best = score(sorted[0]);
    return sorted.filter((e) => score(e) === best);
  }

  // Most Aggressive — highest bet + raise count
  const aggressiveScore = (e: (typeof entries)[0]) =>
    e.stats.bets + e.stats.raises;
  const byAggressive = [...entries].sort(
    (a, b) => aggressiveScore(b) - aggressiveScore(a),
  );
  if (aggressiveScore(byAggressive[0]) > 0) {
    const top = topBy(byAggressive, aggressiveScore);
    const count = aggressiveScore(top[0]);
    awards.push({
      title: "Most Aggressive",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `${count} bets/raises`,
    });
  }

  // Most Passive — highest call + check count
  const passiveScore = (e: (typeof entries)[0]) =>
    e.stats.calls + e.stats.checks;
  const byPassive = [...entries].sort(
    (a, b) => passiveScore(b) - passiveScore(a),
  );
  if (passiveScore(byPassive[0]) > 0) {
    const top = topBy(byPassive, passiveScore);
    const count = passiveScore(top[0]);
    awards.push({
      title: "Most Passive",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `${count} calls/checks`,
    });
  }

  // Tightest — highest fold rate
  const withActions = entries.filter((e) => e.total > 0);
  const foldRate = (e: (typeof entries)[0]) =>
    e.total > 0 ? e.stats.folds / e.total : 0;
  const byTight = [...withActions].sort((a, b) => foldRate(b) - foldRate(a));
  if (byTight.length > 0 && byTight[0].stats.folds > 0) {
    const bestRate = foldRate(byTight[0]);
    const top = byTight.filter((e) => foldRate(e) === bestRate);
    const pct = Math.round(bestRate * 100);
    awards.push({
      title: "Tightest",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `${pct}% fold rate`,
    });
  }

  // Loosest — lowest fold rate
  const byLoose = [...withActions].sort((a, b) => foldRate(a) - foldRate(b));
  if (byLoose.length > 0) {
    const bestRate = foldRate(byLoose[0]);
    const top = byLoose.filter((e) => foldRate(e) === bestRate);
    const pct = Math.round(bestRate * 100);
    awards.push({
      title: "Loosest",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `${pct}% fold rate`,
    });
  }

  // Yolo — most all-ins
  const byAllIn = [...entries].sort(
    (a, b) => b.stats.allIns - a.stats.allIns,
  );
  if (byAllIn[0].stats.allIns > 0) {
    const top = topBy(byAllIn, (e) => e.stats.allIns);
    awards.push({
      title: "Yolo",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `${top[0].stats.allIns} all-ins`,
    });
  }

  // Biggest Pot Won
  const byBigPot = [...entries].sort(
    (a, b) => b.stats.biggestPotWon - a.stats.biggestPotWon,
  );
  if (byBigPot[0].stats.biggestPotWon > 0) {
    const top = topBy(byBigPot, (e) => e.stats.biggestPotWon);
    const amount = top[0].stats.biggestPotWon.toLocaleString();
    awards.push({
      title: "Biggest Pot Won",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `$${amount}`,
    });
  }

  // Most Hands Won
  const byHandsWon = [...entries].sort(
    (a, b) => b.stats.handsWon - a.stats.handsWon,
  );
  if (byHandsWon[0].stats.handsWon > 0) {
    const top = topBy(byHandsWon, (e) => e.stats.handsWon);
    awards.push({
      title: "Most Hands Won",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `${top[0].stats.handsWon} hands`,
    });
  }

  // Analysis Paralysis — longest average analysis
  const withAnalysis = entries.filter((e) => e.stats.analysisLengths.length > 0);
  const avgAnalysis = (e: (typeof entries)[0]) => {
    const lengths = e.stats.analysisLengths;
    return lengths.length > 0
      ? lengths.reduce((a, b) => a + b, 0) / lengths.length
      : 0;
  };
  const byLongAnalysis = [...withAnalysis].sort(
    (a, b) => avgAnalysis(b) - avgAnalysis(a),
  );
  if (byLongAnalysis.length > 0) {
    const bestAvg = avgAnalysis(byLongAnalysis[0]);
    const top = byLongAnalysis.filter((e) => avgAnalysis(e) === bestAvg);
    awards.push({
      title: "Analysis Paralysis",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `avg ${Math.round(bestAvg)} characters`,
    });
  }

  // Just Do It — shortest average analysis
  const byShortAnalysis = [...withAnalysis].sort(
    (a, b) => avgAnalysis(a) - avgAnalysis(b),
  );
  if (byShortAnalysis.length > 0) {
    const bestAvg = avgAnalysis(byShortAnalysis[0]);
    const top = byShortAnalysis.filter((e) => avgAnalysis(e) === bestAvg);
    awards.push({
      title: "Just Do It",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `avg ${Math.round(bestAvg)} characters`,
    });
  }

  // Bounty Hunter — most eliminations
  const byElim = [...entries].sort(
    (a, b) => b.stats.eliminations - a.stats.eliminations,
  );
  if (byElim[0].stats.eliminations > 0) {
    const top = topBy(byElim, (e) => e.stats.eliminations);
    awards.push({
      title: "Bounty Hunter",
      playerIds: top.map((e) => e.id),
      playerNames: top.map((e) => getName(e.id)),
      description: `${top[0].stats.eliminations} eliminations`,
    });
  }

  return awards;
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

    if (isGameOver(postHandState)) {
      const activePlayers = postHandState.players.filter(
        (p) => p.status !== "BUSTED",
      );
      const winner =
        activePlayers.sort((a, b) => b.chips - a.chips)[0] ??
        postHandState.players[0];

      const awards = computeAwards(ctx.actionTracker, postHandState.players);

      emit(
        moduleId,
        session,
        buildGameOver(
          winner.id,
          winner.name,
          postHandState.players,
          session.handNumber,
          awards,
        ),
      );

      session.status = "FINISHED";
      poker.deleteGame(ctx.gameId);
      return;
    }
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
    actionTracker: createActionTracker(),
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
    actionTracker: createActionTracker(),
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
