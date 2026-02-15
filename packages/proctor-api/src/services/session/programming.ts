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
async function detectOrphanedModule(
  channelKey: string,
): Promise<{ moduleId: string; snapshot: RecoverySnapshot } | null> {
  const channelState = await getChannelState(channelKey);
  if (!channelState) return null;

  const mod = await getModule(channelState.moduleId);
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
    await completeModule(channelState.moduleId);
    return null;
  }
}

/** Channels that already have an active programming loop. */
const activeLoops = new Set<string>();

export async function runProgrammingLoop(
  channelKey: string,
  startIndex = 0,
): Promise<void> {
  if (activeLoops.has(channelKey)) return;
  activeLoops.add(channelKey);

  try {
    let index = startIndex;

    // Check for orphaned session from a previous crash
    const recovery = await detectOrphanedModule(channelKey);
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

      await completeModule(recovery.moduleId);
      deleteSession(channelKey);
      index++;
    }

    // Run games while live — each iteration waits for client ACKs
    // (GAME_START ack before playing, GAME_OVER ack before next module)
    while ((await getSetting(`live:${channelKey}`)) === "true") {
      const moduleType = PROGRAMMING[index % PROGRAMMING.length];
      const moduleId = crypto.randomUUID();
      await createModule(moduleId, moduleType, index % PROGRAMMING.length);
      await upsertChannelState(channelKey, moduleId);

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

      await completeModule(moduleId);
      deleteSession(channelKey);
      index++;
    }

    console.log("[programming-loop] Live is off, stopping loop");
  } finally {
    activeLoops.delete(channelKey);
  }
}

export function _resetActiveLoops(): void {
  activeLoops.clear();
}
