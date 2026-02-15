import type { GameState } from "../../../../types.js";
import {
  buildDealCommunity,
  buildDealHands,
  buildHandResult,
  buildPlayerAnalysis,
} from "../instruction-builder.js";
import {
  formatDealCommunity,
  formatDealHands,
  formatHandResult,
} from "../message-formatter.js";
import * as poker from "../poker-engine/index.js";
import { emit, updateGameState } from "./emitter.js";
import { playTurn } from "./turn-resolver.js";
import {
  type SessionContext,
  trackElimination,
  trackHandWin,
} from "./types.js";

const HAND_REACTION_PROMPT =
  "The hand is over. Say something short to the table about how it played out. One sentence, 15 words max. Plain conversational English only, no emoji or markup.";

async function handleHandResult(
  ctx: SessionContext,
  advancedState: GameState,
  preHandBustedIds: Set<string>,
): Promise<void> {
  const history = poker.getHistory(ctx.gameId, 1);
  const lastHand = history[0];
  const winners = lastHand?.winners ?? [];

  await emit(
    ctx.moduleId,
    ctx.session,
    buildHandResult(winners, advancedState),
  );

  // Track hand wins and biggest pot
  for (const w of winners) {
    trackHandWin(ctx.actionTracker, w.playerId, w.amount);
  }

  // Track eliminations — attribute to the winner(s) of this hand
  for (const p of advancedState.players) {
    if (
      p.status === "BUSTED" &&
      !preHandBustedIds.has(p.id) &&
      winners.length > 0
    ) {
      trackElimination(ctx.actionTracker, winners[0].playerId);
    }
  }

  for (const p of advancedState.players) {
    if (p.status === "BUSTED") continue;
    ctx.agentRunner.injectMessage(
      p.id,
      formatHandResult(ctx.session.handNumber, winners, advancedState.players),
    );
  }

  const winnerIds = new Set(winners.map((w) => w.playerId));

  // Build the list of players who get to react:
  // 1. All winners
  // 2. In a heads-up showdown, the loser too
  const reactors: Array<{ id: string; name: string }> = [];

  for (const w of winners) {
    const player = advancedState.players.find((p) => p.id === w.playerId);
    if (player && player.status !== "BUSTED") {
      reactors.push({ id: player.id, name: player.name });
    }
  }

  const showdownPlayers = advancedState.players.filter(
    (p) => p.status !== "BUSTED" && p.status !== "FOLDED",
  );
  if (showdownPlayers.length === 2 && winners.length === 1) {
    const loser = showdownPlayers.find((p) => !winnerIds.has(p.id));
    if (loser) {
      reactors.push({ id: loser.id, name: loser.name });
    }
  }

  for (const reactor of reactors) {
    const reaction = await ctx.agentRunner.promptReaction(
      reactor.id,
      HAND_REACTION_PROMPT,
    );
    if (reaction) {
      await emit(
        ctx.moduleId,
        ctx.session,
        buildPlayerAnalysis(reactor.id, reactor.name, reaction),
      );
    }
  }
}

async function handlePhaseTransition(
  ctx: SessionContext,
  advancedState: GameState,
): Promise<void> {
  await emit(
    ctx.moduleId,
    ctx.session,
    buildDealCommunity(advancedState.phase, advancedState),
  );

  for (const p of advancedState.players) {
    if (p.status === "BUSTED" || p.status === "FOLDED") continue;
    ctx.agentRunner.injectMessage(
      p.id,
      formatDealCommunity(advancedState.phase, advancedState.communityCards),
    );
  }
}

export async function playHand(ctx: SessionContext): Promise<void> {
  const { session, moduleId, gameId, agentRunner, signal } = ctx;
  session.handNumber++;

  const preHandBustedIds = new Set(
    session.lastGameState?.players
      .filter((p) => p.status === "BUSTED")
      .map((p) => p.id) ?? [],
  );

  const handState = poker.startHand(gameId);
  updateGameState(session, handState);
  session.button = handState.button ?? null;

  const playerHands: Array<{
    playerId: string;
    cards: Array<{ rank: string; suit: string }>;
  }> = [];
  for (const player of handState.players) {
    if (player.status === "BUSTED") continue;
    const myHand = poker.getMyTurn(gameId, player.id).myHand;
    playerHands.push({ playerId: player.id, cards: myHand });
  }

  session.currentHands = playerHands;

  await emit(
    moduleId,
    session,
    buildDealHands(session.handNumber, handState, playerHands, {
      smallBlind: session.config.smallBlind,
      bigBlind: session.config.bigBlind,
    }),
  );

  const totalPot = handState.pots.reduce((sum, p) => sum + p.size, 0);
  const blinds = {
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
  };
  const scheduleContext =
    session.config.blindSchedule && session.config.handsPerLevel
      ? {
          schedule: session.config.blindSchedule,
          handsPerLevel: session.config.handsPerLevel,
        }
      : undefined;
  for (const ph of playerHands) {
    agentRunner.injectMessage(
      ph.playerId,
      formatDealHands(
        session.handNumber,
        ph.cards,
        handState.players,
        totalPot,
        blinds,
        scheduleContext,
      ),
    );
  }

  if (signal.aborted) return;

  let currentState = handState;
  let previousPhase = currentState.phase;

  while (!signal.aborted) {
    if (currentState.currentPlayerId) {
      currentState = await playTurn(ctx, currentState);
      if (signal.aborted) break;
      continue;
    }

    const advancedState = poker.advanceGame(gameId);
    updateGameState(session, advancedState);

    if (advancedState.phase === "WAITING") {
      await handleHandResult(ctx, advancedState, preHandBustedIds);
      session.currentHands = [];
      break;
    }

    if (advancedState.phase !== previousPhase) {
      await handlePhaseTransition(ctx, advancedState);
      previousPhase = advancedState.phase;
    }

    currentState = advancedState;
  }
}
