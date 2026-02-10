import type { GameState } from "../../../../types.js";
import {
  buildDealCommunity,
  buildDealHands,
  buildHandResult,
} from "../instruction-builder.js";
import {
  formatDealCommunity,
  formatDealHands,
  formatHandResult,
} from "../message-formatter.js";
import * as poker from "../poker-engine/index.js";
import { emit, updateGameState } from "./emitter.js";
import { playTurn } from "./turn-resolver.js";
import type { SessionContext } from "./types.js";

async function handleHandResult(
  ctx: SessionContext,
  advancedState: GameState,
): Promise<void> {
  const history = poker.getHistory(ctx.gameId, 1);
  const lastHand = history[0];
  const winners = lastHand?.winners ?? [];

  await emit(ctx.session, buildHandResult(winners, advancedState), ctx.signal);

  for (const p of advancedState.players) {
    if (p.status === "BUSTED") continue;
    ctx.agentRunner.injectMessage(
      p.id,
      formatHandResult(ctx.session.handNumber, winners, advancedState.players),
    );
  }
}

async function handlePhaseTransition(
  ctx: SessionContext,
  advancedState: GameState,
): Promise<void> {
  await emit(
    ctx.session,
    buildDealCommunity(advancedState.phase, advancedState),
    ctx.signal,
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
  const { session, gameId, agentRunner, signal } = ctx;
  session.handNumber++;

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
    session,
    buildDealHands(session.handNumber, handState, playerHands),
    signal,
  );

  const totalPot = handState.pots.reduce((sum, p) => sum + p.size, 0);
  for (const ph of playerHands) {
    agentRunner.injectMessage(
      ph.playerId,
      formatDealHands(
        session.handNumber,
        ph.cards,
        handState.players,
        totalPot,
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
      await handleHandResult(ctx, advancedState);
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
