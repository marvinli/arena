import { beforeEach, describe, expect, it } from "vitest";
import { _resetGames } from "../src/services/games/poker/poker-engine/index.js";
import { gql } from "./yoga-helper.js";

const CREATE_GAME = /* GraphQL */ `
  mutation CreateGame($input: CreateGameInput!) {
    createGame(input: $input) {
      gameId
      phase
      players { id name chips status seatIndex }
      handNumber
    }
  }
`;

const START_HAND = /* GraphQL */ `
  mutation StartHand($gameId: ID!) {
    startHand(gameId: $gameId) {
      gameId
      phase
      handNumber
      currentPlayerId
      players { id chips bet status }
      pots { size eligiblePlayerIds }
    }
  }
`;

const GET_GAME_STATE = /* GraphQL */ `
  query GetGameState($gameId: ID!) {
    getGameState(gameId: $gameId) {
      gameId
      phase
      handNumber
      currentPlayerId
      communityCards { rank suit }
      players { id name chips bet status seatIndex }
      pots { size eligiblePlayerIds }
      button
    }
  }
`;

const GET_MY_TURN = /* GraphQL */ `
  query GetMyTurn($gameId: ID!) {
    getMyTurn(gameId: $gameId) {
      gameState { gameId phase currentPlayerId }
      myHand { rank suit }
      validActions { type amount min max }
    }
  }
`;

const SUBMIT_ACTION = /* GraphQL */ `
  mutation SubmitAction($gameId: ID!, $action: SubmitActionInput!) {
    submitAction(gameId: $gameId, action: $action) {
      gameId
      phase
      currentPlayerId
      players { id chips bet status }
      pots { size }
    }
  }
`;

const ADVANCE_GAME = /* GraphQL */ `
  mutation AdvanceGame($gameId: ID!) {
    advanceGame(gameId: $gameId) {
      gameId
      phase
      communityCards { rank suit }
      currentPlayerId
      handNumber
      pots { size eligiblePlayerIds }
    }
  }
`;

const GET_HISTORY = /* GraphQL */ `
  query GetHistory($gameId: ID!, $lastN: Int) {
    getHistory(gameId: $gameId, lastN: $lastN) {
      handNumber
      communityCards { rank suit }
      players { id name startingChips }
      actions { phase actions { playerId action amount } }
      pots { size }
      winners { playerId amount hand }
    }
  }
`;

const TEST_INPUT = {
  players: [
    { id: "p1", name: "Alice", chips: 1000 },
    { id: "p2", name: "Bob", chips: 1000 },
    { id: "p3", name: "Charlie", chips: 1000 },
  ],
  smallBlind: 10,
  bigBlind: 20,
};

async function createAndStart() {
  const createRes = await gql<{ createGame: { gameId: string } }>(CREATE_GAME, {
    input: TEST_INPUT,
  });
  const gameId = createRes.data!.createGame.gameId;
  const startRes = await gql<{
    startHand: { currentPlayerId: string; phase: string };
  }>(START_HAND, { gameId });
  return { gameId, state: startRes.data!.startHand };
}

