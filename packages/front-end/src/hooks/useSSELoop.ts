import { useCallback } from "react";
import { gqlFetch } from "../graphql/client";
import {
  RENDER_COMPLETE_MUT,
  RENDER_INSTRUCTIONS_SUB,
} from "../graphql/operations";
import { CHANNEL_KEY, delay } from "../session/config";
import type { Action } from "../session/reducer";
import { createRenderQueue } from "../session/renderQueue";
import { fetchChannelState, sseSubscribe } from "../session/sseClient";

/**
 * Encapsulates the SSE subscribe → ack → drain loop with reconnection logic.
 * Returns a stable `startSSELoop` callback.
 */
export function useSSELoop(dispatch: (action: Action) => void) {
  const startSSELoop = useCallback(
    function startSSELoop(
      abort: AbortController,
      voiceMap: Map<string, string>,
      onConnected?: () => void,
    ) {
      const rq = createRenderQueue({
        dispatch,
        voiceMap,
        signal: abort.signal,
      });

      // ── SSE consumer — acks immediately for pipelining ─
      void (async () => {
        try {
          for await (const instruction of sseSubscribe(
            RENDER_INSTRUCTIONS_SUB,
            { channelKey: CHANNEL_KEY },
            abort.signal,
            onConnected,
          )) {
            rq.push(instruction);

            // Ack immediately so the proctor can pipeline the
            // next LLM call while we render at our own pace.
            await gqlFetch(RENDER_COMPLETE_MUT, {
              channelKey: CHANNEL_KEY,
              instructionId: instruction.instructionId,
            });
          }

          // SSE stream ended normally — check if game is still running
          if (!abort.signal.aborted) {
            const cs = await fetchChannelState();
            if (cs.status === "RUNNING") {
              startSSELoop(abort, voiceMap);
            } else if (cs.status === "FINISHED") {
              dispatch({ type: "RECONNECT", channelState: cs });
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (abort.signal.aborted) return;

          // SSE dropped — attempt to reconnect
          console.warn("[useSSELoop] SSE dropped, attempting reconnect…");
          try {
            await delay(1000, abort.signal);
            if (abort.signal.aborted) return;

            const cs = await fetchChannelState();
            if (cs.status === "RUNNING") {
              for (const meta of cs.playerMeta) {
                if (meta.ttsVoice) voiceMap.set(meta.id, meta.ttsVoice);
              }
              dispatch({ type: "RECONNECT", channelState: cs });
              startSSELoop(abort, voiceMap);
            } else if (cs.status === "FINISHED") {
              dispatch({ type: "RECONNECT", channelState: cs });
            } else {
              const message = err instanceof Error ? err.message : String(err);
              dispatch({ type: "ERROR", error: message });
            }
          } catch {
            const message = err instanceof Error ? err.message : String(err);
            dispatch({ type: "ERROR", error: message });
          }
        }
      })();
    },
    [dispatch],
  );

  return startSSELoop;
}
