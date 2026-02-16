import { formatChips } from "../../../../chips";
import { ChipIcon } from "../ChipStack";
import {
  BET_MAX_STEP,
  BET_PULL_DISTANCE,
  SIDE_ROW_Y_NUDGE,
  SIDE_SEATS,
  TOP_ROW_SEATS,
  TOP_ROW_Y_NUDGE,
} from "../layout";
import styles from "../PokerTable.module.css";

export function BetIndicator({
  amount,
  isAllIn,
  seatColor,
  seatX,
  seatY,
  seatIndex,
}: {
  amount: number;
  isAllIn: boolean;
  seatColor: string;
  seatX: number;
  seatY: number;
  seatIndex: number;
}) {
  // Position bet indicator toward center (50, 50)
  const cx = 50;
  const cy = 50;
  const dx = cx - seatX;
  const dy = cy - seatY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.min(BET_MAX_STEP, BET_PULL_DISTANCE / dist);
  const betX = seatX + dx * step;

  // Nudge bets away from player info to avoid overlap
  const isTopRow = TOP_ROW_SEATS.includes(seatIndex);
  const isSideRow = SIDE_SEATS.includes(seatIndex);
  const yNudge = isTopRow ? TOP_ROW_Y_NUDGE : isSideRow ? SIDE_ROW_Y_NUDGE : 0;
  const betY = seatY + dy * step + yNudge;

  return (
    <div
      className={`${styles.betIndicator} ${isAllIn ? styles.allIn : ""}`}
      style={{
        left: `${betX}%`,
        top: `${betY}%`,
        borderColor: seatColor,
      }}
    >
      {isAllIn && <span className={styles.allInLabel}>ALL IN</span>}
      <ChipIcon className={styles.betChipIcon} color={seatColor} />
      <span className={styles.betAmount}>{formatChips(amount)}</span>
    </div>
  );
}
