import { describe, expect, it } from "vitest";
import {
  buildDealCommunity,
  buildDealHands,
  buildGameOver,
  buildGameStart,
  buildHandResult,
  buildLeaderboard,
  buildPlayerAction,
  buildPlayerAnalysis,
} from "../../../../src/services/games/poker/instruction-builder.js";
import type { GameState, RenderInstruction } from "../../../../src/types.js";
import { InstructionType } from "../../../../src/types.js";

// Shared mock data for reuse
const mockPlayers: GameState["players"] = [
  {
    id: "p1",
    name: "Alice",
    chips: 1000,
    bet: 0,
    status: "ACTIVE",
    seatIndex: 0,
  },
  {
    id: "p2",
    name: "Bob",
    chips: 500,
    bet: 0,
    status: "ACTIVE",
    seatIndex: 1,
  },
];

const mockPots: GameState["pots"] = [
  { size: 100, eligiblePlayerIds: ["p1", "p2"] },
];

const mockAgentConfigs = [
  { playerId: "p1", ttsVoice: "voice-1", avatarUrl: null },
  { playerId: "p2", ttsVoice: null, avatarUrl: "https://example.com/bob.png" },
];

const mockCommunityCards: GameState["communityCards"] = [
  { rank: "A", suit: "spades" },
  { rank: "K", suit: "hearts" },
  { rank: "Q", suit: "diamonds" },
];

const mockGameState: GameState = {
  players: mockPlayers,
  pots: mockPots,
  communityCards: mockCommunityCards,
  button: 0,
  currentPlayerIndex: 0,
  currentBet: 0,
  phase: "preflop",
};

