import { formatChips, toChipStacks } from "../chips";
import styles from "./ChipStack.module.css";

const MAX_VISIBLE_PER_STACK = 5;

export function ChipStackDisplay({ amount }: { amount: number }) {
  const stacks = toChipStacks(amount);

  return (
    <div className={styles.chipArea}>
      <div className={styles.stacks}>
        {stacks.map((stack) => (
          <div key={stack.label} className={styles.stack}>
            {Array.from({
              length: Math.min(stack.count, MAX_VISIBLE_PER_STACK),
            }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: decorative identical chips
                key={i}
                className={styles.chip}
                style={{ backgroundColor: stack.color }}
              />
            ))}
          </div>
        ))}
      </div>
      <span className={styles.label}>{formatChips(amount)}</span>
    </div>
  );
}
