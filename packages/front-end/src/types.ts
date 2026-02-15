export interface Card {
  rank: string;
  suit: "clubs" | "diamonds" | "hearts" | "spades";
}

export type PlayerAction =
  | "call"
  | "bet"
  | "raise"
  | "check"
  | "fold"
  | "muck"
  | null;

export interface Player {
  id: string;
  name: string;
  chips: number;
  avatar: string;
  persona: string | null;
  seatIndex: number;
  cards: [Card, Card] | null; // null = show card backs
  isDealer: boolean;
  isFolded: boolean;
  isActive: boolean; // currently acting
  isAllIn: boolean;
  isWinner: boolean;
  winAmount: number | null;
  winHand: string | null; // e.g. "Flush", "Full House"
  lastAction: PlayerAction;
  currentBet: number; // amount bet this round (0 = none)
}

export interface Pot {
  label: string;
  amount: number;
}

export interface GameAward {
  title: string;
  playerIds: string[];
  playerNames: string[];
  description: string;
}

/** Community cards dealt face-up on the board (0-5 cards). */
export type CommunityCards = Card[];

// ── Game state types ────────────────────────────────────

export type GameView = "poker" | "endcard";

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
  currentView: GameView;
  smallBlind: number;
  bigBlind: number;
  button: number | null;
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  holeCards: Map<string, [Card, Card]>;
  speakingPlayerId: string | null;
  analysisText: string | null;
  isApiError: boolean;
  error: string | null;
  awards: GameAward[];
  /** Avatar URLs keyed by player ID — persists across GAME_START → GAME_OVER so busted players retain avatars. */
  playerAvatars: Map<string, string>;
}
