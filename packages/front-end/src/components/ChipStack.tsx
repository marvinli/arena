import { formatChips } from "../chips";
import styles from "./ChipStack.module.css";

export function ChipStackDisplay({ amount }: { amount: number }) {
  return (
    <div className={styles.chipArea}>
      <span className={styles.label}>{formatChips(amount)}</span>
    </div>
  );
}
