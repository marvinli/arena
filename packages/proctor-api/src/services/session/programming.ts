import { logError } from "../../logger.js";
import {
  completeModule,
  createModule,
  upsertChannelState,
} from "../../persistence.js";
import { LlmAgentRunner } from "../games/poker/llm-agent-runner.js";
import { runSession } from "../games/poker/orchestrator/index.js";
import { createSession, deleteSession } from "./session-manager.js";

export type ModuleType = "poker";

export const PROGRAMMING: ModuleType[] = ["poker"];

export async function runProgrammingLoop(
  channelKey: string,
  startIndex = 0,
): Promise<void> {
  let index = startIndex;

  while (true) {
    const moduleType = PROGRAMMING[index % PROGRAMMING.length];
    const moduleId = crypto.randomUUID();
    createModule(moduleId, moduleType, index % PROGRAMMING.length);
    upsertChannelState(channelKey, moduleId);

    const session = createSession(channelKey);
    const agentRunner = new LlmAgentRunner();

    try {
      await runSession(session, agentRunner, moduleId);
    } catch (err) {
      logError(
        "programming-loop",
        `Module ${moduleId} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    completeModule(moduleId);
    deleteSession(channelKey);
    index++;
  }
}
