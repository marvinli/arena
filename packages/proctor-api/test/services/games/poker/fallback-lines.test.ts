import { describe, expect, it } from "vitest";
import {
  fallbackCheckLine,
  fallbackFoldLine,
} from "../../../../src/services/games/poker/fallback-lines.js";

describe("fallback-lines", () => {
  it("fallbackCheckLine returns a non-empty string", () => {
    const line = fallbackCheckLine();
    expect(typeof line).toBe("string");
    expect(line.length).toBeGreaterThan(0);
  });

  it("fallbackFoldLine returns a non-empty string", () => {
    const line = fallbackFoldLine();
    expect(typeof line).toBe("string");
    expect(line.length).toBeGreaterThan(0);
  });

  it("check lines mention check-related content", () => {
    // Run multiple times to sample the randomness
    const lines = new Set<string>();
    for (let i = 0; i < 50; i++) {
      lines.add(fallbackCheckLine());
    }
    // Should have sampled at least 2 different lines
    expect(lines.size).toBeGreaterThan(1);
    // Every line should contain "check" (case-insensitive)
    for (const line of lines) {
      expect(line.toLowerCase()).toContain("check");
    }
  });

  it("fold lines mention fold-related content", () => {
    const lines = new Set<string>();
    for (let i = 0; i < 50; i++) {
      lines.add(fallbackFoldLine());
    }
    expect(lines.size).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.toLowerCase()).toContain("fold");
    }
  });
});
