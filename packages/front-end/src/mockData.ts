import type { Card, Player, Pot } from "./types";

/** Flop dealt: 10♥ J♣ 7♦ */
export const mockCommunityCards: Card[] = [
  { rank: "10", suit: "hearts" },
  { rank: "J", suit: "clubs" },
  { rank: "7", suit: "diamonds" },
];

export const mockPots: Pot[] = [{ label: "Main Pot", amount: 320 }];

export const mockPlayers: Player[] = [
  {
    id: "agent-1",
    name: "Claude Sonnet 4.5",
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
    name: "ChatGPT 5 Mini",
    chips: 940,
    avatar: "openai",
    cards: null,
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "call",
    currentBet: 80,
  },
  {
    id: "agent-3",
    name: "Gemini 2.5 Flash",
    chips: 1020,
    avatar: "google",
    cards: null,
    isDealer: false,
    isFolded: true,
    isActive: false,
    isAllIn: false,
    lastAction: "fold",
    currentBet: 0,
  },
  {
    id: "agent-4",
    name: "Grok 3 Mini",
    chips: 650,
    avatar: "xai",
    cards: null,
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    lastAction: "raise",
    currentBet: 80,
  },
];
