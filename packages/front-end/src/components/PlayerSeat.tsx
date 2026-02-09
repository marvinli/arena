import Claude from "@lobehub/icons/es/Claude";
import Gemini from "@lobehub/icons/es/Gemini";
import OpenAI from "@lobehub/icons/es/OpenAI";
import { useEffect, useRef, useState } from "react";
import type { Player } from "../types";
import { ChipStackDisplay } from "./ChipStack";
import styles from "./PlayerSeat.module.css";
import { PlayingCard } from "./PlayingCard";

export function PlayerSeat({
  player,
  seatColor,
  holeCardSecondClass,
  isSpeaking,
  isDimmed,
  visibleCards = 2,
  faceUp = true,
}: {
  player: Player;
  seatColor: string;
  holeCardSecondClass?: string;
  isSpeaking?: boolean;
  isDimmed?: boolean;
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

  const seatClass = [
    styles.seat,
    player.isActive ? styles.active : "",
    player.isFolded ? styles.folded : "",
    isDimmed && !player.isFolded ? styles.dimmed : "",
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
            {player.lastAction && actionBadgeClass && (
              <div className={actionBadgeClass}>
                {player.lastAction.toUpperCase()}
              </div>
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
                {player.avatar &&
                !["anthropic", "openai", "google"].includes(player.avatar) ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : player.avatar === "openai" ? (
                  <OpenAI.Avatar size={42} />
                ) : player.avatar === "google" ? (
                  <Gemini.Avatar size={42} />
                ) : (
                  <Claude.Color style={{ width: "60%", height: "60%" }} />
                )}
              </div>
            </div>
            {player.isDealer && <div className={styles.dealerButton}>D</div>}
          </div>
          <div className={styles.infoBadge}>
            <span className={styles.name}>{player.name}</span>
            <ChipStackDisplay amount={player.chips} />
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
