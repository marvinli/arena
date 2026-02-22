import { gqlFetch } from "../graphql/client";
import { GET_CHANNEL_STATE } from "../graphql/operations";
import { CHANNEL_KEY } from "./config";
import type { GqlChannelState, GqlInstruction } from "./types";

// ── SSE subscription helper ─────────────────────────────

export async function* sseSubscribe(
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
  onConnected?: () => void,
): AsyncGenerator<GqlInstruction> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`SSE subscribe failed: ${res.status} ${res.statusText}`);
  }

  // Signal that the SSE connection is established (client is registered server-side)
  onConnected?.();

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep incomplete last line in buffer
      buffer = lines.pop() ?? "";

      let eventType = "";
      let dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        } else if (line === "") {
          // End of event
          if (eventType === "next" && dataLines.length > 0) {
            try {
              const json = JSON.parse(dataLines.join("\n")) as {
                data?: { renderInstructions: GqlInstruction };
              };
              if (json.data?.renderInstructions) {
                yield json.data.renderInstructions;
              }
            } catch {
              console.warn("SSE: failed to parse event data, skipping");
            }
          } else if (eventType === "complete") {
            return;
          }
          eventType = "";
          dataLines = [];
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Channel state query helper ──────────────────────────

export async function fetchChannelState(): Promise<GqlChannelState> {
  const result = await gqlFetch(GET_CHANNEL_STATE, {
    channelKey: CHANNEL_KEY,
  });
  return (result as { getChannelState: GqlChannelState }).getChannelState;
}
