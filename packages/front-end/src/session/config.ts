// ── Session config ──────────────────────────────────────

export const CHANNEL_KEY = "poker-stream-1";

export const DEFAULT_CONFIG = {
  players: [
    {
      playerId: "agent-1",
      name: "Claude",
      modelId: "claude-opus-4-6",
      modelName: "Opus 4.6",
      provider: "anthropic",
      ttsVoice: "ash", // confident male
    },
    {
      playerId: "agent-2",
      name: "ChatGPT",
      modelId: "gpt-5.2",
      modelName: "5.2",
      provider: "openai",
      avatarUrl: "openai",
      ttsVoice: "fable", // warm storyteller male
    },
    {
      playerId: "agent-3",
      name: "Gemini",
      modelId: "gemini-2.5-pro",
      modelName: "2.5 Pro",
      provider: "google",
      avatarUrl: "google",
      ttsVoice: "nova", // female
    },
    {
      playerId: "agent-4",
      name: "Grok",
      modelId: "grok-4-1-fast-non-reasoning",
      modelName: "4.1",
      provider: "xai",
      avatarUrl: "xai",
      ttsVoice: "shimmer", // female
    },
    {
      playerId: "agent-5",
      name: "DeepSeek",
      modelId: "deepseek-chat",
      modelName: "V3",
      provider: "deepseek",
      avatarUrl: "deepseek",
      ttsVoice: "echo", // male
    },
    {
      playerId: "agent-7",
      name: "Mistral",
      modelId: "mistral.mistral-large-3-675b-instruct",
      modelName: "Large 3",
      provider: "bedrock",
      avatarUrl: "mistral",
      ttsVoice: "coral", // female
    },
    {
      playerId: "agent-8",
      name: "Nova",
      modelId: "us.amazon.nova-pro-v1:0",
      modelName: "Pro",
      provider: "bedrock",
      avatarUrl: "nova",
      ttsVoice: "onyx", // deep male
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
