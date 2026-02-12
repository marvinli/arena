import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetGames,
  advanceGame,
  createGame,
  deleteGame,
  getGameState,
  getHistory,
  getMyTurn,
  startHand,
  submitAction,
} from "../../../../src/services/games/poker/poker-engine/index.js";
import { ActionType, GamePhase, PlayerStatus } from "../../../../src/types.js";

const TEST_PLAYERS = [
  { id: "p1", name: "Alice", chips: 1000 },
  { id: "p2", name: "Bob", chips: 1000 },
  { id: "p3", name: "Charlie", chips: 1000 },
];

const HEADS_UP_PLAYERS = [
  { id: "p1", name: "Alice", chips: 1000 },
  { id: "p2", name: "Bob", chips: 1000 },
];

function createTestGame() {
  return createGame({
    players: TEST_PLAYERS,
    smallBlind: 10,
    bigBlind: 20,
  });
}

/** Play a complete check/call hand to showdown */
function playCheckCallHand(gameId: string): void {
  startHand(gameId);
  let state = getGameState(gameId);
  while (state.phase !== "WAITING") {
    if (state.currentPlayerId) {
      const turn = getMyTurn(gameId, state.currentPlayerId);
      const canCheck = turn.validActions.some(
        (a) => a.type === ActionType.Check,
      );
      state = submitAction(
        gameId,
        state.currentPlayerId,
        canCheck ? "check" : "call",
      );
    } else {
      state = advanceGame(gameId);
    }
  }
}

