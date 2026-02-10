import { bedrock } from "@ai-sdk/amazon-bedrock";
import { anthropic } from "@ai-sdk/anthropic";
import { deepseek } from "@ai-sdk/deepseek";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import {
  generateText,
  hasToolCall,
  type ModelMessage,
  stepCountIs,
  tool,
} from "ai";
import { z } from "zod";
import { logError } from "../../../logger.js";
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
    case "xai":
      return xai(modelId);
    case "bedrock":
      return bedrock(modelId);
    case "deepseek":
      return deepseek(modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

type JSONValue = null | string | number | boolean | JSONObject | JSONValue[];
type JSONObject = { [key: string]: JSONValue | undefined };

function getProviderOptions(
  config: PlayerConfig,
): Record<string, JSONObject> | undefined {
  switch (config.provider) {
    case "openai":
      return { openai: { reasoningEffort: "none" } };
    case "google":
      return { google: { thinkingConfig: { thinkingBudget: 128 } } };
    case "bedrock":
      if (config.modelId.includes("qwen")) {
        return {
          bedrock: {
            additionalModelRequestFields: { enable_thinking: false },
          },
        };
      }
      return undefined;
    default:
      return undefined;
  }
}

/** Strip XML-style tags some models (Nova) wrap around output. */
function stripTags(text: string): string {
  return text.replace(/<\/?[a-zA-Z][a-zA-Z0-9_-]*(?:\s[^>]*)?\s*>/g, "").trim();
}

const VALID_ACTIONS = new Set(["FOLD", "CHECK", "CALL", "BET", "RAISE"]);

/** Parse a tool call emitted as JSON text (Llama 4 on Bedrock does this). */
function parseToolCallFromText(text: string): {
  action: string;
  amount?: number;
  analysis: string;
} | null {
  // Match JSON like {"name":"submit_action","parameters":{"action":"RAISE","amount":80}}
  const jsonMatch = text.match(
    /\{[^{}]*"name"\s*:\s*"submit_action"[^{}]*"parameters"\s*:\s*\{[^{}]*\}[^{}]*\}/s,
  );
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const params = parsed.parameters ?? parsed.input;
    if (!params?.action || !VALID_ACTIONS.has(params.action)) return null;

    // Everything before the JSON blob is the analysis
    const analysis = text.slice(0, jsonMatch.index).trim();
    return {
      action: params.action,
      amount: params.amount != null ? Number(params.amount) : undefined,
      analysis: analysis || undefined,
    } as { action: string; amount?: number; analysis: string };
  } catch {
    return null;
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
      logError(
        "llm-agent-runner",
        `injectMessage called for unknown agent: ${playerId}`,
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

    // Remove the assistant bridge message (if present) and the tool result
    if (
      agent.config.provider === "bedrock" &&
      agent.messages.at(-1)?.role === "assistant"
    ) {
      agent.messages.pop();
    }
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

    console.log(
      `[llm-agent-runner] Calling ${agent.config.provider}/${agent.config.modelId} for ${agent.config.name}...`,
    );
    const start = Date.now();

    const result = await generateText({
      model,
      system: agent.systemPrompt,
      messages: agent.messages,
      tools: { submit_action: submitActionTool },
      temperature: agent.config.temperature,
      maxOutputTokens: 512,
      stopWhen: [hasToolCall("submit_action"), stepCountIs(3)],
      providerOptions: getProviderOptions(agent.config),
    });

    console.log(
      `[llm-agent-runner] ${agent.config.name} responded in ${Date.now() - start}ms`,
    );

    // Append response messages to conversation history
    for (const msg of result.response.messages) {
      agent.messages.push(msg);
    }

    // Extract tool call
    const toolCall = result.staticToolCalls.find(
      (tc) => tc.toolName === "submit_action",
    );

    if (toolCall) {
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

      // Some providers (Bedrock Llama/Mistral) require an assistant message
      // after a tool result before the next user message.
      if (agent.config.provider === "bedrock") {
        agent.messages.push({
          role: "assistant",
          content: "Action submitted.",
        });
      }

      const analysis = result.text
        ? stripTags(result.text) || undefined
        : undefined;

      console.log(
        `[llm-agent-runner] ${agent.config.name} structured tool call: action=${toolCall.input.action}, analysis=${analysis ? `"${analysis.slice(0, 80)}"` : "(none)"}`,
      );

      return {
        action: {
          type: toolCall.input.action,
          amount: toolCall.input.amount,
        },
        analysis,
      };
    }

    // Fallback: some models (e.g. Llama 4 on Bedrock) emit tool calls as
    // JSON text instead of structured tool calls. Try to parse it.
    console.log(
      `[llm-agent-runner] ${agent.config.name} no structured tool call, text: "${(result.text ?? "").slice(0, 200)}"`,
    );
    const parsed = parseToolCallFromText(result.text ?? "");
    if (parsed) {
      console.log(
        `[llm-agent-runner] ${agent.config.name} parsed from text: action=${parsed.action}, analysis=${parsed.analysis ? `"${parsed.analysis.slice(0, 80)}"` : "(none)"}`,
      );
      // Replace the text-only assistant message with a clean one for history
      agent.messages.push({
        role: "assistant",
        content: parsed.analysis || "Action submitted.",
      });

      return {
        action: {
          type: parsed.action,
          amount: parsed.amount,
        },
        analysis: parsed.analysis || undefined,
      };
    }

    throw new Error("Agent did not call submit_action");
  }
}
