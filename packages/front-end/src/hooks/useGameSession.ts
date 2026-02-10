import { useCallback, useEffect, useReducer, useRef } from "react";
import { gqlFetch } from "../graphql/client";
import {
  RUN_SESSION_MUT,
  START_SESSION_MUT,
  STOP_SESSION_MUT,
} from "../graphql/operations";
import { CHANNEL_KEY } from "../session/config";
import { INITIAL_STATE, reducer } from "../session/reducer";
import { fetchChannelState } from "../session/sseClient";
import { useSSELoop } from "./useSSELoop";

export function useGameSession() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const startSSELoop = useSSELoop(dispatch);

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
