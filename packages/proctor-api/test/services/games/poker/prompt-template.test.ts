import { describe, expect, it } from "vitest";
import type { PlayerConfig } from "../../../../src/services/games/poker/agent-runner.js";
import { buildSystemPrompt } from "../../../../src/services/games/poker/prompt-template.js";

describe("buildSystemPrompt", () => {
  it("substitutes name and bio into the template", () => {
    const config: PlayerConfig = {
      id: "player-1",
      name: "Alice",
      modelId: "deepseek-chat",
      provider: "deepseek",
      bio: "A cunning strategist with nerves of steel.",
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain("You are Alice.");
    expect(prompt).toContain("A cunning strategist with nerves of steel.");
    expect(prompt).toContain("winner-takes-all Texas Hold'em tournament");
  });

  it("contains key instruction phrases", () => {
    const config: PlayerConfig = {
      id: "player-1",
      name: "Bob",
      modelId: "deepseek-chat",
      provider: "deepseek",
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain("submit_action");
    expect(prompt).toContain("Texas Hold'em tournament");
    expect(prompt).toContain("your hole cards");
    expect(prompt).toContain("community cards");
    expect(prompt).toContain("speak your thoughts");
  });

  it("does not contain any remaining placeholders after substitution", () => {
    const config: PlayerConfig = {
      id: "player-2",
      name: "Charlie",
      modelId: "deepseek-chat",
      provider: "deepseek",
      bio: "A relentless grinder.",
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).not.toMatch(/\{\{.*?\}\}/);
  });

  it("works with different config values", () => {
    const configs: PlayerConfig[] = [
      {
        id: "1",
        name: "AggressiveBot",
        modelId: "deepseek-chat",
        provider: "deepseek",
        bio: "Loves to raise.",
      },
      {
        id: "2",
        name: "ConservativeAI",
        modelId: "deepseek-chat",
        provider: "deepseek",
        bio: "Plays it safe.",
      },
      {
        id: "3",
        name: "RandomPlayer",
        modelId: "deepseek-chat",
        provider: "deepseek",
        bio: "Pure chaos.",
      },
    ];

    for (const config of configs) {
      const prompt = buildSystemPrompt(config);

      expect(prompt).toContain(`You are ${config.name}.`);
      expect(prompt).not.toMatch(/\{\{.*?\}\}/);
    }
  });

  it("preserves template structure and all instructions", () => {
    const config: PlayerConfig = {
      id: "player-1",
      name: "TestPlayer",
      modelId: "deepseek-chat",
      provider: "deepseek",
      bio: "A test character.",
    };

    const prompt = buildSystemPrompt(config);

    // Verify key sections are present
    expect(prompt).toContain("You will receive game updates");
    expect(prompt).toContain("speak your thoughts aloud");
    expect(prompt).toContain("submit_action");
    expect(prompt).toContain("Other players cannot hear your commentary");
  });
});