// Helper to verify base instruction fields
function verifyBaseInstruction(
  instruction: RenderInstruction,
  expectedType: InstructionType,
) {
  expect(instruction.instructionId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  expect(instruction.type).toBe(expectedType);
  expect(instruction.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(new Date(instruction.timestamp).toString()).not.toBe("Invalid Date");
}

describe("instruction-builder", () => {
  describe("buildGameStart", () => {
    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildGameStart(
        "game-123",
        mockPlayers,
        {
          smallBlind: 10,
          bigBlind: 20,
        },
        mockAgentConfigs,
      );

      verifyBaseInstruction(result, InstructionType.GameStart);
    });

    it("gameStart payload contains gameId, players, smallBlind, bigBlind", () => {
      const result = buildGameStart(
        "game-123",
        mockPlayers,
        {
          smallBlind: 10,
          bigBlind: 20,
        },
        mockAgentConfigs,
      );

      expect(result.gameStart).toBeDefined();
      expect(result.gameStart?.gameId).toBe("game-123");
      expect(result.gameStart?.players).toHaveLength(2);
      expect(result.gameStart?.players[0]).toEqual({
        id: "p1",
        name: "Alice",
        chips: 1000,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 0,
      });
      expect(result.gameStart?.players[1]).toEqual({
        id: "p2",
        name: "Bob",
        chips: 500,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 1,
      });
      expect(result.gameStart?.smallBlind).toBe(10);
      expect(result.gameStart?.bigBlind).toBe(20);
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildGameStart(
        "game-123",
        mockPlayers,
        {
          smallBlind: 10,
          bigBlind: 20,
        },
        mockAgentConfigs,
      );
      const result2 = buildGameStart(
        "game-123",
        mockPlayers,
        {
          smallBlind: 10,
          bigBlind: 20,
        },
        mockAgentConfigs,
      );

      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });

  describe("buildDealHands", () => {
    const mockHands = [
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
    ];

    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildDealHands(1, mockGameState, mockHands);

      verifyBaseInstruction(result, InstructionType.DealHands);
    });

    it("dealHands payload contains handNumber, players, hands, button, pots", () => {
      const result = buildDealHands(1, mockGameState, mockHands);

      expect(result.dealHands).toBeDefined();
      expect(result.dealHands?.handNumber).toBe(1);
      expect(result.dealHands?.players).toHaveLength(2);
      expect(result.dealHands?.players[0]).toEqual({
        id: "p1",
        name: "Alice",
        chips: 1000,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 0,
      });
      expect(result.dealHands?.hands).toEqual(mockHands);
      expect(result.dealHands?.button).toBe(0);
      expect(result.dealHands?.pots).toEqual([
        { size: 100, eligiblePlayerIds: ["p1", "p2"] },
      ]);
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildDealHands(1, mockGameState, mockHands);
      const result2 = buildDealHands(1, mockGameState, mockHands);

      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });

  describe("buildDealCommunity", () => {
    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildDealCommunity("flop", mockGameState);

      verifyBaseInstruction(result, InstructionType.DealCommunity);
    });

    it("dealCommunity payload contains phase and communityCards", () => {
      const result = buildDealCommunity("flop", mockGameState);

      expect(result.dealCommunity).toBeDefined();
      expect(result.dealCommunity?.phase).toBe("flop");
      expect(result.dealCommunity?.communityCards).toEqual([
        { rank: "A", suit: "spades" },
        { rank: "K", suit: "hearts" },
        { rank: "Q", suit: "diamonds" },
      ]);
      expect(result.dealCommunity?.pots).toEqual([
        { size: 100, eligiblePlayerIds: ["p1", "p2"] },
      ]);
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildDealCommunity("flop", mockGameState);
      const result2 = buildDealCommunity("flop", mockGameState);

      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });

  describe("buildPlayerAnalysis", () => {
    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildPlayerAnalysis(
        "p1",
        "Alice",
        "Strong hand, considering a raise.",
      );
      verifyBaseInstruction(result, InstructionType.PlayerAnalysis);
    });

    it("playerAnalysis payload has playerId, playerName, analysis", () => {
      const result = buildPlayerAnalysis(
        "p1",
        "Alice",
        "Strong hand, considering a raise.",
      );
      expect(result.playerAnalysis).toBeDefined();
      expect(result.playerAnalysis?.playerId).toBe("p1");
      expect(result.playerAnalysis?.playerName).toBe("Alice");
      expect(result.playerAnalysis?.analysis).toBe(
        "Strong hand, considering a raise.",
      );
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildPlayerAnalysis("p1", "Alice", "Thinking...");
      const result2 = buildPlayerAnalysis("p1", "Alice", "Thinking...");
      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });

  describe("buildPlayerAction", () => {
    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildPlayerAction("p1", "Alice", "bet", 50, mockGameState);

      verifyBaseInstruction(result, InstructionType.PlayerAction);
    });

    it("playerAction payload has playerId, playerName, action, amount, pots, players", () => {
      const result = buildPlayerAction("p1", "Alice", "bet", 50, mockGameState);

      expect(result.playerAction).toBeDefined();
      expect(result.playerAction?.playerId).toBe("p1");
      expect(result.playerAction?.playerName).toBe("Alice");
      expect(result.playerAction?.action).toBe("bet");
      expect(result.playerAction?.amount).toBe(50);
      expect(result.playerAction?.pots).toEqual([
        { size: 100, eligiblePlayerIds: ["p1", "p2"] },
      ]);
      expect(result.playerAction?.players).toHaveLength(2);
      expect(result.playerAction?.players[0]).toEqual({
        id: "p1",
        name: "Alice",
        chips: 1000,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 0,
      });
    });

    it("playerAction payload converts undefined amount to null", () => {
      const result = buildPlayerAction(
        "p1",
        "Alice",
        "fold",
        undefined,
        mockGameState,
      );

      expect(result.playerAction?.amount).toBeNull();
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildPlayerAction(
        "p1",
        "Alice",
        "bet",
        50,
        mockGameState,
      );
      const result2 = buildPlayerAction(
        "p1",
        "Alice",
        "bet",
        50,
        mockGameState,
      );

      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });

  describe("buildHandResult", () => {
    const mockWinners = [
      { playerId: "p1", amount: 100, hand: "Full House" },
      { playerId: "p2", amount: 50, hand: null },
    ];

    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildHandResult(mockWinners, mockGameState);

      verifyBaseInstruction(result, InstructionType.HandResult);
    });

    it("handResult has winners with hand field, pots, players, communityCards", () => {
      const result = buildHandResult(mockWinners, mockGameState);

      expect(result.handResult).toBeDefined();
      expect(result.handResult?.winners).toHaveLength(2);
      expect(result.handResult?.winners[0]).toEqual({
        playerId: "p1",
        amount: 100,
        hand: "Full House",
      });
      expect(result.handResult?.winners[1]).toEqual({
        playerId: "p2",
        amount: 50,
        hand: null,
      });
      expect(result.handResult?.pots).toEqual([
        { size: 100, eligiblePlayerIds: ["p1", "p2"] },
      ]);
      expect(result.handResult?.players).toHaveLength(2);
      expect(result.handResult?.communityCards).toEqual([
        { rank: "A", suit: "spades" },
        { rank: "K", suit: "hearts" },
        { rank: "Q", suit: "diamonds" },
      ]);
    });

    it("handResult converts undefined hand to null", () => {
      const winners = [{ playerId: "p1", amount: 100 }];
      const result = buildHandResult(winners, mockGameState);

      expect(result.handResult?.winners[0].hand).toBeNull();
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildHandResult(mockWinners, mockGameState);
      const result2 = buildHandResult(mockWinners, mockGameState);

      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });

  describe("buildLeaderboard", () => {
    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildLeaderboard(mockPlayers, 5);

      verifyBaseInstruction(result, InstructionType.Leaderboard);
    });

    it("leaderboard has players and handsPlayed", () => {
      const result = buildLeaderboard(mockPlayers, 5);

      expect(result.leaderboard).toBeDefined();
      expect(result.leaderboard?.players).toHaveLength(2);
      expect(result.leaderboard?.players[0]).toEqual({
        id: "p1",
        name: "Alice",
        chips: 1000,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 0,
      });
      expect(result.leaderboard?.players[1]).toEqual({
        id: "p2",
        name: "Bob",
        chips: 500,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 1,
      });
      expect(result.leaderboard?.handsPlayed).toBe(5);
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildLeaderboard(mockPlayers, 5);
      const result2 = buildLeaderboard(mockPlayers, 5);

      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });

  describe("buildGameOver", () => {
    it("returns correct type and has instructionId/timestamp", () => {
      const result = buildGameOver("p1", "Alice", mockPlayers, 10);

      verifyBaseInstruction(result, InstructionType.GameOver);
    });

    it("gameOver has winnerId, winnerName, players, handsPlayed", () => {
      const result = buildGameOver("p1", "Alice", mockPlayers, 10);

      expect(result.gameOver).toBeDefined();
      expect(result.gameOver?.winnerId).toBe("p1");
      expect(result.gameOver?.winnerName).toBe("Alice");
      expect(result.gameOver?.players).toHaveLength(2);
      expect(result.gameOver?.players[0]).toEqual({
        id: "p1",
        name: "Alice",
        chips: 1000,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 0,
      });
      expect(result.gameOver?.players[1]).toEqual({
        id: "p2",
        name: "Bob",
        chips: 500,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 1,
      });
      expect(result.gameOver?.handsPlayed).toBe(10);
    });

    it("generates unique instructionId for each call", () => {
      const result1 = buildGameOver("p1", "Alice", mockPlayers, 10);
      const result2 = buildGameOver("p1", "Alice", mockPlayers, 10);

      expect(result1.instructionId).not.toBe(result2.instructionId);
    });
  });
});
