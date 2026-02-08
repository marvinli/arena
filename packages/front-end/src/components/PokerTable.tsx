import { mockPlayers } from "../mockData";
import { PlayerSeat } from "./PlayerSeat";
import styles from "./PokerTable.module.css";

/**
 * 10-seat positions around an ellipse.
 * The table scene is 1000x620. The ellipse center is at (500, 310).
 * Seats are offset outward from the ellipse edge so players sit
 * around the rail, not on top of the felt.
 *
 * Positions are hand-tuned for a natural oval layout:
 * Bottom center (seat 0) → clockwise.
 */
const SEAT_POSITIONS: { x: number; y: number }[] = [
  { x: 500, y: 570 }, // 0: bottom center
  { x: 270, y: 540 }, // 1: bottom-left
  { x: 90, y: 420 }, // 2: left-lower
  { x: 60, y: 260 }, // 3: left-upper
  { x: 200, y: 100 }, // 4: top-left
  { x: 420, y: 50 }, // 5: top-center-left
  { x: 580, y: 50 }, // 6: top-center-right
  { x: 800, y: 100 }, // 7: top-right
  { x: 940, y: 260 }, // 8: right-upper
  { x: 910, y: 420 }, // 9: right-lower
];

export function PokerTable() {
  return (
    <div className={styles.scene}>
      <div className={styles.felt}>
        <div className={styles.rail} />
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
          <PlayerSeat player={player} />
        </div>
      ))}
    </div>
  );
}
