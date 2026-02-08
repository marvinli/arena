import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunner } from "../src/agent-runner.js";
import type { RenderInstruction } from "../src/gql/resolverTypes.js";
import { runSession } from "../src/orchestrator.js";
import type {
  PokerApiClient,
  PokerGameState,
} from "../src/poker-api-client.js";
import * as pubsub from "../src/pubsub.js";
import { _resetPubSub } from "../src/pubsub.js";
import { _resetSessions, createSession } from "../src/session-manager.js";
import { ScriptedAgentRunner } from "./fixtures/scripted-agent.js";

// ---- helpers ----

const baseConfig = {
  players: [
    {
      playerId: "p1",
      name: "Alice",
      model: "test",
      systemPrompt: "Play poker",
    },
    {
      playerId: "p2",
      name: "Bob",
      model: "test",
      systemPrompt: "Play poker",
    },
  ],
  startingChips: 1000,
  smallBlind: 5,
  bigBlind: 10,
  handsPerGame: 1,
};

function makeGameState(
  overrides: Partial<PokerGameState> = {},
): PokerGameState {
  return {
    gameId: "game-1",
    phase: "PREFLOP",
    communityCards: [],
    players: [
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
        chips: 1000,
        bet: 0,
        status: "ACTIVE",
        seatIndex: 1,
      },
    ],
    pots: [{ size: 15, eligiblePlayerIds: ["p1", "p2"] }],
    currentPlayerId: "p1",
    handNumber: 1,
    button: 0,
    ...overrides,
  };
}

/**
 * Creates a mock PokerApiClient that simulates a simple fold-to-win scenario:
 * p1 folds -> p2 wins.
 */
function createFoldWinClient(): PokerApiClient {
  let phase = "WAITING";
  let currentPlayerId: string | null = null;

  return {
    async createGame() {
      phase = "WAITING";
      return makeGameState({ phase, currentPlayerId: null });
    },
    async startHand() {
      phase = "PREFLOP";
      currentPlayerId = "p1";
      return makeGameState({ phase, currentPlayerId });
    },
    async getGameState() {
      return makeGameState({ phase, currentPlayerId });
    },
    async getMyTurn(_gameId, playerId) {
      return {
        gameState: makeGameState({ phase, currentPlayerId: playerId }),
        myHand: [
          { rank: "A", suit: "spades" },
          { rank: "K", suit: "hearts" },
        ],
        validActions: [
          { type: "FOLD" },
          { type: "CALL", amount: 10 },
          { type: "RAISE", min: 20, max: 1000 },
        ],
      };
    },
    async submitAction(_gameId, _playerId, action) {
      if (action.type === "FOLD") {
        currentPlayerId = null;
        return makeGameState({
          phase,
          currentPlayerId: null,
          players: [
            {
              id: "p1",
              name: "Alice",
              chips: 1000,
              bet: 0,
              status: "FOLDED",
              seatIndex: 0,
            },
            {
              id: "p2",
              name: "Bob",
              chips: 1000,
              bet: 0,
              status: "ACTIVE",
              seatIndex: 1,
            },
          ],
        });
      }
      currentPlayerId = "p2";
      return makeGameState({ phase, currentPlayerId });
    },
    async advanceGame() {
      phase = "WAITING";
      currentPlayerId = null;
      return makeGameState({ phase, currentPlayerId: null });
    },
    async getHistory() {
      return [
        {
          handNumber: 1,
          players: [
            { id: "p1", name: "Alice", startingChips: 1000 },
            { id: "p2", name: "Bob", startingChips: 1000 },
          ],
          communityCards: [],
          actions: [
            {
              phase: "PREFLOP",
              actions: [{ playerId: "p1", action: "fold" }],
            },
          ],
          pots: [{ size: 15, eligiblePlayerIds: ["p2"] }],
          winners: [{ playerId: "p2", amount: 15 }],
        },
      ];
    },
  };
}

/** Spy on publish to capture all emitted instructions */
function spyOnPublish(): RenderInstruction[] {
  const instructions: RenderInstruction[] = [];
  vi.spyOn(pubsub, "publish").mockImplementation((_channelKey, instruction) => {
    instructions.push(instruction);
  });
  return instructions;
}

// ---- tests ----

