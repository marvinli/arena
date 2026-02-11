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

interface ActionResult {
  action: { type: string; amount?: number };
  analysis?: string;
  isApiError?: boolean;
}

/**
 * Calls the agent runner with retries. If all attempts fail,
 * returns a fallback check/fold action.
 */
async function callAgentWithRetries(
  ctx: SessionContext,
  playerId: string,
  turnData: ReturnType<typeof poker.getMyTurn>,
): Promise<ActionResult> {
  for (let attempt = 0; attempt < MAX_LLM_RETRIES; attempt++) {
    try {
      return await ctx.agentRunner.runTurn(playerId, {
        gameId: ctx.gameId,
        handNumber: ctx.session.handNumber,
        phase: turnData.gameState.phase,
        communityCards: turnData.gameState.communityCards,
        myHand: turnData.myHand,
        players: turnData.gameState.players,
        pots: turnData.gameState.pots,
        validActions: turnData.validActions,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(
        "orchestrator",
        `Agent ${playerId} LLM call failed (attempt ${attempt + 1}/${MAX_LLM_RETRIES}):`,
        msg,
      );
      if (attempt < MAX_LLM_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, LLM_RETRY_DELAY_MS));
      }
    }
  }

  // All LLM attempts exhausted — fallback
  const canCheck = turnData.validActions.some(
    (a: { type: string }) => a.type === "CHECK",
  );
  const fallback = canCheck ? "CHECK" : "FOLD";
  logError(
    "orchestrator",
    `Max LLM retries for ${playerId}, auto-${fallback.toLowerCase()}ing`,
  );
  return {
    action: { type: fallback },
    analysis: canCheck ? fallbackCheckLine() : fallbackFoldLine(),
    isApiError: true,
  };
}

/**
 * Submits the action to the poker engine, retrying with rejectAction
 * if the action is invalid. Falls back to fold if retries are exhausted.
 */
async function submitActionWithRetries(
  ctx: SessionContext,
  playerId: string,
  initialResult: ActionResult,
): Promise<{ result: ActionResult; state: GameState }> {
  let result = initialResult;

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
        const turnData = poker.getMyTurn(ctx.gameId, playerId);
        const canCheck = turnData.validActions.some(
          (a: { type: string }) => a.type === "CHECK",
        );
        const fallback = canCheck ? "CHECK" : "FOLD";
        logError(
          "orchestrator",
          `Max retries reached for ${playerId}, auto-${fallback.toLowerCase()}ing`,
        );
        const state = poker.submitAction(ctx.gameId, playerId, fallback);
        return { result: { action: { type: fallback } }, state };
      }

      try {
        result = await ctx.agentRunner.rejectAction(playerId, errorMsg);
      } catch (retryErr) {
        const retryMsg =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        const turnData2 = poker.getMyTurn(ctx.gameId, playerId);
        const canCheck2 = turnData2.validActions.some(
          (a: { type: string }) => a.type === "CHECK",
        );
        const fallback2 = canCheck2 ? "CHECK" : "FOLD";
        logError(
          "orchestrator",
          `Agent ${playerId} rejectAction failed, auto-${fallback2.toLowerCase()}ing:`,
          retryMsg,
        );
        const state = poker.submitAction(ctx.gameId, playerId, fallback2);
        return {
          result: {
            action: { type: fallback2 },
            analysis: canCheck2 ? fallbackCheckLine() : fallbackFoldLine(),
            isApiError: true,
          },
          state,
        };
      }
    }
  }
}

export async function resolveAction(
  ctx: SessionContext,
  playerId: string,
): Promise<{ result: ActionResult; state: GameState }> {
  const turnData = poker.getMyTurn(ctx.gameId, playerId);
  const agentResult = await callAgentWithRetries(ctx, playerId, turnData);

  // If the agent result is already a fallback (LLM exhausted), submit directly
  if (agentResult.isApiError) {
    const state = poker.submitAction(
      ctx.gameId,
      playerId,
      agentResult.action.type,
    );
    return { result: agentResult, state };
  }

  return submitActionWithRetries(ctx, playerId, agentResult);
}

export async function playTurn(
  ctx: SessionContext,
  currentState: GameState,
): Promise<GameState> {
  const playerId = currentState.currentPlayerId as string;
  const playerName =
    currentState.players.find((p) => p.id === playerId)?.name ?? playerId;

  emit(ctx.moduleId, ctx.session, buildPlayerTurn(playerId, playerName));

  const { result, state } = await resolveAction(ctx, playerId);
  updateGameState(ctx.session, state);

  if (result.analysis) {
    emit(
      ctx.moduleId,
      ctx.session,
      buildPlayerAnalysis(
        playerId,
        playerName,
        result.analysis,
        result.isApiError ?? false,
      ),
    );
  }

  emit(
    ctx.moduleId,
    ctx.session,
    buildPlayerAction(
      playerId,
      playerName,
      result.action.type,
      result.action.amount,
      state,
    ),
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
