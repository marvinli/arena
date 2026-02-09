import { randomUUID } from "node:crypto";
import Poker from "poker-ts";
import {
  type ActionRecord,
  ActionType,
  type Card,
  type CreateGameOptions,
  GamePhase,
  type GameState,
  type HandRecord,
  type MyTurnResponse,
  type Player,
  PlayerStatus,
  type Pot,
  type ValidAction,
} from "../../../types.js";

interface PlayerMapping {
  id: string;
  name: string;
  seatIndex: number;
}

interface PhaseActions {
  phase: string;
  actions: ActionRecord[];
}

interface Game {
  table: InstanceType<typeof Poker.Table>;
  players: PlayerMapping[];
  folded: Set<number>;
  handNumber: number;
  history: HandRecord[];
  currentPhaseActions: PhaseActions[];
  startingChips: Map<string, number>;
}

const games = new Map<string, Game>();

function seatToPlayerId(game: Game, seatIndex: number): string | undefined {
  return game.players.find((p) => p.seatIndex === seatIndex)?.id;
}

function playerIdToSeat(game: Game, playerId: string): number | undefined {
  return game.players.find((p) => p.id === playerId)?.seatIndex;
}

function getGame(gameId: string): Game {
  const game = games.get(gameId);
  if (!game) throw new Error(`Game not found: ${gameId}`);
  return game;
}

function formatCard(card: { rank: string; suit: string }): Card {
  return { rank: card.rank, suit: card.suit };
}

const roundToPhase: Record<string, GamePhase> = {
  preflop: GamePhase.Preflop,
  flop: GamePhase.Flop,
  turn: GamePhase.Turn,
  river: GamePhase.River,
};

const actionToEnum: Record<string, ActionType> = {
  fold: ActionType.Fold,
  check: ActionType.Check,
  call: ActionType.Call,
  bet: ActionType.Bet,
  raise: ActionType.Raise,
};

const handRankings = [
  "HIGH_CARD",
  "PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "STRAIGHT_FLUSH",
  "ROYAL_FLUSH",
];

function getPhase(
  table: InstanceType<typeof Poker.Table>,
  handInProgress: boolean,
): GamePhase {
  if (!handInProgress) return GamePhase.Waiting;
  try {
    const round = table.roundOfBetting();
    return roundToPhase[round] ?? GamePhase.Showdown;
  } catch {
    // poker-ts throws when betting rounds are complete (showdown)
    return GamePhase.Showdown;
  }
}

function buildPlayers(game: Game): Player[] {
  const seats = game.table.seats();
  let handPlayers: ReturnType<
    InstanceType<typeof Poker.Table>["handPlayers"]
  > | null = null;
  try {
    handPlayers = game.table.handPlayers();
  } catch {
    // poker-ts throws when no hand is in progress
  }

  return game.players.map((pm) => {
    const seat = seats[pm.seatIndex];
    if (!seat) {
      return {
        id: pm.id,
        name: pm.name,
        chips: 0,
        bet: 0,
        status: PlayerStatus.Busted,
        seatIndex: pm.seatIndex,
      };
    }

    let status: PlayerStatus = PlayerStatus.Active;
    if (
      seat.stack === 0 &&
      seat.betSize === 0 &&
      !game.table.isHandInProgress()
    ) {
      status = PlayerStatus.Busted;
    } else if (game.folded.has(pm.seatIndex)) {
      status = PlayerStatus.Folded;
    } else if (
      handPlayers?.[pm.seatIndex]?.stack === 0 &&
      game.table.isHandInProgress()
    ) {
      status = PlayerStatus.AllIn;
    }

    return {
      id: pm.id,
      name: pm.name,
      chips: seat.totalChips,
      bet: seat.betSize,
      status,
      seatIndex: pm.seatIndex,
    };
  });
}

function buildPots(game: Game): Pot[] {
  try {
    return game.table.pots().map((pot) => ({
      size: pot.size,
      eligiblePlayerIds: pot.eligiblePlayers
        .map((si) => seatToPlayerId(game, si))
        .filter((id): id is string => id !== undefined),
    }));
  } catch {
    return [];
  }
}

