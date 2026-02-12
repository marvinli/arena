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
}

export type ActionTracker = Map<string, PlayerActionStats>;

export function createActionTracker(): ActionTracker {
  return new Map();
}

export function trackAction(
  tracker: ActionTracker,
  playerId: string,
  action: string,
): void {
  let stats = tracker.get(playerId);
  if (!stats) {
    stats = { folds: 0, calls: 0, checks: 0, bets: 0, raises: 0 };
    tracker.set(playerId, stats);
  }
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
}

export interface SessionContext {
  session: Session;
  moduleId: string;
  gameId: string;
  agentRunner: AgentRunner;
  signal: AbortSignal;
  actionTracker: ActionTracker;
}
