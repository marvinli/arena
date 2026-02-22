import { describe, expect, it } from "vitest";
import type { GameConfig } from "../../../../../src/game-config.js";
import { buildSnapshot } from "../../../../../src/services/games/poker/orchestrator/emitter.js";
import type { Session } from "../../../../../src/services/session/session-manager.js";

// ---- helpers ----

function makeSession(overrides?: Partial<Session>): Session {
  const config: GameConfig = {
    players: [
      {
        playerId: "p1",
        name: "Alice",
        modelId: "gpt-4",
        provider: "openai",
        persona: "shark",
        bio: "A fierce competitor.",
        ttsVoice: "Dennis",
        avatarUrl: "https://example.com/alice.png",
      },
      {
        playerId: "p2",
        name: "Bob",
        modelId: "claude-3",
        provider: "anthropic",
        persona: "fish",
        bio: "A relaxed player.",
        ttsVoice: "Aria",
      },
    ],
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
  };

  const personaAssignments = new Map<string, string>();
  personaAssignments.set("p1", "shark");
  personaAssignments.set("p2", "fish");

  return {
    channelKey: "test-channel",
    config,
    gameId: "game-123",
    status: "RUNNING",
    handNumber: 5,
    button: 0,
    players: [
      {
        id: "p1",
        name: "Alice",
        chips: 800,
        modelId: "gpt-4",
        provider: "openai",
      },
      {
        id: "p2",
        name: "Bob",
        chips: 1200,
        modelId: "claude-3",
        provider: "anthropic",
      },
    ],
    currentHands: [
      {
        playerId: "p1",
        cards: [
          { rank: "A", suit: "spades" },
          { rank: "K", suit: "spades" },
        ],
      },
      {
        playerId: "p2",
        cards: [
          { rank: "Q", suit: "hearts" },
          { rank: "J", suit: "hearts" },
        ],
      },
    ],
    lastInstruction: null,
    lastGameState: {
      phase: "flop",
      button: 0,
      players: [
        {
          id: "p1",
          name: "Alice",
          chips: 800,
          bet: 20,
          status: "ACTIVE",
          seatIndex: 0,
        },
        {
          id: "p2",
          name: "Bob",
          chips: 1200,
          bet: 20,
          status: "ACTIVE",
          seatIndex: 1,
        },
      ],
      communityCards: [
        { rank: "A", suit: "hearts" },
        { rank: "K", suit: "diamonds" },
        { rank: "Q", suit: "clubs" },
      ],
      pots: [{ size: 40, eligiblePlayerIds: ["p1", "p2"] }],
    },
    personaAssignments,
    abortController: new AbortController(),
    ...overrides,
  };
}

// ---- tests ----

describe("buildSnapshot", () => {
  it("returns valid JSON string", () => {
    const session = makeSession();
    const snapshot = buildSnapshot(session);
    expect(() => JSON.parse(snapshot)).not.toThrow();
  });

  it("contains expected top-level fields", () => {
    const session = makeSession();
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.channelKey).toBe("test-channel");
    expect(snapshot.status).toBe("RUNNING");
    expect(snapshot.gameId).toBe("game-123");
    expect(snapshot.handNumber).toBe(5);
    expect(snapshot.phase).toBe("flop");
    expect(snapshot.button).toBe(0);
    expect(snapshot.smallBlind).toBe(10);
    expect(snapshot.bigBlind).toBe(20);
  });

  it("contains players from lastGameState", () => {
    const session = makeSession();
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.players).toHaveLength(2);
    expect(snapshot.players[0]).toEqual({
      id: "p1",
      name: "Alice",
      chips: 800,
      bet: 20,
      status: "ACTIVE",
      seatIndex: 0,
    });
  });

  it("contains communityCards from lastGameState", () => {
    const session = makeSession();
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.communityCards).toHaveLength(3);
    expect(snapshot.communityCards[0]).toEqual({ rank: "A", suit: "hearts" });
  });

  it("contains pots from lastGameState", () => {
    const session = makeSession();
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.pots).toHaveLength(1);
    expect(snapshot.pots[0]).toEqual({
      size: 40,
      eligiblePlayerIds: ["p1", "p2"],
    });
  });

  it("contains hands from session.currentHands", () => {
    const session = makeSession();
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.hands).toHaveLength(2);
    expect(snapshot.hands[0].playerId).toBe("p1");
    expect(snapshot.hands[0].cards).toHaveLength(2);
  });

  it("contains playerMeta with persona assignments", () => {
    const session = makeSession();
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.playerMeta).toHaveLength(2);
    expect(snapshot.playerMeta[0]).toEqual({
      id: "p1",
      ttsVoice: "Dennis",
      avatarUrl: "https://example.com/alice.png",
      persona: "shark",
    });
    expect(snapshot.playerMeta[1]).toEqual({
      id: "p2",
      ttsVoice: "Aria",
      avatarUrl: null,
      persona: "fish",
    });
  });

  it("handles null lastGameState gracefully", () => {
    const session = makeSession({ lastGameState: null });
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.phase).toBeNull();
    expect(snapshot.button).toBeNull();
    expect(snapshot.players).toEqual([]);
    expect(snapshot.communityCards).toEqual([]);
    expect(snapshot.pots).toEqual([]);
  });

  it("handles undefined personaAssignments", () => {
    const session = makeSession({ personaAssignments: undefined });
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.playerMeta).toHaveLength(2);
    // Without persona assignments, persona should be null
    expect(snapshot.playerMeta[0].persona).toBeNull();
    expect(snapshot.playerMeta[1].persona).toBeNull();
  });

  it("includes correct config blinds from session", () => {
    const session = makeSession();
    session.config.smallBlind = 50;
    session.config.bigBlind = 100;
    const snapshot = JSON.parse(buildSnapshot(session));

    expect(snapshot.smallBlind).toBe(50);
    expect(snapshot.bigBlind).toBe(100);
  });
});