function buildGameState(game: Game, gameId: string): GameState {
  const table = game.table;
  const handInProgress = table.isHandInProgress();
  const phase = getPhase(table, handInProgress);

  let communityCards: Card[] = [];
  try {
    communityCards = table.communityCards().map(formatCard);
  } catch {
    // poker-ts throws before flop is dealt
  }

  let currentPlayerId: string | null = null;
  try {
    if (handInProgress && table.isBettingRoundInProgress()) {
      const currentSeat = table.playerToAct();
      currentPlayerId = seatToPlayerId(game, currentSeat) ?? null;
    }
  } catch {
    // poker-ts throws when no betting round is active
  }

  let button: number | null = null;
  try {
    if (handInProgress) {
      button = table.button();
    }
  } catch {
    // poker-ts throws when no hand has started
  }

  return {
    gameId,
    phase,
    communityCards,
    players: buildPlayers(game),
    pots: buildPots(game),
    currentPlayerId,
    handNumber: game.handNumber,
    button,
  };
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

export function createGame(opts: CreateGameOptions): string {
  if (opts.players.length < 2) {
    throw new Error("A game requires at least 2 players");
  }
  if (opts.smallBlind <= 0 || opts.bigBlind <= 0) {
    throw new Error("Blinds must be positive numbers");
  }
  if (opts.smallBlind >= opts.bigBlind) {
    throw new Error("Small blind must be less than big blind");
  }

  const gameId = randomUUID();
  const table = new Poker.Table({
    smallBlind: opts.smallBlind,
    bigBlind: opts.bigBlind,
  });

  const players: PlayerMapping[] = opts.players.map((p, i) => {
    table.sitDown(i, p.chips);
    return { id: p.id, name: p.name, seatIndex: i };
  });

  const game: Game = {
    table,
    players,
    folded: new Set(),
    handNumber: 0,
    history: [],
    currentPhaseActions: [],
    startingChips: new Map(),
  };

  games.set(gameId, game);
  return gameId;
}

export function startHand(gameId: string): GameState {
  const game = getGame(gameId);

  if (game.table.isHandInProgress()) {
    throw new Error(
      `Cannot start hand in game ${gameId}: hand already in progress`,
    );
  }

  game.folded.clear();
  game.handNumber++;
  game.table.startHand();

  // Snapshot starting chips
  game.startingChips.clear();
  const seats = game.table.seats();
  for (const pm of game.players) {
    const seat = seats[pm.seatIndex];
    if (seat) {
      game.startingChips.set(pm.id, seat.totalChips);
    }
  }

  // Initialize phase actions for preflop
  game.currentPhaseActions = [{ phase: "PREFLOP", actions: [] }];

  return buildGameState(game, gameId);
}

export function getGameState(gameId: string): GameState {
  const game = getGame(gameId);
  return buildGameState(game, gameId);
}

export function getMyTurn(gameId: string, playerId: string): MyTurnResponse {
  const game = getGame(gameId);
  const seatIndex = playerIdToSeat(game, playerId);
  if (seatIndex === undefined) {
    throw new Error(`Player not in game: ${playerId}`);
  }

  const gameState = buildGameState(game, gameId);

  // Get hole cards for this player
  let myHand: Card[] = [];
  try {
    const allHoleCards = game.table.holeCards();
    const cards = allHoleCards[seatIndex];
    if (cards) {
      myHand = cards.map(formatCard);
    }
  } catch {
    // poker-ts throws when no hand is in progress
  }

  // Get valid actions if it's this player's turn
  const validActions: ValidAction[] = [];
  try {
    if (
      game.table.isBettingRoundInProgress() &&
      game.table.playerToAct() === seatIndex
    ) {
      const legal = game.table.legalActions();
      for (const action of legal.actions) {
        const actionType = actionToEnum[action];
        if (!actionType) continue;
        const va: ValidAction = { type: actionType };
        if ((action === "bet" || action === "raise") && legal.chipRange) {
          va.min = legal.chipRange.min;
          va.max = legal.chipRange.max;
        }
        if (action === "call") {
          const handPlayers = game.table.handPlayers();
          const currentBet = handPlayers[seatIndex]?.betSize ?? 0;
          const maxBet = Math.max(
            ...handPlayers
              .filter((p): p is NonNullable<typeof p> => p !== null)
              .map((p) => p.betSize),
          );
          va.amount = maxBet - currentBet;
        }
        validActions.push(va);
      }
    }
  } catch {
    // poker-ts throws when no betting round is active
  }

  return { gameState, myHand, validActions };
}

export function submitAction(
  gameId: string,
  playerId: string,
  action: string,
  amount?: number,
): GameState {
  const game = getGame(gameId);
  const seatIndex = playerIdToSeat(game, playerId);
  if (seatIndex === undefined) {
    throw new Error(`Player not in game: ${playerId}`);
  }

  if (!game.table.isHandInProgress()) {
    throw new Error(
      `Cannot submit action for player ${playerId} in game ${gameId}: no hand in progress`,
    );
  }

  if (!game.table.isBettingRoundInProgress()) {
    throw new Error(
      `Cannot submit action for player ${playerId} in game ${gameId}: no betting round in progress`,
    );
  }

  if (game.table.playerToAct() !== seatIndex) {
    throw new Error(
      `Cannot submit action for player ${playerId} in game ${gameId}: not this player's turn`,
    );
  }

  // Validate action is legal
  const legal = game.table.legalActions();
  const lowerAction = action.toLowerCase() as
    | "fold"
    | "check"
    | "call"
    | "bet"
    | "raise";
  if (!legal.actions.includes(lowerAction)) {
    throw new Error(
      `You chose ${action.toUpperCase()}, but that action is not available right now. Your valid actions are: ${legal.actions.map((a) => a.toUpperCase()).join(", ")}.`,
    );
  }

  // Validate bet/raise amount
  if (lowerAction === "bet" || lowerAction === "raise") {
    if (amount === undefined) {
      throw new Error(
        `You chose ${lowerAction.toUpperCase()} but did not specify an amount. You must provide an amount between ${legal.chipRange?.min ?? 0} and ${legal.chipRange?.max ?? 0} chips.`,
      );
    }
    if (
      legal.chipRange &&
      (amount < legal.chipRange.min || amount > legal.chipRange.max)
    ) {
      throw new Error(
        `You tried to ${lowerAction.toUpperCase()} ${amount} chips, but the amount must be between ${legal.chipRange.min} and ${legal.chipRange.max} chips.`,
      );
    }
  }

  // Execute action
  game.table.actionTaken(lowerAction, amount);

  // Track folds
  if (lowerAction === "fold") {
    game.folded.add(seatIndex);
  }

  // Record action
  const currentPhase =
    game.currentPhaseActions[game.currentPhaseActions.length - 1];
  if (currentPhase) {
    currentPhase.actions.push({
      playerId,
      action: lowerAction,
      amount,
    });
  }

  return buildGameState(game, gameId);
}

export function advanceGame(gameId: string): GameState {
  const game = getGame(gameId);

  if (!game.table.isHandInProgress()) {
    throw new Error(`Cannot advance game ${gameId}: no hand in progress`);
  }

  if (game.table.isBettingRoundInProgress()) {
    throw new Error(
      `Cannot advance game ${gameId}: betting round still in progress`,
    );
  }

  if (game.table.areBettingRoundsCompleted()) {
    // Save community cards before showdown
    let communityCards: Card[] = [];
    try {
      communityCards = game.table.communityCards().map(formatCard);
    } catch {
      // poker-ts throws when no community cards exist (preflop fold-out)
    }

    // Save pots before showdown
    const pots = buildPots(game);

    // Check if only one player left (fold-to-win)
    const preShowdownPots = game.table.pots();
    const isFoldWin = preShowdownPots.every(
      (pot) => pot.eligiblePlayers.length <= 1,
    );

    game.table.showdown();

    // Build winners
    const winners: HandRecord["winners"] = [];
    if (isFoldWin) {
      // Fold win — the sole eligible player wins each pot
      for (const pot of preShowdownPots) {
        if (pot.eligiblePlayers.length === 1) {
          const winnerId = seatToPlayerId(game, pot.eligiblePlayers[0]);
          if (winnerId) {
            winners.push({ playerId: winnerId, amount: pot.size });
          }
        }
      }
    } else {
      const winnersResult = game.table.winners();
      for (const potWinners of winnersResult) {
        for (const [seatIdx, hand, _holeCards] of potWinners) {
          const winnerId = seatToPlayerId(game, seatIdx);
          if (winnerId) {
            winners.push({
              playerId: winnerId,
              amount: 0, // poker-ts doesn't expose per-winner amounts directly
              hand: handRankings[hand.ranking] ?? "UNKNOWN",
            });
          }
        }
      }
    }

    // Record completed hand
    const record: HandRecord = {
      handNumber: game.handNumber,
      players: game.players.map((pm) => ({
        id: pm.id,
        name: pm.name,
        startingChips: game.startingChips.get(pm.id) ?? 0,
      })),
      communityCards,
      actions: game.currentPhaseActions,
      pots,
      winners,
    };
    game.history.push(record);
  } else {
    // End betting round and advance to next phase
    game.table.endBettingRound();

    // If only one active player remains (everyone else folded), or all remaining
    // players are all-in, keep advancing through remaining rounds automatically
    const MAX_ROUND_ADVANCES = 10;
    let advances = 0;
    while (
      game.table.isHandInProgress() &&
      !game.table.isBettingRoundInProgress() &&
      !game.table.areBettingRoundsCompleted()
    ) {
      if (++advances > MAX_ROUND_ADVANCES) {
        throw new Error(
          `advanceGame: exceeded ${MAX_ROUND_ADVANCES} round advances — possible infinite loop`,
        );
      }
      game.table.endBettingRound();
    }

    if (
      game.table.isHandInProgress() &&
      game.table.areBettingRoundsCompleted()
    ) {
      // Went straight to showdown — recurse to handle showdown logic
      return advanceGame(gameId);
    }

    // Determine next phase name
    const nextPhase = getPhase(game.table, true);
    game.currentPhaseActions.push({ phase: nextPhase, actions: [] });
  }

  return buildGameState(game, gameId);
}

export function getHistory(gameId: string, lastN?: number): HandRecord[] {
  const game = getGame(gameId);
  if (lastN !== undefined && lastN > 0) {
    return game.history.slice(-lastN);
  }
  return game.history;
}

// For testing: clear all games
export function _resetGames(): void {
  games.clear();
}
