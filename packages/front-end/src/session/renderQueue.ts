import { speakAnalysis } from "../tts";
import { delay } from "./config";
import type { Action } from "./reducer";
import {
  communityAnimDuration,
  dealAnimDuration,
  LEADERBOARD_DISPLAY_MS,
  SHOWDOWN_DISPLAY_MS,
} from "./timing";
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
  let animGate: Promise<void> = Promise.resolve();
  let prevCommunityCardCount = 0;

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

          // Wait for in-flight deal/display animation to complete
          await animGate;

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

          // Set animation gate after deal instructions
          if (inst.type === "DEAL_HANDS") {
            prevCommunityCardCount = 0;
            const playerCount = inst.dealHands?.hands?.length ?? 0;
            animGate = delay(dealAnimDuration(playerCount), deps.signal);
          } else if (inst.type === "DEAL_COMMUNITY") {
            const totalCards = inst.dealCommunity?.communityCards?.length ?? 0;
            const newCards = totalCards - prevCommunityCardCount;
            prevCommunityCardCount = totalCards;
            animGate = delay(communityAnimDuration(newCards), deps.signal);
          } else if (inst.type === "HAND_RESULT") {
            animGate = delay(SHOWDOWN_DISPLAY_MS, deps.signal);
          } else if (inst.type === "LEADERBOARD") {
            animGate = delay(LEADERBOARD_DISPLAY_MS, deps.signal);
          }

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
