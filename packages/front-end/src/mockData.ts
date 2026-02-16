import type { Card, GameAward, Player, Pot } from "./types";

// ── Mock player factory ────────────────────────────────

function createMockPlayer(
  id: string,
  name: string,
  seatIndex: number,
  overrides?: Partial<Player>,
): Player {
  return {
    id,
    name,
    chips: 1000,
    avatar: name,
    persona: null,
    seatIndex,
    cards: null,
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    isWinner: false,
    winAmount: null,
    winHand: null,
    lastAction: null,
    currentBet: 0,
    ...overrides,
  };
}

// ── Shared players ──────────────────────────────────────

const PLAYERS: Player[] = [
  createMockPlayer("agent-1", "Aaron", 0, {
    chips: 870,
    persona: "shark",
    cards: [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "spades" },
    ],
    isDealer: true,
    isActive: true,
    lastAction: "raise",
    currentBet: 80,
  }),
  createMockPlayer("agent-2", "Cleo", 1, {
    chips: 940,
    persona: "robot",
    cards: [
      { rank: "9", suit: "hearts" },
      { rank: "J", suit: "diamonds" },
    ],
    lastAction: "call",
    currentBet: 80,
  }),
  createMockPlayer("agent-3", "Barnum", 2, {
    chips: 1020,
    persona: "snake",
    cards: [
      { rank: "5", suit: "clubs" },
      { rank: "3", suit: "hearts" },
    ],
    lastAction: "call",
    currentBet: 80,
  }),
  createMockPlayer("agent-4", "Chad", 3, {
    chips: 650,
    persona: "degen",
    cards: [
      { rank: "K", suit: "hearts" },
      { rank: "10", suit: "clubs" },
    ],
    lastAction: "raise",
    currentBet: 80,
  }),
  createMockPlayer("agent-5", "Angela", 4, {
    chips: 520,
    persona: "rock",
    cards: [
      { rank: "Q", suit: "diamonds" },
      { rank: "8", suit: "spades" },
    ],
    lastAction: "call",
    currentBet: 80,
  }),
  createMockPlayer("agent-6", "Dan", 5, {
    chips: 1100,
    persona: "grinder",
    cards: [
      { rank: "J", suit: "spades" },
      { rank: "10", suit: "spades" },
    ],
    lastAction: "call",
    currentBet: 80,
  }),
  createMockPlayer("agent-7", "Katy", 6, {
    chips: 910,
    persona: "maniac",
    cards: [
      { rank: "4", suit: "diamonds" },
      { rank: "2", suit: "clubs" },
    ],
    lastAction: "call",
    currentBet: 80,
  }),
  createMockPlayer("agent-8", "Isabella", 7, {
    chips: 780,
    persona: "fish",
    cards: [
      { rank: "7", suit: "hearts" },
      { rank: "6", suit: "hearts" },
    ],
    lastAction: "call",
    currentBet: 80,
  }),
  createMockPlayer("agent-9", "Smithers", 8, {
    chips: 1210,
    persona: "degen",
    cards: [
      { rank: "2", suit: "spades" },
      { rank: "8", suit: "clubs" },
    ],
    isFolded: true,
    lastAction: "fold",
  }),
];

const COMMUNITY_CARDS: Card[] = [
  { rank: "10", suit: "hearts" },
  { rank: "J", suit: "clubs" },
  { rank: "7", suit: "diamonds" },
];

const POTS: Pot[] = [{ label: "Main Pot", amount: 560 }];

// ── Fixtures ────────────────────────────────────────────

export type MockView = "poker" | "endcard";

export interface MockFixture {
  view?: MockView;
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  speakingPlayerId: string | null;
  analysisText: string | null;
  isApiError: boolean;
  handNumber: number;
  button: number | null;
  smallBlind?: number;
  bigBlind?: number;
  awards?: GameAward[];
  isFinished?: boolean;
}

const defaultFixture: MockFixture = {
  players: PLAYERS,
  communityCards: COMMUNITY_CARDS,
  pots: POTS,
  speakingPlayerId: "agent-1",
  analysisText:
    "Ace-king suited on the button \u2014 this is a premium hand. With Barnum folding and only Chad and Cleo left to act behind me, I'm in great position. The flop gives me two overcards and a backdoor flush draw. I like my equity here. Let me put in a raise to 80 and see who wants to play.",
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
      // Aaron wins with a flush
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
    if (p.id === "agent-6" || p.id === "agent-3") {
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

const endcardOverrides: Partial<Player> = {
  isActive: false,
  lastAction: null,
  currentBet: 0,
  cards: null,
  isFolded: false,
};

const gameOverFixture: MockFixture = {
  view: "endcard",
  players: [
    { ...PLAYERS[0], ...endcardOverrides, chips: 3200 },
    ...PLAYERS.slice(1).map((p) => ({ ...p, ...endcardOverrides, chips: 0 })),
  ],
  communityCards: [],
  pots: [],
  speakingPlayerId: null,
  analysisText: null,
  isApiError: false,
  handNumber: 47,
  button: null,
  smallBlind: 500,
  bigBlind: 1000,
  awards: [
    {
      title: "Most Aggressive",
      playerIds: ["agent-1"],
      playerNames: ["Aaron"],
      description: "18 bets/raises",
    },
    {
      title: "Most Passive",
      playerIds: ["agent-8"],
      playerNames: ["Isabella"],
      description: "31 calls/checks",
    },
    {
      title: "Tightest",
      playerIds: ["agent-5"],
      playerNames: ["Angela"],
      description: "67% fold rate",
    },
    {
      title: "Loosest",
      playerIds: ["agent-3"],
      playerNames: ["Barnum"],
      description: "12% fold rate",
    },
    {
      title: "Yolo",
      playerIds: ["agent-4", "agent-9"],
      playerNames: ["Chad", "Smithers"],
      description: "5 all-ins",
    },
    {
      title: "Biggest Pot Won",
      playerIds: ["agent-1"],
      playerNames: ["Aaron"],
      description: "$1,240",
    },
    {
      title: "Most Hands Won",
      playerIds: ["agent-6"],
      playerNames: ["Dan"],
      description: "14 hands",
    },
    {
      title: "Analysis Paralysis",
      playerIds: ["agent-7"],
      playerNames: ["Katy"],
      description: "avg 847 characters",
    },
    {
      title: "Just Do It",
      playerIds: ["agent-4", "agent-9"],
      playerNames: ["Chad", "Smithers"],
      description: "avg 94 characters",
    },
    {
      title: "Bounty Hunter",
      playerIds: ["agent-1"],
      playerNames: ["Aaron"],
      description: "4 eliminations",
    },
  ],
  isFinished: true,
};

const FIXTURES: Record<string, MockFixture> = {
  default: defaultFixture,
  "api-error": apiErrorFixture,
  preflop: preflopFixture,
  showdown: showdownFixture,
  "game-over": gameOverFixture,
};

export function getMockFixture(name: string): MockFixture {
  return FIXTURES[name] ?? defaultFixture;
}
