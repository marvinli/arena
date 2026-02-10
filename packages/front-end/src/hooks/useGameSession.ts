import { useCallback, useEffect, useReducer, useRef } from "react";
import { gqlFetch } from "../graphql/client";
import {
  RENDER_COMPLETE_MUT,
  RENDER_INSTRUCTIONS_SUB,
  RUN_SESSION_MUT,
  START_SESSION_MUT,
  STOP_SESSION_MUT,
} from "../graphql/operations";
import { CHANNEL_KEY, DEFAULT_CONFIG, delay } from "../session/config";
import { INITIAL_STATE, reducer } from "../session/reducer";
import { createRenderQueue } from "../session/renderQueue";
import { fetchChannelState, sseSubscribe } from "../session/sseClient";

// ── Hook ────────────────────────────────────────────────

export function useGameSession() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  /** Start SSE loop: subscribe, ack, and drain render queue. */
  const startSSELoop = useCallback(function startSSELoop(
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
        console.warn("[useGameSession] SSE dropped, attempting reconnect…");
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
  }, []);

  const startGame = useCallback(async () => {
    dispatch({ type: "START", channelKey: CHANNEL_KEY });

    try {
      // Check for an existing running session
      const cs = await fetchChannelState();

      const abort = new AbortController();
      abortRef.current = abort;

      if (cs.status === "RUNNING" || cs.status === "FINISHED") {
        // ── Reconnect to existing session ──────────────
        const voiceMap = new Map<string, string>();
        for (const meta of cs.playerMeta) {
          if (meta.ttsVoice) voiceMap.set(meta.id, meta.ttsVoice);
        }
        dispatch({ type: "RECONNECT", channelState: cs });

        if (cs.status === "RUNNING") {
          startSSELoop(abort, voiceMap);
        }
        return;
      }

      // ── No session — create a new one ──────────────
      await gqlFetch(START_SESSION_MUT, {
        channelKey: CHANNEL_KEY,
        config: DEFAULT_CONFIG,
      });

      // Wait for SSE connection to be established before starting the game
      let resolveConnected: () => void = () => {};
      const connected = new Promise<void>((r) => {
        resolveConnected = r;
      });

      const voiceMap = new Map<string, string>();
      startSSELoop(abort, voiceMap, resolveConnected);

      // Wait for SSE connection, then start the orchestrator
      await connected;
      await gqlFetch(RUN_SESSION_MUT, { channelKey: CHANNEL_KEY });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "ERROR", error: message });
    }
  }, [startSSELoop]);

  const stopGame = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    try {
      await gqlFetch(STOP_SESSION_MUT, { channelKey: CHANNEL_KEY });
    } catch {
      // Ignore stop errors
    }
    dispatch({ type: "RESET" });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { state, startGame, stopGame };
}
