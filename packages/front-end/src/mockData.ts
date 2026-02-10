import type { Card, Player, Pot } from "./types";

// ── Shared players ──────────────────────────────────────

const PLAYERS: Player[] = [
  {
    id: "agent-1",
    name: "Claude Opus 4.6",
    chips: 870,
    avatar: "",
    cards: [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "spades" },
    ],
    isDealer: true,
    isFolded: false,
    isActive: true,
    isAllIn: false,
    lastAction: "raise",
    currentBet: 80,
  },
  {
    id: "agent-2",
    name: "ChatGPT 5.2",
    chips: 940,
    avatar: "openai",
    cards: [
      { rank: "9", suit: "hearts" },
      { rank: "J", suit: "diamonds" },
    ],
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "call",
    currentBet: 80,
  },
  {
    id: "agent-3",
    name: "Gemini 2.5 Pro",
    chips: 1020,
    avatar: "google",
    cards: [
      { rank: "5", suit: "clubs" },
      { rank: "3", suit: "hearts" },
    ],
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "call",
    currentBet: 80,
  },
  {
    id: "agent-4",
    name: "Grok 4.1",
    chips: 650,
    avatar: "xai",
    cards: [
      { rank: "K", suit: "hearts" },
      { rank: "10", suit: "clubs" },
    ],
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "raise",
    currentBet: 80,
  },
  {
    id: "agent-5",
    name: "DeepSeek V3.1",
    chips: 520,
    avatar: "deepseek",
    cards: [
      { rank: "Q", suit: "diamonds" },
      { rank: "8", suit: "spades" },
    ],
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "call",
    currentBet: 80,
  },
  {
    id: "agent-6",
    name: "Llama 4 Maverick",
    chips: 780,
    avatar: "meta",
    cards: [
      { rank: "7", suit: "spades" },
      { rank: "6", suit: "hearts" },
    ],
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "call",
    currentBet: 80,
  },
  {
    id: "agent-7",
    name: "Mistral Large 3",
    chips: 1100,
    avatar: "mistral",
    cards: [
      { rank: "J", suit: "spades" },
      { rank: "10", suit: "spades" },
    ],
    isDealer: false,
    isFolded: true,
    isActive: false,
    isAllIn: false,
    lastAction: "fold",
    currentBet: 0,
  },
  {
    id: "agent-8",
    name: "Nova Pro",
    chips: 910,
    avatar: "nova",
    cards: [
      { rank: "4", suit: "diamonds" },
      { rank: "2", suit: "clubs" },
    ],
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "call",
    currentBet: 80,
  },
  {
    id: "agent-9",
    name: "Qwen3 235B",
    chips: 850,
    avatar: "qwen",
    cards: [
      { rank: "A", suit: "hearts" },
      { rank: "3", suit: "diamonds" },
    ],
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "call",
    currentBet: 80,
  },
];

const COMMUNITY_CARDS: Card[] = [
  { rank: "10", suit: "hearts" },
  { rank: "J", suit: "clubs" },
  { rank: "7", suit: "diamonds" },
];

const POTS: Pot[] = [{ label: "Main Pot", amount: 560 }];

// ── Fixtures ────────────────────────────────────────────

export interface MockFixture {
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  speakingPlayerId: string | null;
  analysisText: string | null;
  isApiError: boolean;
  handNumber: number;
  button: number | null;
}

const defaultFixture: MockFixture = {
  players: PLAYERS,
  communityCards: COMMUNITY_CARDS,
  pots: POTS,
  speakingPlayerId: "agent-1",
  analysisText:
    "Ace-king suited on the button \u2014 this is a premium hand. With Gemini folding and only Grok and ChatGPT left to act behind me, I'm in great position. The flop gives me two overcards and a backdoor flush draw. I like my equity here. Let me put in a raise to 80 and see who wants to play.",
  isApiError: false,
  handNumber: 1,
  button: 0,
};

const apiErrorFixture: MockFixture = {
  players: PLAYERS.map((p) =>
    p.id === "agent-4" ? { ...p, isActive: true, lastAction: null } : p,
  ),
  communityCards: COMMUNITY_CARDS,
  pots: POTS,
  speakingPlayerId: "agent-4",
  analysisText: "Pretty sure my human forgot to pay the API bill. Check.",
  isApiError: true,
  handNumber: 2,
  button: 0,
};

const preflopFixture: MockFixture = {
  players: PLAYERS.map((p) => ({
    ...p,
    lastAction: null,
    currentBet: 0,
    isFolded: false,
    isActive: p.id === "agent-1",
  })),
  communityCards: [],
  pots: [{ label: "Main Pot", amount: 30 }],
  speakingPlayerId: null,
  analysisText: null,
  isApiError: false,
  handNumber: 1,
  button: 0,
};

const FIXTURES: Record<string, MockFixture> = {
  default: defaultFixture,
  "api-error": apiErrorFixture,
  preflop: preflopFixture,
};

export function getMockFixture(name: string): MockFixture {
  return FIXTURES[name] ?? defaultFixture;
}
