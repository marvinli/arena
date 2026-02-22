import { describe, expect, it } from "vitest";
import { handleDealCommunity } from "../../../src/session/handlers/dealCommunity";
import { handleDealHands } from "../../../src/session/handlers/dealHands";
import { handleGameOver } from "../../../src/session/handlers/gameOver";
import { handleGameStart } from "../../../src/session/handlers/gameStart";
import { handleHandResult } from "../../../src/session/handlers/handResult";
import { handleLeaderboard } from "../../../src/session/handlers/leaderboard";
import { handlePlayerAction } from "../../../src/session/handlers/playerAction";
import { handlePlayerTurn } from "../../../src/session/handlers/playerTurn";
import { handleReconnect } from "../../../src/session/handlers/reconnect";
import type {
  GqlChannelState,
  GqlInstruction,
} from "../../../src/session/types";
import type { GameState, Player } from "../../../src/types";

// ── Helpers ──────────────────────────────────────────────

function inst(partial: Partial<GqlInstruction>): GqlInstruction {
  return {
    instructionId: "test-1",
    moduleId: "mod-1",
    type: "GAME_START",
    timestamp: new Date().toISOString(),
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

function baseState(overrides?: Partial<GameState>): GameState {
  return {
    status: "running",
    channelKey: "test-channel",
    gameId: "game-1",
    handNumber: 0,
    phase: "WAITING",
    currentView: "poker",
    smallBlind: 10,
    bigBlind: 20,
    button: null,
    players: [],
    communityCards: [],
    pots: [],
    holeCards: new Map(),
    speakingPlayerId: null,
    analysisText: null,
    isApiError: false,
    error: null,
    awards: [],
    playerAvatars: new Map(),
    playerPersonas: new Map(),
    ...overrides,
  };
}

// ── gameStartHandler ────────────────────────────────────

describe("handleGameStart", () => {
  it("sets status to running and currentView to poker", () => {
    const state = handleGameStart(
      baseState({ status: "connecting" }),
      inst({
        type: "GAME_START",
        gameStart: {
          gameId: "g1",
          smallBlind: 25,
          bigBlind: 50,
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
          playerMeta: [
            {
              id: "p1",
              ttsVoice: "alloy",
              avatarUrl: "openai",
              persona: "shark",
            },
          ],
        },
      }),
    );
    expect(state.status).toBe("running");
    expect(state.currentView).toBe("poker");
    expect(state.gameId).toBe("g1");
    expect(state.smallBlind).toBe(25);
    expect(state.bigBlind).toBe(50);
  });

  it("maps players with avatars and personas from playerMeta", () => {
    const state = handleGameStart(
      baseState(),
      inst({
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
            {
              id: "p2",
              name: "Bob",
              chips: 1000,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          playerMeta: [
            {
              id: "p1",
              ttsVoice: "alloy",
              avatarUrl: "openai",
              persona: "aggressive",
            },
            { id: "p2", ttsVoice: null, avatarUrl: "anthropic", persona: null },
          ],
        },
      }),
    );
    expect(state.players).toHaveLength(2);
    expect(state.players[0].avatar).toBe("openai");
    expect(state.players[0].persona).toBe("aggressive");
    expect(state.players[1].avatar).toBe("anthropic");
    expect(state.players[1].persona).toBeNull();
  });

  it("builds persona map filtering out null entries", () => {
    const state = handleGameStart(
      baseState(),
      inst({
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
            {
              id: "p2",
              name: "Bob",
              chips: 1000,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          playerMeta: [
            { id: "p1", ttsVoice: null, avatarUrl: null, persona: "shark" },
            { id: "p2", ttsVoice: null, avatarUrl: null, persona: null },
          ],
        },
      }),
    );
    expect(state.playerPersonas.get("p1")).toBe("shark");
    expect(state.playerPersonas.has("p2")).toBe(false);
  });

  it("stores playerAvatars map", () => {
    const state = handleGameStart(
      baseState(),
      inst({
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
          playerMeta: [
            { id: "p1", ttsVoice: null, avatarUrl: "openai", persona: null },
          ],
        },
      }),
    );
    expect(state.playerAvatars.get("p1")).toBe("openai");
  });

  it("returns state unchanged when gameStart is null", () => {
    const prev = baseState();
    const state = handleGameStart(
      prev,
      inst({ type: "GAME_START", gameStart: null }),
    );
    expect(state).toBe(prev);
  });
});

// ── dealHandsHandler ────────────────────────────────────

describe("handleDealHands", () => {
  const prevPlayers: Player[] = [
    mkPlayer({
      id: "p1",
      seatIndex: 0,
      avatar: "openai",
      lastAction: "call",
      isActive: true,
    }),
    mkPlayer({
      id: "p2",
      seatIndex: 1,
      avatar: "anthropic",
      lastAction: "raise",
    }),
  ];

  it("sets phase to PREFLOP and clears community cards", () => {
    const state = handleDealHands(
      baseState({
        players: prevPlayers,
        communityCards: [{ rank: "A", suit: "spades" }],
      }),
      inst({
        type: "DEAL_HANDS",
        dealHands: {
          handNumber: 3,
          button: 0,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 990,
              seatIndex: 0,
              bet: 10,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 980,
              seatIndex: 1,
              bet: 20,
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
            {
              playerId: "p2",
              cards: [
                { rank: "Q", suit: "CLUBS" },
                { rank: "J", suit: "DIAMONDS" },
              ],
            },
          ],
          pots: [{ size: 30, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.phase).toBe("PREFLOP");
    expect(state.communityCards).toEqual([]);
    expect(state.handNumber).toBe(3);
  });

  it("builds hole cards map", () => {
    const state = handleDealHands(
      baseState({ players: prevPlayers }),
      inst({
        type: "DEAL_HANDS",
        dealHands: {
          handNumber: 1,
          button: 0,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 990,
              seatIndex: 0,
              bet: 10,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 980,
              seatIndex: 1,
              bet: 20,
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
            {
              playerId: "p2",
              cards: [
                { rank: "2", suit: "CLUBS" },
                { rank: "3", suit: "DIAMONDS" },
              ],
            },
          ],
          pots: [{ size: 30, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.holeCards.get("p1")).toEqual([
      { rank: "A", suit: "SPADES" },
      { rank: "K", suit: "HEARTS" },
    ]);
    expect(state.holeCards.get("p2")).toEqual([
      { rank: "2", suit: "CLUBS" },
      { rank: "3", suit: "DIAMONDS" },
    ]);
  });

  it("resets player lastAction and isActive via overrides", () => {
    const state = handleDealHands(
      baseState({ players: prevPlayers }),
      inst({
        type: "DEAL_HANDS",
        dealHands: {
          handNumber: 1,
          button: 1,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 990,
              seatIndex: 0,
              bet: 10,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 980,
              seatIndex: 1,
              bet: 20,
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
            {
              playerId: "p2",
              cards: [
                { rank: "2", suit: "CLUBS" },
                { rank: "3", suit: "DIAMONDS" },
              ],
            },
          ],
          pots: [{ size: 30, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.players[0].lastAction).toBeNull();
    expect(state.players[0].isActive).toBe(false);
    expect(state.players[1].lastAction).toBeNull();
    expect(state.players[1].isActive).toBe(false);
  });

  it("sets currentView to poker", () => {
    const state = handleDealHands(
      baseState({ players: prevPlayers, currentView: "endcard" }),
      inst({
        type: "DEAL_HANDS",
        dealHands: {
          handNumber: 1,
          button: 0,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 990,
              seatIndex: 0,
              bet: 10,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 980,
              seatIndex: 1,
              bet: 20,
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
            {
              playerId: "p2",
              cards: [
                { rank: "2", suit: "CLUBS" },
                { rank: "3", suit: "DIAMONDS" },
              ],
            },
          ],
          pots: [{ size: 30, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.currentView).toBe("poker");
  });

  it("preserves blinds when provided in payload", () => {
    const state = handleDealHands(
      baseState({ players: prevPlayers, smallBlind: 10, bigBlind: 20 }),
      inst({
        type: "DEAL_HANDS",
        dealHands: {
          handNumber: 5,
          button: 0,
          smallBlind: 25,
          bigBlind: 50,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 950,
              seatIndex: 0,
              bet: 25,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 950,
              seatIndex: 1,
              bet: 50,
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
            {
              playerId: "p2",
              cards: [
                { rank: "2", suit: "CLUBS" },
                { rank: "3", suit: "DIAMONDS" },
              ],
            },
          ],
          pots: [{ size: 75, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.smallBlind).toBe(25);
    expect(state.bigBlind).toBe(50);
  });

  it("returns state unchanged when dealHands is null", () => {
    const prev = baseState();
    const state = handleDealHands(
      prev,
      inst({ type: "DEAL_HANDS", dealHands: null }),
    );
    expect(state).toBe(prev);
  });

  it("filters out BUSTED players", () => {
    const state = handleDealHands(
      baseState({ players: prevPlayers }),
      inst({
        type: "DEAL_HANDS",
        dealHands: {
          handNumber: 2,
          button: 0,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 990,
              seatIndex: 0,
              bet: 10,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 0,
              seatIndex: 1,
              bet: 0,
              status: "BUSTED",
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
          pots: [{ size: 10, eligiblePlayerIds: ["p1"] }],
        },
      }),
    );
    expect(state.players).toHaveLength(1);
    expect(state.players[0].id).toBe("p1");
  });
});

// ── dealCommunityHandler ────────────────────────────────

describe("handleDealCommunity", () => {
  const prevPlayers: Player[] = [
    mkPlayer({
      id: "p1",
      seatIndex: 0,
      lastAction: "call",
      currentBet: 20,
      isActive: true,
    }),
    mkPlayer({
      id: "p2",
      seatIndex: 1,
      lastAction: "raise",
      currentBet: 40,
      isActive: false,
    }),
  ];

  it("updates phase from instruction", () => {
    const state = handleDealCommunity(
      baseState({ players: prevPlayers, phase: "PREFLOP" }),
      inst({
        type: "DEAL_COMMUNITY",
        dealCommunity: {
          phase: "FLOP",
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
          ],
          pots: [{ size: 80, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.phase).toBe("FLOP");
  });

  it("maps community cards", () => {
    const state = handleDealCommunity(
      baseState({ players: prevPlayers }),
      inst({
        type: "DEAL_COMMUNITY",
        dealCommunity: {
          phase: "TURN",
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
            { rank: "J", suit: "SPADES" },
          ],
          pots: [{ size: 100, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.communityCards).toHaveLength(4);
    expect(state.communityCards[3]).toEqual({ rank: "J", suit: "SPADES" });
  });

  it("resets all player lastAction, currentBet, and isActive", () => {
    const state = handleDealCommunity(
      baseState({ players: prevPlayers }),
      inst({
        type: "DEAL_COMMUNITY",
        dealCommunity: {
          phase: "FLOP",
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
          ],
          pots: [{ size: 80, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    for (const p of state.players) {
      expect(p.lastAction).toBeNull();
      expect(p.currentBet).toBe(0);
      expect(p.isActive).toBe(false);
    }
  });

  it("updates pots", () => {
    const state = handleDealCommunity(
      baseState({ players: prevPlayers }),
      inst({
        type: "DEAL_COMMUNITY",
        dealCommunity: {
          phase: "FLOP",
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
          ],
          pots: [
            { size: 80, eligiblePlayerIds: ["p1", "p2"] },
            { size: 20, eligiblePlayerIds: ["p1"] },
          ],
        },
      }),
    );
    expect(state.pots).toEqual([
      { label: "Main Pot", amount: 80 },
      { label: "Side Pot 1", amount: 20 },
    ]);
  });

  it("returns state unchanged when dealCommunity is null", () => {
    const prev = baseState();
    const state = handleDealCommunity(
      prev,
      inst({ type: "DEAL_COMMUNITY", dealCommunity: null }),
    );
    expect(state).toBe(prev);
  });
});

// ── playerTurnHandler ───────────────────────────────────

describe("handlePlayerTurn", () => {
  it("marks only the specified player as active", () => {
    const state = handlePlayerTurn(
      baseState({
        players: [
          mkPlayer({ id: "p1", seatIndex: 0, isActive: true }),
          mkPlayer({ id: "p2", seatIndex: 1 }),
          mkPlayer({ id: "p3", seatIndex: 2 }),
        ],
      }),
      inst({
        type: "PLAYER_TURN",
        playerTurn: { playerId: "p2", playerName: "Bob" },
      }),
    );
    expect(state.players[0].isActive).toBe(false);
    expect(state.players[1].isActive).toBe(true);
    expect(state.players[2].isActive).toBe(false);
  });

  it("returns state unchanged when playerTurn is null", () => {
    const prev = baseState();
    const state = handlePlayerTurn(
      prev,
      inst({ type: "PLAYER_TURN", playerTurn: null }),
    );
    expect(state).toBe(prev);
  });
});

// ── playerActionHandler ─────────────────────────────────

describe("handlePlayerAction", () => {
  const prevPlayers: Player[] = [
    mkPlayer({ id: "p1", seatIndex: 0, avatar: "openai", isActive: true }),
    mkPlayer({ id: "p2", seatIndex: 1, avatar: "anthropic" }),
  ];

  it("sets lastAction on the acting player and deactivates them", () => {
    const state = handlePlayerAction(
      baseState({ players: prevPlayers, button: 0 }),
      inst({
        type: "PLAYER_ACTION",
        playerAction: {
          playerId: "p1",
          playerName: "Alice",
          action: "fold",
          amount: null,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1000,
              seatIndex: 0,
              bet: 0,
              status: "FOLDED",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 1000,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          pots: [{ size: 30, eligiblePlayerIds: ["p2"] }],
        },
      }),
    );
    expect(state.players[0].lastAction).toBe("fold");
    expect(state.players[0].isActive).toBe(false);
    expect(state.players[0].isFolded).toBe(true);
  });

  it("does not set lastAction on non-acting players", () => {
    const state = handlePlayerAction(
      baseState({ players: prevPlayers, button: 0 }),
      inst({
        type: "PLAYER_ACTION",
        playerAction: {
          playerId: "p1",
          playerName: "Alice",
          action: "call",
          amount: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 980,
              seatIndex: 0,
              bet: 20,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 1000,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          pots: [{ size: 40, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.players[1].lastAction).toBeNull();
  });

  it("updates pots", () => {
    const state = handlePlayerAction(
      baseState({ players: prevPlayers, button: 0 }),
      inst({
        type: "PLAYER_ACTION",
        playerAction: {
          playerId: "p1",
          playerName: "Alice",
          action: "raise",
          amount: 100,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 900,
              seatIndex: 0,
              bet: 100,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 1000,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          pots: [{ size: 120, eligiblePlayerIds: ["p1", "p2"] }],
        },
      }),
    );
    expect(state.pots).toEqual([{ label: "Main Pot", amount: 120 }]);
  });

  it("returns state unchanged when playerAction is null", () => {
    const prev = baseState();
    const state = handlePlayerAction(
      prev,
      inst({ type: "PLAYER_ACTION", playerAction: null }),
    );
    expect(state).toBe(prev);
  });

  it("filters out BUSTED players", () => {
    const state = handlePlayerAction(
      baseState({ players: prevPlayers, button: 0 }),
      inst({
        type: "PLAYER_ACTION",
        playerAction: {
          playerId: "p1",
          playerName: "Alice",
          action: "call",
          amount: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 980,
              seatIndex: 0,
              bet: 20,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 0,
              seatIndex: 1,
              bet: 0,
              status: "BUSTED",
            },
          ],
          pots: [{ size: 40, eligiblePlayerIds: ["p1"] }],
        },
      }),
    );
    expect(state.players).toHaveLength(1);
    expect(state.players[0].id).toBe("p1");
  });
});

// ── handResultHandler ───────────────────────────────────

describe("handleHandResult", () => {
  const holeCards = new Map<
    string,
    [{ rank: string; suit: string }, { rank: string; suit: string }]
  >([
    [
      "p1",
      [
        { rank: "A", suit: "SPADES" },
        { rank: "K", suit: "HEARTS" },
      ],
    ],
    [
      "p2",
      [
        { rank: "Q", suit: "CLUBS" },
        { rank: "J", suit: "DIAMONDS" },
      ],
    ],
  ]);

  const prevPlayers: Player[] = [
    mkPlayer({ id: "p1", seatIndex: 0, avatar: "openai" }),
    mkPlayer({ id: "p2", seatIndex: 1, avatar: "anthropic" }),
  ];

  it("marks winners with winAmount and winHand", () => {
    const state = handleHandResult(
      baseState({ players: prevPlayers, holeCards, button: 0 }),
      inst({
        type: "HAND_RESULT",
        handResult: {
          winners: [{ playerId: "p1", amount: 60, hand: "Pair of Aces" }],
          pots: [{ size: 0, eligiblePlayerIds: [] }],
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1060,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 940,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
            { rank: "J", suit: "SPADES" },
            { rank: "K", suit: "CLUBS" },
          ],
        },
      }),
    );
    expect(state.phase).toBe("SHOWDOWN");
    const winner = state.players.find((p) => p.id === "p1");
    expect(winner?.isWinner).toBe(true);
    expect(winner?.winAmount).toBe(60);
    expect(winner?.winHand).toBe("Pair of Aces");
  });

  it("preserves cards for non-folded losers (showdown display)", () => {
    const state = handleHandResult(
      baseState({ players: prevPlayers, holeCards, button: 0 }),
      inst({
        type: "HAND_RESULT",
        handResult: {
          winners: [{ playerId: "p1", amount: 60, hand: "Flush" }],
          pots: [{ size: 0, eligiblePlayerIds: [] }],
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1060,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 940,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          communityCards: [
            { rank: "2", suit: "CLUBS" },
            { rank: "5", suit: "DIAMONDS" },
            { rank: "9", suit: "HEARTS" },
            { rank: "J", suit: "SPADES" },
            { rank: "K", suit: "CLUBS" },
          ],
        },
      }),
    );
    const loser = state.players.find((p) => p.id === "p2");
    expect(loser?.isWinner).toBe(false);
    expect(loser?.winAmount).toBeNull();
    expect(loser?.winHand).toBeNull();
    // Cards come from holeCards map
    expect(loser?.cards).toEqual([
      { rank: "Q", suit: "CLUBS" },
      { rank: "J", suit: "DIAMONDS" },
    ]);
    expect(loser?.isFolded).toBe(false);
  });

  it("handles fold-win (communityCards empty in instruction)", () => {
    const prevCommunity = [
      { rank: "2", suit: "clubs" as const },
      { rank: "5", suit: "diamonds" as const },
      { rank: "9", suit: "hearts" as const },
    ];
    const state = handleHandResult(
      baseState({
        players: prevPlayers,
        holeCards,
        button: 0,
        communityCards: prevCommunity,
      }),
      inst({
        type: "HAND_RESULT",
        handResult: {
          winners: [{ playerId: "p1", amount: 30, hand: null }],
          pots: [{ size: 0, eligiblePlayerIds: [] }],
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1030,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 970,
              seatIndex: 1,
              bet: 0,
              status: "FOLDED",
            },
          ],
          communityCards: [],
        },
      }),
    );
    // Should preserve existing community cards
    expect(state.communityCards).toEqual(prevCommunity);
    const winner = state.players.find((p) => p.id === "p1");
    expect(winner?.isWinner).toBe(true);
    expect(winner?.winHand).toBeNull();
  });

  it("marks folded losers with isFolded true", () => {
    const state = handleHandResult(
      baseState({
        players: [
          mkPlayer({ id: "p1", seatIndex: 0 }),
          mkPlayer({ id: "p2", seatIndex: 1, isFolded: true }),
        ],
        holeCards,
        button: 0,
      }),
      inst({
        type: "HAND_RESULT",
        handResult: {
          winners: [{ playerId: "p1", amount: 30, hand: null }],
          pots: [{ size: 0, eligiblePlayerIds: [] }],
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1030,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 970,
              seatIndex: 1,
              bet: 0,
              status: "FOLDED",
            },
          ],
          communityCards: [],
        },
      }),
    );
    const loser = state.players.find((p) => p.id === "p2");
    // isFolded comes from buildPlayers mapping the FOLDED status
    expect(loser?.isFolded).toBe(true);
  });

  it("returns state unchanged when handResult is null", () => {
    const prev = baseState();
    const state = handleHandResult(
      prev,
      inst({ type: "HAND_RESULT", handResult: null }),
    );
    expect(state).toBe(prev);
  });
});

// ── leaderboardHandler ──────────────────────────────────

describe("handleLeaderboard", () => {
  it("includes ALL players (even busted) for leaderboard display", () => {
    const state = handleLeaderboard(
      baseState({
        players: [
          mkPlayer({ id: "p1", seatIndex: 0, avatar: "openai" }),
          mkPlayer({ id: "p2", seatIndex: 1, avatar: "anthropic" }),
        ],
        playerAvatars: new Map([
          ["p1", "openai"],
          ["p2", "anthropic"],
          ["p3", "google"],
        ]),
        playerPersonas: new Map([["p1", "shark"]]),
      }),
      inst({
        type: "LEADERBOARD",
        leaderboard: {
          handsPlayed: 5,
          smallBlind: 25,
          bigBlind: 50,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1500,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 500,
              seatIndex: 1,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p3",
              name: "Charlie",
              chips: 0,
              seatIndex: 2,
              bet: 0,
              status: "BUSTED",
            },
          ],
        },
      }),
    );
    // Leaderboard does NOT filter busted (uses mapPlayers directly, not buildPlayers)
    expect(state.players).toHaveLength(3);
    expect(state.players.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("resets for endcard: clears cards, lastAction, isActive, isDealer", () => {
    const state = handleLeaderboard(
      baseState({
        phase: "SHOWDOWN",
        players: [
          mkPlayer({
            id: "p1",
            seatIndex: 0,
            cards: [
              { rank: "A", suit: "spades" },
              { rank: "K", suit: "hearts" },
            ],
            lastAction: "raise",
            isActive: true,
            isDealer: true,
          }),
        ],
        playerAvatars: new Map([["p1", "openai"]]),
        playerPersonas: new Map<string, string>(),
      }),
      inst({
        type: "LEADERBOARD",
        leaderboard: {
          handsPlayed: 3,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1500,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
        },
      }),
    );
    expect(state.players[0].cards).toBeNull();
    expect(state.players[0].lastAction).toBeNull();
    expect(state.players[0].isActive).toBe(false);
    expect(state.players[0].isDealer).toBe(false);
  });

  it("sets phase to WAITING and currentView to endcard", () => {
    const state = handleLeaderboard(
      baseState({ phase: "SHOWDOWN" }),
      inst({
        type: "LEADERBOARD",
        leaderboard: {
          handsPlayed: 3,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1500,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
        },
      }),
    );
    expect(state.phase).toBe("WAITING");
    expect(state.currentView).toBe("endcard");
  });

  it("clears communityCards, pots, holeCards, and button", () => {
    const state = handleLeaderboard(
      baseState({
        communityCards: [{ rank: "A", suit: "spades" }],
        pots: [{ label: "Main Pot", amount: 100 }],
        holeCards: new Map([
          [
            "p1",
            [
              { rank: "A", suit: "spades" as const },
              { rank: "K", suit: "hearts" as const },
            ],
          ],
        ]),
        button: 2,
      }),
      inst({
        type: "LEADERBOARD",
        leaderboard: {
          handsPlayed: 3,
          smallBlind: 10,
          bigBlind: 20,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1500,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
        },
      }),
    );
    expect(state.communityCards).toEqual([]);
    expect(state.pots).toEqual([]);
    expect(state.holeCards.size).toBe(0);
    expect(state.button).toBeNull();
  });

  it("updates blinds when provided", () => {
    const state = handleLeaderboard(
      baseState({ smallBlind: 10, bigBlind: 20 }),
      inst({
        type: "LEADERBOARD",
        leaderboard: {
          handsPlayed: 5,
          smallBlind: 25,
          bigBlind: 50,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1500,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
        },
      }),
    );
    expect(state.smallBlind).toBe(25);
    expect(state.bigBlind).toBe(50);
  });

  it("returns state unchanged when leaderboard is null", () => {
    const prev = baseState();
    const state = handleLeaderboard(
      prev,
      inst({ type: "LEADERBOARD", leaderboard: null }),
    );
    expect(state).toBe(prev);
  });
});

// ── gameOverHandler ─────────────────────────────────────

describe("handleGameOver", () => {
  it("sets status to finished", () => {
    const state = handleGameOver(
      baseState({ status: "running" }),
      inst({
        type: "GAME_OVER",
        gameOver: {
          winnerId: "p1",
          winnerName: "Alice",
          handsPlayed: 10,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 3000,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 0,
              seatIndex: 1,
              bet: 0,
              status: "BUSTED",
            },
          ],
          awards: [],
        },
      }),
    );
    expect(state.status).toBe("finished");
  });

  it("sets currentView to endcard", () => {
    const state = handleGameOver(
      baseState(),
      inst({
        type: "GAME_OVER",
        gameOver: {
          winnerId: "p1",
          winnerName: "Alice",
          handsPlayed: 10,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 3000,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          awards: [],
        },
      }),
    );
    expect(state.currentView).toBe("endcard");
  });

  it("assigns awards array", () => {
    const state = handleGameOver(
      baseState(),
      inst({
        type: "GAME_OVER",
        gameOver: {
          winnerId: "p1",
          winnerName: "Alice",
          handsPlayed: 10,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 3000,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          awards: [
            {
              title: "Biggest Bluffer",
              playerIds: ["p1"],
              playerNames: ["Alice"],
              description: "Most successful bluffs",
            },
          ],
        },
      }),
    );
    expect(state.awards).toHaveLength(1);
    expect(state.awards[0].title).toBe("Biggest Bluffer");
    expect(state.awards[0].playerIds).toEqual(["p1"]);
  });

  it("resets players via resetForEndcard", () => {
    const state = handleGameOver(
      baseState({
        players: [
          mkPlayer({
            id: "p1",
            seatIndex: 0,
            isActive: true,
            isDealer: true,
            cards: [
              { rank: "A", suit: "spades" },
              { rank: "K", suit: "hearts" },
            ],
            lastAction: "raise",
          }),
        ],
        playerAvatars: new Map([["p1", "openai"]]),
        playerPersonas: new Map([["p1", "aggressive"]]),
      }),
      inst({
        type: "GAME_OVER",
        gameOver: {
          winnerId: "p1",
          winnerName: "Alice",
          handsPlayed: 10,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 3000,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
          ],
          awards: [],
        },
      }),
    );
    expect(state.players[0].cards).toBeNull();
    expect(state.players[0].lastAction).toBeNull();
    expect(state.players[0].isActive).toBe(false);
    expect(state.players[0].isDealer).toBe(false);
    expect(state.players[0].avatar).toBe("openai");
    expect(state.players[0].persona).toBe("aggressive");
  });

  it("includes all players (even busted) for endcard display", () => {
    const state = handleGameOver(
      baseState({
        playerAvatars: new Map([
          ["p1", "openai"],
          ["p2", "anthropic"],
        ]),
        playerPersonas: new Map<string, string>(),
      }),
      inst({
        type: "GAME_OVER",
        gameOver: {
          winnerId: "p1",
          winnerName: "Alice",
          handsPlayed: 10,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 3000,
              seatIndex: 0,
              bet: 0,
              status: "ACTIVE",
            },
            {
              id: "p2",
              name: "Bob",
              chips: 0,
              seatIndex: 1,
              bet: 0,
              status: "BUSTED",
            },
          ],
          awards: [],
        },
      }),
    );
    // gameOver uses mapPlayers (not buildPlayers), so BUSTED included
    expect(state.players).toHaveLength(2);
  });

  it("returns state unchanged when gameOver is null", () => {
    const prev = baseState();
    const state = handleGameOver(
      prev,
      inst({ type: "GAME_OVER", gameOver: null }),
    );
    expect(state).toBe(prev);
  });
});

// ── reconnectHandler ────────────────────────────────────

describe("handleReconnect", () => {
  function mkChannelState(
    overrides?: Partial<GqlChannelState>,
  ): GqlChannelState {
    return {
      status: "RUNNING",
      gameId: "game-1",
      handNumber: 5,
      phase: "FLOP",
      button: 1,
      smallBlind: 10,
      bigBlind: 20,
      players: [
        {
          id: "p1",
          name: "Alice",
          chips: 900,
          seatIndex: 0,
          bet: 0,
          status: "ACTIVE",
        },
        {
          id: "p2",
          name: "Bob",
          chips: 1100,
          seatIndex: 1,
          bet: 0,
          status: "ACTIVE",
        },
      ],
      communityCards: [
        { rank: "2", suit: "CLUBS" },
        { rank: "5", suit: "DIAMONDS" },
        { rank: "9", suit: "HEARTS" },
      ],
      pots: [{ size: 100, eligiblePlayerIds: ["p1", "p2"] }],
      hands: [
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
            { rank: "Q", suit: "CLUBS" },
            { rank: "J", suit: "DIAMONDS" },
          ],
        },
      ],
      playerMeta: [
        { id: "p1", ttsVoice: "alloy", avatarUrl: "openai", persona: "shark" },
        {
          id: "p2",
          ttsVoice: "shimmer",
          avatarUrl: "anthropic",
          persona: "conservative",
        },
      ],
      ...overrides,
    };
  }

  it("reconstructs full state from server snapshot", () => {
    const state = handleReconnect(mkChannelState());
    expect(state.status).toBe("running");
    expect(state.gameId).toBe("game-1");
    expect(state.handNumber).toBe(5);
    expect(state.phase).toBe("FLOP");
    expect(state.button).toBe(1);
    expect(state.smallBlind).toBe(10);
    expect(state.bigBlind).toBe(20);
    expect(state.communityCards).toHaveLength(3);
    expect(state.pots).toEqual([{ label: "Main Pot", amount: 100 }]);
    expect(state.holeCards.size).toBe(2);
  });

  it("sets currentView to poker for active phases", () => {
    const state = handleReconnect(
      mkChannelState({ phase: "FLOP", status: "RUNNING" }),
    );
    expect(state.currentView).toBe("poker");
  });

  it("sets currentView to endcard for WAITING phase", () => {
    const state = handleReconnect(mkChannelState({ phase: "WAITING" }));
    expect(state.currentView).toBe("endcard");
  });

  it("sets currentView to endcard for FINISHED status", () => {
    const state = handleReconnect(
      mkChannelState({ status: "FINISHED", phase: "SHOWDOWN" }),
    );
    expect(state.currentView).toBe("endcard");
    expect(state.status).toBe("finished");
  });

  it("filters busted players during active play", () => {
    const state = handleReconnect(
      mkChannelState({
        phase: "FLOP",
        status: "RUNNING",
        players: [
          {
            id: "p1",
            name: "Alice",
            chips: 900,
            seatIndex: 0,
            bet: 0,
            status: "ACTIVE",
          },
          {
            id: "p2",
            name: "Bob",
            chips: 0,
            seatIndex: 1,
            bet: 0,
            status: "BUSTED",
          },
          {
            id: "p3",
            name: "Charlie",
            chips: 1100,
            seatIndex: 2,
            bet: 0,
            status: "ACTIVE",
          },
        ],
        playerMeta: [
          { id: "p1", ttsVoice: null, avatarUrl: "openai", persona: null },
          { id: "p2", ttsVoice: null, avatarUrl: "anthropic", persona: null },
          { id: "p3", ttsVoice: null, avatarUrl: "google", persona: null },
        ],
      }),
    );
    expect(state.players).toHaveLength(2);
    expect(state.players.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("includes busted players on endcard", () => {
    const state = handleReconnect(
      mkChannelState({
        phase: "WAITING",
        status: "RUNNING",
        players: [
          {
            id: "p1",
            name: "Alice",
            chips: 1500,
            seatIndex: 0,
            bet: 0,
            status: "ACTIVE",
          },
          {
            id: "p2",
            name: "Bob",
            chips: 0,
            seatIndex: 1,
            bet: 0,
            status: "BUSTED",
          },
        ],
        playerMeta: [
          { id: "p1", ttsVoice: null, avatarUrl: "openai", persona: null },
          { id: "p2", ttsVoice: null, avatarUrl: "anthropic", persona: null },
        ],
      }),
    );
    expect(state.currentView).toBe("endcard");
    expect(state.players).toHaveLength(2);
    expect(state.players.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("builds avatar and persona maps", () => {
    const state = handleReconnect(mkChannelState());
    expect(state.playerAvatars.get("p1")).toBe("openai");
    expect(state.playerAvatars.get("p2")).toBe("anthropic");
    expect(state.playerPersonas.get("p1")).toBe("shark");
    expect(state.playerPersonas.get("p2")).toBe("conservative");
  });

  it("applies avatars and personas to players", () => {
    const state = handleReconnect(mkChannelState());
    expect(state.players[0].avatar).toBe("openai");
    expect(state.players[0].persona).toBe("shark");
    expect(state.players[1].avatar).toBe("anthropic");
    expect(state.players[1].persona).toBe("conservative");
  });

  it("builds hole cards and assigns to players", () => {
    const state = handleReconnect(mkChannelState());
    expect(state.players[0].cards).toEqual([
      { rank: "A", suit: "SPADES" },
      { rank: "K", suit: "HEARTS" },
    ]);
    expect(state.players[1].cards).toEqual([
      { rank: "Q", suit: "CLUBS" },
      { rank: "J", suit: "DIAMONDS" },
    ]);
    expect(state.holeCards.get("p1")).toEqual([
      { rank: "A", suit: "SPADES" },
      { rank: "K", suit: "HEARTS" },
    ]);
  });

  it("initializes transient fields to defaults", () => {
    const state = handleReconnect(mkChannelState());
    expect(state.speakingPlayerId).toBeNull();
    expect(state.analysisText).toBeNull();
    expect(state.isApiError).toBe(false);
    expect(state.error).toBeNull();
    expect(state.awards).toEqual([]);
  });

  it("handles null phase as WAITING", () => {
    const state = handleReconnect(mkChannelState({ phase: null }));
    expect(state.phase).toBe("WAITING");
  });
});
