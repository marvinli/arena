import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: join(import.meta.dirname, "../../../.env") });

import type { RenderInstruction } from "../src/gql/resolverTypes.js";
import { LlmAgentRunner } from "../src/services/games/poker/llm-agent-runner.js";
import { runSession } from "../src/services/games/poker/orchestrator.js";
import * as pubsub from "../src/services/session/pubsub.js";
import { createSession } from "../src/services/session/session-manager.js";

const CHANNEL_KEY = "test-game";
const HANDS_TO_PLAY = 3;

const config = {
  players: [
    {
      playerId: "claude-1",
      name: "Alice",
      modelId: "claude-haiku-4-5-20251001",
      modelName: "Claude Haiku",
      provider: "anthropic",
    },
    {
      playerId: "claude-2",
      name: "Bob",
      modelId: "claude-haiku-4-5-20251001",
      modelName: "Claude Haiku",
      provider: "anthropic",
    },
  ],
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  handsPerGame: HANDS_TO_PLAY,
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY in .env");
    process.exit(1);
  }

  console.log(`Starting ${HANDS_TO_PLAY}-hand game with 2 Haiku agents...`);
  console.log();

  const session = createSession(CHANNEL_KEY, config);
  const agentRunner = new LlmAgentRunner();

  // Collect all render instructions
  const instructions: RenderInstruction[] = [];
  const sub = pubsub.subscribe(CHANNEL_KEY);

  // Collect instructions in background (fire-and-forget)
  void (async () => {
    for await (const instruction of sub) {
      instructions.push(instruction);
      logInstruction(instruction);
    }
  })();

  // Run the game
  const start = Date.now();
  await runSession(session, agentRunner);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Give collector a moment to drain
  await new Promise((r) => setTimeout(r, 100));

  console.log();
  console.log(
    `Game finished in ${elapsed}s — ${instructions.length} instructions emitted`,
  );

  // Write log file
  const logsDir = join(import.meta.dirname, "../../../logs");
  mkdirSync(logsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = join(logsDir, `game-${timestamp}.json`);

  writeFileSync(
    logPath,
    JSON.stringify(
      {
        config,
        startedAt: new Date(start).toISOString(),
        durationSeconds: Number(elapsed),
        instructions,
      },
      null,
      2,
    ),
  );

  console.log(`Log written to ${logPath}`);
  process.exit(0);
}

function logInstruction(inst: RenderInstruction) {
  const gs = inst.gameStart;
  const dh = inst.dealHands;
  const dc = inst.dealCommunity;
  const pa = inst.playerAction;
  const hr = inst.handResult;
  const lb = inst.leaderboard;
  const go = inst.gameOver;

  switch (inst.type) {
    case "GAME_START":
      if (gs) {
        console.log(
          `[GAME_START] Players: ${gs.players.map((p) => `${p.name} (${p.chips})`).join(", ")}`,
        );
      }
      break;
    case "DEAL_HANDS":
      if (dh) console.log(`[DEAL_HANDS] Hand #${dh.handNumber}`);
      break;
    case "DEAL_COMMUNITY":
      if (dc) {
        const cards = dc.communityCards
          .map((c) => `${c.rank}${suitSymbol(c.suit)}`)
          .join(" ");
        console.log(`[${dc.phase}] ${cards}`);
      }
      break;
    case "PLAYER_ACTION":
      if (pa) {
        const amountStr =
          pa.amount != null && pa.amount > 0 ? ` ${pa.amount}` : "";
        console.log(`[ACTION] ${pa.playerName} ${pa.action}${amountStr}`);
        if (pa.analysis) {
          console.log(`  ${pa.analysis}`);
        }
      }
      break;
    case "HAND_RESULT":
      if (hr) {
        for (const w of hr.winners) {
          const name =
            hr.players.find((p) => p.id === w.playerId)?.name ?? w.playerId;
          console.log(`[RESULT] ${name} wins ${w.amount}`);
        }
        const chipSummary = hr.players
          .map((p) => `${p.name}: ${p.chips}`)
          .join(", ");
        console.log(`  Chips: ${chipSummary}`);
      }
      break;
    case "LEADERBOARD":
      if (lb) {
        console.log(
          `[LEADERBOARD] ${lb.players.map((p) => `${p.name}: ${p.chips}`).join(", ")}`,
        );
      }
      break;
    case "GAME_OVER":
      if (go) {
        console.log(
          `[GAME_OVER] Winner: ${go.winnerName} after ${go.handsPlayed} hands`,
        );
      }
      break;
  }
}

function suitSymbol(suit: string): string {
  const symbols: Record<string, string> = {
    spades: "\u2660",
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
  };
  return symbols[suit] ?? suit;
}

main().catch((err) => {
  console.error("Game failed:", err);
  process.exit(1);
});
