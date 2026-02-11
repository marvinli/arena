import { formatChips } from "../../../../chips";
import styles from "./ChipStack.module.css";

export function ChipIcon({
  className,
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <ellipse cx="10" cy="5" rx="6.5" ry="2.5" />
      <path d="M3.5 5v10c0 1.38 2.9 2.5 6.5 2.5s6.5-1.12 6.5-2.5V5" />
      <path d="M3.5 8.5c0 1.38 2.9 2.5 6.5 2.5s6.5-1.12 6.5-2.5" />
      <path d="M3.5 12c0 1.38 2.9 2.5 6.5 2.5s6.5-1.12 6.5-2.5" />
    </svg>
  );
}

export function ChipStackDisplay({
  amount,
  color,
}: {
  amount: number;
  color?: string;
}) {
  return (
    <div className={styles.chipArea}>
      <span className={styles.label}>
        <ChipIcon className={styles.icon} color={color} />
        {formatChips(amount)}
      </span>
    </div>
  );
}
