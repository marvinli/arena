import type { GameState } from "../../../types.js";
import { publish } from "../../session/pubsub.js";
import type { Session } from "../../session/session-manager.js";
import { waitForRenderComplete } from "../../session/session-manager.js";
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

  // Update player chips in session
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

export async function runSession(
  session: Session,
  agentRunner: AgentRunner,
): Promise<void> {
  const signal = session.abortController.signal;

  // Create game via poker engine
  const gameId = poker.createGame({
    players: session.config.players.map((p) => ({
      id: p.playerId,
      name: p.name,
      chips: session.config.startingChips,
    })),
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
  });

  const createState = poker.getGameState(gameId);
  session.gameId = gameId;
  updateGameState(session, createState);

  // Initialize agents
  for (const p of session.config.players) {
    agentRunner.initAgent(p.playerId, buildPlayerConfig(p));
  }

  // Emit GAME_START
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
    session.handNumber++;

    // Start hand
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

    // Emit DEAL_HANDS (includes all hole cards for front-end)
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

    if (signal.aborted) break;

    // Turn loop within a hand
    let currentState = handState;
    let previousPhase = currentState.phase;

    while (!signal.aborted) {
      // Check if there's a player to act
      if (currentState.currentPlayerId) {
        const playerId = currentState.currentPlayerId;
        const playerName =
          currentState.players.find((p) => p.id === playerId)?.name ?? playerId;

        // Get turn data from poker engine
        const turnData = poker.getMyTurn(gameId, playerId);

        // Call agent runner
        const MAX_ACTION_RETRIES = 3;
        let result: {
          action: { type: string; amount?: number };
          analysis?: string;
        };
        try {
          result = await agentRunner.runTurn(playerId, {
            gameId,
            handNumber: session.handNumber,
            phase: turnData.gameState.phase,
            communityCards: turnData.gameState.communityCards,
            myHand: turnData.myHand,
            players: turnData.gameState.players,
            pots: turnData.gameState.pots,
            validActions: turnData.validActions,
          });
        } catch (err) {
          // Agent failed — auto-fold
          console.error(
            `[orchestrator] Agent ${playerId} failed, auto-folding:`,
            err instanceof Error ? err.message : err,
          );
          result = { action: { type: "FOLD" } };
        }

        // Submit action to poker engine, retrying with agent feedback on invalid actions
        for (let attempt = 0; ; attempt++) {
          try {
            currentState = poker.submitAction(
              gameId,
              playerId,
              result.action.type,
              result.action.amount,
            );
            break;
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
              currentState = poker.submitAction(gameId, playerId, "FOLD");
              break;
            }

            try {
              result = await agentRunner.rejectAction(playerId, errorMsg);
            } catch (retryErr) {
              console.error(
                `[orchestrator] Agent ${playerId} retry failed, auto-folding:`,
                retryErr instanceof Error ? retryErr.message : retryErr,
              );
              result = { action: { type: "FOLD" } };
              currentState = poker.submitAction(gameId, playerId, "FOLD");
              break;
            }
          }
        }
        updateGameState(session, currentState);

        // Emit PLAYER_ACTION
        await emit(
          session,
          buildPlayerAction(
            playerId,
            playerName,
            result.action.type,
            result.action.amount,
            result.analysis,
            currentState,
          ),
          signal,
        );

        // Inject OPPONENT_ACTION into all other active players
        for (const p of currentState.players) {
          if (p.id === playerId || p.status === "BUSTED") continue;
          agentRunner.injectMessage(
            p.id,
            formatOpponentAction(
              playerName,
              result.action.type,
              result.action.amount,
            ),
          );
        }

        if (signal.aborted) break;
        continue;
      }

      // No current player — try to advance
      const advancedState = poker.advanceGame(gameId);
      updateGameState(session, advancedState);

      if (advancedState.phase === "WAITING") {
        // Hand is over — get latest history for results
        const history = poker.getHistory(gameId, 1);
        const lastHand = history[0];
        const winners = lastHand?.winners ?? [];

        await emit(session, buildHandResult(winners, advancedState), signal);

        // Inject HAND_RESULT into all active players
        for (const p of advancedState.players) {
          if (p.status === "BUSTED") continue;
          agentRunner.injectMessage(
            p.id,
            formatHandResult(
              session.handNumber,
              winners,
              advancedState.players,
            ),
          );
        }

        break;
      }

      // Phase changed — emit DEAL_COMMUNITY if we moved to a new phase
      if (advancedState.phase !== previousPhase) {
        await emit(
          session,
          buildDealCommunity(advancedState.phase, advancedState),
          signal,
        );

        // Inject DEAL_COMMUNITY into all active players
        for (const p of advancedState.players) {
          if (p.status === "BUSTED" || p.status === "FOLDED") continue;
          agentRunner.injectMessage(
            p.id,
            formatDealCommunity(
              advancedState.phase,
              advancedState.communityCards,
            ),
          );
        }

        previousPhase = advancedState.phase;
      }

      currentState = advancedState;
    }

    if (signal.aborted) break;

    // Check if game is over
    const postHandState = poker.getGameState(gameId);
    updateGameState(session, postHandState);

    if (
      isGameOver(postHandState, session.config.handsPerGame, session.handNumber)
    ) {
      // Find winner (player with most chips or last standing)
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
      return;
    }

    // Emit LEADERBOARD between hands
    await emit(
      session,
      buildLeaderboard(postHandState.players, session.handNumber),
      signal,
    );
  }

  // If we exit due to abort, mark as stopped
  if (session.status === "RUNNING") {
    session.status = "STOPPED";
  }
}
