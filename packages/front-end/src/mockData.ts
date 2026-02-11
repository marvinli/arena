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
    isWinner: false,
    winAmount: null,
    winHand: null,
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
    isWinner: false,
    winAmount: null,
    winHand: null,
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
    isWinner: false,
    winAmount: null,
    winHand: null,
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
    isWinner: false,
    winAmount: null,
    winHand: null,
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
    isWinner: false,
    winAmount: null,
    winHand: null,
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
    isWinner: false,
    winAmount: null,
    winHand: null,
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
    isWinner: false,
    winAmount: null,
    winHand: null,
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

const showdownFixture: MockFixture = {
  players: PLAYERS.map((p) => {
    const base = {
      ...p,
      currentBet: 0,
      isActive: false,
    };
    if (p.id === "agent-1") {
      // Claude wins with a flush
      return {
        ...base,
        chips: 1350,
        cards: [
          { rank: "A", suit: "spades" as const },
          { rank: "K", suit: "spades" as const },
        ] as [Card, Card],
        lastAction: null as Player["lastAction"],
        isWinner: true,
        winAmount: 480,
        winHand: "Flush",
      };
    }
    if (p.id === "agent-7" || p.id === "agent-3") {
      // Already folded during the hand
      return {
        ...base,
        isFolded: true,
        lastAction: null as Player["lastAction"],
      };
    }
    // Non-winners muck
    return {
      ...base,
      isFolded: true,
      lastAction: "muck" as Player["lastAction"],
    };
  }),
  communityCards: [
    { rank: "10", suit: "hearts" },
    { rank: "J", suit: "clubs" },
    { rank: "7", suit: "spades" },
    { rank: "3", suit: "spades" },
    { rank: "5", suit: "spades" },
  ],
  pots: [{ label: "Main Pot", amount: 480 }],
  speakingPlayerId: null,
  analysisText: null,
  isApiError: false,
  handNumber: 3,
  button: 0,
};

const FIXTURES: Record<string, MockFixture> = {
  default: defaultFixture,
  "api-error": apiErrorFixture,
  preflop: preflopFixture,
  showdown: showdownFixture,
};

export function getMockFixture(name: string): MockFixture {
  return FIXTURES[name] ?? defaultFixture;
}
