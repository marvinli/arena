import { mockCommunityCards, mockPlayers, mockPot } from "../mockData";
import { PlayerSeat } from "./PlayerSeat";
import { PlayingCard } from "./PlayingCard";
import styles from "./PokerTable.module.css";

const TOTAL_COMMUNITY_SLOTS = 5;

const SEAT_COLORS = [
  "#e05c5c", "#5cb8e0", "#e0a05c", "#5ce08a", "#c05ce0",
  "#e05ca0", "#5ce0d4", "#e0d45c", "#5c6ee0", "#e07c5c",
];

/**
 * 10-seat positions around an ellipse.
 * The table scene is 1200x700. The ellipse center is at (600, 350).
 * Seats are offset outward from the ellipse edge so players sit
 * around the rail, not on top of the felt.
 *
 * Positions are hand-tuned for a natural oval layout:
 * Bottom center (seat 0) -> clockwise.
 */
const SEAT_POSITIONS: { x: number; y: number }[] = [
  { x: 600, y: 650 }, // 0: bottom center
  { x: 320, y: 610 }, // 1: bottom-left
  { x: 100, y: 480 }, // 2: left-lower
  { x: 65, y: 290 }, // 3: left-upper
  { x: 230, y: 110 }, // 4: top-left
  { x: 480, y: 50 }, // 5: top-center-left
  { x: 720, y: 50 }, // 6: top-center-right
  { x: 970, y: 110 }, // 7: top-right
  { x: 1135, y: 290 }, // 8: right-upper
  { x: 1100, y: 480 }, // 9: right-lower
];

function formatChips(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function PokerTable() {
  const emptySlots = TOTAL_COMMUNITY_SLOTS - mockCommunityCards.length;

  return (
    <div className={styles.scene}>
      <div className={styles.felt}>
        <div className={styles.rail} />
        <div className={styles.railPad} />
        <div className={styles.feltTexture} />

        {/* Community cards + pot */}
        <div className={styles.communityArea}>
          <div className={styles.potLabel}>Pot: {formatChips(mockPot)}</div>
          <div className={styles.communityCards}>
            {mockCommunityCards.map((card) => (
              <PlayingCard key={`${card.rank}-${card.suit}`} card={card} />
            ))}
            {Array.from({ length: emptySlots }, (_, i) => {
              const slotName =
                mockCommunityCards.length + i < 3
                  ? `flop-${mockCommunityCards.length + i}`
                  : mockCommunityCards.length + i === 3
                    ? "turn"
                    : "river";
              return <div key={slotName} className={styles.emptySlot} />;
            })}
          </div>
        </div>
      </div>

      {mockPlayers.map((player, i) => (
        <div
          key={player.id}
          style={{
            position: "absolute",
            left: SEAT_POSITIONS[i].x,
            top: SEAT_POSITIONS[i].y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <PlayerSeat
            player={player}
            seatColor={SEAT_COLORS[i]}
            holeCardSecondClass={styles.holeCardSecond}
          />
        </div>
      ))}
    </div>
  );
}
