import type { Card } from "../types";
import styles from "./PlayingCard.module.css";

const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  clubs: "\u2663",
  diamonds: "\u2666",
  hearts: "\u2665",
  spades: "\u2660",
};

const RED_SUITS = new Set<Card["suit"]>(["hearts", "diamonds"]);

export function PlayingCard({ card }: { card: Card | null }) {
  if (!card) {
    return (
      <div className={`${styles.card} ${styles.back}`}>
        <div className={styles.backPattern} />
      </div>
    );
  }

  const isRed = RED_SUITS.has(card.suit);
  return (
    <div
      className={`${styles.card} ${styles.front} ${isRed ? styles.red : styles.black}`}
    >
      <span>{card.rank}</span>
      <span className={styles.suit}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}
