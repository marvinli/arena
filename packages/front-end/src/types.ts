export interface Card {
  rank: string;
  suit: "clubs" | "diamonds" | "hearts" | "spades";
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  avatar: string;
  cards: [Card, Card] | null; // null = show card backs
  isDealer: boolean;
  isFolded: boolean;
  isActive: boolean; // currently acting
}

/** Community cards dealt face-up on the board (0-5 cards). */
export type CommunityCards = Card[];
