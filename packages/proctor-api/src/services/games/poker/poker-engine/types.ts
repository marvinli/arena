import type Poker from "poker-ts";
import {
  type ActionRecord,
  ActionType,
  GamePhase,
  type HandRecord,
} from "../../../../types.js";

export interface PlayerMapping {
  id: string;
  name: string;
  seatIndex: number;
}

export interface PhaseActions {
  phase: string;
  actions: ActionRecord[];
}

export interface Game {
  table: InstanceType<typeof Poker.Table>;
  players: PlayerMapping[];
  folded: Set<number>;
  handNumber: number;
  history: HandRecord[];
  currentPhaseActions: PhaseActions[];
  startingChips: Map<string, number>;
}

export const roundToPhase: Record<string, GamePhase> = {
  preflop: GamePhase.Preflop,
  flop: GamePhase.Flop,
  turn: GamePhase.Turn,
  river: GamePhase.River,
};

export const actionToEnum: Record<string, ActionType> = {
  fold: ActionType.Fold,
  check: ActionType.Check,
  call: ActionType.Call,
  bet: ActionType.Bet,
  raise: ActionType.Raise,
};

export const handRankings = [
  "HIGH_CARD",
  "PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "STRAIGHT_FLUSH",
  "ROYAL_FLUSH",
];
