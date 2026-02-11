import type { RenderInstruction } from "../../../gql/resolverTypes.js";
import type { GameState } from "../../../types.js";
import { InstructionType } from "../../../types.js";

let lastTimestamp = 0;

function base(
  type: InstructionType,
): Pick<
  RenderInstruction,
  "instructionId" | "type" | "timestamp" | "moduleId"
> {
  let ts = Date.now();
  if (ts <= lastTimestamp) ts = lastTimestamp + 1;
  lastTimestamp = ts;
  return {
    instructionId: ts.toString(),
    type,
    timestamp: new Date(ts).toISOString(),
    moduleId: "", // Set by emitter when publishing
  };
}

export function resetTimestamp(): void {
  lastTimestamp = 0;
}

export function toPlayerInfos(
  players: GameState["players"],
): RenderInstruction["gameStart"] extends infer T
  ? T extends { players: infer P }
    ? P
    : never
  : never {
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    chips: p.chips,
    bet: p.bet,
    status: p.status,
    seatIndex: p.seatIndex,
  }));
}

export function toPotInfos(pots: GameState["pots"]) {
  return pots.map((p) => ({
    size: p.size,
    eligiblePlayerIds: p.eligiblePlayerIds,
  }));
}

export function toCardInfos(cards: GameState["communityCards"]) {
  return cards.map((c) => ({ rank: c.rank, suit: c.suit }));
}

export function toPlayerMeta(
  players: Array<{
    playerId: string;
    ttsVoice?: string | null;
    avatarUrl?: string | null;
  }>,
) {
  return players.map((p) => ({
    id: p.playerId,
    ttsVoice: p.ttsVoice ?? null,
    avatarUrl: p.avatarUrl ?? null,
  }));
}

export function buildGameStart(
  gameId: string,
  players: GameState["players"],
  config: { smallBlind: number; bigBlind: number },
  agentConfigs: Array<{
    playerId: string;
    ttsVoice?: string | null;
    avatarUrl?: string | null;
  }>,
): RenderInstruction {
  return {
    ...base(InstructionType.GameStart),
    gameStart: {
      gameId,
      players: toPlayerInfos(players),
      playerMeta: toPlayerMeta(agentConfigs),
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
    },
  };
}

export function buildDealHands(
  handNumber: number,
  gameState: GameState,
  hands: Array<{
    playerId: string;
    cards: Array<{ rank: string; suit: string }>;
  }>,
  blinds: { smallBlind: number; bigBlind: number },
): RenderInstruction {
  return {
    ...base(InstructionType.DealHands),
    dealHands: {
      handNumber,
      players: toPlayerInfos(gameState.players),
      hands,
      button: gameState.button,
      pots: toPotInfos(gameState.pots),
      smallBlind: blinds.smallBlind,
      bigBlind: blinds.bigBlind,
    },
  };
}

export function buildDealCommunity(
  phase: string,
  gameState: GameState,
): RenderInstruction {
  return {
    ...base(InstructionType.DealCommunity),
    dealCommunity: {
      phase,
      communityCards: toCardInfos(gameState.communityCards),
      pots: toPotInfos(gameState.pots),
    },
  };
}

export function buildPlayerTurn(
  playerId: string,
  playerName: string,
): RenderInstruction {
  return {
    ...base(InstructionType.PlayerTurn),
    playerTurn: {
      playerId,
      playerName,
    },
  };
}

export function buildPlayerAnalysis(
  playerId: string,
  playerName: string,
  analysis: string,
  isApiError = false,
): RenderInstruction {
  return {
    ...base(InstructionType.PlayerAnalysis),
    playerAnalysis: {
      playerId,
      playerName,
      analysis,
      isApiError,
    },
  };
}

export function buildPlayerAction(
  playerId: string,
  playerName: string,
  action: string,
  amount: number | undefined,
  gameState: GameState,
): RenderInstruction {
  return {
    ...base(InstructionType.PlayerAction),
    playerAction: {
      playerId,
      playerName,
      action,
      amount: amount ?? null,
      pots: toPotInfos(gameState.pots),
      players: toPlayerInfos(gameState.players),
    },
  };
}

export function buildHandResult(
  winners: Array<{ playerId: string; amount: number; hand?: string | null }>,
  gameState: GameState,
): RenderInstruction {
  return {
    ...base(InstructionType.HandResult),
    handResult: {
      winners: winners.map((w) => ({
        playerId: w.playerId,
        amount: w.amount,
        hand: w.hand ?? null,
      })),
      pots: toPotInfos(gameState.pots),
      players: toPlayerInfos(gameState.players),
      communityCards: toCardInfos(gameState.communityCards),
    },
  };
}

export function buildLeaderboard(
  players: GameState["players"],
  handsPlayed: number,
  blinds: { smallBlind: number; bigBlind: number },
): RenderInstruction {
  return {
    ...base(InstructionType.Leaderboard),
    leaderboard: {
      players: toPlayerInfos(players),
      handsPlayed,
      smallBlind: blinds.smallBlind,
      bigBlind: blinds.bigBlind,
    },
  };
}

export function buildGameOver(
  winnerId: string,
  winnerName: string,
  players: GameState["players"],
  handsPlayed: number,
): RenderInstruction {
  return {
    ...base(InstructionType.GameOver),
    gameOver: {
      winnerId,
      winnerName,
      players: toPlayerInfos(players),
      handsPlayed,
    },
  };
}
