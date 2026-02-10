import { logError } from "../../../../logger.js";
import type { GameState } from "../../../../types.js";
import { fallbackCheckLine, fallbackFoldLine } from "../fallback-lines.js";
import {
  buildPlayerAction,
  buildPlayerAnalysis,
  buildPlayerTurn,
} from "../instruction-builder.js";
import { formatOpponentAction } from "../message-formatter.js";
import * as poker from "../poker-engine/index.js";
import { emit, updateGameState } from "./emitter.js";
import {
  LLM_RETRY_DELAY_MS,
  MAX_ACTION_RETRIES,
  MAX_LLM_RETRIES,
  type SessionContext,
} from "./types.js";

export async function resolveAction(
  ctx: SessionContext,
  playerId: string,
): Promise<{
  result: {
    action: { type: string; amount?: number };
    analysis?: string;
    isApiError?: boolean;
  };
  state: GameState;
}> {
  const turnData = poker.getMyTurn(ctx.gameId, playerId);

  let result: {
    action: { type: string; amount?: number };
    analysis?: string;
    isApiError?: boolean;
  };
  for (let llmAttempt = 0; ; llmAttempt++) {
    try {
      result = await ctx.agentRunner.runTurn(playerId, {
        gameId: ctx.gameId,
        handNumber: ctx.session.handNumber,
        phase: turnData.gameState.phase,
        communityCards: turnData.gameState.communityCards,
        myHand: turnData.myHand,
        players: turnData.gameState.players,
        pots: turnData.gameState.pots,
        validActions: turnData.validActions,
      });
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(
        "orchestrator",
        `Agent ${playerId} LLM call failed (attempt ${llmAttempt + 1}/${MAX_LLM_RETRIES}):`,
        msg,
      );
      if (llmAttempt >= MAX_LLM_RETRIES - 1) {
        const canCheck = turnData.validActions.some(
          (a: { type: string }) => a.type === "CHECK",
        );
        const fallback = canCheck ? "CHECK" : "FOLD";
        const analysis = canCheck ? fallbackCheckLine() : fallbackFoldLine();
        logError(
          "orchestrator",
          `Max LLM retries for ${playerId}, auto-${fallback.toLowerCase()}ing`,
        );
        const state = poker.submitAction(ctx.gameId, playerId, fallback);
        return {
          result: {
            action: { type: fallback },
            analysis,
            isApiError: true,
          },
          state,
        };
      }
      await new Promise((r) => setTimeout(r, LLM_RETRY_DELAY_MS));
    }
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const state = poker.submitAction(
        ctx.gameId,
        playerId,
        result.action.type,
        result.action.amount,
      );
      return { result, state };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logError(
        "orchestrator",
        `Invalid action from ${playerId} (attempt ${attempt + 1}):`,
        errorMsg,
      );

      if (attempt >= MAX_ACTION_RETRIES) {
        logError(
          "orchestrator",
          `Max retries reached for ${playerId}, auto-folding`,
        );
        result = { action: { type: "FOLD" } };
        const state = poker.submitAction(ctx.gameId, playerId, "FOLD");
        return { result, state };
      }

      try {
        result = await ctx.agentRunner.rejectAction(playerId, errorMsg);
      } catch (retryErr) {
        const retryMsg =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        logError(
          "orchestrator",
          `Agent ${playerId} rejectAction failed, auto-folding:`,
          retryMsg,
        );
        result = {
          action: { type: "FOLD" },
          analysis: fallbackFoldLine(),
          isApiError: true,
        };
        const state = poker.submitAction(ctx.gameId, playerId, "FOLD");
        return { result, state };
      }
    }
  }
}

export async function playTurn(
  ctx: SessionContext,
  currentState: GameState,
): Promise<GameState> {
  const playerId = currentState.currentPlayerId as string;
  const playerName =
    currentState.players.find((p) => p.id === playerId)?.name ?? playerId;

  await emit(ctx.session, buildPlayerTurn(playerId, playerName), ctx.signal);

  const { result, state } = await resolveAction(ctx, playerId);
  updateGameState(ctx.session, state);

  if (result.analysis) {
    await emit(
      ctx.session,
      buildPlayerAnalysis(
        playerId,
        playerName,
        result.analysis,
        result.isApiError ?? false,
      ),
      ctx.signal,
    );
  }

  await emit(
    ctx.session,
    buildPlayerAction(
      playerId,
      playerName,
      result.action.type,
      result.action.amount,
      state,
    ),
    ctx.signal,
  );

  for (const p of state.players) {
    if (p.id === playerId || p.status === "BUSTED") continue;
    ctx.agentRunner.injectMessage(
      p.id,
      formatOpponentAction(
        playerName,
        result.action.type,
        result.action.amount,
      ),
    );
  }

  return state;
}
