import type { GameState } from "../../../types.js";
import { publish } from "../../session/pubsub.js";
import type { Session } from "../../session/session-manager.js";
import {
  deleteSession,
  waitForRenderComplete,
} from "../../session/session-manager.js";
import type { AgentRunner, PlayerConfig } from "./agent-runner.js";
import {
  buildDealCommunity,
  buildDealHands,
  buildGameOver,
  buildGameStart,
  buildHandResult,
  buildLeaderboard,
  buildPlayerAction,
} from "./instruction-builder.js";
import {
  formatDealCommunity,
  formatDealHands,
  formatHandResult,
  formatOpponentAction,
} from "./message-formatter.js";
import * as poker from "./poker-engine.js";

const MAX_ACTION_RETRIES = 3;
const MAX_LLM_RETRIES = 3;
const LLM_RETRY_DELAY_MS = 2000;

interface SessionContext {
  session: Session;
  gameId: string;
  agentRunner: AgentRunner;
  signal: AbortSignal;
}

async function emit(
  session: Session,
  instruction: ReturnType<typeof buildGameStart>,
  signal: AbortSignal,
): Promise<void> {
  session.lastInstruction = instruction;
  publish(session.channelKey, instruction);
  await waitForRenderComplete(
    session.channelKey,
    instruction.instructionId,
    signal,
  );
}

function updateGameState(session: Session, state: GameState): void {
  session.gameId = state.gameId;
  session.lastGameState = {
    phase: state.phase,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      status: p.status,
      seatIndex: p.seatIndex,
    })),
    communityCards: state.communityCards.map((c) => ({
      rank: c.rank,
      suit: c.suit,
    })),
    pots: state.pots.map((p) => ({
      size: p.size,
      eligiblePlayerIds: p.eligiblePlayerIds,
    })),
  };

  for (const sp of session.players) {
    const gp = state.players.find((p) => p.id === sp.id);
    if (gp) sp.chips = gp.chips;
  }
}

function isGameOver(
  state: GameState,
  handsPerGame: number | null | undefined,
  handNumber: number,
): boolean {
  const activePlayers = state.players.filter((p) => p.status !== "BUSTED");
  if (activePlayers.length <= 1) return true;
  if (handsPerGame && handNumber >= handsPerGame) return true;
  return false;
}

function buildPlayerConfig(agentConfig: {
  playerId: string;
  name: string;
  modelId: string;
  modelName: string;
  provider: string;
  avatarUrl?: string | null;
  ttsVoice?: string | null;
  temperature?: number | null;
}): PlayerConfig {
  return {
    id: agentConfig.playerId,
    name: agentConfig.name,
    modelId: agentConfig.modelId,
    modelName: agentConfig.modelName,
    provider: agentConfig.provider,
    avatarUrl: agentConfig.avatarUrl ?? undefined,
    ttsVoice: agentConfig.ttsVoice ?? undefined,
    temperature: agentConfig.temperature ?? undefined,
  };
}

async function resolveAction(
  ctx: SessionContext,
  playerId: string,
): Promise<{
  result: { action: { type: string; amount?: number }; analysis?: string };
  state: GameState;
}> {
  const turnData = poker.getMyTurn(ctx.gameId, playerId);

  let result: { action: { type: string; amount?: number }; analysis?: string };
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
      console.error(
        `[orchestrator] Agent ${playerId} LLM call failed (attempt ${llmAttempt + 1}/${MAX_LLM_RETRIES}):`,
        msg,
      );
      if (llmAttempt >= MAX_LLM_RETRIES - 1) {
        throw new Error(
          `LLM unavailable for agent ${playerId} after ${MAX_LLM_RETRIES} retries: ${msg}`,
        );
      }
      await new Promise((r) => setTimeout(r, LLM_RETRY_DELAY_MS));
    }
  }

  // Submit action, retrying with agent feedback on invalid actions
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
      console.error(
        `[orchestrator] Invalid action from ${playerId} (attempt ${attempt + 1}):`,
        errorMsg,
      );

      if (attempt >= MAX_ACTION_RETRIES) {
        console.error(
          `[orchestrator] Max retries reached for ${playerId}, auto-folding`,
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
        console.error(
          `[orchestrator] Agent ${playerId} rejectAction failed:`,
          retryMsg,
        );
        throw new Error(
          `LLM unavailable for agent ${playerId} during action retry: ${retryMsg}`,
        );
      }
    }
  }
}

