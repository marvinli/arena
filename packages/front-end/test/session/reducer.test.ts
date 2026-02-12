import { describe, expect, it } from "vitest";
import { INITIAL_STATE, reducer } from "../../src/session/reducer";
import type { GqlInstruction } from "../../src/session/types";

function inst(partial: Partial<GqlInstruction>): GqlInstruction {
  return {
    instructionId: "test-1",
    type: "GAME_START",
    gameStart: null,
    dealHands: null,
    dealCommunity: null,
    playerTurn: null,
    playerAnalysis: null,
    playerAction: null,
    handResult: null,
    leaderboard: null,
    gameOver: null,
    ...partial,
  };
}

describe("reducer — top-level actions", () => {
  it("START sets connecting status", () => {
    const state = reducer(INITIAL_STATE, {
      type: "START",
      channelKey: "ch-1",
    });
    expect(state.status).toBe("connecting");
    expect(state.channelKey).toBe("ch-1");
  });

  it("ERROR sets error status", () => {
    const state = reducer(INITIAL_STATE, {
      type: "ERROR",
      error: "oops",
    });
    expect(state.status).toBe("error");
    expect(state.error).toBe("oops");
  });

  it("RESET returns initial state", () => {
    const modified = {
      ...INITIAL_STATE,
      status: "running" as const,
      gameId: "g1",
    };
    const state = reducer(modified, { type: "RESET" });
    expect(state).toEqual(INITIAL_STATE);
  });

  it("SPEAK_START sets speaking state", () => {
    const state = reducer(INITIAL_STATE, {
      type: "SPEAK_START",
      playerId: "p1",
      text: "hello",
      isApiError: false,
    });
    expect(state.speakingPlayerId).toBe("p1");
    expect(state.analysisText).toBe("hello");
    expect(state.isApiError).toBe(false);
  });

  it("SPEAK_END clears speaking state", () => {
    const speaking = {
      ...INITIAL_STATE,
      speakingPlayerId: "p1",
      analysisText: "hello",
      isApiError: true,
    };
    const state = reducer(speaking, { type: "SPEAK_END" });
    expect(state.speakingPlayerId).toBeNull();
    expect(state.analysisText).toBeNull();
    expect(state.isApiError).toBe(false);
  });
});

describe("reducer — GAME_START instruction", () => {
  it("sets running status and game info", () => {
    const state = reducer(INITIAL_STATE, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "GAME_START",
        gameStart: {
          gameId: "g1",
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1000,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          playerMeta: [{ id: "p1", ttsVoice: null, avatarUrl: "openai" }],
        },
      }),
    });
    expect(state.status).toBe("running");
    expect(state.gameId).toBe("g1");
    expect(state.smallBlind).toBe(10);
    expect(state.bigBlind).toBe(20);
    expect(state.players).toHaveLength(1);
    expect(state.players[0].avatar).toBe("openai");
  });

  it("returns state unchanged when gameStart is null", () => {
    const state = reducer(INITIAL_STATE, {
      type: "INSTRUCTION",
      instruction: inst({ type: "GAME_START", gameStart: null }),
    });
    expect(state).toBe(INITIAL_STATE);
  });
});

describe("reducer — DEAL_HANDS instruction", () => {
  it("sets hand number, phase, and hole cards", () => {
    const running = {
      ...INITIAL_STATE,
      status: "running" as const,
      players: [
        {
          id: "p1",
          name: "A",
          chips: 1000,
          avatar: "openai",
          cards: null,
          isDealer: false,
          isFolded: false,
          isActive: false,
          isAllIn: false,
          lastAction: null,
          currentBet: 0,
        },
      ],
    };
    const state = reducer(running, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "DEAL_HANDS",
        dealHands: {
          handNumber: 1,
          button: 0,
          players: [
            {
              id: "p1",
              name: "A",
              chips: 990,
              seatIndex: 0,
              bet: 10,
              status: "ACTIVE",
            },
          ],
          hands: [
            {
              playerId: "p1",
              cards: [
                { rank: "A", suit: "SPADES" },
                { rank: "K", suit: "HEARTS" },
              ],
            },
          ],
          pots: [{ size: 30, eligiblePlayerIds: ["p1"] }],
        },
      }),
    });
    expect(state.handNumber).toBe(1);
    expect(state.phase).toBe("PREFLOP");
    expect(state.button).toBe(0);
    expect(state.holeCards.get("p1")).toEqual([
      { rank: "A", suit: "SPADES" },
      { rank: "K", suit: "HEARTS" },
    ]);
  });
});

