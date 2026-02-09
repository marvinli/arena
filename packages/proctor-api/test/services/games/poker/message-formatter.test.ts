import { describe, expect, it } from "vitest";
import type { AgentTurnContext } from "../../../../src/services/games/poker/agent-runner.js";
import {
  formatDealCommunity,
  formatDealHands,
  formatHandResult,
  formatOpponentAction,
  formatYourTurn,
} from "../../../../src/services/games/poker/message-formatter.js";

describe("message-formatter", () => {
  describe("formatDealHands", () => {
    it("formats a deal with players and pot", () => {
      const result = formatDealHands(
        3,
        [
          { rank: "A", suit: "spades" },
          { rank: "K", suit: "hearts" },
        ],
        [
          { id: "p1", name: "Alice", chips: 990, status: "ACTIVE" },
          { id: "p2", name: "Bob", chips: 980, status: "ACTIVE" },
        ],
        30,
      );

      expect(result).toBe(
        `Hand #3 has been dealt.
Your hole cards: A♠ K♥
Players:
  Alice: 990 chips
  Bob: 980 chips
Pot: 30`,
      );
    });

    it("formats a deal with empty player list", () => {
      const result = formatDealHands(
        1,
        [
          { rank: "2", suit: "clubs" },
          { rank: "7", suit: "diamonds" },
        ],
        [],
        0,
      );

      expect(result).toBe(
        `Hand #1 has been dealt.
Your hole cards: 2♣ 7♦
Players:

Pot: 0`,
      );
    });
  });

  describe("formatYourTurn", () => {
    const baseContext: AgentTurnContext = {
      gameId: "g1",
      handNumber: 1,
      phase: "PREFLOP",
      communityCards: [],
      myHand: [
        { rank: "A", suit: "spades" },
        { rank: "K", suit: "hearts" },
      ],
      players: [
        { id: "p1", name: "Alice", chips: 980, bet: 20, status: "ACTIVE" },
        { id: "p2", name: "Bob", chips: 990, bet: 10, status: "ACTIVE" },
      ],
      pots: [{ size: 30, eligiblePlayerIds: ["p1", "p2"] }],
      validActions: [{ type: "fold" }, { type: "call", amount: 20 }],
    };

    it("formats without community cards", () => {
      const result = formatYourTurn("p1", baseContext);

      expect(result).toBe(
        `It's your turn.
Phase: PREFLOP
Your hole cards: A♠ K♥
Pot: 30
Your chips: 980 (current bet: 20)
Valid actions:
  - fold
  - call 20

Call submit_action with your decision.`,
      );
    });

    it("formats with community cards", () => {
      const context: AgentTurnContext = {
        ...baseContext,
        phase: "FLOP",
        communityCards: [
          { rank: "10", suit: "diamonds" },
          { rank: "J", suit: "clubs" },
          { rank: "Q", suit: "spades" },
        ],
      };

      const result = formatYourTurn("p1", context);

      expect(result).toContain("Community cards: 10♦ J♣ Q♠");
      expect(result).toContain("Phase: FLOP");
    });

    it("formats bet/raise with min and max", () => {
      const context: AgentTurnContext = {
        ...baseContext,
        validActions: [{ type: "fold" }, { type: "raise", min: 40, max: 980 }],
      };

      const result = formatYourTurn("p1", context);

      expect(result).toContain("  - fold");
      expect(result).toContain("  - raise (min: 40, max: 980)");
    });

    it("formats call with amount", () => {
      const context: AgentTurnContext = {
        ...baseContext,
        validActions: [{ type: "call", amount: 50 }],
      };

      const result = formatYourTurn("p1", context);

      expect(result).toContain("  - call 50");
    });

    it("formats fold and check without amount", () => {
      const context: AgentTurnContext = {
        ...baseContext,
        validActions: [{ type: "fold" }, { type: "check" }],
      };

      const result = formatYourTurn("p1", context);

      expect(result).toContain("  - fold");
      expect(result).toContain("  - check");
    });
  });

  describe("formatOpponentAction", () => {
    it("formats a fold", () => {
      expect(formatOpponentAction("Alice", "fold")).toBe("Alice folds.");
    });

    it("formats a check", () => {
      expect(formatOpponentAction("Bob", "check")).toBe("Bob checks.");
    });

    it("formats a call without amount", () => {
      expect(formatOpponentAction("Alice", "call")).toBe("Alice calls.");
    });

    it("formats a call with amount", () => {
      expect(formatOpponentAction("Alice", "call", 50)).toBe("Alice calls 50.");
    });

    it("formats a bet with amount", () => {
      expect(formatOpponentAction("Bob", "bet", 100)).toBe("Bob bets 100.");
    });

    it("formats a raise with amount", () => {
      expect(formatOpponentAction("Alice", "raise", 200)).toBe(
        "Alice raises to 200.",
      );
    });
  });

  describe("formatDealCommunity", () => {
    it("formats community cards with phase label", () => {
      const result = formatDealCommunity("FLOP", [
        { rank: "10", suit: "diamonds" },
        { rank: "J", suit: "clubs" },
        { rank: "Q", suit: "spades" },
      ]);

      expect(result).toBe("FLOP: 10♦ J♣ Q♠");
    });
  });

  describe("formatHandResult", () => {
    it("formats a single winner", () => {
      const result = formatHandResult(
        5,
        [{ playerId: "p1", amount: 200 }],
        [
          { id: "p1", name: "Alice", chips: 1200 },
          { id: "p2", name: "Bob", chips: 800 },
        ],
      );

      expect(result).toBe(
        `Hand #5 result:
  Winner: Alice — wins 200
  Alice: 1200 chips
  Bob: 800 chips`,
      );
    });

    it("formats multiple winners", () => {
      const result = formatHandResult(
        7,
        [
          { playerId: "p1", amount: 100 },
          { playerId: "p2", amount: 100 },
        ],
        [
          { id: "p1", name: "Alice", chips: 1100 },
          { id: "p2", name: "Bob", chips: 1100 },
        ],
      );

      expect(result).toBe(
        `Hand #7 result:
  Winner: Alice — wins 100
  Winner: Bob — wins 100
  Alice: 1100 chips
  Bob: 1100 chips`,
      );
    });
  });
});
