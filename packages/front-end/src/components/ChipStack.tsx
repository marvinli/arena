import { formatChips } from "../chips";
import styles from "./ChipStack.module.css";

function ChipIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1" />
      <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="16" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" />
      <line x1="1" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ChipStackDisplay({ amount }: { amount: number }) {
  return (
    <div className={styles.chipArea}>
      <span className={styles.label}>
        <ChipIcon />
        {formatChips(amount)}
      </span>
    </div>
  );
}
