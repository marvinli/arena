import { randomUUID } from "node:crypto";
import Poker from "poker-ts";
import type { CreateGameOptions, GameState } from "../../../../types.js";
import { buildGameState } from "./state.js";
import type { Game, PlayerMapping } from "./types.js";

const games = new Map<string, Game>();

export function getGame(gameId: string): Game {
  const game = games.get(gameId);
  if (!game) throw new Error(`Game not found: ${gameId}`);
  return game;
}

export function createGame(opts: CreateGameOptions): string {
  if (opts.players.length < 2) {
    throw new Error("A game requires at least 2 players");
  }
  if (opts.smallBlind <= 0 || opts.bigBlind <= 0) {
    throw new Error("Blinds must be positive numbers");
  }
  if (opts.smallBlind >= opts.bigBlind) {
    throw new Error("Small blind must be less than big blind");
  }

  const gameId = randomUUID();
  const table = new Poker.Table({
    smallBlind: opts.smallBlind,
    bigBlind: opts.bigBlind,
  });

  const players: PlayerMapping[] = opts.players.map((p, i) => {
    table.sitDown(i, p.chips);
    return { id: p.id, name: p.name, seatIndex: i };
  });

  const game: Game = {
    table,
    players,
    folded: new Set(),
    handNumber: 0,
    history: [],
    currentPhaseActions: [],
    startingChips: new Map(),
  };

  games.set(gameId, game);
  return gameId;
}

export function setBlinds(
  gameId: string,
  smallBlind: number,
  bigBlind: number,
): void {
  const game = getGame(gameId);
  game.table.setForcedBets({ smallBlind, bigBlind });
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

export function getGameState(gameId: string): GameState {
  const game = getGame(gameId);
  return buildGameState(game, gameId);
}

export function _resetGames(): void {
  games.clear();
}
