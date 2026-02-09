export interface Card {
  rank: string;
  suit: "clubs" | "diamonds" | "hearts" | "spades";
}

export type PlayerAction = "call" | "bet" | "raise" | "check" | "fold" | null;

export interface Player {
  id: string;
  name: string;
  chips: number;
  avatar: string;
  cards: [Card, Card] | null; // null = show card backs
  isDealer: boolean;
  isFolded: boolean;
  isActive: boolean; // currently acting
  isAllIn: boolean;
  lastAction: PlayerAction;
  currentBet: number; // amount bet this round (0 = none)
}

export interface Pot {
  label: string;
  amount: number;
}

/** Community cards dealt face-up on the board (0-5 cards). */
export type CommunityCards = Card[];

// ── Game state types ────────────────────────────────────

export type GamePhase =
  | "WAITING"
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN";

export type GameStatus =
  | "idle"
  | "connecting"
  | "running"
  | "finished"
  | "error";

export interface GameState {
  status: GameStatus;
  channelKey: string | null;
  gameId: string | null;
  handNumber: number;
  phase: GamePhase;
  smallBlind: number;
  bigBlind: number;
  button: number | null;
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  holeCards: Map<string, [Card, Card]>;
  error: string | null;
}
