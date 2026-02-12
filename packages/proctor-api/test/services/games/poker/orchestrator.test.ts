import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/persistence.js", () => ({
  insertInstruction: vi.fn(),
  createModule: vi.fn(),
  completeModule: vi.fn(),
  upsertChannelState: vi.fn(),
  getChannelState: vi.fn(),
  appendAgentMessage: vi.fn(),
  getAgentMessages: vi.fn(() => []),
}));

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
import {
  PassiveAgentRunner,
  ScriptedAgentRunner,
} from "../../../fixtures/scripted-agent.js";

// ---- helpers ----

// With blinds equal to the stack, BB is all-in from the start.
// A CALL by SB puts both all-in → showdown → one player busts in 1 hand.
// The blind schedule escalates after 1 hand to force termination even if
// both players fold (heads-up fold oscillation would otherwise be infinite).
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
  startingChips: 100,
  smallBlind: 50,
  bigBlind: 100,
  blindSchedule: [
    { smallBlind: 50, bigBlind: 100 },
    { smallBlind: 200, bigBlind: 400 },
  ],
  handsPerLevel: 1,
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

  it("runs a game to completion and emits correct instruction sequence", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([
      {
        action: { type: "CALL" },
        analysis: "I'm going to call here",
      },
    ]);

    const instructions = spyOnPublish();

    await runSession(session, agentRunner, "test-module");

    expect(instructions[0].type).toBe("GAME_START");
    expect(instructions[0].gameStart).toBeDefined();

    const dealHands = instructions.find((i) => i.type === "DEAL_HANDS");
    expect(dealHands).toBeDefined();
    expect(dealHands!.dealHands!.handNumber).toBe(1);

    const playerTurn = instructions.find((i) => i.type === "PLAYER_TURN");
    expect(playerTurn).toBeDefined();

    const analysis = instructions.find((i) => i.type === "PLAYER_ANALYSIS");
    expect(analysis).toBeDefined();
    expect(analysis!.playerAnalysis!.analysis).toBe("I'm going to call here");

    const action = instructions.find((i) => i.type === "PLAYER_ACTION");
    expect(action).toBeDefined();
    expect(action!.playerAction!.action).toBe("CALL");

    const handResult = instructions.find((i) => i.type === "HAND_RESULT");
    expect(handResult).toBeDefined();
    expect(handResult!.handResult!.winners.length).toBeGreaterThan(0);
  });

  it("marks session as FINISHED when game completes", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "CALL" } }]);

    spyOnPublish();
    await runSession(session, agentRunner, "test-module");

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
      async promptReaction() {
        return undefined;
      },
    };

    const instructions = spyOnPublish();
    await runSession(session, failingRunner, "test-module");

    expect(session.status).toBe("FINISHED");

    // Should have emitted a PLAYER_ACTION with FOLD (or CHECK) as fallback
    const action = instructions.find((i) => i.type === "PLAYER_ACTION");
    expect(action).toBeDefined();
    expect(["FOLD", "CHECK"]).toContain(action!.playerAction!.action);

    // Should have emitted a PLAYER_ANALYSIS with isApiError
    const analysis = instructions.find((i) => i.type === "PLAYER_ANALYSIS");
    expect(analysis).toBeDefined();
    expect(analysis!.playerAnalysis!.isApiError).toBe(true);
  }, 60_000);

  it("stops on abort signal", async () => {
    const session = createSession("test-channel", {
      ...baseConfig,
      startingChips: 10000,
      smallBlind: 5,
      bigBlind: 10,
    });

    // Use a slow passive agent to give time for abort
    const slowRunner: AgentRunner = {
      initAgent() {},
      injectMessage() {},
      async runTurn(_playerId, context) {
        await new Promise((r) => setTimeout(r, 50));
        const valid = context.validActions.map((a) => a.type);
        if (valid.includes("CALL")) return { action: { type: "CALL" } };
        if (valid.includes("CHECK")) return { action: { type: "CHECK" } };
        return { action: { type: "FOLD" } };
      },
      async rejectAction() {
        return { action: { type: "FOLD" } };
      },
      async promptReaction() {
        return undefined;
      },
    };

    spyOnPublish();
    setTimeout(() => session.abortController.abort(), 20);

    await runSession(session, slowRunner, "test-module");

    expect(session.status).toBe("STOPPED");
  });

  it("sets gameId and updates hand number on session", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "CALL" } }]);

    spyOnPublish();
    await runSession(session, agentRunner, "test-module");

    expect(session.gameId).toBeDefined();
    expect(session.gameId).not.toBeNull();
    expect(session.handNumber).toBe(1);
  });

  it("emits GAME_OVER with winner info", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "CALL" } }]);

    const instructions = spyOnPublish();
    await runSession(session, agentRunner, "test-module");

    const gameOver = instructions.find((i) => i.type === "GAME_OVER");
    expect(gameOver).toBeDefined();
    expect(gameOver!.gameOver).toBeDefined();
    expect(gameOver!.gameOver!.handsPlayed).toBe(1);
  });

  it("each instruction has unique instructionId and timestamp", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "CALL" } }]);

    const instructions = spyOnPublish();
    await runSession(session, agentRunner, "test-module");

    const ids = instructions.map((i) => i.instructionId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const inst of instructions) {
      expect(inst.timestamp).toBeDefined();
      expect(inst.instructionId).toBeDefined();
    }
  });

  it("plays multiple hands and emits GAME_OVER with awards", async () => {
    // Blind schedule: hands 1-2 at 10/20 (survivable with 200 chips),
    // then jumps to 100/200 which forces all-in and bust.
    // Guarantees 2+ hands and terminates within ~4 hands.
    const session = createSession("test-channel", {
      ...baseConfig,
      startingChips: 200,
      smallBlind: 10,
      bigBlind: 20,
      blindSchedule: [
        { smallBlind: 10, bigBlind: 20 },
        { smallBlind: 100, bigBlind: 200 },
      ],
      handsPerLevel: 2,
    });
    const agentRunner = new PassiveAgentRunner();

    const instructions = spyOnPublish();
    await runSession(session, agentRunner, "test-module");

    expect(session.handNumber).toBeGreaterThanOrEqual(2);

    const dealHands = instructions.filter((i) => i.type === "DEAL_HANDS");
    expect(dealHands.length).toBeGreaterThanOrEqual(2);

    // No between-hands leaderboard
    const leaderboards = instructions.filter((i) => i.type === "LEADERBOARD");
    expect(leaderboards.length).toBe(0);

    // GAME_OVER should include awards with new shape
    const gameOver = instructions.find((i) => i.type === "GAME_OVER");
    expect(gameOver).toBeDefined();
    expect(gameOver!.gameOver!.awards.length).toBeGreaterThan(0);
    const award = gameOver!.gameOver!.awards[0];
    expect(award.playerIds.length).toBeGreaterThan(0);
    expect(award.playerNames.length).toBeGreaterThan(0);
    expect(award.description).toBeDefined();
  }, 30_000);

  it("skips PLAYER_ANALYSIS when agent returns no analysis", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "CALL" } }]);

    const instructions = spyOnPublish();
    await runSession(session, agentRunner, "test-module");

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
      async promptReaction() {
        return undefined;
      },
    };

    const instructions = spyOnPublish();
    await runSession(session, badActionRunner, "test-module");

    // Should have completed via blind escalation forcing all-in showdown
    expect(session.status).toBe("FINISHED");

    // Agent should have been called at least once
    expect(callCount).toBeGreaterThanOrEqual(1);

    // The first action should be FOLD or CHECK (auto-fallback after retries)
    const actions = instructions.filter((i) => i.type === "PLAYER_ACTION");
    expect(actions.length).toBeGreaterThan(0);
    expect(["FOLD", "CHECK"]).toContain(actions[0].playerAction!.action);
  }, 30_000);

  it("injects opponent actions into other players' agents", async () => {
    const session = createSession("test-channel", baseConfig);

    const injectedMessages: Array<{ playerId: string; message: string }> = [];
    const trackingRunner: AgentRunner = {
      initAgent() {},
      injectMessage(playerId, message) {
        injectedMessages.push({ playerId, message });
      },
      async runTurn() {
        return { action: { type: "CALL" } };
      },
      async rejectAction() {
        return { action: { type: "FOLD" } };
      },
      async promptReaction() {
        return undefined;
      },
    };

    spyOnPublish();
    await runSession(session, trackingRunner, "test-module");

    // The other player should have received an opponent action message
    const opponentActions = injectedMessages.filter(
      (m) => m.message.includes("calls") || m.message.includes("folds"),
    );
    expect(opponentActions.length).toBeGreaterThan(0);
  });
});
