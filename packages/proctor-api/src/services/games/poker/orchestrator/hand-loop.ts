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

function handleHandResult(ctx: SessionContext, advancedState: GameState): void {
  const history = poker.getHistory(ctx.gameId, 1);
  const lastHand = history[0];
  const winners = lastHand?.winners ?? [];

  emit(ctx.moduleId, ctx.session, buildHandResult(winners, advancedState));

  for (const p of advancedState.players) {
    if (p.status === "BUSTED") continue;
    ctx.agentRunner.injectMessage(
      p.id,
      formatHandResult(ctx.session.handNumber, winners, advancedState.players),
    );
  }
}

function handlePhaseTransition(
  ctx: SessionContext,
  advancedState: GameState,
): void {
  emit(
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

  emit(
    moduleId,
    session,
    buildDealHands(session.handNumber, handState, playerHands),
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
      handleHandResult(ctx, advancedState);
      session.currentHands = [];
      break;
    }

    if (advancedState.phase !== previousPhase) {
      handlePhaseTransition(ctx, advancedState);
      previousPhase = advancedState.phase;
    }

    currentState = advancedState;
  }
}
