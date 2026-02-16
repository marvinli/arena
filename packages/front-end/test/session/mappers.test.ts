import { describe, expect, it } from "vitest";
import {
  buildPlayerMetaMaps,
  mapCard,
  mapPlayer,
  mapPlayers,
  mapPots,
} from "../../src/session/mappers";
import type { Player } from "../../src/types";

describe("mapCard", () => {
  it("maps rank and suit", () => {
    expect(mapCard({ rank: "A", suit: "SPADES" })).toEqual({
      rank: "A",
      suit: "SPADES",
    });
  });
});

describe("mapPots", () => {
  it("returns empty array for no pots", () => {
    expect(mapPots([])).toEqual([]);
  });

  it("labels first pot as Main Pot", () => {
    const result = mapPots([{ size: 100, eligiblePlayerIds: [] }]);
    expect(result).toEqual([{ label: "Main Pot", amount: 100 }]);
  });

  it("labels subsequent pots as Side Pot N", () => {
    const result = mapPots([
      { size: 200, eligiblePlayerIds: [] },
      { size: 50, eligiblePlayerIds: [] },
      { size: 25, eligiblePlayerIds: [] },
    ]);
    expect(result).toEqual([
      { label: "Main Pot", amount: 200 },
      { label: "Side Pot 1", amount: 50 },
      { label: "Side Pot 2", amount: 25 },
    ]);
  });
});

describe("mapPlayer", () => {
  const baseInfo = {
    id: "p1",
    name: "Alice",
    chips: 500,
    seatIndex: 0,
    bet: 10,
    status: "ACTIVE" as const,
  };

  it("maps basic fields", () => {
    const player = mapPlayer(baseInfo, null);
    expect(player.id).toBe("p1");
    expect(player.chips).toBe(500);
    expect(player.currentBet).toBe(10);
    expect(player.isFolded).toBe(false);
    expect(player.isAllIn).toBe(false);
    expect(player.isDealer).toBe(false);
  });

  it("detects dealer by seatIndex matching button", () => {
    const player = mapPlayer(baseInfo, 0);
    expect(player.isDealer).toBe(true);
  });

  it("detects folded status", () => {
    const player = mapPlayer({ ...baseInfo, status: "FOLDED" }, null);
    expect(player.isFolded).toBe(true);
  });

  it("detects all-in status", () => {
    const player = mapPlayer({ ...baseInfo, status: "ALL_IN" }, null);
    expect(player.isAllIn).toBe(true);
  });

  it("preserves existing avatar and cards", () => {
    const existing = {
      avatar: "http://example.com/avatar.png",
      cards: [
        { rank: "A", suit: "spades" },
        { rank: "K", suit: "hearts" },
      ] as [
        Player["cards"] extends infer T ? (T extends null ? never : T) : never,
      ][0] extends never
        ? never
        : Player["cards"],
    } as Partial<Player>;

    const player = mapPlayer(baseInfo, null, existing as Player);
    expect(player.avatar).toBe("http://example.com/avatar.png");
  });
});

describe("buildPlayerMetaMaps", () => {
  it("builds avatar, persona, and voice maps", () => {
    const meta = [
      { id: "p1", avatarUrl: "openai", persona: "shark", ttsVoice: "alloy" },
      { id: "p2", avatarUrl: null, persona: null, ttsVoice: null },
    ];
    const { avatars, personas, voices } = buildPlayerMetaMaps(meta);
    expect(avatars.get("p1")).toBe("openai");
    expect(avatars.get("p2")).toBe("");
    expect(personas.get("p1")).toBe("shark");
    expect(personas.get("p2")).toBeNull();
    expect(voices.get("p1")).toBe("alloy");
    expect(voices.has("p2")).toBe(false);
  });

  it("returns empty maps for empty input", () => {
    const { avatars, personas, voices } = buildPlayerMetaMaps([]);
    expect(avatars.size).toBe(0);
    expect(personas.size).toBe(0);
    expect(voices.size).toBe(0);
  });
});

describe("mapPlayers", () => {
  it("sorts by seatIndex", () => {
    const infos = [
      {
        id: "p2",
        name: "B",
        chips: 100,
        seatIndex: 2,
        bet: 0,
        status: "ACTIVE" as const,
      },
      {
        id: "p1",
        name: "A",
        chips: 200,
        seatIndex: 0,
        bet: 0,
        status: "ACTIVE" as const,
      },
      {
        id: "p3",
        name: "C",
        chips: 300,
        seatIndex: 1,
        bet: 0,
        status: "ACTIVE" as const,
      },
    ];
    const result = mapPlayers(infos, null, []);
    expect(result.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
  });

  it("merges existing player data", () => {
    const infos = [
      {
        id: "p1",
        name: "A",
        chips: 200,
        seatIndex: 0,
        bet: 0,
        status: "ACTIVE" as const,
      },
    ];
    const existing: Player[] = [
      {
        id: "p1",
        name: "A",
        chips: 100,
        avatar: "test-avatar",
        cards: null,
        isDealer: false,
        isFolded: false,
        isActive: true,
        isAllIn: false,
        lastAction: "call",
        currentBet: 0,
      },
    ];
    const result = mapPlayers(infos, null, existing);
    expect(result[0].avatar).toBe("test-avatar");
    expect(result[0].isActive).toBe(true);
    expect(result[0].lastAction).toBe("call");
  });
});
