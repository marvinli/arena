import { useEffect, useRef, useState } from "react";
import { formatChips } from "../../../../chips";
import { PERSONAS } from "../../../../personas";
import type { Player } from "../../../../types";
import { CharacterAvatar } from "../../ProviderIcon";
import { ChipStackDisplay } from "../ChipStack";
import { PlayingCard } from "../PlayingCard";
import styles from "./PlayerSeat.module.css";

export function PlayerSeat({
  player,
  seatColor,
  holeCardSecondClass,
  isSpeaking,
  isDimmed,
  hasWinner,
  visibleCards = 2,
  faceUp = true,
}: {
  player: Player;
  seatColor: string;
  holeCardSecondClass?: string;
  isSpeaking?: boolean;
  isDimmed?: boolean;
  hasWinner?: boolean;
  visibleCards?: number;
  faceUp?: boolean;
}) {
  // Detect fold transition → play flip-then-dismiss animation
  const [folding, setFolding] = useState(false);
  const prevFoldedRef = useRef(player.isFolded);
  useEffect(() => {
    if (player.isFolded && !prevFoldedRef.current) {
      setFolding(true);
      const timer = setTimeout(() => setFolding(false), 1000);
      return () => clearTimeout(timer);
    }
    prevFoldedRef.current = player.isFolded;
  }, [player.isFolded]);

  const effectiveFaceUp = folding ? false : faceUp;

  const isLoser = hasWinner && !player.isWinner && !player.isFolded;

  const seatClass = [
    styles.seat,
    player.isActive ? styles.active : "",
    player.isWinner ? styles.winner : "",
    isLoser ? styles.loser : "",
    player.isFolded ? styles.folded : "",
    isDimmed && !player.isFolded && !hasWinner ? styles.dimmed : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardsClass = [
    styles.cards,
    folding ? styles.cardsFolding : "",
    player.isFolded && !folding ? styles.cardsHidden : "",
  ]
    .filter(Boolean)
    .join(" ");

  const actionBadgeClass = player.lastAction
    ? `${styles.actionBadge} ${player.lastAction === "fold" ? styles.actionFold : ""}`
    : undefined;

  return (
    <div className={seatClass}>
      <div className={styles.topRow}>
        <div className={styles.avatarColumn}>
          <div className={styles.avatarArea}>
            {player.isWinner ? (
              <div className={`${styles.actionBadge} ${styles.actionWinner}`}>
                <span className={styles.winnerLabel}>WINNER</span>
                {player.winAmount != null && (
                  <span className={styles.winnerAmount}>
                    +{formatChips(player.winAmount)}
                  </span>
                )}
              </div>
            ) : (
              player.lastAction &&
              actionBadgeClass && (
                <div className={actionBadgeClass}>
                  {player.lastAction.toUpperCase()}
                </div>
              )
            )}
            {isSpeaking && (
              <div className={styles.thoughtBubble}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
                <div className={styles.bubbleTail1} />
                <div className={styles.bubbleTail2} />
              </div>
            )}
            <div
              className={styles.avatarRing}
              style={{ "--seat-color": seatColor } as React.CSSProperties}
            >
              <div className={styles.avatar}>
                <CharacterAvatar name={player.avatar || player.name} />
              </div>
            </div>
            {player.isDealer && <div className={styles.dealerButton}>D</div>}
          </div>
          <div className={styles.infoBadge}>
            <span className={styles.name}>{player.name}</span>
            {player.persona && PERSONAS[player.persona] && (
              <span
                className={styles.persona}
                style={{ color: PERSONAS[player.persona].color }}
              >
                {PERSONAS[player.persona].emoji} {PERSONAS[player.persona].name}
              </span>
            )}
            <ChipStackDisplay amount={player.chips} color={seatColor} />
          </div>
        </div>
        <div className={cardsClass}>
          {player.cards && visibleCards >= 1 && (
            <div className={styles.cardDealIn}>
              <PlayingCard
                card={player.cards[0] ?? null}
                faceUp={effectiveFaceUp}
              />
            </div>
          )}
          {player.cards && visibleCards >= 2 && (
            <div
              className={`${styles.cardDealIn} ${holeCardSecondClass ?? ""}`}
            >
              <PlayingCard
                card={player.cards[1] ?? null}
                faceUp={effectiveFaceUp}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
