/** Vegas casino chip denominations and colors */
export const CHIP_DEFS = [
  { value: 25_000, color: "#c8a2c8", label: "25K" }, // lavender
  { value: 5_000, color: "#e8672c", label: "5K" }, // orange
  { value: 1_000, color: "#f5d442", label: "1K" }, // yellow
  { value: 500, color: "#7b2d8b", label: "500" }, // purple
  { value: 100, color: "#1a1a1a", label: "100" }, // black
  { value: 25, color: "#2e8b57", label: "25" }, // green
] as const;

export interface ChipStack {
  color: string;
  label: string;
  count: number;
}

/** Break a dollar amount into Vegas-denomination chip stacks */
export function toChipStacks(amount: number): ChipStack[] {
  const stacks: ChipStack[] = [];
  let remaining = amount;

  for (const { value, color, label } of CHIP_DEFS) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      stacks.push({ color, label, count });
      remaining -= count * value;
    }
  }

  return stacks;
}

/** Format dollar amount for display */
export function formatChips(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
