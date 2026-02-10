import { describe, expect, it } from "vitest";
import { formatChips, toChipStacks } from "../src/chips";

describe("formatChips", () => {
  it("formats zero", () => {
    expect(formatChips(0)).toBe("$0");
  });

  it("formats small amounts", () => {
    expect(formatChips(50)).toBe("$50");
  });

  it("formats with thousands separators", () => {
    expect(formatChips(1_000)).toBe("$1,000");
    expect(formatChips(25_000)).toBe("$25,000");
    expect(formatChips(1_000_000)).toBe("$1,000,000");
  });
});

describe("toChipStacks", () => {
  it("returns empty array for zero", () => {
    expect(toChipStacks(0)).toEqual([]);
  });

  it("uses highest denomination first", () => {
    const stacks = toChipStacks(25_000);
    expect(stacks).toEqual([{ color: "#c8a2c8", label: "25K", count: 1 }]);
  });

  it("breaks into mixed denominations", () => {
    const stacks = toChipStacks(6_525);
    expect(stacks).toEqual([
      { color: "#e8672c", label: "5K", count: 1 },
      { color: "#f5d442", label: "1K", count: 1 },
      { color: "#7b2d8b", label: "500", count: 1 },
      { color: "#2e8b57", label: "25", count: 1 },
    ]);
  });

  it("handles amounts with multiple chips of same denomination", () => {
    const stacks = toChipStacks(200);
    expect(stacks).toEqual([{ color: "#1a1a1a", label: "100", count: 2 }]);
  });

  it("handles large amounts", () => {
    const stacks = toChipStacks(50_000);
    expect(stacks).toEqual([{ color: "#c8a2c8", label: "25K", count: 2 }]);
  });
});
