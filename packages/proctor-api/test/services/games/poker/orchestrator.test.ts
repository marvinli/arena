import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderInstruction } from "../../../../src/gql/resolverTypes.js";
import type { AgentRunner } from "../../../../src/services/games/poker/agent-runner.js";
import { runSession } from "../../../../src/services/games/poker/orchestrator/index.js";
import { _resetGames } from "../../../../src/services/games/poker/poker-engine/index.js";
import * as pubsub from "../../../../src/services/session/pubsub.js";
import { _resetPubSub } from "../../../../src/services/session/pubsub.js";
import {
  _resetSessions,
  createSession,
} from "../../../../src/services/session/session-manager.js";
import { ScriptedAgentRunner } from "../../../fixtures/scripted-agent.js";

// ---- helpers ----

const baseConfig = {
  players: [
    {
      playerId: "p1",
      name: "Alice",
      modelId: "test",
      modelName: "Test Model",
      provider: "openai",
    },
    {
      playerId: "p2",
      name: "Bob",
      modelId: "test",
      modelName: "Test Model",
      provider: "openai",
    },
  ],
  startingChips: 1000,
  smallBlind: 5,
  bigBlind: 10,
  handsPerGame: 1,
};

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
    _resetGames();
    vi.restoreAllMocks();
  });

  it("runs a fold-to-win game and emits correct instruction sequence", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([
      {
        action: { type: "FOLD" },
        analysis: "I fold because my hand is weak",
      },
    ]);

    const instructions = spyOnPublish();

    await runSession(session, agentRunner);

    // Verify instruction sequence:
    // GAME_START -> DEAL_HANDS -> PLAYER_TURN -> PLAYER_ANALYSIS -> PLAYER_ACTION(fold) -> HAND_RESULT -> GAME_OVER
    expect(instructions.length).toBeGreaterThanOrEqual(6);

    expect(instructions[0].type).toBe("GAME_START");
    expect(instructions[0].gameStart).toBeDefined();

    expect(instructions[1].type).toBe("DEAL_HANDS");
    expect(instructions[1].dealHands).toBeDefined();
    expect(instructions[1].dealHands!.handNumber).toBe(1);

    expect(instructions[2].type).toBe("PLAYER_TURN");
    expect(instructions[2].playerTurn).toBeDefined();

    expect(instructions[3].type).toBe("PLAYER_ANALYSIS");
    expect(instructions[3].playerAnalysis).toBeDefined();
    expect(instructions[3].playerAnalysis!.analysis).toBe(
      "I fold because my hand is weak",
    );

    expect(instructions[4].type).toBe("PLAYER_ACTION");
    expect(instructions[4].playerAction).toBeDefined();
    expect(instructions[4].playerAction!.action).toBe("FOLD");

    expect(instructions[5].type).toBe("HAND_RESULT");
    expect(instructions[5].handResult).toBeDefined();
    expect(instructions[5].handResult!.winners.length).toBeGreaterThan(0);
  });

  it("marks session as FINISHED when game completes", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    spyOnPublish();
    await runSession(session, agentRunner);

    expect(session.status).toBe("FINISHED");
  });

  it("auto-folds with fallback line after LLM retries exhausted", async () => {
    const session = createSession("test-channel", baseConfig);

    const failingRunner: AgentRunner = {
      initAgent() {},
      injectMessage() {},
      async runTurn() {
        throw new Error("LLM API error");
      },
      async rejectAction() {
        return { action: { type: "FOLD" } };
      },
    };

    const instructions = spyOnPublish();
    await runSession(session, failingRunner);

    expect(session.status).toBe("FINISHED");

    // Should have emitted a PLAYER_ACTION with FOLD (or CHECK) as fallback
    const action = instructions.find((i) => i.type === "PLAYER_ACTION");
    expect(action).toBeDefined();
    expect(["FOLD", "CHECK"]).toContain(action!.playerAction!.action);

    // Should have emitted a PLAYER_ANALYSIS with isApiError
    const analysis = instructions.find((i) => i.type === "PLAYER_ANALYSIS");
    expect(analysis).toBeDefined();
    expect(analysis!.playerAnalysis!.isApiError).toBe(true);
  }, 30_000);

  it("stops on abort signal", async () => {
    const session = createSession("test-channel", {
      ...baseConfig,
      handsPerGame: 100,
    });

    // Use a slow agent to give time for abort
    const slowRunner: AgentRunner = {
      initAgent() {},
      injectMessage() {},
      async runTurn() {
        await new Promise((r) => setTimeout(r, 50));
        return { action: { type: "FOLD" } };
      },
      async rejectAction() {
        return { action: { type: "FOLD" } };
      },
    };

    spyOnPublish();
    setTimeout(() => session.abortController.abort(), 20);

    await runSession(session, slowRunner);

    expect(session.status).toBe("STOPPED");
  });

  it("sets gameId and updates hand number on session", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    spyOnPublish();
    await runSession(session, agentRunner);

    expect(session.gameId).toBeDefined();
    expect(session.gameId).not.toBeNull();
    expect(session.handNumber).toBe(1);
  });

  it("emits GAME_OVER with winner info", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    const instructions = spyOnPublish();
    await runSession(session, agentRunner);

    const gameOver = instructions.find((i) => i.type === "GAME_OVER");
    expect(gameOver).toBeDefined();
    expect(gameOver!.gameOver).toBeDefined();
    expect(gameOver!.gameOver!.handsPlayed).toBe(1);
  });

  it("each instruction has unique instructionId and timestamp", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    const instructions = spyOnPublish();
    await runSession(session, agentRunner);

    const ids = instructions.map((i) => i.instructionId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const inst of instructions) {
      expect(inst.timestamp).toBeDefined();
      expect(inst.instructionId).toBeDefined();
    }
  });

  it("plays multiple hands and emits LEADERBOARD between them", async () => {
    const session = createSession("test-channel", {
      ...baseConfig,
      handsPerGame: 2,
    });
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    const instructions = spyOnPublish();
    await runSession(session, agentRunner);

    expect(session.handNumber).toBe(2);

    const leaderboards = instructions.filter((i) => i.type === "LEADERBOARD");
    expect(leaderboards.length).toBeGreaterThanOrEqual(1);
    expect(leaderboards[0].leaderboard!.players.length).toBe(2);

    const dealHands = instructions.filter((i) => i.type === "DEAL_HANDS");
    expect(dealHands).toHaveLength(2);
  });

  it("skips PLAYER_ANALYSIS when agent returns no analysis", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    const instructions = spyOnPublish();
    await runSession(session, agentRunner);

    const analyses = instructions.filter((i) => i.type === "PLAYER_ANALYSIS");
    expect(analyses).toHaveLength(0);
  });

  it("retries and auto-folds on invalid action from agent", async () => {
    const session = createSession("test-channel", baseConfig);

    let callCount = 0;
    const badActionRunner: AgentRunner = {
      initAgent() {},
      injectMessage() {},
      async runTurn() {
        callCount++;
        // Always return an invalid action (BET without amount)
        return { action: { type: "BET" }, analysis: "I bet big!" };
      },
      async rejectAction() {
        // Still return bad action
        return { action: { type: "BET" } };
      },
    };

    const instructions = spyOnPublish();
    await runSession(session, badActionRunner);

    // Should have auto-folded after retries
    expect(session.status).toBe("FINISHED");

    // Agent should have been called at least once
    expect(callCount).toBeGreaterThanOrEqual(1);

    // The final action should be FOLD (auto-fold after retries)
    const actions = instructions.filter((i) => i.type === "PLAYER_ACTION");
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].playerAction!.action).toBe("FOLD");
  });

  it("injects opponent actions into other players' agents", async () => {
    const session = createSession("test-channel", baseConfig);

    const injectedMessages: Array<{ playerId: string; message: string }> = [];
    const trackingRunner: AgentRunner = {
      initAgent() {},
      injectMessage(playerId, message) {
        injectedMessages.push({ playerId, message });
      },
      async runTurn() {
        return { action: { type: "FOLD" } };
      },
      async rejectAction() {
        return { action: { type: "FOLD" } };
      },
    };

    spyOnPublish();
    await runSession(session, trackingRunner);

    // The non-folding player should have received OPPONENT_ACTION
    // formatOpponentAction lowercases: "Alice folds."
    const opponentActions = injectedMessages.filter((m) =>
      m.message.includes("folds"),
    );
    expect(opponentActions.length).toBeGreaterThan(0);
  });
});
