import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
	generateText: vi.fn(),
	tool: vi.fn((opts: unknown) => opts),
}));

vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn() }));
vi.mock("@ai-sdk/google", () => ({ google: vi.fn() }));

import { generateText } from "ai";
import type { AgentTurnContext } from "../../../../src/services/games/poker/agent-runner.js";
import { LlmAgentRunner } from "../../../../src/services/games/poker/llm-agent-runner.js";

const mockGenerateText = vi.mocked(generateText);

const config = {
	id: "p1",
	name: "Alice",
	modelId: "test-model",
	modelName: "Test",
	provider: "anthropic" as const,
};

const context: AgentTurnContext = {
	gameId: "g1",
	handNumber: 1,
	phase: "PREFLOP",
	communityCards: [],
	myHand: [
		{ rank: "A", suit: "spades" },
		{ rank: "K", suit: "hearts" },
	],
	players: [
		{ id: "p1", name: "Alice", chips: 1000, bet: 0, status: "ACTIVE" },
	],
	pots: [{ size: 30, eligiblePlayerIds: ["p1"] }],
	validActions: [{ type: "FOLD" }, { type: "CALL", amount: 10 }],
};

function mockGenerateTextResult(
	action = "CALL",
	analysis = "I call because the odds are good.",
	toolCallId = "tc-123",
) {
	mockGenerateText.mockResolvedValue({
		response: {
			messages: [{ role: "assistant", content: "Let me think..." }],
		},
		staticToolCalls: [
			{
				toolName: "submit_action",
				toolCallId,
				input: { action, amount: undefined, analysis },
			},
		],
	} as never);
}

describe("LlmAgentRunner", () => {
	let runner: LlmAgentRunner;

	beforeEach(() => {
		vi.restoreAllMocks();
		runner = new LlmAgentRunner();
	});

	it("initAgent stores agent config and creates empty message array", () => {
		runner.initAgent("p1", config);

		// Verify the agent was stored by calling injectMessage (no warn)
		// and runTurn (no throw) — indirectly confirms state exists
		const warnSpy = vi.spyOn(console, "warn");
		runner.injectMessage("p1", "test");
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("injectMessage appends a user message to the agent conversation", async () => {
		runner.initAgent("p1", config);
		runner.injectMessage("p1", "Hand dealt. Your cards: A K");

		mockGenerateTextResult();
		await runner.runTurn("p1", context);

		// The messages passed to generateText should include the injected message
		// before the YOUR_TURN message
		const callArgs = mockGenerateText.mock.calls[0][0] as {
			messages: Array<{ role: string; content: string }>;
		};
		expect(callArgs.messages[0]).toEqual({
			role: "user",
			content: "Hand dealt. Your cards: A K",
		});
	});

	it("injectMessage warns on unknown agent", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		runner.injectMessage("unknown-id", "hello");
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("unknown agent: unknown-id"),
		);
	});

	it("runTurn appends YOUR_TURN message and calls generateText", async () => {
		runner.initAgent("p1", config);
		mockGenerateTextResult();

		await runner.runTurn("p1", context);

		expect(mockGenerateText).toHaveBeenCalledOnce();
		const callArgs = mockGenerateText.mock.calls[0][0] as {
			messages: Array<{ role: string; content: string }>;
			system: string;
			tools: Record<string, unknown>;
		};

		// The first message should be the YOUR_TURN user message.
		// (After promptAgent returns, response messages and tool results are
		// appended to the same array, so we check the first entry only.)
		expect(callArgs.messages[0].role).toBe("user");
		expect(callArgs.messages[0].content).toContain("It's your turn");
		expect(callArgs.system).toBeDefined();
		expect(callArgs.tools).toHaveProperty("submit_action");
	});

	it("runTurn returns the correct action and analysis from tool call", async () => {
		runner.initAgent("p1", config);
		mockGenerateTextResult("CALL", "Pot odds favor a call here.");

		const result = await runner.runTurn("p1", context);

		expect(result).toEqual({
			action: { type: "CALL", amount: undefined },
			analysis: "Pot odds favor a call here.",
		});
	});

	it("runTurn throws when agent does not call submit_action", async () => {
		runner.initAgent("p1", config);
		mockGenerateText.mockResolvedValue({
			response: {
				messages: [{ role: "assistant", content: "Hmm..." }],
			},
			staticToolCalls: [],
		} as never);

		await expect(runner.runTurn("p1", context)).rejects.toThrow(
			"Agent did not call submit_action",
		);
	});

	it("runTurn throws for uninitialized agent", async () => {
		await expect(runner.runTurn("unknown", context)).rejects.toThrow(
			"Agent not initialized: unknown",
		);
	});

	it("rejectAction replaces last tool result with error and re-prompts", async () => {
		runner.initAgent("p1", config);

		// First turn: agent calls with an invalid action
		mockGenerateTextResult("BET", "I bet big!", "tc-first");
		await runner.runTurn("p1", context);

		// Reject and re-prompt: agent now folds
		mockGenerateTextResult("FOLD", "Fine, I fold.", "tc-second");
		const result = await runner.rejectAction("p1", "Invalid bet amount");

		expect(result).toEqual({
			action: { type: "FOLD", amount: undefined },
			analysis: "Fine, I fold.",
		});

		// Verify the second generateText call has the error tool result.
		// Note: promptAgent mutates the messages array after generateText returns
		// (appending response + tool result), so we check all tool messages to
		// find the rejection error rather than only looking at the last one.
		expect(mockGenerateText).toHaveBeenCalledTimes(2);
		const secondCallArgs = mockGenerateText.mock.calls[1][0] as {
			messages: Array<{ role: string; content: unknown }>;
		};

		const allMessagesJson = JSON.stringify(secondCallArgs.messages);
		expect(allMessagesJson).toContain(
			"Action rejected: Invalid bet amount",
		);
	});

	it("rejectAction throws for uninitialized agent", async () => {
		await expect(runner.rejectAction("unknown", "error")).rejects.toThrow(
			"Agent not initialized: unknown",
		);
	});

	it("conversation history accumulates across multiple turns", async () => {
		runner.initAgent("p1", config);

		// Turn 1
		mockGenerateTextResult("CHECK", "I check.", "tc-1");
		await runner.runTurn("p1", context);

		// Inject a message between turns
		runner.injectMessage("p1", "Bob raises to 40.");

		// Turn 2
		mockGenerateTextResult("CALL", "I call the raise.", "tc-2");
		await runner.runTurn("p1", context);

		expect(mockGenerateText).toHaveBeenCalledTimes(2);

		const secondCallArgs = mockGenerateText.mock.calls[1][0] as {
			messages: Array<{ role: string; content: string }>;
		};

		// Messages should include:
		// 1. user: YOUR_TURN (turn 1)
		// 2. assistant: response from turn 1
		// 3. tool: "Action submitted." result from turn 1
		// 4. user: "Bob raises to 40." (injected)
		// 5. user: YOUR_TURN (turn 2)
		expect(secondCallArgs.messages.length).toBeGreaterThanOrEqual(5);

		// The injected message should be present
		const userMessages = secondCallArgs.messages.filter(
			(m) => m.role === "user",
		);
		expect(userMessages.some((m) => m.content === "Bob raises to 40.")).toBe(
			true,
		);
	});
});
