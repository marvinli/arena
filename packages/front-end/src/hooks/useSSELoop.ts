import { useCallback } from "react";
import { gqlFetch } from "../graphql/client";
import {
  COMPLETE_INSTRUCTION_MUT,
  CONNECT_QUERY,
  RENDER_INSTRUCTIONS_SUB,
} from "../graphql/operations";
import { CHANNEL_KEY, delay } from "../session/config";
import type { Action } from "../session/reducer";
import { createRenderQueue } from "../session/renderQueue";
import { sseSubscribe } from "../session/sseClient";
import type { GqlChannelState } from "../session/types";

interface ConnectResult {
  moduleId: string;
  moduleType: string;
  gameState: GqlChannelState | null;
}

/**
 * Encapsulates the SSE subscribe -> ack -> drain loop with reconnection logic.
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
        onProcessed: (instruction) => {
          // Ack after the render queue has finished processing
          // (animations + TTS) so the pointer reflects what's
          // actually been rendered. Fire-and-forget is fine here.
          void gqlFetch(COMPLETE_INSTRUCTION_MUT, {
            channelKey: CHANNEL_KEY,
            moduleId: instruction.moduleId,
            instructionId: instruction.instructionId,
          });
        },
      });

      // ── SSE consumer ─────────────────────────────────────
      void (async () => {
        try {
          for await (const instruction of sseSubscribe(
            RENDER_INSTRUCTIONS_SUB,
            { channelKey: CHANNEL_KEY },
            abort.signal,
            onConnected,
          )) {
            rq.push(instruction);
          }

          // SSE stream ended normally — reconnect
          if (!abort.signal.aborted) {
            const result = await gqlFetch(CONNECT_QUERY, {
              channelKey: CHANNEL_KEY,
            });
            const conn = (result as { connect: ConnectResult }).connect;
            const gs = conn.gameState;
            if (gs) {
              for (const meta of gs.playerMeta ?? []) {
                if (meta.ttsVoice) voiceMap.set(meta.id, meta.ttsVoice);
              }
              dispatch({ type: "RECONNECT", channelState: gs });
            }
            startSSELoop(abort, voiceMap, onConnected);
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (abort.signal.aborted) return;

          // SSE dropped — attempt to reconnect
          console.warn("[useSSELoop] SSE dropped, attempting reconnect…");
          try {
            await delay(1000, abort.signal);
            if (abort.signal.aborted) return;

            const result = await gqlFetch(CONNECT_QUERY, {
              channelKey: CHANNEL_KEY,
            });
            const conn = (result as { connect: ConnectResult }).connect;
            const gs = conn.gameState;
            if (gs) {
              for (const meta of gs.playerMeta ?? []) {
                if (meta.ttsVoice) voiceMap.set(meta.id, meta.ttsVoice);
              }
              dispatch({ type: "RECONNECT", channelState: gs });
              if (gs.status === "FINISHED") return;
            }
            startSSELoop(abort, voiceMap, onConnected);
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
