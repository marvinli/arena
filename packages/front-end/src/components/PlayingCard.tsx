import type { Card } from "../types";
import styles from "./PlayingCard.module.css";

const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  clubs: "\u2663",
  diamonds: "\u2666",
  hearts: "\u2665",
  spades: "\u2660",
};

const RED_SUITS = new Set<Card["suit"]>(["hearts", "diamonds"]);

function CardBackDesign() {
  return (
    <svg
      className={styles.backDesign}
      viewBox="0 0 60 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="lattice" width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="6" y2="6" stroke="#ffffff" strokeWidth="0.4" opacity="0.35" />
          <line x1="6" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="0.4" opacity="0.35" />
        </pattern>
        <clipPath id="latticeClip">
          <rect x="9" y="9" width="42" height="66" rx="1.5" />
        </clipPath>
      </defs>
      {/* Lattice fill */}
      <rect x="9" y="9" width="42" height="66" fill="url(#lattice)" clipPath="url(#latticeClip)" />
      {/* Outer edge */}
      <rect x="4" y="4" width="52" height="76" rx="3" stroke="#ffffff" strokeWidth="0.8" />

    </svg>
  );
}

export function PlayingCard({ card }: { card: Card | null }) {
  if (!card) {
    return (
      <div className={`${styles.card} ${styles.back}`}>
        <CardBackDesign />
      </div>
    );
  }

  const isRed = RED_SUITS.has(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];
  return (
    <div
      className={`${styles.card} ${styles.front} ${isRed ? styles.red : styles.black}`}
    >
      <span className={styles.rank}>{card.rank}</span>
      <span className={styles.centerSuit}>{symbol}</span>
    </div>
  );
}