describe("poker-engine", () => {
  beforeEach(() => {
    _resetGames();
  });

  describe("createGame", () => {
    it("creates a game with players seated and correct chips", () => {
      const gameId = createTestGame();
      const state = getGameState(gameId);

      expect(state.gameId).toBe(gameId);
      expect(state.phase).toBe(GamePhase.Waiting);
      expect(state.players).toHaveLength(3);
      expect(state.players[0].id).toBe("p1");
      expect(state.players[0].name).toBe("Alice");
      expect(state.players[0].chips).toBe(1000);
      expect(state.players[1].id).toBe("p2");
      expect(state.players[2].id).toBe("p3");
      expect(state.handNumber).toBe(0);
    });
  });

  describe("startHand", () => {
    it("starts a hand with blinds posted and cards dealt", () => {
      const gameId = createTestGame();
      const state = startHand(gameId);

      expect(state.phase).toBe(GamePhase.Preflop);
      expect(state.handNumber).toBe(1);
      expect(state.currentPlayerId).not.toBeNull();

      // All players should have hole cards
      for (const player of TEST_PLAYERS) {
        const turn = getMyTurn(gameId, player.id);
        expect(turn.myHand).toHaveLength(2);
        expect(turn.myHand[0]).toHaveProperty("rank");
        expect(turn.myHand[0]).toHaveProperty("suit");
      }
    });

    it("throws when hand already in progress", () => {
      const gameId = createTestGame();
      startHand(gameId);
      expect(() => startHand(gameId)).toThrow("hand already in progress");
    });
  });

  describe("getMyTurn / identity enforcement", () => {
    it("returns different hole cards for different players", () => {
      const gameId = createTestGame();
      startHand(gameId);

      const p1Turn = getMyTurn(gameId, "p1");
      const p2Turn = getMyTurn(gameId, "p2");

      // Each player should get their own unique cards
      expect(p1Turn.myHand).toHaveLength(2);
      expect(p2Turn.myHand).toHaveLength(2);

      // Cards should differ (extremely unlikely to be identical)
      const p1Cards = p1Turn.myHand
        .map((c) => `${c.rank}${c.suit}`)
        .sort()
        .join(",");
      const p2Cards = p2Turn.myHand
        .map((c) => `${c.rank}${c.suit}`)
        .sort()
        .join(",");
      expect(p1Cards).not.toBe(p2Cards);
    });

    it("shows valid actions only for the player whose turn it is", () => {
      const gameId = createTestGame();
      startHand(gameId);

      const state = getGameState(gameId);
      const currentId = state.currentPlayerId!;
      const otherId = TEST_PLAYERS.find((p) => p.id !== currentId)!.id;

      const currentTurn = getMyTurn(gameId, currentId);
      const otherTurn = getMyTurn(gameId, otherId);

      expect(currentTurn.validActions.length).toBeGreaterThan(0);
      expect(otherTurn.validActions).toHaveLength(0);
    });

    it("throws for unknown player", () => {
      const gameId = createTestGame();
      expect(() => getMyTurn(gameId, "unknown")).toThrow("Player not in game");
    });
  });

  describe("submitAction", () => {
    it("rejects out-of-turn actions", () => {
      const gameId = createTestGame();
      startHand(gameId);

      const state = getGameState(gameId);
      const currentId = state.currentPlayerId!;
      const otherId = TEST_PLAYERS.find((p) => p.id !== currentId)!.id;

      expect(() => submitAction(gameId, otherId, "call")).toThrow(
        "not this player's turn",
      );
    });

    it("rejects illegal action types", () => {
      const gameId = createTestGame();
      startHand(gameId);

      const state = getGameState(gameId);
      const currentId = state.currentPlayerId!;
      const turn = getMyTurn(gameId, currentId);

      // If bet is not a valid action, trying it should fail
      if (!turn.validActions.some((a) => a.type === ActionType.Bet)) {
        expect(() => submitAction(gameId, currentId, "bet", 100)).toThrow(
          "not available right now",
        );
      }
    });

    it("rejects out-of-range bet amounts", () => {
      const gameId = createTestGame();
      startHand(gameId);

      const state = getGameState(gameId);
      const currentId = state.currentPlayerId!;
      const turn = getMyTurn(gameId, currentId);

      const raiseAction = turn.validActions.find(
        (a) => a.type === ActionType.Raise,
      );
      if (raiseAction?.max) {
        expect(() =>
          submitAction(gameId, currentId, "raise", raiseAction.max + 1),
        ).toThrow("amount must be between");
      }
    });

    it("accepts a valid action and advances turn", () => {
      const gameId = createTestGame();
      startHand(gameId);

      const state1 = getGameState(gameId);
      const currentId = state1.currentPlayerId!;

      const newState = submitAction(gameId, currentId, "call");
      // Turn should have advanced to a different player
      expect(newState.currentPlayerId).not.toBe(currentId);
    });
  });

  describe("fold to win", () => {
    it("awards pot to last remaining player when all others fold", () => {
      const gameId = createTestGame();
      startHand(gameId);

      let state = getGameState(gameId);

      // First player folds
      const player1 = state.currentPlayerId!;
      state = submitAction(gameId, player1, "fold");

      // Second player folds
      const player2 = state.currentPlayerId!;
      state = submitAction(gameId, player2, "fold");

      // Advance to showdown
      const finalState = advanceGame(gameId);
      expect(finalState.phase).toBe(GamePhase.Waiting);

      // Check history - should have a winner
      const history = getHistory(gameId);
      expect(history).toHaveLength(1);
      expect(history[0].winners.length).toBeGreaterThan(0);
    });
  });

  describe("full hand lifecycle", () => {
    it("plays a hand from preflop through showdown", () => {
      const gameId = createTestGame();
      startHand(gameId);

      // Play through preflop - all call
      let state = getGameState(gameId);
      expect(state.phase).toBe(GamePhase.Preflop);

      // Have everyone call/check through preflop
      while (state.phase === GamePhase.Preflop && state.currentPlayerId) {
        const turn = getMyTurn(gameId, state.currentPlayerId);
        const canCheck = turn.validActions.some(
          (a) => a.type === ActionType.Check,
        );
        state = submitAction(
          gameId,
          state.currentPlayerId,
          canCheck ? "check" : "call",
        );
      }

      // Advance to flop
      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Flop);
      expect(state.communityCards).toHaveLength(3);

      // Play through flop - all check
      while (state.currentPlayerId) {
        state = submitAction(gameId, state.currentPlayerId, "check");
      }

      // Advance to turn
      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Turn);
      expect(state.communityCards).toHaveLength(4);

      // Play through turn - all check
      while (state.currentPlayerId) {
        state = submitAction(gameId, state.currentPlayerId, "check");
      }

      // Advance to river
      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.River);
      expect(state.communityCards).toHaveLength(5);

      // Play through river - all check
      while (state.currentPlayerId) {
        state = submitAction(gameId, state.currentPlayerId, "check");
      }

      // Advance to showdown
      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Waiting);

      // Verify history
      const history = getHistory(gameId);
      expect(history).toHaveLength(1);
      expect(history[0].handNumber).toBe(1);
      expect(history[0].communityCards).toHaveLength(5);
      expect(history[0].winners.length).toBeGreaterThan(0);
    });
  });

  describe("history", () => {
    it("records multiple hands and supports lastN filter", () => {
      const gameId = createTestGame();

      // Play hand 1 — everyone folds to big blind
      startHand(gameId);
      let state = getGameState(gameId);
      state = submitAction(gameId, state.currentPlayerId!, "fold");
      state = submitAction(gameId, state.currentPlayerId!, "fold");
      advanceGame(gameId);

      // Play hand 2 — everyone folds to big blind
      startHand(gameId);
      state = getGameState(gameId);
      state = submitAction(gameId, state.currentPlayerId!, "fold");
      state = submitAction(gameId, state.currentPlayerId!, "fold");
      advanceGame(gameId);

      const allHistory = getHistory(gameId);
      expect(allHistory).toHaveLength(2);
      expect(allHistory[0].handNumber).toBe(1);
      expect(allHistory[1].handNumber).toBe(2);

      const lastOne = getHistory(gameId, 1);
      expect(lastOne).toHaveLength(1);
      expect(lastOne[0].handNumber).toBe(2);
    });
  });

  describe("heads-up (2 players)", () => {
    it("plays a full hand to showdown with 2 players", () => {
      const gameId = createGame({
        players: HEADS_UP_PLAYERS,
        smallBlind: 10,
        bigBlind: 20,
      });

      playCheckCallHand(gameId);

      const history = getHistory(gameId);
      expect(history).toHaveLength(1);
      expect(history[0].winners.length).toBeGreaterThan(0);
    });

    it("fold in heads-up immediately awards pot", () => {
      const gameId = createGame({
        players: HEADS_UP_PLAYERS,
        smallBlind: 10,
        bigBlind: 20,
      });
      startHand(gameId);

      const state = getGameState(gameId);
      submitAction(gameId, state.currentPlayerId!, "fold");

      const finalState = advanceGame(gameId);
      expect(finalState.phase).toBe(GamePhase.Waiting);

      const history = getHistory(gameId);
      expect(history[0].winners).toHaveLength(1);
    });
  });

  describe("deleteGame", () => {
    it("removes the game from the store", () => {
      const gameId = createTestGame();
      expect(() => getGameState(gameId)).not.toThrow();

      deleteGame(gameId);
      expect(() => getGameState(gameId)).toThrow("Game not found");
    });

    it("is a no-op for non-existent games", () => {
      expect(() => deleteGame("nonexistent")).not.toThrow();
    });
  });

  describe("createGame validation", () => {
    it("rejects fewer than 2 players", () => {
      expect(() =>
        createGame({
          players: [{ id: "p1", name: "Solo", chips: 1000 }],
          smallBlind: 10,
          bigBlind: 20,
        }),
      ).toThrow("at least 2 players");
    });

    it("rejects non-positive blinds", () => {
      expect(() =>
        createGame({
          players: HEADS_UP_PLAYERS,
          smallBlind: 0,
          bigBlind: 20,
        }),
      ).toThrow("Blinds must be positive");
    });

    it("rejects small blind >= big blind", () => {
      expect(() =>
        createGame({
          players: HEADS_UP_PLAYERS,
          smallBlind: 20,
          bigBlind: 20,
        }),
      ).toThrow("Small blind must be less than big blind");
    });
  });

  describe("player busting", () => {
    it("marks a player as BUSTED when they lose all chips", () => {
      // Give one player very few chips so they bust quickly
      const gameId = createGame({
        players: [
          { id: "p1", name: "Alice", chips: 15 },
          { id: "p2", name: "Bob", chips: 1000 },
        ],
        smallBlind: 10,
        bigBlind: 20,
      });

      // Play a hand — p1 will be forced all-in by blinds
      playCheckCallHand(gameId);

      const state = getGameState(gameId);
      const busted = state.players.filter(
        (p) => p.status === PlayerStatus.Busted,
      );
      // p1 either busted or won. If p1 busted, verify status
      if (busted.length > 0) {
        expect(busted[0].chips).toBe(0);
      }
    });
  });

  describe("all-in runout", () => {
    it("reveals flop, turn, river one at a time when both players go all-in preflop", () => {
      const gameId = createGame({
        players: HEADS_UP_PLAYERS,
        smallBlind: 10,
        bigBlind: 20,
      });

      const handState = startHand(gameId);
      let state = handState;

      // SB raises all-in, BB calls all-in
      state = submitAction(gameId, state.currentPlayerId!, "raise", 1000);
      state = submitAction(gameId, state.currentPlayerId!, "call");

      expect(state.phase).toBe(GamePhase.Preflop);
      expect(state.currentPlayerId).toBeNull();

      // Advance should reveal flop (3 cards), then turn (4), then river (5), then WAITING
      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Flop);
      expect(state.communityCards).toHaveLength(3);

      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Turn);
      expect(state.communityCards).toHaveLength(4);

      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.River);
      expect(state.communityCards).toHaveLength(5);

      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Waiting);

      const history = getHistory(gameId);
      expect(history).toHaveLength(1);
      expect(history[0].winners.length).toBeGreaterThan(0);
    });

    it("reveals turn and river when both go all-in on the flop", () => {
      const gameId = createGame({
        players: HEADS_UP_PLAYERS,
        smallBlind: 10,
        bigBlind: 20,
      });

      startHand(gameId);
      // Play through preflop
      let state = submitAction(gameId, "p1", "call");
      state = submitAction(gameId, "p2", "check");
      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Flop);
      expect(state.communityCards).toHaveLength(3);

      // All-in on flop
      const turn = getMyTurn(gameId, state.currentPlayerId!);
      const hasBet = turn.validActions.some((a) => a.type === ActionType.Bet);
      state = submitAction(
        gameId,
        state.currentPlayerId!,
        hasBet ? "bet" : "raise",
        980,
      );
      state = submitAction(gameId, state.currentPlayerId!, "call");

      // Should reveal turn then river then showdown
      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Turn);
      expect(state.communityCards).toHaveLength(4);

      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.River);
      expect(state.communityCards).toHaveLength(5);

      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Waiting);
      expect(getHistory(gameId)[0].winners.length).toBeGreaterThan(0);
    });

    it("reveals river when both go all-in on the turn", () => {
      const gameId = createGame({
        players: HEADS_UP_PLAYERS,
        smallBlind: 10,
        bigBlind: 20,
      });

      startHand(gameId);
      let state = submitAction(gameId, "p1", "call");
      state = submitAction(gameId, "p2", "check");
      state = advanceGame(gameId); // flop
      while (state.currentPlayerId) {
        state = submitAction(gameId, state.currentPlayerId, "check");
      }
      state = advanceGame(gameId); // turn
      expect(state.phase).toBe(GamePhase.Turn);

      // All-in on turn
      const turn = getMyTurn(gameId, state.currentPlayerId!);
      const hasBet = turn.validActions.some((a) => a.type === ActionType.Bet);
      state = submitAction(
        gameId,
        state.currentPlayerId!,
        hasBet ? "bet" : "raise",
        980,
      );
      state = submitAction(gameId, state.currentPlayerId!, "call");

      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.River);
      expect(state.communityCards).toHaveLength(5);

      state = advanceGame(gameId);
      expect(state.phase).toBe(GamePhase.Waiting);
      expect(getHistory(gameId)[0].winners.length).toBeGreaterThan(0);
    });
  });

  describe("multiple consecutive hands", () => {
    it("plays 3 hands and tracks history correctly", () => {
      const gameId = createTestGame();

      for (let i = 0; i < 3; i++) {
        playCheckCallHand(gameId);
      }

      const history = getHistory(gameId);
      expect(history).toHaveLength(3);
      expect(history[0].handNumber).toBe(1);
      expect(history[1].handNumber).toBe(2);
      expect(history[2].handNumber).toBe(3);

      // Each hand should have winners
      for (const h of history) {
        expect(h.winners.length).toBeGreaterThan(0);
      }
    });
  });
});
