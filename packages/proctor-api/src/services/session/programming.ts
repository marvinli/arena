import { logError } from "../../logger.js";
import {
  completeModule,
  createModule,
  getChannelState,
  getModule,
  getSetting,
  upsertChannelState,
} from "../../persistence.js";
import { LlmAgentRunner } from "../games/poker/llm-agent-runner.js";
import {
  type RecoverySnapshot,
  resumeSession,
  runSession,
} from "../games/poker/orchestrator/index.js";
import { createSession, deleteSession } from "./session-manager.js";

export type ModuleType = "poker";

export const PROGRAMMING: ModuleType[] = ["poker"];

/**
 * Check for an orphaned running module on this channel and recover if possible.
 * Returns the recovery info or null if no recovery is needed.
 */
function detectOrphanedModule(
  channelKey: string,
): { moduleId: string; snapshot: RecoverySnapshot } | null {
  const channelState = getChannelState(channelKey);
  if (!channelState) return null;

  const mod = getModule(channelState.moduleId);
  if (!mod || mod.status !== "running") return null;

  if (!channelState.stateSnapshot) return null;

  try {
    const snapshot = JSON.parse(channelState.stateSnapshot) as Record<
      string,
      unknown
    >;
    const players = snapshot.players as RecoverySnapshot["players"] | undefined;
    const handNumber = snapshot.handNumber as number | undefined;

    if (!players || !Array.isArray(players) || handNumber == null) return null;

    console.log(
      `[programming-loop] Detected orphaned module ${channelState.moduleId} at hand ${handNumber}`,
    );

    return {
      moduleId: channelState.moduleId,
      snapshot: { handNumber, players },
    };
  } catch {
    console.warn(
      `[programming-loop] Corrupt snapshot for orphaned module ${channelState.moduleId}, skipping recovery`,
    );
    completeModule(channelState.moduleId);
    return null;
  }
}

export async function runProgrammingLoop(
  channelKey: string,
  startIndex = 0,
): Promise<void> {
  let index = startIndex;

  // Check for orphaned session from a previous crash
  const recovery = detectOrphanedModule(channelKey);
  if (recovery) {
    const chipOverrides = new Map(
      recovery.snapshot.players.map((p) => [p.id, p.chips]),
    );
    const session = createSession(channelKey, undefined, chipOverrides);
    const agentRunner = new LlmAgentRunner();

    try {
      await resumeSession(
        session,
        agentRunner,
        recovery.moduleId,
        recovery.snapshot,
      );
    } catch (err) {
      logError(
        "programming-loop",
        `Resumed module ${recovery.moduleId} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    completeModule(recovery.moduleId);
    deleteSession(channelKey);
  }

  while (true) {
    // Pause while live flag is off
    while (getSetting("live") !== "true") {
      await new Promise((r) => setTimeout(r, 5000));
    }

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
