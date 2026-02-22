import { describe, expect, it } from "vitest";
import type { BlindLevel } from "../../../../../src/game-config.js";
import {
  _computeAwards,
  _shuffle,
  getBlindLevel,
} from "../../../../../src/services/games/poker/orchestrator/index.js";
import type { ActionTracker } from "../../../../../src/services/games/poker/orchestrator/types.js";

// ---- helpers ----

function makeTracker(
  entries: Array<{
    id: string;
    name: string;
    folds?: number;
    calls?: number;
    checks?: number;
    bets?: number;
    raises?: number;
    allIns?: number;
    handsWon?: number;
    biggestPotWon?: number;
    eliminations?: number;
    analysisLengths?: number[];
  }>,
): {
  tracker: ActionTracker;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    bet: number;
    status: string;
    seatIndex: number;
  }>;
} {
  const tracker: ActionTracker = new Map();
  const players = entries.map((e, i) => {
    tracker.set(e.id, {
      folds: e.folds ?? 0,
      calls: e.calls ?? 0,
      checks: e.checks ?? 0,
      bets: e.bets ?? 0,
      raises: e.raises ?? 0,
      allIns: e.allIns ?? 0,
      handsWon: e.handsWon ?? 0,
      biggestPotWon: e.biggestPotWon ?? 0,
      eliminations: e.eliminations ?? 0,
      analysisLengths: e.analysisLengths ?? [],
    });
    return {
      id: e.id,
      name: e.name,
      chips: 1000,
      bet: 0,
      status: "ACTIVE",
      seatIndex: i,
    };
  });
  return { tracker, players };
}

// ---- tests ----

describe("getBlindLevel", () => {
  const schedule: BlindLevel[] = [
    { smallBlind: 10, bigBlind: 20 },
    { smallBlind: 20, bigBlind: 40 },
    { smallBlind: 50, bigBlind: 100 },
  ];

  it("hand 1 returns first level", () => {
    const level = getBlindLevel(1, schedule, 3);
    expect(level).toEqual({ smallBlind: 10, bigBlind: 20 });
  });

  it("hand at boundary returns next level", () => {
    // handsPerLevel=3, hand 4 should be level index 1
    const level = getBlindLevel(4, schedule, 3);
    expect(level).toEqual({ smallBlind: 20, bigBlind: 40 });
  });

  it("hands within first level all return first level", () => {
    expect(getBlindLevel(1, schedule, 3)).toEqual({
      smallBlind: 10,
      bigBlind: 20,
    });
    expect(getBlindLevel(2, schedule, 3)).toEqual({
      smallBlind: 10,
      bigBlind: 20,
    });
    expect(getBlindLevel(3, schedule, 3)).toEqual({
      smallBlind: 10,
      bigBlind: 20,
    });
  });

  it("hand beyond schedule length clamps to last level", () => {
    // 3 levels, handsPerLevel=2, hand 100 => levelIndex=49, clamped to 2
    const level = getBlindLevel(100, schedule, 2);
    expect(level).toEqual({ smallBlind: 50, bigBlind: 100 });
  });

  it("single-level schedule always returns that level", () => {
    const single: BlindLevel[] = [{ smallBlind: 5, bigBlind: 10 }];
    expect(getBlindLevel(1, single, 3)).toEqual({
      smallBlind: 5,
      bigBlind: 10,
    });
    expect(getBlindLevel(50, single, 3)).toEqual({
      smallBlind: 5,
      bigBlind: 10,
    });
    expect(getBlindLevel(999, single, 1)).toEqual({
      smallBlind: 5,
      bigBlind: 10,
    });
  });

  it("handsPerLevel=1 escalates every hand", () => {
    expect(getBlindLevel(1, schedule, 1)).toEqual({
      smallBlind: 10,
      bigBlind: 20,
    });
    expect(getBlindLevel(2, schedule, 1)).toEqual({
      smallBlind: 20,
      bigBlind: 40,
    });
    expect(getBlindLevel(3, schedule, 1)).toEqual({
      smallBlind: 50,
      bigBlind: 100,
    });
    // Beyond schedule clamps
    expect(getBlindLevel(4, schedule, 1)).toEqual({
      smallBlind: 50,
      bigBlind: 100,
    });
  });
});

