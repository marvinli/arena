import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText, type ModelMessage, tool } from "ai";
import { z } from "zod";
import type {
  AgentRunner,
  AgentTurnContext,
  AgentTurnResult,
  PlayerConfig,
} from "./agent-runner.js";
import { formatYourTurn } from "./message-formatter.js";
import { buildSystemPrompt } from "./prompt-template.js";

interface AgentState {
  config: PlayerConfig;
  systemPrompt: string;
  messages: ModelMessage[];
  lastToolCallId?: string;
}

function resolveModel(provider: string, modelId: string) {
  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "openai":
      return openai(modelId);
    case "google":
      return google(modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

const submitActionTool = tool({
  description: "Submit your poker action. This ends your turn.",
  inputSchema: z.object({
    action: z
      .enum(["FOLD", "CHECK", "CALL", "BET", "RAISE"])
      .describe("Your poker action"),
    amount: z
      .number()
      .optional()
      .describe("Bet/raise amount. Required for BET and RAISE."),
    closing: z
      .string()
      .optional()
      .describe(
        "A brief closing remark after your action — a quip, taunt, or parting thought for the audience.",
      ),
  }),
});

export class LlmAgentRunner implements AgentRunner {
  private agents = new Map<string, AgentState>();

  initAgent(playerId: string, config: PlayerConfig): void {
    this.agents.set(playerId, {
      config,
      systemPrompt: buildSystemPrompt(config),
      messages: [],
    });
  }

  injectMessage(playerId: string, message: string): void {
    const agent = this.agents.get(playerId);
    if (!agent) {
      console.warn(
        `[llm-agent-runner] injectMessage called for unknown agent: ${playerId}`,
      );
      return;
    }
    agent.messages.push({ role: "user", content: message });
  }

  async runTurn(
    playerId: string,
    context: AgentTurnContext,
  ): Promise<AgentTurnResult> {
    const agent = this.agents.get(playerId);
    if (!agent) {
      throw new Error(`Agent not initialized: ${playerId}`);
    }

    // Build and inject YOUR_TURN message
    const turnMessage = formatYourTurn(playerId, context);
    agent.messages.push({ role: "user", content: turnMessage });

    return this.promptAgent(agent);
  }

  async rejectAction(
    playerId: string,
    error: string,
  ): Promise<AgentTurnResult> {
    const agent = this.agents.get(playerId);
    if (!agent) {
      throw new Error(`Agent not initialized: ${playerId}`);
    }

    if (!agent.lastToolCallId) {
      throw new Error(`No previous tool call to reject for ${playerId}`);
    }

    // Replace the "Action submitted." tool result with the error
    agent.messages.pop();
    agent.messages.push({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: agent.lastToolCallId,
          toolName: "submit_action",
          output: {
            type: "text",
            value: `Action rejected: ${error} Please try again with a valid action.`,
          },
        },
      ],
    });

    return this.promptAgent(agent);
  }

  private async promptAgent(agent: AgentState): Promise<AgentTurnResult> {
    const model = resolveModel(agent.config.provider, agent.config.modelId);

    const result = await generateText({
      model,
      system: agent.systemPrompt,
      messages: agent.messages,
      tools: { submit_action: submitActionTool },
      temperature: agent.config.temperature,
    });

    // Append response messages to conversation history
    for (const msg of result.response.messages) {
      agent.messages.push(msg);
    }

    // Extract tool call
    const toolCall = result.staticToolCalls.find(
      (tc) => tc.toolName === "submit_action",
    );

    if (!toolCall) {
      throw new Error("Agent did not call submit_action");
    }

    agent.lastToolCallId = toolCall.toolCallId;

    // Append tool result so the conversation is valid for the next turn
    agent.messages.push({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: toolCall.toolCallId,
          toolName: "submit_action",
          output: { type: "text", value: "Action submitted." },
        },
      ],
    });

    const analysis = result.text?.trim() || undefined;

    return {
      action: {
        type: toolCall.input.action,
        amount: toolCall.input.amount,
      },
      analysis,
      closing: toolCall.input.closing,
    };
  }
}
