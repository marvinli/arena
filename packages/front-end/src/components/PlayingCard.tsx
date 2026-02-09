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
    return <div className={`${styles.card} ${styles.back}`} />;
  }

  const isRed = RED_SUITS.has(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];
  return (
    <div
      className={`${styles.card} ${styles.front} ${isRed ? styles.red : styles.black}`}
    >
      <div className={styles.cornerTopLeft}>
        <span className={styles.rank}>{card.rank}</span>
        <span className={styles.cornerSuit}>{symbol}</span>
      </div>
      <span className={styles.centerSuit}>{symbol}</span>
      <div className={styles.cornerBottomRight}>
        <span className={styles.rank}>{card.rank}</span>
        <span className={styles.cornerSuit}>{symbol}</span>
      </div>
    </div>
  );
}