describe("poker-api GraphQL", () => {
  beforeEach(() => {
    _resetGames();
  });

  describe("context / auth", () => {
    it("getMyTurn rejects when X-Player-Id header is missing", async () => {
      const { gameId } = await createAndStart();
      const res = await gql(GET_MY_TURN, { gameId });
      expect(res.errors).toBeDefined();
      expect(res.errors![0].message).toBe("Missing X-Player-Id header");
    });

    it("submitAction rejects when X-Player-Id header is missing", async () => {
      const { gameId } = await createAndStart();
      const res = await gql(SUBMIT_ACTION, {
        gameId,
        action: { type: "CALL" },
      });
      expect(res.errors).toBeDefined();
      expect(res.errors![0].message).toBe("Missing X-Player-Id header");
    });

    it("getMyTurn succeeds with X-Player-Id header", async () => {
      const { gameId } = await createAndStart();
      const res = await gql<{
        getMyTurn: { myHand: unknown[] };
      }>(GET_MY_TURN, { gameId }, { "x-player-id": "p1" });
      expect(res.errors).toBeUndefined();
      expect(res.data!.getMyTurn.myHand).toHaveLength(2);
    });
  });

  describe("queries", () => {
    it("getGameState returns created game", async () => {
      const createRes = await gql<{ createGame: { gameId: string } }>(
        CREATE_GAME,
        { input: TEST_INPUT },
      );
      const gameId = createRes.data!.createGame.gameId;

      const res = await gql<{
        getGameState: {
          gameId: string;
          phase: string;
          players: { id: string }[];
        };
      }>(GET_GAME_STATE, { gameId });
      expect(res.errors).toBeUndefined();
      expect(res.data!.getGameState.gameId).toBe(gameId);
      expect(res.data!.getGameState.phase).toBe("WAITING");
      expect(res.data!.getGameState.players).toHaveLength(3);
    });

    it("getGameState with bad gameId returns error", async () => {
      const res = await gql(GET_GAME_STATE, { gameId: "nonexistent" });
      expect(res.errors).toBeDefined();
      expect(res.errors![0].message).toContain("Game not found");
    });

    it("getMyTurn returns hole cards and valid actions for active player", async () => {
      const { gameId, state } = await createAndStart();
      const res = await gql<{
        getMyTurn: {
          myHand: { rank: string; suit: string }[];
          validActions: { type: string }[];
        };
      }>(GET_MY_TURN, { gameId }, { "x-player-id": state.currentPlayerId });
      expect(res.errors).toBeUndefined();
      const turn = res.data!.getMyTurn;
      expect(turn.myHand).toHaveLength(2);
      expect(turn.myHand[0]).toHaveProperty("rank");
      expect(turn.myHand[0]).toHaveProperty("suit");
      expect(turn.validActions.length).toBeGreaterThan(0);
      for (const action of turn.validActions) {
        expect(["FOLD", "CHECK", "CALL", "BET", "RAISE"]).toContain(
          action.type,
        );
      }
    });

    it("getHistory returns empty before any hands", async () => {
      const createRes = await gql<{ createGame: { gameId: string } }>(
        CREATE_GAME,
        { input: TEST_INPUT },
      );
      const gameId = createRes.data!.createGame.gameId;
      const res = await gql<{ getHistory: unknown[] }>(GET_HISTORY, {
        gameId,
      });
      expect(res.errors).toBeUndefined();
      expect(res.data!.getHistory).toEqual([]);
    });
  });

  describe("mutations", () => {
    it("createGame returns valid GameState", async () => {
      const res = await gql<{
        createGame: {
          gameId: string;
          phase: string;
          handNumber: number;
          players: {
            id: string;
            name: string;
            chips: number;
            status: string;
          }[];
        };
      }>(CREATE_GAME, { input: TEST_INPUT });
      expect(res.errors).toBeUndefined();
      const game = res.data!.createGame;
      expect(game.gameId).toBeDefined();
      expect(game.phase).toBe("WAITING");
      expect(game.handNumber).toBe(0);
      expect(game.players).toHaveLength(3);
      expect(game.players[0].id).toBe("p1");
      expect(game.players[0].name).toBe("Alice");
      expect(game.players[0].chips).toBe(1000);
      expect(game.players[0].status).toBe("ACTIVE");
    });

    it("startHand transitions to PREFLOP", async () => {
      const createRes = await gql<{ createGame: { gameId: string } }>(
        CREATE_GAME,
        { input: TEST_INPUT },
      );
      const gameId = createRes.data!.createGame.gameId;
      const res = await gql<{
        startHand: {
          phase: string;
          handNumber: number;
          currentPlayerId: string;
        };
      }>(START_HAND, { gameId });
      expect(res.errors).toBeUndefined();
      expect(res.data!.startHand.phase).toBe("PREFLOP");
      expect(res.data!.startHand.handNumber).toBe(1);
      expect(res.data!.startHand.currentPlayerId).toBeDefined();
    });

    it("submitAction advances turn to next player", async () => {
      const { gameId, state } = await createAndStart();
      const currentId = state.currentPlayerId;

      const res = await gql<{
        submitAction: { currentPlayerId: string };
      }>(
        SUBMIT_ACTION,
        { gameId, action: { type: "CALL" } },
        { "x-player-id": currentId },
      );
      expect(res.errors).toBeUndefined();
      expect(res.data!.submitAction.currentPlayerId).not.toBe(currentId);
    });

    it("advanceGame moves to next phase after betting round", async () => {
      const { gameId } = await createAndStart();

      // Complete preflop: everyone calls/checks
      let state = (
        await gql<{
          getGameState: { phase: string; currentPlayerId: string | null };
        }>(GET_GAME_STATE, { gameId })
      ).data!.getGameState;

      while (state.phase === "PREFLOP" && state.currentPlayerId) {
        const turn = (
          await gql<{
            getMyTurn: { validActions: { type: string }[] };
          }>(GET_MY_TURN, { gameId }, { "x-player-id": state.currentPlayerId })
        ).data!.getMyTurn;
        const canCheck = turn.validActions.some((a) => a.type === "CHECK");
        await gql(
          SUBMIT_ACTION,
          { gameId, action: { type: canCheck ? "CHECK" : "CALL" } },
          { "x-player-id": state.currentPlayerId },
        );
        state = (
          await gql<{
            getGameState: { phase: string; currentPlayerId: string | null };
          }>(GET_GAME_STATE, { gameId })
        ).data!.getGameState;
      }

      const res = await gql<{
        advanceGame: {
          phase: string;
          communityCards: unknown[];
        };
      }>(ADVANCE_GAME, { gameId });
      expect(res.errors).toBeUndefined();
      expect(res.data!.advanceGame.phase).toBe("FLOP");
      expect(res.data!.advanceGame.communityCards).toHaveLength(3);
    });
  });

  describe("full game flow", () => {
    it("plays a complete fold-to-win hand via GraphQL", async () => {
      const createRes = await gql<{ createGame: { gameId: string } }>(
        CREATE_GAME,
        { input: TEST_INPUT },
      );
      const gameId = createRes.data!.createGame.gameId;

      await gql(START_HAND, { gameId });
      let state = (
        await gql<{
          getGameState: { currentPlayerId: string };
        }>(GET_GAME_STATE, { gameId })
      ).data!.getGameState;

      // First player folds
      await gql(
        SUBMIT_ACTION,
        { gameId, action: { type: "FOLD" } },
        { "x-player-id": state.currentPlayerId },
      );
      state = (
        await gql<{
          getGameState: { currentPlayerId: string };
        }>(GET_GAME_STATE, { gameId })
      ).data!.getGameState;

      // Second player folds
      await gql(
        SUBMIT_ACTION,
        { gameId, action: { type: "FOLD" } },
        { "x-player-id": state.currentPlayerId },
      );

      // Advance to showdown
      const advanceRes = await gql<{
        advanceGame: { phase: string };
      }>(ADVANCE_GAME, { gameId });
      expect(advanceRes.data!.advanceGame.phase).toBe("WAITING");

      // Verify history
      const historyRes = await gql<{
        getHistory: {
          handNumber: number;
          winners: { playerId: string }[];
          players: unknown[];
        }[];
      }>(GET_HISTORY, { gameId });
      expect(historyRes.errors).toBeUndefined();
      const history = historyRes.data!.getHistory;
      expect(history).toHaveLength(1);
      expect(history[0].handNumber).toBe(1);
      expect(history[0].winners.length).toBeGreaterThan(0);
      expect(history[0].players).toHaveLength(3);
    });
  });

  describe("error handling", () => {
    it("startHand twice returns a GraphQL error", async () => {
      const { gameId } = await createAndStart();
      const res = await gql(START_HAND, { gameId });
      expect(res.errors).toBeDefined();
      expect(res.errors![0].message).toContain("hand already in progress");
    });

    it("submitAction with invalid enum value returns validation error", async () => {
      const { gameId, state } = await createAndStart();
      const res = await gql(
        SUBMIT_ACTION,
        { gameId, action: { type: "INVALID_ACTION" } },
        { "x-player-id": state.currentPlayerId },
      );
      expect(res.errors).toBeDefined();
    });
  });
});
