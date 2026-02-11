export interface PlayerConfig {
  id: string;
  name: string;
  modelId: string;
  modelName: string;
  provider: string;
  avatarUrl?: string;
  ttsVoice?: string;
  temperature?: number;
}

export interface AgentTurnContext {
  gameId: string;
  handNumber: number;
  phase: string;
  communityCards: Array<{ rank: string; suit: string }>;
  myHand: Array<{ rank: string; suit: string }>;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    bet: number;
    status: string;
  }>;
  pots: Array<{ size: number; eligiblePlayerIds: string[] }>;
  validActions: Array<{
    type: string;
    amount?: number | null;
    min?: number | null;
    max?: number | null;
  }>;
}

export interface AgentTurnResult {
  action: { type: string; amount?: number };
  analysis?: string;
}

export interface AgentRunner {
  /** Initialize a new agent for a game. Called once per player at session start. */
  initAgent(playerId: string, config: PlayerConfig, moduleId: string): void;

  /** Append a game event message to an agent's conversation. */
  injectMessage(playerId: string, message: string): void;

  /** Run the agent's turn. Returns the action and optional analysis. */
  runTurn(
    playerId: string,
    context: AgentTurnContext,
  ): Promise<AgentTurnResult>;

  /** Reject the last action with an error message and let the agent retry. */
  rejectAction(playerId: string, error: string): Promise<AgentTurnResult>;

  /** Restore persisted conversation history into an agent (for session recovery). */
  restoreMessages?(
    playerId: string,
    messages: Array<{ role: string; content: string }>,
  ): void;
}