describe("reducer — PLAYER_TURN instruction", () => {
  it("marks the active player", () => {
    const running = {
      ...INITIAL_STATE,
      players: [
        {
          id: "p1",
          name: "A",
          chips: 1000,
          avatar: "",
          cards: null,
          isDealer: false,
          isFolded: false,
          isActive: false,
          isAllIn: false,
          lastAction: null,
          currentBet: 0,
        },
        {
          id: "p2",
          name: "B",
          chips: 1000,
          avatar: "",
          cards: null,
          isDealer: false,
          isFolded: false,
          isActive: false,
          isAllIn: false,
          lastAction: null,
          currentBet: 0,
        },
      ],
    };
    const state = reducer(running, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "PLAYER_TURN",
        playerTurn: { playerId: "p2" },
      }),
    });
    expect(state.players[0].isActive).toBe(false);
    expect(state.players[1].isActive).toBe(true);
  });
});

describe("reducer — PLAYER_ANALYSIS instruction", () => {
  it("returns state unchanged (visual rendering is in render queue)", () => {
    const state = reducer(INITIAL_STATE, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "PLAYER_ANALYSIS",
        playerAnalysis: {
          playerId: "p1",
          analysis: "I should fold",
          isApiError: false,
        },
      }),
    });
    expect(state).toBe(INITIAL_STATE);
  });
});

describe("reducer — PLAYER_ACTION instruction", () => {
  it("sets lastAction on the acting player", () => {
    const running = {
      ...INITIAL_STATE,
      button: 0,
      players: [
        {
          id: "p1",
          name: "A",
          chips: 1000,
          avatar: "",
          cards: null,
          isDealer: true,
          isFolded: false,
          isActive: true,
          isAllIn: false,
          lastAction: null,
          currentBet: 0,
        },
      ],
    };
    const state = reducer(running, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "PLAYER_ACTION",
        playerAction: {
          playerId: "p1",
          action: "fold",
          players: [
            {
              id: "p1",
              name: "A",
              chips: 1000,
              seatIndex: 0,
              bet: 0,
              status: "FOLDED",
            },
          ],
          pots: [{ size: 30, eligiblePlayerIds: [] }],
        },
      }),
    });
    expect(state.players[0].lastAction).toBe("fold");
    expect(state.players[0].isFolded).toBe(true);
    expect(state.players[0].isActive).toBe(false);
  });
});

describe("reducer — DEAL_COMMUNITY instruction", () => {
  it("sets phase and community cards", () => {
    const state = reducer(INITIAL_STATE, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "DEAL_COMMUNITY",
        dealCommunity: {
          phase: "FLOP",
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
          ],
          pots: [{ size: 60, eligiblePlayerIds: [] }],
        },
      }),
    });
    expect(state.phase).toBe("FLOP");
    expect(state.communityCards).toHaveLength(3);
  });
});

describe("reducer — HAND_RESULT instruction", () => {
  it("sets SHOWDOWN phase", () => {
    const running = {
      ...INITIAL_STATE,
      holeCards: new Map<
        string,
        [{ rank: string; suit: string }, { rank: string; suit: string }]
      >(),
      button: 0,
    };
    const state = reducer(running, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "HAND_RESULT",
        handResult: {
          players: [
            {
              id: "p1",
              name: "A",
              chips: 1060,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          winners: [{ playerId: "p1", amount: 60, hand: "Pair" }],
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
            { rank: "J", suit: "SPADES" },
            { rank: "K", suit: "HEARTS" },
          ],
          pots: [{ size: 0, eligiblePlayerIds: [] }],
        },
      }),
    });
    expect(state.phase).toBe("SHOWDOWN");
  });
});

describe("reducer — LEADERBOARD instruction", () => {
  it("resets to WAITING phase", () => {
    const running = {
      ...INITIAL_STATE,
      phase: "SHOWDOWN" as const,
      button: 0,
      players: [
        {
          id: "p1",
          name: "A",
          chips: 1000,
          avatar: "openai",
          cards: null,
          isDealer: true,
          isFolded: false,
          isActive: false,
          isAllIn: false,
          lastAction: null,
          currentBet: 0,
        },
      ],
    };
    const state = reducer(running, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "LEADERBOARD",
        leaderboard: {
          players: [
            {
              id: "p1",
              name: "A",
              chips: 1060,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
        },
      }),
    });
    expect(state.phase).toBe("WAITING");
    expect(state.communityCards).toEqual([]);
    expect(state.pots).toEqual([]);
    expect(state.button).toBeNull();
    expect(state.players[0].isDealer).toBe(false);
    expect(state.players[0].cards).toBeNull();
  });
});

describe("reducer — GAME_OVER instruction", () => {
  it("sets finished status", () => {
    const running = {
      ...INITIAL_STATE,
      status: "running" as const,
      players: [
        {
          id: "p1",
          name: "A",
          chips: 2000,
          avatar: "",
          cards: null,
          isDealer: false,
          isFolded: false,
          isActive: false,
          isAllIn: false,
          lastAction: null,
          currentBet: 0,
        },
      ],
    };
    const state = reducer(running, {
      type: "INSTRUCTION",
      instruction: inst({
        type: "GAME_OVER",
        gameOver: {
          players: [
            {
              id: "p1",
              name: "A",
              chips: 2000,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
        },
      }),
    });
    expect(state.status).toBe("finished");
  });
});