describe("orchestrator", () => {
  beforeEach(() => {
    _resetSessions();
    _resetPubSub();
    vi.restoreAllMocks();
  });

  it("runs a fold-to-win game and emits correct instruction sequence", async () => {
    const session = createSession("test-channel", baseConfig);
    const pokerApi = createFoldWinClient();
    const agentRunner = new ScriptedAgentRunner([
      {
        action: { type: "FOLD" },
        analysis: "I fold because my hand is weak",
      },
    ]);

    const instructions = spyOnPublish();

    await runSession(session, pokerApi, agentRunner);

    // Verify instruction sequence:
    // GAME_START -> DEAL_HANDS -> PLAYER_ACTION(fold) -> HAND_RESULT -> GAME_OVER
    expect(instructions.length).toBeGreaterThanOrEqual(4);

    expect(instructions[0].type).toBe("GAME_START");
    expect(instructions[0].gameStart).toBeDefined();
    expect(instructions[0].gameStart!.gameId).toBe("game-1");

    expect(instructions[1].type).toBe("DEAL_HANDS");
    expect(instructions[1].dealHands).toBeDefined();
    expect(instructions[1].dealHands!.handNumber).toBe(1);

    expect(instructions[2].type).toBe("PLAYER_ACTION");
    expect(instructions[2].playerAction).toBeDefined();
    expect(instructions[2].playerAction!.playerId).toBe("p1");
    expect(instructions[2].playerAction!.action).toBe("FOLD");
    expect(instructions[2].playerAction!.analysis).toBe(
      "I fold because my hand is weak",
    );

    expect(instructions[3].type).toBe("HAND_RESULT");
    expect(instructions[3].handResult).toBeDefined();
    expect(instructions[3].handResult!.winners[0].playerId).toBe("p2");
  });

  it("marks session as FINISHED when game completes", async () => {
    const session = createSession("test-channel", baseConfig);
    const pokerApi = createFoldWinClient();
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    spyOnPublish();
    await runSession(session, pokerApi, agentRunner);

    expect(session.status).toBe("FINISHED");
  });

  it("handles agent failure with auto-fold", async () => {
    const session = createSession("test-channel", baseConfig);
    const pokerApi = createFoldWinClient();

    const failingRunner: AgentRunner = {
      async runTurn() {
        throw new Error("LLM API error");
      },
    };

    const instructions = spyOnPublish();
    await runSession(session, pokerApi, failingRunner);

    const playerAction = instructions.find((i) => i.type === "PLAYER_ACTION");
    expect(playerAction).toBeDefined();
    expect(playerAction!.playerAction!.action).toBe("FOLD");
  });

  it("stops on abort signal", async () => {
    const session = createSession("test-channel", {
      ...baseConfig,
      handsPerGame: 100,
    });

    const slowClient: PokerApiClient = {
      ...createFoldWinClient(),
      async startHand() {
        await new Promise((r) => setTimeout(r, 50));
        return makeGameState({ phase: "PREFLOP", currentPlayerId: "p1" });
      },
    };

    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    spyOnPublish();
    setTimeout(() => session.abortController.abort(), 20);

    await runSession(session, slowClient, agentRunner);

    expect(session.status).toBe("STOPPED");
  });

  it("sets gameId and updates player chips on session", async () => {
    const session = createSession("test-channel", baseConfig);
    const pokerApi = createFoldWinClient();
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    spyOnPublish();
    await runSession(session, pokerApi, agentRunner);

    expect(session.gameId).toBe("game-1");
    expect(session.handNumber).toBe(1);
  });

  it("emits GAME_OVER with winner info", async () => {
    const session = createSession("test-channel", baseConfig);
    const pokerApi = createFoldWinClient();
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    const instructions = spyOnPublish();
    await runSession(session, pokerApi, agentRunner);

    const gameOver = instructions.find((i) => i.type === "GAME_OVER");
    expect(gameOver).toBeDefined();
    expect(gameOver!.gameOver).toBeDefined();
    expect(gameOver!.gameOver!.handsPlayed).toBe(1);
  });

  it("each instruction has unique instructionId and timestamp", async () => {
    const session = createSession("test-channel", baseConfig);
    const pokerApi = createFoldWinClient();
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    const instructions = spyOnPublish();
    await runSession(session, pokerApi, agentRunner);

    const ids = instructions.map((i) => i.instructionId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const inst of instructions) {
      expect(inst.timestamp).toBeDefined();
      expect(inst.instructionId).toBeDefined();
    }
  });
});
