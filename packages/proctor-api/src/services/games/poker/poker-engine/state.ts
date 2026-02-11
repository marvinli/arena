import {
  type Card,
  GamePhase,
  type GameState,
  type Player,
  PlayerStatus,
  type Pot,
} from "../../../../types.js";
import type { Game } from "./types.js";
import { roundToPhase } from "./types.js";

const log = (msg: string) => console.debug("[poker-engine]", msg);

export function seatToPlayerId(
  game: Game,
  seatIndex: number,
): string | undefined {
  return game.players.find((p) => p.seatIndex === seatIndex)?.id;
}

export function playerIdToSeat(
  game: Game,
  playerId: string,
): number | undefined {
  return game.players.find((p) => p.id === playerId)?.seatIndex;
}

export function formatCard(card: { rank: string; suit: string }): Card {
  return { rank: card.rank, suit: card.suit };
}

export function getPhase(
  table: Game["table"],
  handInProgress: boolean,
): GamePhase {
  if (!handInProgress) return GamePhase.Waiting;
  try {
    const round = table.roundOfBetting();
    return roundToPhase[round] ?? GamePhase.Showdown;
  } catch (e) {
    log(`getPhase: roundOfBetting() threw, defaulting to SHOWDOWN: ${e}`);
    return GamePhase.Showdown;
  }
}

export function buildPlayers(game: Game): Player[] {
  const seats = game.table.seats();
  let handPlayers: ReturnType<Game["table"]["handPlayers"]> | null = null;
  try {
    handPlayers = game.table.handPlayers();
  } catch (e) {
    log(`buildPlayers: handPlayers() threw (no hand in progress): ${e}`);
  }

  return game.players.map((pm) => {
    const seat = seats[pm.seatIndex];
    if (!seat) {
      return {
        id: pm.id,
        name: pm.name,
        chips: 0,
        bet: 0,
        status: PlayerStatus.Busted,
        seatIndex: pm.seatIndex,
      };
    }

    let status: PlayerStatus = PlayerStatus.Active;
    if (
      seat.stack === 0 &&
      seat.betSize === 0 &&
      !game.table.isHandInProgress()
    ) {
      status = PlayerStatus.Busted;
    } else if (game.folded.has(pm.seatIndex)) {
      status = PlayerStatus.Folded;
    } else if (
      handPlayers?.[pm.seatIndex]?.stack === 0 &&
      game.table.isHandInProgress()
    ) {
      status = PlayerStatus.AllIn;
    }

    return {
      id: pm.id,
      name: pm.name,
      chips: seat.totalChips - seat.betSize,
      bet: seat.betSize,
      status,
      seatIndex: pm.seatIndex,
    };
  });
}

export function buildPots(game: Game): Pot[] {
  try {
    return game.table.pots().map((pot) => ({
      size: pot.size,
      eligiblePlayerIds: pot.eligiblePlayers
        .map((si) => seatToPlayerId(game, si))
        .filter((id): id is string => id !== undefined),
    }));
  } catch (e) {
    log(`buildPots: pots() threw, returning empty: ${e}`);
    return [];
  }
}

export function buildGameState(game: Game, gameId: string): GameState {
  const table = game.table;
  const handInProgress = table.isHandInProgress();
  const phase = getPhase(table, handInProgress);

  let communityCards: Card[] = [];
  try {
    communityCards = table.communityCards().map(formatCard);
  } catch (e) {
    log(`buildGameState: communityCards() threw (pre-flop): ${e}`);
  }

  let currentPlayerId: string | null = null;
  try {
    if (handInProgress && table.isBettingRoundInProgress()) {
      const currentSeat = table.playerToAct();
      currentPlayerId = seatToPlayerId(game, currentSeat) ?? null;
    }
  } catch (e) {
    log(`buildGameState: playerToAct() threw (no active betting): ${e}`);
  }

  let button: number | null = null;
  try {
    if (handInProgress) {
      button = table.button();
    }
  } catch (e) {
    log(`buildGameState: button() threw (no hand started): ${e}`);
  }

  return {
    gameId,
    phase,
    communityCards,
    players: buildPlayers(game),
    pots: buildPots(game),
    currentPlayerId,
    handNumber: game.handNumber,
    button,
  };
}
