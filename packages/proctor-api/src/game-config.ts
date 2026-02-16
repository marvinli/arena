// ── Game configuration ──────────────────────────────────

import { CHARACTERS } from "./characters.js";

export interface AgentConfig {
  playerId: string;
  name: string;
  modelId: string;
  provider: string;
  persona: string;
  bio: string;
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

function player(id: number, name: string): AgentConfig {
  const c = CHARACTERS[name];
  if (!c) throw new Error(`Unknown character: ${name}`);
  return {
    playerId: `agent-${id}`,
    name,
    modelId: "deepseek-chat",
    provider: "deepseek",
    persona: c.persona,
    bio: c.bio,
    avatarUrl: name,
    ttsVoices: c.ttsVoices,
  };
}

export const GAME_CONFIG: GameConfig = {
  players: [
    player(1, "Aaron"),
    player(2, "Cleo"),
    player(3, "Barnum"),
    player(4, "Chad"),
    player(5, "Angela"),
    player(6, "Dan"),
    player(7, "Katy"),
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
