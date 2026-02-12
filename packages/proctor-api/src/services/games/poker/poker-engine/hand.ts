import {
  type Card,
  GamePhase,
  type GameState,
  type HandRecord,
} from "../../../../types.js";
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
  game.allInRunout = undefined;
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

/** Build a GameState with only the revealed subset of community cards. */
function buildRunoutState(
  game: Game,
  gameId: string,
  cards: Card[],
  phase: GamePhase,
): GameState {
  const state = buildGameState(game, gameId);
  return { ...state, communityCards: cards, phase, currentPlayerId: null };
}

/** Map revealed-card count to the corresponding game phase. */
function runoutPhase(count: number): GamePhase {
  if (count <= 3) return GamePhase.Flop;
  if (count === 4) return GamePhase.Turn;
  return GamePhase.River;
}

export function advanceGame(gameId: string): GameState {
  const game = getGame(gameId);

  // ── Ongoing all-in runout: reveal the next street ──
  if (game.allInRunout) {
    const runout = game.allInRunout;
    // Advance to the next phase
    runout.revealedCount =
      runout.revealedCount < 3 ? 3 : runout.revealedCount + 1;

    if (runout.revealedCount > 5) {
      // All streets revealed — proceed to showdown
      game.allInRunout = undefined;
      return handleShowdown(game, gameId);
    }

    const phase = runoutPhase(runout.revealedCount);
    game.currentPhaseActions.push({ phase, actions: [] });
    return buildRunoutState(
      game,
      gameId,
      runout.cards.slice(0, runout.revealedCount),
      phase,
    );
  }

  // ── Normal guards ──
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

  // Record how many community cards exist before advancing so we can
  // detect when poker-ts deals multiple streets in one endBettingRound().
  let previousCardCount = 0;
  try {
    previousCardCount = game.table.communityCards().length;
  } catch {
    // Pre-flop: no community cards yet
  }

  game.table.endBettingRound();

  // ── All-in runout detection ──
  // When every remaining player is all-in, poker-ts deals ALL remaining
  // community cards in a single endBettingRound() call and marks betting
  // rounds as completed.  We need to reveal them one street at a time so
  // the front-end can animate each deal.
  if (game.table.isHandInProgress() && game.table.areBettingRoundsCompleted()) {
    let allCards: Card[] = [];
    try {
      allCards = game.table.communityCards().map(formatCard);
    } catch {
      // Shouldn't happen since hand is still in progress
    }

    if (allCards.length > previousCardCount) {
      // New cards were dealt — start the incremental reveal
      const firstRevealCount =
        previousCardCount < 3 ? 3 : previousCardCount + 1;
      const phase = runoutPhase(firstRevealCount);

      // If more phases remain after this one, track the runout
      if (firstRevealCount < 5) {
        game.allInRunout = { cards: allCards, revealedCount: firstRevealCount };
      }

      game.currentPhaseActions.push({ phase, actions: [] });
      return buildRunoutState(
        game,
        gameId,
        allCards.slice(0, firstRevealCount),
        phase,
      );
    }

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