async function playTurn(
  ctx: SessionContext,
  currentState: GameState,
): Promise<GameState> {
  const playerId = currentState.currentPlayerId as string;
  const playerName =
    currentState.players.find((p) => p.id === playerId)?.name ?? playerId;

  const { result, state } = await resolveAction(ctx, playerId);
  updateGameState(ctx.session, state);

  await emit(
    ctx.session,
    buildPlayerAction(
      playerId,
      playerName,
      result.action.type,
      result.action.amount,
      result.analysis,
      state,
    ),
    ctx.signal,
  );

  // Inject OPPONENT_ACTION into all other active players
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

async function playHand(ctx: SessionContext): Promise<void> {
  const { session, gameId, agentRunner, signal } = ctx;
  session.handNumber++;

  const handState = poker.startHand(gameId);
  updateGameState(session, handState);

  // Gather hole cards for all active players
  const playerHands: Array<{
    playerId: string;
    cards: Array<{ rank: string; suit: string }>;
  }> = [];
  for (const player of handState.players) {
    if (player.status === "BUSTED") continue;
    const myHand = poker.getMyTurn(gameId, player.id).myHand;
    playerHands.push({ playerId: player.id, cards: myHand });
  }

  await emit(
    session,
    buildDealHands(session.handNumber, handState, playerHands),
    signal,
  );

  // Inject DEAL_HANDS into each active player's conversation
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

  // Turn loop within a hand
  let currentState = handState;
  let previousPhase = currentState.phase;

  while (!signal.aborted) {
    if (currentState.currentPlayerId) {
      currentState = await playTurn(ctx, currentState);
      if (signal.aborted) break;
      continue;
    }

    // No current player — try to advance
    const advancedState = poker.advanceGame(gameId);
    updateGameState(session, advancedState);

    if (advancedState.phase === "WAITING") {
      await handleHandResult(ctx, advancedState);
      break;
    }

    if (advancedState.phase !== previousPhase) {
      await handlePhaseTransition(ctx, advancedState);
      previousPhase = advancedState.phase;
    }

    currentState = advancedState;
  }
}

export async function runSession(
  session: Session,
  agentRunner: AgentRunner,
): Promise<void> {
  const signal = session.abortController.signal;

  const gameId = poker.createGame({
    players: session.config.players.map((p) => ({
      id: p.playerId,
      name: p.name,
      chips: session.config.startingChips,
    })),
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
  });

  const ctx: SessionContext = { session, gameId, agentRunner, signal };

  const createState = poker.getGameState(gameId);
  session.gameId = gameId;
  updateGameState(session, createState);

  for (const p of session.config.players) {
    agentRunner.initAgent(p.playerId, buildPlayerConfig(p));
  }

  await emit(
    session,
    buildGameStart(gameId, createState.players, {
      smallBlind: session.config.smallBlind,
      bigBlind: session.config.bigBlind,
    }),
    signal,
  );

  // Hand loop
  while (!signal.aborted) {
    await playHand(ctx);

    if (signal.aborted) break;

    const postHandState = poker.getGameState(gameId);
    updateGameState(session, postHandState);

    if (
      isGameOver(postHandState, session.config.handsPerGame, session.handNumber)
    ) {
      const activePlayers = postHandState.players.filter(
        (p) => p.status !== "BUSTED",
      );
      const winner =
        activePlayers.sort((a, b) => b.chips - a.chips)[0] ??
        postHandState.players[0];

      await emit(
        session,
        buildGameOver(
          winner.id,
          winner.name,
          postHandState.players,
          session.handNumber,
        ),
        signal,
      );

      session.status = "FINISHED";
      poker.deleteGame(gameId);
      deleteSession(session.channelKey);
      return;
    }

    await emit(
      session,
      buildLeaderboard(postHandState.players, session.handNumber),
      signal,
    );
  }

  if (session.status === "RUNNING") {
    session.status = "STOPPED";
  }

  poker.deleteGame(gameId);
  deleteSession(session.channelKey);
}
