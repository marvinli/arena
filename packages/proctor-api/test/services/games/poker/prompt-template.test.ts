import { describe, expect, it } from "vitest";
import type { PlayerConfig } from "../../../../src/services/games/poker/agent-runner.js";
import { buildSystemPrompt } from "../../../../src/services/games/poker/prompt-template.js";

describe("buildSystemPrompt", () => {
  it("substitutes name, modelName, and provider into the template", () => {
    const config: PlayerConfig = {
      id: "player-1",
      name: "Alice",
      modelId: "claude-opus-4-6",
      modelName: "Claude Opus 4.6",
      provider: "Anthropic",
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain("You are Alice, a poker player");
    expect(prompt).toContain("powered by Claude Opus 4.6 from Anthropic");
  });

  it("contains key instruction phrases", () => {
    const config: PlayerConfig = {
      id: "player-1",
      name: "Bob",
      modelId: "gpt-4",
      modelName: "GPT-4",
      provider: "OpenAI",
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain("submit_action");
    expect(prompt).toContain("Texas Hold'em tournament");
    expect(prompt).toContain("your hole cards");
    expect(prompt).toContain("community cards");
    expect(prompt).toContain("speak your thoughts");
    expect(prompt).toContain("closing remark");
  });

  it("does not contain any remaining placeholders after substitution", () => {
    const config: PlayerConfig = {
      id: "player-2",
      name: "Charlie",
      modelId: "gemini-pro",
      modelName: "Gemini Pro",
      provider: "Google",
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).not.toMatch(/\{\{.*?\}\}/);
  });

  it("works with different config values", () => {
    const configs: PlayerConfig[] = [
      {
        id: "1",
        name: "AggressiveBot",
        modelId: "claude-sonnet-4-5",
        modelName: "Claude Sonnet 4.5",
        provider: "Anthropic",
      },
      {
        id: "2",
        name: "ConservativeAI",
        modelId: "gpt-3.5-turbo",
        modelName: "GPT-3.5 Turbo",
        provider: "OpenAI",
      },
      {
        id: "3",
        name: "RandomPlayer",
        modelId: "llama-2-70b",
        modelName: "Llama 2 70B",
        provider: "Meta",
      },
    ];

    for (const config of configs) {
      const prompt = buildSystemPrompt(config);

      expect(prompt).toContain(`You are ${config.name}`);
      expect(prompt).toContain(
        `powered by ${config.modelName} from ${config.provider}`,
      );
      expect(prompt).not.toMatch(/\{\{.*?\}\}/);
    }
  });

  it("preserves template structure and all instructions", () => {
    const config: PlayerConfig = {
      id: "player-1",
      name: "TestPlayer",
      modelId: "test-model",
      modelName: "Test Model",
      provider: "Test Provider",
    };

    const prompt = buildSystemPrompt(config);

    // Verify key sections are present
    expect(prompt).toContain("You will receive game updates");
    expect(prompt).toContain("speak your thoughts aloud");
    expect(prompt).toContain("submit_action");
    expect(prompt).toContain("closing remark");
    expect(prompt).toContain("Other players cannot hear your commentary");
  });
});
