import type { Session } from "../../../session/session-manager.js";
import type { AgentRunner } from "../agent-runner.js";

export const MAX_ACTION_RETRIES = 3;
export const MAX_LLM_RETRIES = 3;
export const LLM_RETRY_DELAY_MS = 2000;

export interface PlayerActionStats {
  folds: number;
  calls: number;
  checks: number;
  bets: number;
  raises: number;
  allIns: number;
  handsWon: number;
  biggestPotWon: number;
  eliminations: number;
  analysisLengths: number[];
}

export type ActionTracker = Map<string, PlayerActionStats>;

export function createActionTracker(): ActionTracker {
  return new Map();
}

function getOrCreate(
  tracker: ActionTracker,
  playerId: string,
): PlayerActionStats {
  let stats = tracker.get(playerId);
  if (!stats) {
    stats = {
      folds: 0,
      calls: 0,
      checks: 0,
      bets: 0,
      raises: 0,
      allIns: 0,
      handsWon: 0,
      biggestPotWon: 0,
      eliminations: 0,
      analysisLengths: [],
    };
    tracker.set(playerId, stats);
  }
  return stats;
}

export function trackAction(
  tracker: ActionTracker,
  playerId: string,
  action: string,
  isAllIn?: boolean,
): void {
  const stats = getOrCreate(tracker, playerId);
  switch (action) {
    case "FOLD":
      stats.folds++;
      break;
    case "CALL":
      stats.calls++;
      break;
    case "CHECK":
      stats.checks++;
      break;
    case "BET":
      stats.bets++;
      break;
    case "RAISE":
      stats.raises++;
      break;
  }
  if (isAllIn) stats.allIns++;
}

export function trackHandWin(
  tracker: ActionTracker,
  playerId: string,
  potAmount: number,
): void {
  const stats = getOrCreate(tracker, playerId);
  stats.handsWon++;
  if (potAmount > stats.biggestPotWon) stats.biggestPotWon = potAmount;
}

export function trackElimination(
  tracker: ActionTracker,
  eliminatorId: string,
): void {
  const stats = getOrCreate(tracker, eliminatorId);
  stats.eliminations++;
}

export function trackAnalysis(
  tracker: ActionTracker,
  playerId: string,
  analysisLength: number,
): void {
  const stats = getOrCreate(tracker, playerId);
  stats.analysisLengths.push(analysisLength);
}

export interface SessionContext {
  session: Session;
  moduleId: string;
  gameId: string;
  agentRunner: AgentRunner;
  signal: AbortSignal;
  actionTracker: ActionTracker;
}
