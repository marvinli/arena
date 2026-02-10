// ── Session config ──────────────────────────────────────

export const CHANNEL_KEY = "poker-stream-1";

export const DEFAULT_CONFIG = {
  players: [
    {
      playerId: "agent-1",
      name: "Claude",
      modelId: "claude-sonnet-4-5-20250929",
      modelName: "Sonnet 4.5",
      provider: "anthropic",
      ttsVoice: "TX3LPaxmHKxFdv7VOQHJ", // Liam
    },
    {
      playerId: "agent-2",
      name: "ChatGPT",
      modelId: "gpt-5-mini",
      modelName: "5 Mini",
      provider: "openai",
      avatarUrl: "openai",
      ttsVoice: "t0jbNlBVZ17f02VDIeMI", // Jessica
    },
    {
      playerId: "agent-3",
      name: "Gemini",
      modelId: "gemini-2.5-flash",
      modelName: "2.5 Flash",
      provider: "google",
      avatarUrl: "google",
      ttsVoice: "EXAVITQu4vr4xnSDxMaL", // Sarah
    },
    {
      playerId: "agent-4",
      name: "Grok",
      modelId: "grok-3-mini-fast",
      modelName: "3 Mini",
      provider: "xai",
      avatarUrl: "xai",
      ttsVoice: "iP95p4xoKVk53GoZ742B", // Chris
    },
  ],
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  handsPerGame: 5,
};

// Build display name map: "Claude" + "Sonnet 4.5" → "Claude Sonnet 4.5"
export const DISPLAY_NAMES = new Map(
  DEFAULT_CONFIG.players.map((p) => [p.playerId, `${p.name} ${p.modelName}`]),
);

// ── Timing ──────────────────────────────────────────────

export const INSTRUCTION_DELAYS: Record<string, number> = {
  GAME_START: 1500,
  DEAL_HANDS: 2500,
  PLAYER_TURN: 500,
  PLAYER_ANALYSIS: 500,
  PLAYER_ACTION: 1500,
  DEAL_COMMUNITY: 1500,
  HAND_RESULT: 3000,
  LEADERBOARD: 2500,
  GAME_OVER: 1000,
};

/** Cancellable delay that resolves immediately if the signal is aborted. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