describe("computeAwards", () => {
  it("returns empty array for empty tracker", () => {
    const tracker: ActionTracker = new Map();
    const awards = _computeAwards(tracker, []);
    expect(awards).toEqual([]);
  });

  it("awards Most Aggressive to player with most bets+raises", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", bets: 5, raises: 3 },
      { id: "p2", name: "Bob", bets: 1, raises: 1 },
    ]);
    const awards = _computeAwards(tracker, players);
    const aggressive = awards.find((a) => a.title === "Most Aggressive");
    expect(aggressive).toBeDefined();
    expect(aggressive!.playerIds).toEqual(["p1"]);
    expect(aggressive!.playerNames).toEqual(["Alice"]);
    expect(aggressive!.description).toBe("8 bets/raises");
  });

  it("skips Most Aggressive when no bets or raises", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", calls: 5 },
      { id: "p2", name: "Bob", checks: 3 },
    ]);
    const awards = _computeAwards(tracker, players);
    expect(awards.find((a) => a.title === "Most Aggressive")).toBeUndefined();
  });

  it("awards Most Passive to player with most calls+checks", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", calls: 2, checks: 1 },
      { id: "p2", name: "Bob", calls: 5, checks: 4 },
    ]);
    const awards = _computeAwards(tracker, players);
    const passive = awards.find((a) => a.title === "Most Passive");
    expect(passive).toBeDefined();
    expect(passive!.playerIds).toEqual(["p2"]);
    expect(passive!.playerNames).toEqual(["Bob"]);
    expect(passive!.description).toBe("9 calls/checks");
  });

  it("skips Most Passive when no calls or checks", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", bets: 3 },
      { id: "p2", name: "Bob", raises: 2 },
    ]);
    const awards = _computeAwards(tracker, players);
    expect(awards.find((a) => a.title === "Most Passive")).toBeUndefined();
  });

  it("awards Tightest to player with highest fold rate", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", folds: 8, calls: 2 }, // 80% fold rate
      { id: "p2", name: "Bob", folds: 3, calls: 7 }, // 30% fold rate
    ]);
    const awards = _computeAwards(tracker, players);
    const tight = awards.find((a) => a.title === "Tightest");
    expect(tight).toBeDefined();
    expect(tight!.playerIds).toEqual(["p1"]);
    expect(tight!.description).toBe("80% fold rate");
  });

  it("skips Tightest when no player has folded", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", calls: 5 },
      { id: "p2", name: "Bob", checks: 3 },
    ]);
    const awards = _computeAwards(tracker, players);
    expect(awards.find((a) => a.title === "Tightest")).toBeUndefined();
  });

  it("awards Loosest to player with lowest fold rate", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", folds: 8, calls: 2 }, // 80% fold rate
      { id: "p2", name: "Bob", folds: 1, calls: 9 }, // 10% fold rate
    ]);
    const awards = _computeAwards(tracker, players);
    const loose = awards.find((a) => a.title === "Loosest");
    expect(loose).toBeDefined();
    expect(loose!.playerIds).toEqual(["p2"]);
    expect(loose!.description).toBe("10% fold rate");
  });

  it("awards Yolo to player with most all-ins", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", allIns: 5, bets: 5 },
      { id: "p2", name: "Bob", allIns: 2, bets: 2 },
    ]);
    const awards = _computeAwards(tracker, players);
    const yolo = awards.find((a) => a.title === "Yolo");
    expect(yolo).toBeDefined();
    expect(yolo!.playerIds).toEqual(["p1"]);
    expect(yolo!.description).toBe("5 all-ins");
  });

  it("skips Yolo when no all-ins", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", bets: 5 },
    ]);
    const awards = _computeAwards(tracker, players);
    expect(awards.find((a) => a.title === "Yolo")).toBeUndefined();
  });

  it("awards Biggest Pot Won", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", biggestPotWon: 500 },
      { id: "p2", name: "Bob", biggestPotWon: 1200 },
    ]);
    const awards = _computeAwards(tracker, players);
    const bigPot = awards.find((a) => a.title === "Biggest Pot Won");
    expect(bigPot).toBeDefined();
    expect(bigPot!.playerIds).toEqual(["p2"]);
    expect(bigPot!.description).toBe("$1,200");
  });

  it("skips Biggest Pot Won when all zero", () => {
    const { tracker, players } = makeTracker([{ id: "p1", name: "Alice" }]);
    const awards = _computeAwards(tracker, players);
    expect(awards.find((a) => a.title === "Biggest Pot Won")).toBeUndefined();
  });

  it("awards Most Hands Won", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", handsWon: 7 },
      { id: "p2", name: "Bob", handsWon: 3 },
    ]);
    const awards = _computeAwards(tracker, players);
    const hw = awards.find((a) => a.title === "Most Hands Won");
    expect(hw).toBeDefined();
    expect(hw!.playerIds).toEqual(["p1"]);
    expect(hw!.description).toBe("7 hands");
  });

  it("skips Most Hands Won when all zero", () => {
    const { tracker, players } = makeTracker([{ id: "p1", name: "Alice" }]);
    const awards = _computeAwards(tracker, players);
    expect(awards.find((a) => a.title === "Most Hands Won")).toBeUndefined();
  });

  it("awards Analysis Paralysis to longest average analysis", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", analysisLengths: [100, 200, 300] }, // avg 200
      { id: "p2", name: "Bob", analysisLengths: [50, 60, 70] }, // avg 60
    ]);
    const awards = _computeAwards(tracker, players);
    const ap = awards.find((a) => a.title === "Analysis Paralysis");
    expect(ap).toBeDefined();
    expect(ap!.playerIds).toEqual(["p1"]);
    expect(ap!.description).toBe("avg 200 characters");
  });

  it("awards Just Do It to shortest average analysis", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", analysisLengths: [100, 200, 300] }, // avg 200
      { id: "p2", name: "Bob", analysisLengths: [50, 60, 70] }, // avg 60
    ]);
    const awards = _computeAwards(tracker, players);
    const jdi = awards.find((a) => a.title === "Just Do It");
    expect(jdi).toBeDefined();
    expect(jdi!.playerIds).toEqual(["p2"]);
    expect(jdi!.description).toBe("avg 60 characters");
  });

  it("skips analysis awards when no player has analysis lengths", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", calls: 3 },
    ]);
    const awards = _computeAwards(tracker, players);
    expect(
      awards.find((a) => a.title === "Analysis Paralysis"),
    ).toBeUndefined();
    expect(awards.find((a) => a.title === "Just Do It")).toBeUndefined();
  });

  it("awards Bounty Hunter to player with most eliminations", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", eliminations: 4 },
      { id: "p2", name: "Bob", eliminations: 1 },
    ]);
    const awards = _computeAwards(tracker, players);
    const bh = awards.find((a) => a.title === "Bounty Hunter");
    expect(bh).toBeDefined();
    expect(bh!.playerIds).toEqual(["p1"]);
    expect(bh!.description).toBe("4 eliminations");
  });

  it("skips Bounty Hunter when no eliminations", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", calls: 5 },
    ]);
    const awards = _computeAwards(tracker, players);
    expect(awards.find((a) => a.title === "Bounty Hunter")).toBeUndefined();
  });

  it("handles tie-breaking via topBy (multiple winners for same score)", () => {
    const { tracker, players } = makeTracker([
      { id: "p1", name: "Alice", bets: 5, raises: 3 },
      { id: "p2", name: "Bob", bets: 4, raises: 4 },
      { id: "p3", name: "Charlie", bets: 1, raises: 1 },
    ]);
    const awards = _computeAwards(tracker, players);
    const aggressive = awards.find((a) => a.title === "Most Aggressive");
    expect(aggressive).toBeDefined();
    // Both have 8 bets+raises
    expect(aggressive!.playerIds).toHaveLength(2);
    expect(aggressive!.playerIds).toContain("p1");
    expect(aggressive!.playerIds).toContain("p2");
    expect(aggressive!.playerNames).toContain("Alice");
    expect(aggressive!.playerNames).toContain("Bob");
  });

  it("handles single player", () => {
    const { tracker, players } = makeTracker([
      {
        id: "p1",
        name: "Alice",
        bets: 3,
        raises: 2,
        calls: 1,
        checks: 4,
        folds: 2,
        allIns: 1,
        handsWon: 5,
        biggestPotWon: 800,
        eliminations: 2,
        analysisLengths: [100, 200],
      },
    ]);
    const awards = _computeAwards(tracker, players);
    // Single player should still get awards where applicable
    expect(awards.find((a) => a.title === "Most Aggressive")).toBeDefined();
    expect(awards.find((a) => a.title === "Most Passive")).toBeDefined();
    expect(awards.find((a) => a.title === "Yolo")).toBeDefined();
    expect(awards.find((a) => a.title === "Biggest Pot Won")).toBeDefined();
    expect(awards.find((a) => a.title === "Most Hands Won")).toBeDefined();
    expect(awards.find((a) => a.title === "Bounty Hunter")).toBeDefined();
    expect(awards.find((a) => a.title === "Analysis Paralysis")).toBeDefined();
    expect(awards.find((a) => a.title === "Just Do It")).toBeDefined();
  });

  it("uses player id as name fallback when player not in list", () => {
    const tracker: ActionTracker = new Map();
    tracker.set("unknown-id", {
      folds: 0,
      calls: 0,
      checks: 0,
      bets: 3,
      raises: 2,
      allIns: 0,
      handsWon: 0,
      biggestPotWon: 0,
      eliminations: 0,
      analysisLengths: [],
    });
    // Pass empty players array so getName falls back to id
    const awards = _computeAwards(tracker, []);
    const aggressive = awards.find((a) => a.title === "Most Aggressive");
    expect(aggressive).toBeDefined();
    expect(aggressive!.playerNames).toEqual(["unknown-id"]);
  });
});

describe("shuffle", () => {
  it("returns same length", () => {
    const original = [1, 2, 3, 4, 5];
    const result = _shuffle(original);
    expect(result).toHaveLength(original.length);
  });

  it("contains same elements", () => {
    const original = [1, 2, 3, 4, 5];
    const result = _shuffle(original);
    expect(result.sort()).toEqual([...original].sort());
  });

  it("does not mutate original array", () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    _shuffle(original);
    expect(original).toEqual(copy);
  });

  it("handles empty array", () => {
    const result = _shuffle([]);
    expect(result).toEqual([]);
  });

  it("handles single element", () => {
    const result = _shuffle([42]);
    expect(result).toEqual([42]);
  });

  it("works with non-numeric types", () => {
    const original = ["a", "b", "c"];
    const result = _shuffle(original);
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual(["a", "b", "c"]);
  });
});
