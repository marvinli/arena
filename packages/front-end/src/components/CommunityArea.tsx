import { formatChips } from "../chips";
import type { CommunityCardState } from "../hooks/useCommunityDealAnimation";
import type { Card, Pot } from "../types";
import { PlayingCard } from "./PlayingCard";
import styles from "./PokerTable.module.css";

export function CommunityArea({
  communityCards,
  pots,
  communityAnim,
}: {
  communityCards: Card[];
  pots: Pot[];
  communityAnim: Map<number, CommunityCardState>;
}) {
  return (
    <div className={styles.communityArea}>
      <div className={styles.potLabels}>
        {pots.map((pot) => (
          <div key={pot.label} className={styles.potLabel}>
            {pot.label}: {formatChips(pot.amount)}
          </div>
        ))}
      </div>
      <div className={styles.communityCards}>
        {/* All 5 slots: indices 0-2 = flop, 3 = turn, 4 = river */}
        {Array.from({ length: 5 }, (_, i) => {
          const card = communityCards[i] ?? null;
          const anim = communityAnim.get(i);
          const needsGap = i === 3 || i === 4;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-position card slots never reorder
            <span key={`slot-${i}`} style={{ display: "contents" }}>
              {needsGap && <div className={styles.streetGap} />}
              {card && anim?.visible ? (
                <PlayingCard card={card} faceUp={anim.faceUp} />
              ) : (
                <div className={styles.emptySlot} />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
