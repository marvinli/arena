import { speakAnalysis } from "../tts";
import { delay, INSTRUCTION_DELAYS } from "./config";
import type { Action } from "./reducer";
import type { GqlInstruction } from "./types";

export interface RenderQueueDeps {
  dispatch: (action: Action) => void;
  voiceMap: Map<string, string>;
  signal: AbortSignal;
}

export function createRenderQueue(deps: RenderQueueDeps) {
  const queue: GqlInstruction[] = [];
  let draining = false;
  let ttsGate: Promise<void> = Promise.resolve();

  function push(instruction: GqlInstruction) {
    queue.push(instruction);
    startDrain();
  }

  function startDrain() {
    if (draining) return;
    draining = true;
    void (async () => {
      try {
        while (queue.length > 0) {
          if (deps.signal.aborted) break;
          const inst = queue.shift();
          if (!inst) continue;

          // Wait for in-flight TTS before showing analysis or action
          if (
            inst.type === "PLAYER_ANALYSIS" ||
            inst.type === "PLAYER_ACTION"
          ) {
            await ttsGate;
          }

          // Capture player metadata before dispatching
          if (inst.gameStart?.playerMeta) {
            for (const meta of inst.gameStart.playerMeta) {
              if (meta.ttsVoice) deps.voiceMap.set(meta.id, meta.ttsVoice);
            }
          }

          deps.dispatch({ type: "INSTRUCTION", instruction: inst });

          const pauseMs = INSTRUCTION_DELAYS[inst.type] ?? 1000;
          await delay(pauseMs, deps.signal);

          // Fire-and-forget TTS after dispatching analysis
          if (
            inst.type === "PLAYER_ANALYSIS" &&
            inst.playerAnalysis?.analysis
          ) {
            const { playerId, analysis, isApiError } = inst.playerAnalysis;
            const voiceId = deps.voiceMap.get(playerId) ?? "";
            deps.dispatch({
              type: "SPEAK_START",
              playerId,
              text: analysis,
              isApiError,
            });
            ttsGate = speakAnalysis(analysis, voiceId).then(
              () => deps.dispatch({ type: "SPEAK_END" }),
              () => deps.dispatch({ type: "SPEAK_END" }),
            );
          }
        }
      } finally {
        draining = false;
      }
    })();
  }

  return { push };
}
