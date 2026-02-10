import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dirname, "../../../.env") });

import { bedrock } from "@ai-sdk/amazon-bedrock";
import { generateText, tool } from "ai";
import { z } from "zod";

const model = bedrock("us.meta.llama4-maverick-17b-instruct-v1:0");

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

const systemPrompt = `You are Llama from bedrock, a professional poker player in a Texas Hold'em tournament.

You are playing against other AI models. Each opponent is a different model
with its own strategy. Play to win.

When it is your turn, first speak your thoughts aloud as plain text, then
call the submit_action tool.

Keep it to 2-3 SHORT sentences — 40 words max.
Then call submit_action with your action and amount.`;

const userMessage = `It's your turn.
Phase: PREFLOP
Your hole cards: A♠ K♥
Pot: 30
Your chips: 980 (current bet: 0)
Valid actions:
  - FOLD
  - CALL 20
  - RAISE (min: 40, max: 980)

Call submit_action with your decision.`;

async function main() {
  console.log("=== Testing WITHOUT toolChoice ===");
  try {
    const result1 = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: { submit_action: submitActionTool },
      maxOutputTokens: 512,
    });
    console.log("Text:", result1.text);
    console.log(
      "Tool calls:",
      JSON.stringify(result1.staticToolCalls, null, 2),
    );
    console.log("Finish reason:", result1.finishReason);
  } catch (e: unknown) {
    console.error("Error:", e instanceof Error ? e.message : e);
  }

  console.log("\n=== Testing WITH toolChoice: tool ===");
  try {
    const result2 = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: { submit_action: submitActionTool },
      toolChoice: { type: "tool", toolName: "submit_action" },
      maxOutputTokens: 512,
    });
    console.log("Text:", result2.text);
    console.log(
      "Tool calls:",
      JSON.stringify(result2.staticToolCalls, null, 2),
    );
    console.log("Finish reason:", result2.finishReason);
  } catch (e: unknown) {
    console.error("Error:", e instanceof Error ? e.message : e);
  }

  console.log("\n=== Testing WITH toolChoice: required ===");
  try {
    const result3 = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: { submit_action: submitActionTool },
      toolChoice: { type: "required" },
      maxOutputTokens: 512,
    });
    console.log("Text:", result3.text);
    console.log(
      "Tool calls:",
      JSON.stringify(result3.staticToolCalls, null, 2),
    );
    console.log("Finish reason:", result3.finishReason);
  } catch (e: unknown) {
    console.error("Error:", e instanceof Error ? e.message : e);
  }
}

main();
