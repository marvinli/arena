import type { AgentRunner, AgentTurnResult } from "../../src/agent-runner.js";

export class ScriptedAgentRunner implements AgentRunner {
  private actions: AgentTurnResult[];
  private index = 0;

  constructor(actions: AgentTurnResult[]) {
    this.actions = actions;
  }

  async runTurn(): Promise<AgentTurnResult> {
    if (this.index >= this.actions.length) {
      return { action: { type: "FOLD" } };
    }
    return this.actions[this.index++];
  }

  reset(): void {
    this.index = 0;
  }
}
