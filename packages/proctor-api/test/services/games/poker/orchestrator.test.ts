import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderInstruction } from "../../../../src/gql/resolverTypes.js";
import type { AgentRunner } from "../../../../src/services/games/poker/agent-runner.js";
import { runSession } from "../../../../src/services/games/poker/orchestrator.js";
import { _resetGames } from "../../../../src/services/games/poker/poker-engine.js";
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
    // GAME_START -> DEAL_HANDS -> PLAYER_ACTION(fold) -> HAND_RESULT -> GAME_OVER
    expect(instructions.length).toBeGreaterThanOrEqual(4);

    expect(instructions[0].type).toBe("GAME_START");
    expect(instructions[0].gameStart).toBeDefined();

    expect(instructions[1].type).toBe("DEAL_HANDS");
    expect(instructions[1].dealHands).toBeDefined();
    expect(instructions[1].dealHands!.handNumber).toBe(1);

    expect(instructions[2].type).toBe("PLAYER_ACTION");
    expect(instructions[2].playerAction).toBeDefined();
    expect(instructions[2].playerAction!.action).toBe("FOLD");
    expect(instructions[2].playerAction!.analysis).toBe(
      "I fold because my hand is weak",
    );

    expect(instructions[3].type).toBe("HAND_RESULT");
    expect(instructions[3].handResult).toBeDefined();
    expect(instructions[3].handResult!.winners.length).toBeGreaterThan(0);
  });

  it("marks session as FINISHED when game completes", async () => {
    const session = createSession("test-channel", baseConfig);
    const agentRunner = new ScriptedAgentRunner([{ action: { type: "FOLD" } }]);

    spyOnPublish();
    await runSession(session, agentRunner);

    expect(session.status).toBe("FINISHED");
  });

  it("handles agent failure with auto-fold", async () => {
    const session = createSession("test-channel", baseConfig);

    const failingRunner: AgentRunner = {
      async runTurn() {
        throw new Error("LLM API error");
      },
    };

    const instructions = spyOnPublish();
    await runSession(session, failingRunner);

    const playerAction = instructions.find((i) => i.type === "PLAYER_ACTION");
    expect(playerAction).toBeDefined();
    expect(playerAction!.playerAction!.action).toBe("FOLD");
  });

  it("stops on abort signal", async () => {
    const session = createSession("test-channel", {
      ...baseConfig,
      handsPerGame: 100,
    });

    // Use a slow agent to give time for abort
    const slowRunner: AgentRunner = {
      async runTurn() {
        await new Promise((r) => setTimeout(r, 50));
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
});
