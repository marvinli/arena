import { mockCommunityCards, mockPlayers, mockPots } from "../mockData";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import styles from "./PokerTable.module.css";

const SEAT_COLORS = [
  "#e05c5c",
  "#5cb8e0",
  "#e0a05c",
  "#5ce08a",
  "#c05ce0",
  "#e05ca0",
  "#5ce0d4",
  "#e0d45c",
  "#5c6ee0",
  "#e07c5c",
];

/**
 * 10-seat positions as percentages of the 16:9 container.
 * Evenly distributed around an ellipse, clockwise from bottom center.
 */
const SEAT_COUNT = 10;
const SEAT_POSITIONS: { x: number; y: number }[] = Array.from(
  { length: SEAT_COUNT },
  (_, i) => {
    const angle = Math.PI / 2 + (i * 2 * Math.PI) / SEAT_COUNT;
    return {
      x: Math.round((50 + 36 * Math.cos(angle)) * 10) / 10,
      y: Math.round((50 + 38 * Math.sin(angle)) * 10) / 10,
    };
  },
);

function formatChips(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function PokerTable() {
  return (
    <div className={styles.scene}>
      {/* Community cards + pot */}
      <div className={styles.communityArea}>
        <div className={styles.potLabels}>
          {mockPots.map((pot) => (
            <div key={pot.label} className={styles.potLabel}>
              {pot.label}: {formatChips(pot.amount)}
            </div>
          ))}
        </div>
        <div className={styles.communityCards}>
          {/* All 5 slots: indices 0-2 = flop, 3 = turn, 4 = river */}
          {Array.from({ length: 5 }, (_, i) => {
            const card = mockCommunityCards[i] ?? null;
            const needsGap = i === 3 || i === 4;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-position card slots never reorder
              <span key={`slot-${i}`} style={{ display: "contents" }}>
                {needsGap && <div className={styles.streetGap} />}
                {card ? (
                  <PlayingCard card={card} />
                ) : (
                  <div className={styles.emptySlot} />
                )}
              </span>
            );
          })}
        </div>
      </div>

      {mockPlayers.map((player, i) => {
        const seat = SEAT_POSITIONS[i];
        // Position bet indicator toward center (50, 50)
        const cx = 50;
        const cy = 50;
        const dx = cx - seat.x;
        const dy = cy - seat.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = Math.min(0.35, 14 / dist);
        const betX = seat.x + dx * step;
        const yNudge = i === 3 || i === 7 ? -3 : 0;
        const betY = seat.y + dy * step + yNudge;
        const showBet = player.lastAction && player.lastAction !== "fold";

        return (
          <div key={player.id}>
            <div
              style={{
                position: "absolute",
                left: `${seat.x}%`,
                top: `${seat.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <PlayerSeat
                player={player}
                seatColor={SEAT_COLORS[i]}
                holeCardSecondClass={styles.holeCardSecond}
              />
            </div>
            {showBet && player.currentBet > 0 && (
              <div
                className={`${styles.betIndicator} ${player.isAllIn ? styles.allIn : ""}`}
                style={{
                  left: `${betX}%`,
                  top: `${betY}%`,
                  borderColor: SEAT_COLORS[i],
                }}
              >
                {player.isAllIn && (
                  <span className={styles.allInLabel}>ALL IN</span>
                )}
                <svg
                  className={styles.betChipIcon}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="8.5"
                    stroke={SEAT_COLORS[i]}
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="5.5"
                    stroke={SEAT_COLORS[i]}
                    strokeWidth="1"
                  />
                  <line
                    x1="10"
                    y1="1"
                    x2="10"
                    y2="4"
                    stroke={SEAT_COLORS[i]}
                    strokeWidth="1.5"
                  />
                  <line
                    x1="10"
                    y1="16"
                    x2="10"
                    y2="19"
                    stroke={SEAT_COLORS[i]}
                    strokeWidth="1.5"
                  />
                  <line
                    x1="1"
                    y1="10"
                    x2="4"
                    y2="10"
                    stroke={SEAT_COLORS[i]}
                    strokeWidth="1.5"
                  />
                  <line
                    x1="16"
                    y1="10"
                    x2="19"
                    y2="10"
                    stroke={SEAT_COLORS[i]}
                    strokeWidth="1.5"
                  />
                </svg>
                <span className={styles.betAmount}>
                  {formatChips(player.currentBet)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
