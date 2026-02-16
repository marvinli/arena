import { useEffect, useReducer, useRef } from "react";
import { gqlFetch } from "../graphql/client";
import { CONNECT_QUERY, START_MODULE_MUT } from "../graphql/operations";
import { CHANNEL_KEY } from "../session/config";
import { buildPlayerMetaMaps } from "../session/mappers";
import { INITIAL_STATE, reducer } from "../session/reducer";
import type { GqlChannelState } from "../session/types";
import { useSSELoop } from "./useSSELoop";

interface ConnectResult {
  moduleId: string;
  moduleType: string;
  gameState: GqlChannelState | null;
}

export function useGameSession() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const startSSELoop = useSSELoop(dispatch);
  const connectingRef = useRef(false);

  useEffect(() => {
    if (connectingRef.current) return;
    connectingRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;

    (async () => {
      try {
        dispatch({ type: "START", channelKey: CHANNEL_KEY });

        const result = await gqlFetch(CONNECT_QUERY, {
          channelKey: CHANNEL_KEY,
        });
        const conn = (result as { connect: ConnectResult }).connect;

        const voiceMap = conn.gameState
          ? buildPlayerMetaMaps(conn.gameState.playerMeta ?? []).voices
          : new Map<string, string>();
        if (conn.gameState) {
          dispatch({ type: "RECONNECT", channelState: conn.gameState });
        }

        startSSELoop(abort, voiceMap, async () => {
          await gqlFetch(START_MODULE_MUT, { channelKey: CHANNEL_KEY });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: "ERROR", error: message });
      }
    })();

    return () => {
      abort.abort();
      connectingRef.current = false;
    };
  }, [startSSELoop]);

  return { state };
}
