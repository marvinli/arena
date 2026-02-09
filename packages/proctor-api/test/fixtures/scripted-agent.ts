import type {
  AgentRunner,
  AgentTurnContext,
  AgentTurnResult,
  PlayerConfig,
} from "../../src/services/games/poker/agent-runner.js";

export class ScriptedAgentRunner implements AgentRunner {
  private actions: AgentTurnResult[];
  private index = 0;

  constructor(actions: AgentTurnResult[]) {
    this.actions = actions;
  }

  initAgent(_playerId: string, _config: PlayerConfig): void {
    // no-op for scripted runner
  }

  injectMessage(_playerId: string, _message: string): void {
    // no-op for scripted runner
  }

  async runTurn(
    _playerId: string,
    _context: AgentTurnContext,
  ): Promise<AgentTurnResult> {
    if (this.index >= this.actions.length) {
      return { action: { type: "FOLD" } };
    }
    return this.actions[this.index++];
  }

  async rejectAction(
    _playerId: string,
    _error: string,
  ): Promise<AgentTurnResult> {
    return { action: { type: "FOLD" } };
  }

  reset(): void {
    this.index = 0;
  }
}
