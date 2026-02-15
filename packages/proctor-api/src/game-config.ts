// ── Game configuration ──────────────────────────────────

export interface AgentConfig {
  playerId: string;
  name: string;
  modelId: string;
  modelName: string;
  provider: string;
  avatarUrl?: string;
  ttsVoices?: { openai?: string; inworld?: string };
  temperature?: number;
}

export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
}

export interface GameConfig {
  players: AgentConfig[];
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  blindSchedule?: BlindLevel[];
  handsPerLevel?: number;
}

export const GAME_CONFIG: GameConfig = {
  players: [
    {
      playerId: "agent-1",
      name: "Claude",
      modelId: "claude-opus-4-6",
      modelName: "Opus 4.6",
      provider: "anthropic",
      avatarUrl: "anthropic",
      ttsVoices: { openai: "ash", inworld: "Dennis" },
    },
    {
      playerId: "agent-2",
      name: "ChatGPT",
      modelId: "gpt-5.2",
      modelName: "5.2",
      provider: "openai",
      avatarUrl: "openai",
      ttsVoices: { openai: "fable", inworld: "Ashley" },
    },
    {
      playerId: "agent-3",
      name: "Gemini",
      modelId: "gemini-2.5-pro",
      modelName: "2.5 Pro",
      provider: "google",
      avatarUrl: "google",
      ttsVoices: { openai: "nova", inworld: "Timothy" },
    },
    {
      playerId: "agent-4",
      name: "Grok",
      modelId: "grok-4-1-fast-non-reasoning",
      modelName: "4.1",
      provider: "xai",
      avatarUrl: "xai",
      ttsVoices: { openai: "shimmer", inworld: "Elizabeth" },
    },
    {
      playerId: "agent-5",
      name: "DeepSeek",
      modelId: "deepseek-chat",
      modelName: "V3",
      provider: "deepseek",
      avatarUrl: "deepseek",
      ttsVoices: { openai: "echo", inworld: "Mark" },
    },
    {
      playerId: "agent-7",
      name: "Mistral",
      modelId: "mistral.mistral-large-3-675b-instruct",
      modelName: "Large 3",
      provider: "bedrock",
      avatarUrl: "mistral",
      ttsVoices: { openai: "coral", inworld: "Ronald" },
    },
    {
      playerId: "agent-8",
      name: "Nova",
      modelId: "us.amazon.nova-pro-v1:0",
      modelName: "Pro",
      provider: "bedrock",
      avatarUrl: "nova",
      ttsVoices: { openai: "onyx", inworld: "Edward" },
    },
  ],
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  blindSchedule: [
    { smallBlind: 10, bigBlind: 20 },
    { smallBlind: 20, bigBlind: 40 },
    { smallBlind: 40, bigBlind: 80 },
    { smallBlind: 80, bigBlind: 160 },
    { smallBlind: 150, bigBlind: 300 },
    { smallBlind: 250, bigBlind: 500 },
    { smallBlind: 500, bigBlind: 1000 },
  ],
  handsPerLevel: 2,
};
