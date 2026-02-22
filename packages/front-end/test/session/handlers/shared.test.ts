import { describe, expect, it } from "vitest";
import {
  buildHoleCards,
  buildPlayers,
  resetForEndcard,
} from "../../../src/session/handlers/shared";
import type { GqlPlayerInfo } from "../../../src/session/types";
import type { Player } from "../../../src/types";

// ── Helpers ──────────────────────────────────────────────

function mkPlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    name: overrides.id,
    chips: 1000,
    avatar: "",
    persona: null,
    seatIndex: 0,
    cards: null,
    isDealer: false,
    isFolded: false,
    isActive: false,
    isAllIn: false,
    isWinner: false,
    winAmount: null,
    winHand: null,
    lastAction: null,
    currentBet: 0,
    ...overrides,
  };
}

function mkGqlPlayer(
  overrides: Partial<GqlPlayerInfo> & { id: string },
): GqlPlayerInfo {
  return {
    name: overrides.id,
    chips: 1000,
    seatIndex: 0,
    bet: 0,
    status: "ACTIVE",
    ...overrides,
  };
}

// ── buildPlayers ─────────────────────────────────────────

describe("buildPlayers", () => {
  it("filters out BUSTED players", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p1", seatIndex: 0, status: "ACTIVE" }),
      mkGqlPlayer({ id: "p2", seatIndex: 1, status: "BUSTED" }),
      mkGqlPlayer({ id: "p3", seatIndex: 2, status: "FOLDED" }),
    ];
    const result = buildPlayers(raw, null, []);
    expect(result.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("maps ACTIVE, FOLDED, ALL_IN statuses correctly", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p1", seatIndex: 0, status: "ACTIVE" }),
      mkGqlPlayer({ id: "p2", seatIndex: 1, status: "FOLDED" }),
      mkGqlPlayer({ id: "p3", seatIndex: 2, status: "ALL_IN" }),
    ];
    const result = buildPlayers(raw, null, []);

    expect(result[0].isFolded).toBe(false);
    expect(result[0].isAllIn).toBe(false);

    expect(result[1].isFolded).toBe(true);
    expect(result[1].isAllIn).toBe(false);

    expect(result[2].isFolded).toBe(false);
    expect(result[2].isAllIn).toBe(true);
  });

  it("preserves avatar and persona from previous players", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p1", seatIndex: 0, chips: 900 }),
    ];
    const prev: Player[] = [
      mkPlayer({ id: "p1", avatar: "openai", persona: "aggressive shark" }),
    ];
    const result = buildPlayers(raw, null, prev);
    expect(result[0].avatar).toBe("openai");
    expect(result[0].persona).toBe("aggressive shark");
    expect(result[0].chips).toBe(900);
  });

  it("applies override function to each player", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p1", seatIndex: 0 }),
      mkGqlPlayer({ id: "p2", seatIndex: 1 }),
    ];
    const result = buildPlayers(raw, null, [], (p) => ({
      lastAction: "fold" as const,
      isActive: p.id === "p1",
    }));
    expect(result[0].lastAction).toBe("fold");
    expect(result[0].isActive).toBe(true);
    expect(result[1].lastAction).toBe("fold");
    expect(result[1].isActive).toBe(false);
  });

  it("sets isDealer based on button matching seatIndex", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p1", seatIndex: 0 }),
      mkGqlPlayer({ id: "p2", seatIndex: 1 }),
    ];
    const result = buildPlayers(raw, 1, []);
    expect(result[0].isDealer).toBe(false);
    expect(result[1].isDealer).toBe(true);
  });

  it("returns empty array when all players are BUSTED", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p1", seatIndex: 0, status: "BUSTED" }),
      mkGqlPlayer({ id: "p2", seatIndex: 1, status: "BUSTED" }),
    ];
    const result = buildPlayers(raw, null, []);
    expect(result).toEqual([]);
  });

  it("works without overrides parameter", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p1", seatIndex: 0, bet: 50 }),
    ];
    const result = buildPlayers(raw, null, []);
    expect(result).toHaveLength(1);
    expect(result[0].currentBet).toBe(50);
  });

  it("sorts players by seatIndex", () => {
    const raw: GqlPlayerInfo[] = [
      mkGqlPlayer({ id: "p3", seatIndex: 2 }),
      mkGqlPlayer({ id: "p1", seatIndex: 0 }),
      mkGqlPlayer({ id: "p2", seatIndex: 1 }),
    ];
    const result = buildPlayers(raw, null, []);
    expect(result.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
});

// ── buildHoleCards ───────────────────────────────────────

describe("buildHoleCards", () => {
  it("builds a Map from hands with >= 2 cards", () => {
    const hands = [
      {
        playerId: "p1",
        cards: [
          { rank: "A", suit: "SPADES" },
          { rank: "K", suit: "HEARTS" },
        ],
      },
      {
        playerId: "p2",
        cards: [
          { rank: "10", suit: "CLUBS" },
          { rank: "J", suit: "DIAMONDS" },
        ],
      },
    ];
    const result = buildHoleCards(hands);
    expect(result.size).toBe(2);
    expect(result.get("p1")).toEqual([
      { rank: "A", suit: "SPADES" },
      { rank: "K", suit: "HEARTS" },
    ]);
    expect(result.get("p2")).toEqual([
      { rank: "10", suit: "CLUBS" },
      { rank: "J", suit: "DIAMONDS" },
    ]);
  });

  it("returns empty Map for empty array", () => {
    const result = buildHoleCards([]);
    expect(result.size).toBe(0);
  });

  it("skips hands with fewer than 2 cards", () => {
    const hands = [
      { playerId: "p1", cards: [{ rank: "A", suit: "SPADES" }] },
      { playerId: "p2", cards: [] },
    ];
    const result = buildHoleCards(hands);
    expect(result.size).toBe(0);
    expect(result.has("p1")).toBe(false);
    expect(result.has("p2")).toBe(false);
  });

  it("takes only first two cards when more than 2 provided", () => {
    const hands = [
      {
        playerId: "p1",
        cards: [
          { rank: "A", suit: "SPADES" },
          { rank: "K", suit: "HEARTS" },
          { rank: "Q", suit: "DIAMONDS" },
        ],
      },
    ];
    const result = buildHoleCards(hands);
    expect(result.get("p1")).toEqual([
      { rank: "A", suit: "SPADES" },
      { rank: "K", suit: "HEARTS" },
    ]);
  });

  it("handles a mix of valid and short hands", () => {
    const hands = [
      {
        playerId: "p1",
        cards: [
          { rank: "2", suit: "CLUBS" },
          { rank: "3", suit: "DIAMONDS" },
        ],
      },
      { playerId: "p2", cards: [] },
      {
        playerId: "p3",
        cards: [
          { rank: "7", suit: "HEARTS" },
          { rank: "8", suit: "SPADES" },
        ],
      },
    ];
    const result = buildHoleCards(hands);
    expect(result.size).toBe(2);
    expect(result.has("p1")).toBe(true);
    expect(result.has("p2")).toBe(false);
    expect(result.has("p3")).toBe(true);
  });
});

// ── resetForEndcard ─────────────────────────────────────

describe("resetForEndcard", () => {
  it("clears cards, lastAction, and sets isActive/isDealer to false", () => {
    const players: Player[] = [
      mkPlayer({
        id: "p1",
        cards: [
          { rank: "A", suit: "spades" },
          { rank: "K", suit: "hearts" },
        ],
        lastAction: "raise",
        isActive: true,
        isDealer: true,
      }),
      mkPlayer({
        id: "p2",
        cards: [
          { rank: "2", suit: "clubs" },
          { rank: "3", suit: "diamonds" },
        ],
        lastAction: "fold",
        isActive: false,
        isDealer: false,
      }),
    ];
    const avatars = new Map<string, string>();
    const personas = new Map<string, string>();

    const result = resetForEndcard(players, avatars, personas);

    for (const p of result) {
      expect(p.cards).toBeNull();
      expect(p.lastAction).toBeNull();
      expect(p.isActive).toBe(false);
      expect(p.isDealer).toBe(false);
    }
  });

  it("restores avatars from the persisted avatar map", () => {
    const players: Player[] = [
      mkPlayer({ id: "p1", avatar: "old-avatar" }),
      mkPlayer({ id: "p2", avatar: "" }),
    ];
    const avatars = new Map([
      ["p1", "openai"],
      ["p2", "anthropic"],
    ]);
    const personas = new Map<string, string>();

    const result = resetForEndcard(players, avatars, personas);
    expect(result[0].avatar).toBe("openai");
    expect(result[1].avatar).toBe("anthropic");
  });

  it("restores personas from the persisted persona map", () => {
    const players: Player[] = [
      mkPlayer({ id: "p1", persona: null }),
      mkPlayer({ id: "p2", persona: "old-persona" }),
    ];
    const avatars = new Map<string, string>();
    const personas = new Map([
      ["p1", "aggressive shark"],
      ["p2", "conservative player"],
    ]);

    const result = resetForEndcard(players, avatars, personas);
    expect(result[0].persona).toBe("aggressive shark");
    expect(result[1].persona).toBe("conservative player");
  });

  it("falls back to existing avatar/persona when not in maps", () => {
    const players: Player[] = [
      mkPlayer({ id: "p1", avatar: "existing-avatar", persona: "tight" }),
    ];
    const avatars = new Map<string, string>();
    const personas = new Map<string, string>();

    const result = resetForEndcard(players, avatars, personas);
    expect(result[0].avatar).toBe("existing-avatar");
    expect(result[0].persona).toBe("tight");
  });

  it("returns empty array for empty players", () => {
    const result = resetForEndcard([], new Map(), new Map());
    expect(result).toEqual([]);
  });
});
