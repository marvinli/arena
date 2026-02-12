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
    // After showdown(), chips have been distributed.
    // Calculate each winner's profit from chip differences.
    const seats = game.table.seats();
    const seen = new Set<string>();
    const winnersResult = game.table.winners();
    for (const potWinners of winnersResult) {
      for (const [seatIdx, hand] of potWinners) {
        const winnerId = seatToPlayerId(game, seatIdx);
        if (!winnerId || seen.has(winnerId)) continue;
        seen.add(winnerId);
        const startChips = game.startingChips.get(winnerId) ?? 0;
        const currentChips = seats[seatIdx]?.totalChips ?? 0;
        winners.push({
          playerId: winnerId,
          amount: Math.max(0, currentChips - startChips),
          hand: handRankings[hand.ranking] ?? "UNKNOWN",
        });
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

  if (game.table.isHandInProgress() && game.table.areBettingRoundsCompleted()) {
    return handleShowdown(game, gameId);
  }

  // If no betting round started, check whether this is an all-in runout
  // (multiple eligible players) or a fold-win (single eligible player).
  // For all-in runouts, return one phase at a time so the front-end can
  // animate each community card deal (turn, river).
  if (
    game.table.isHandInProgress() &&
    !game.table.isBettingRoundInProgress() &&
    !game.table.areBettingRoundsCompleted()
  ) {
    const pots = game.table.pots();
    const isAllInRunout = pots.some((pot) => pot.eligiblePlayers.length >= 2);

    if (isAllInRunout) {
      // Return now — let the hand loop emit DEAL_COMMUNITY for this phase,
      // then call advanceGame again for the next phase.
      const nextPhase = getPhase(game.table, true);
      game.currentPhaseActions.push({ phase: nextPhase, actions: [] });
      return buildGameState(game, gameId);
    }

    // Fold-win: skip through remaining rounds to reach showdown
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
      return handleShowdown(game, gameId);
    }
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
