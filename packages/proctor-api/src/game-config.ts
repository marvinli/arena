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
  ttsVoice?: string;
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

const TABLE_SIZE = 9;

function randomPlayers(count: number): AgentConfig[] {
  const names = Object.keys(CHARACTERS);
  // Shuffle all character names
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, count).map((name, i) => {
    const c = CHARACTERS[name];
    return {
      playerId: `agent-${i + 1}`,
      name,
      modelId: "deepseek-chat",
      provider: "deepseek",
      persona: c.persona,
      bio: c.bio,
      voiceDirective: c.voiceDirective,
      avatarUrl: name,
      ttsVoice: c.ttsVoice,
    };
  });
}

export function createGameConfig(): GameConfig {
  return {
    players: randomPlayers(TABLE_SIZE),
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
}
