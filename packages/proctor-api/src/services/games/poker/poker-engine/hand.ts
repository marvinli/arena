import type { Card, GameState, HandRecord } from "../../../../types.js";
import {
  buildGameState,
  buildPots,
  formatCard,
  getPhase,
  seatToPlayerId,
} from "./state.js";
import { getGame } from "./store.js";
import type { Game } from "./types.js";
import { handRankings } from "./types.js";

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

  game.startingChips.clear();
  const seats = game.table.seats();
  for (const pm of game.players) {
    const seat = seats[pm.seatIndex];
    if (seat) {
      game.startingChips.set(pm.id, seat.totalChips);
    }
  }

  game.currentPhaseActions = [{ phase: "PREFLOP", actions: [] }];

  return buildGameState(game, gameId);
}

function handleShowdown(game: Game, gameId: string): GameState {
  let communityCards: Card[] = [];
  try {
    communityCards = game.table.communityCards().map(formatCard);
  } catch {
    // poker-ts throws when no community cards exist (preflop fold-out)
  }

  const pots = buildPots(game);

  const preShowdownPots = game.table.pots();
  const isFoldWin = preShowdownPots.every(
    (pot) => pot.eligiblePlayers.length <= 1,
  );

  game.table.showdown();

  const winners: HandRecord["winners"] = [];
  if (isFoldWin) {
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
      for (const [seatIdx, hand] of potWinners) {
        const winnerId = seatToPlayerId(game, seatIdx);
        if (winnerId) {
          winners.push({
            playerId: winnerId,
            amount: 0,
            hand: handRankings[hand.ranking] ?? "UNKNOWN",
          });
        }
      }
    }
  }

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
    return handleShowdown(game, gameId);
  }

  game.table.endBettingRound();

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

  if (game.table.isHandInProgress() && game.table.areBettingRoundsCompleted()) {
    return handleShowdown(game, gameId);
  }

  const nextPhase = getPhase(game.table, true);
  game.currentPhaseActions.push({ phase: nextPhase, actions: [] });

  return buildGameState(game, gameId);
}

export function getHistory(gameId: string, lastN?: number): HandRecord[] {
  const game = getGame(gameId);
  if (lastN !== undefined && lastN > 0) {
    return game.history.slice(-lastN);
  }
  return game.history;
}
