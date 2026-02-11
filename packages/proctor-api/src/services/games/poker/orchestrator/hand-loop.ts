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
import type { SessionContext } from "./types.js";

const SOLO_WIN_PROMPT =
  "You just won the pot! Say something short to the table — brag, trash talk, or celebrate. One sentence, 15 words max. Plain conversational English only, no emoji or markup.";

const SPLIT_POT_PROMPT =
  "The pot was split — you only got a share, not the whole thing. Say something short to the table about the split. One sentence, 15 words max. Plain conversational English only, no emoji or markup.";

const SHOWDOWN_LOSS_PROMPT =
  "You just lost at showdown heads-up. React naturally — complain about a bad beat, be shocked at what they called with, admit you were behind, or give grudging respect. One sentence, 15 words max. Plain conversational English only, no emoji or markup.";

async function handleHandResult(
  ctx: SessionContext,
  advancedState: GameState,
): Promise<void> {
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

  const isSplit = winners.length > 1;
  const winnerIds = new Set(winners.map((w) => w.playerId));

  // Detect heads-up showdown: exactly 2 non-folded, non-busted players and 1 winner
  const showdownPlayers = advancedState.players.filter(
    (p) => p.status !== "BUSTED" && p.status !== "FOLDED",
  );
  const headsUpShowdown = showdownPlayers.length === 2 && winners.length === 1;
  const showdownLoser = headsUpShowdown
    ? showdownPlayers.find((p) => !winnerIds.has(p.id))
    : undefined;

  // Let each winner say a short reaction
  for (const w of winners) {
    const player = advancedState.players.find((p) => p.id === w.playerId);
    if (!player || player.status === "BUSTED") continue;

    const reaction = await ctx.agentRunner.promptReaction(
      w.playerId,
      isSplit ? SPLIT_POT_PROMPT : SOLO_WIN_PROMPT,
    );
    if (reaction) {
      emit(
        ctx.moduleId,
        ctx.session,
        buildPlayerAnalysis(w.playerId, player.name, reaction),
      );
    }
  }

  // In a heads-up showdown, let the loser react too
  if (showdownLoser) {
    const reaction = await ctx.agentRunner.promptReaction(
      showdownLoser.id,
      SHOWDOWN_LOSS_PROMPT,
    );
    if (reaction) {
      emit(
        ctx.moduleId,
        ctx.session,
        buildPlayerAnalysis(showdownLoser.id, showdownLoser.name, reaction),
      );
    }
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
      await handleHandResult(ctx, advancedState);
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
