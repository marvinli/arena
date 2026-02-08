import type { AgentRunner } from "./agent-runner.js";
import {
  buildDealCommunity,
  buildDealHands,
  buildGameOver,
  buildGameStart,
  buildHandResult,
  buildLeaderboard,
  buildPlayerAction,
} from "./instruction-builder.js";
import type { PokerApiClient, PokerGameState } from "./poker-api-client.js";
import { publish } from "./pubsub.js";
import type { Session } from "./session-manager.js";
import { waitForRenderComplete } from "./session-manager.js";

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

function updateGameState(session: Session, state: PokerGameState): void {
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

function findAgentConfig(session: Session, playerId: string) {
  return session.config.players.find((p) => p.playerId === playerId);
}

function isGameOver(
  state: PokerGameState,
  handsPerGame: number | null | undefined,
  handNumber: number,
): boolean {
  const activePlayers = state.players.filter((p) => p.status !== "BUSTED");
  if (activePlayers.length <= 1) return true;
  if (handsPerGame && handNumber >= handsPerGame) return true;
  return false;
}

export async function runSession(
  session: Session,
  pokerApi: PokerApiClient,
  agentRunner: AgentRunner,
): Promise<void> {
  const signal = session.abortController.signal;

  // Create game via poker-api
  const createState = await pokerApi.createGame({
    players: session.config.players.map((p) => ({
      id: p.playerId,
      name: p.name,
      chips: session.config.startingChips,
    })),
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
  });

  session.gameId = createState.gameId;
  updateGameState(session, createState);

  // Emit GAME_START
  await emit(
    session,
    buildGameStart(createState.gameId, createState.players, {
      smallBlind: session.config.smallBlind,
      bigBlind: session.config.bigBlind,
    }),
    signal,
  );

  // Hand loop
  while (!signal.aborted) {
    session.handNumber++;

    // Start hand
    const handState = await pokerApi.startHand(createState.gameId);
    updateGameState(session, handState);

    // Emit DEAL_HANDS
    await emit(session, buildDealHands(session.handNumber, handState), signal);

    if (signal.aborted) break;

    // Turn loop within a hand
    let currentState = handState;
    let previousPhase = currentState.phase;

    while (!signal.aborted) {
      // Check if there's a player to act
      if (currentState.currentPlayerId) {
        const playerId = currentState.currentPlayerId;
        const agentConfig = findAgentConfig(session, playerId);
        const playerName =
          currentState.players.find((p) => p.id === playerId)?.name ?? playerId;

        // Get turn data from poker-api
        const turnData = await pokerApi.getMyTurn(createState.gameId, playerId);

        // Get history for agent context
        const history = await pokerApi.getHistory(createState.gameId, 5);

        // Call agent runner
        let result: {
          action: { type: string; amount?: number };
          analysis?: string;
        };
        try {
          result = await agentRunner.runTurn(
            {
              gameId: createState.gameId,
              playerId,
              playerName,
              handNumber: session.handNumber,
              gameState: {
                phase: turnData.gameState.phase,
                communityCards: turnData.gameState.communityCards,
                players: turnData.gameState.players,
                pots: turnData.gameState.pots,
              },
              myHand: turnData.myHand,
              validActions: turnData.validActions,
              history,
            },
            agentConfig
              ? {
                  model: agentConfig.model,
                  systemPrompt: agentConfig.systemPrompt,
                  temperature: agentConfig.temperature,
                }
              : { model: "default", systemPrompt: "" },
          );
        } catch {
          // Agent failed — auto-fold
          result = { action: { type: "FOLD" } };
        }

        // Submit action to poker-api
        currentState = await pokerApi.submitAction(
          createState.gameId,
          playerId,
          result.action,
        );
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

        if (signal.aborted) break;
        continue;
      }

      // No current player — try to advance
      const advancedState = await pokerApi.advanceGame(createState.gameId);
      updateGameState(session, advancedState);

      if (advancedState.phase === "WAITING") {
        // Hand is over — get latest history for results
        const history = await pokerApi.getHistory(createState.gameId, 1);
        const lastHand = history[0];
        const winners = lastHand?.winners ?? [];

        await emit(session, buildHandResult(winners, advancedState), signal);
        break;
      }

      // Phase changed — emit DEAL_COMMUNITY if we moved to a new phase
      if (advancedState.phase !== previousPhase) {
        await emit(
          session,
          buildDealCommunity(advancedState.phase, advancedState),
          signal,
        );
        previousPhase = advancedState.phase;
      }

      currentState = advancedState;
    }

    if (signal.aborted) break;

    // Check if game is over
    const postHandState = await pokerApi.getGameState(createState.gameId);
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
