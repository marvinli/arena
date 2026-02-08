export interface AgentTurnContext {
  gameId: string;
  playerId: string;
  playerName: string;
  handNumber: number;
  gameState: {
    phase: string;
    communityCards: Array<{ rank: string; suit: string }>;
    players: Array<{
      id: string;
      name: string;
      chips: number;
      bet: number;
      status: string;
    }>;
    pots: Array<{ size: number; eligiblePlayerIds: string[] }>;
  };
  myHand: Array<{ rank: string; suit: string }>;
  validActions: Array<{
    type: string;
    amount?: number | null;
    min?: number | null;
    max?: number | null;
  }>;
  history: Array<{
    handNumber: number;
    winners: Array<{ playerId: string; amount: number }>;
    actions: Array<{
      phase: string;
      actions: Array<{
        playerId: string;
        action: string;
        amount?: number | null;
      }>;
    }>;
  }>;
}

export interface AgentTurnResult {
  action: { type: string; amount?: number };
  analysis?: string;
}

export interface AgentRunner {
  runTurn(
    context: AgentTurnContext,
    config: {
      model: string;
      systemPrompt: string;
      temperature?: number | null;
    },
  ): Promise<AgentTurnResult>;
}
