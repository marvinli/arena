import type { Session } from "../../../session/session-manager.js";
import type { AgentRunner } from "../agent-runner.js";

export const MAX_ACTION_RETRIES = 3;
export const MAX_LLM_RETRIES = 3;
export const LLM_RETRY_DELAY_MS = 2000;

export interface SessionContext {
  session: Session;
  moduleId: string;
  gameId: string;
  agentRunner: AgentRunner;
  signal: AbortSignal;
}
