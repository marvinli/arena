import type {
  Card,
  GameState,
  MyTurnResponse,
  ValidAction,
} from "../../../../types.js";
import { buildGameState, formatCard, playerIdToSeat } from "./state.js";
import { getGame } from "./store.js";
import { actionToEnum } from "./types.js";

export function getMyTurn(gameId: string, playerId: string): MyTurnResponse {
  const game = getGame(gameId);
  const seatIndex = playerIdToSeat(game, playerId);
  if (seatIndex === undefined) {
    throw new Error(`Player not in game: ${playerId}`);
  }

  const gameState = buildGameState(game, gameId);

  let myHand: Card[] = [];
  try {
    const allHoleCards = game.table.holeCards();
    const cards = allHoleCards[seatIndex];
    if (cards) {
      myHand = cards.map(formatCard);
    }
  } catch {
    // poker-ts throws when no hand is in progress
  }

  const validActions: ValidAction[] = [];
  try {
    if (
      game.table.isBettingRoundInProgress() &&
      game.table.playerToAct() === seatIndex
    ) {
      const legal = game.table.legalActions();
      for (const action of legal.actions) {
        const actionType = actionToEnum[action];
        if (!actionType) continue;
        const va: ValidAction = { type: actionType };
        if ((action === "bet" || action === "raise") && legal.chipRange) {
          va.min = legal.chipRange.min;
          va.max = legal.chipRange.max;
        }
        if (action === "call") {
          const handPlayers = game.table.handPlayers();
          const currentBet = handPlayers[seatIndex]?.betSize ?? 0;
          const maxBet = Math.max(
            ...handPlayers
              .filter((p): p is NonNullable<typeof p> => p !== null)
              .map((p) => p.betSize),
          );
          va.amount = maxBet - currentBet;
        }
        validActions.push(va);
      }
    }
  } catch {
    // poker-ts throws when no betting round is active
  }

  return { gameState, myHand, validActions };
}

export function submitAction(
  gameId: string,
  playerId: string,
  action: string,
  amount?: number,
): GameState {
  const game = getGame(gameId);
  const seatIndex = playerIdToSeat(game, playerId);
  if (seatIndex === undefined) {
    throw new Error(`Player not in game: ${playerId}`);
  }

  if (!game.table.isHandInProgress()) {
    throw new Error(
      `Cannot submit action for player ${playerId} in game ${gameId}: no hand in progress`,
    );
  }

  if (!game.table.isBettingRoundInProgress()) {
    throw new Error(
      `Cannot submit action for player ${playerId} in game ${gameId}: no betting round in progress`,
    );
  }

  if (game.table.playerToAct() !== seatIndex) {
    throw new Error(
      `Cannot submit action for player ${playerId} in game ${gameId}: not this player's turn`,
    );
  }

  const legal = game.table.legalActions();
  const lowerAction = action.toLowerCase() as
    | "fold"
    | "check"
    | "call"
    | "bet"
    | "raise";
  if (!legal.actions.includes(lowerAction)) {
    throw new Error(
      `You chose ${action.toUpperCase()}, but that action is not available right now. Your valid actions are: ${legal.actions.map((a) => a.toUpperCase()).join(", ")}.`,
    );
  }

  if (lowerAction === "bet" || lowerAction === "raise") {
    if (amount === undefined) {
      throw new Error(
        `You chose ${lowerAction.toUpperCase()} but did not specify an amount. You must provide an amount between ${legal.chipRange?.min ?? 0} and ${legal.chipRange?.max ?? 0} chips.`,
      );
    }
    if (
      legal.chipRange &&
      (amount < legal.chipRange.min || amount > legal.chipRange.max)
    ) {
      throw new Error(
        `You tried to ${lowerAction.toUpperCase()} ${amount} chips, but the amount must be between ${legal.chipRange.min} and ${legal.chipRange.max} chips.`,
      );
    }
  }

  game.table.actionTaken(lowerAction, amount);

  if (lowerAction === "fold") {
    game.folded.add(seatIndex);
  }

  const currentPhase =
    game.currentPhaseActions[game.currentPhaseActions.length - 1];
  if (currentPhase) {
    currentPhase.actions.push({
      playerId,
      action: lowerAction,
      amount,
    });
  }

  return buildGameState(game, gameId);
}
