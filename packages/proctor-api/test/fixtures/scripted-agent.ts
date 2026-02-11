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

  initAgent(_playerId: string, _config: PlayerConfig, _moduleId: string): void {
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

  async promptReaction(
    _playerId: string,
    _message: string,
  ): Promise<string | undefined> {
    return undefined;
  }

  reset(): void {
    this.index = 0;
  }
}

/**
 * Always picks the least aggressive valid action: CALL > CHECK > FOLD.
 * This ensures hands always reach showdown (no voluntary folds).
 */
export class PassiveAgentRunner implements AgentRunner {
  private _analysis: string | undefined;

  constructor(opts?: { analysis?: string }) {
    this._analysis = opts?.analysis;
  }

  initAgent(_playerId: string, _config: PlayerConfig, _moduleId: string): void {
    // no-op
  }

  injectMessage(_playerId: string, _message: string): void {
    // no-op
  }

  async runTurn(
    _playerId: string,
    context: AgentTurnContext,
  ): Promise<AgentTurnResult> {
    const valid = context.validActions.map((a) => a.type);
    let type = "FOLD";
    if (valid.includes("CALL")) type = "CALL";
    else if (valid.includes("CHECK")) type = "CHECK";
    return { action: { type }, analysis: this._analysis };
  }

  async rejectAction(
    _playerId: string,
    _error: string,
  ): Promise<AgentTurnResult> {
    return { action: { type: "FOLD" } };
  }

  async promptReaction(
    _playerId: string,
    _message: string,
  ): Promise<string | undefined> {
    return undefined;
  }
}
