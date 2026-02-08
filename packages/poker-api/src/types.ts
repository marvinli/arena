export type {
  ActionRecord,
  Card,
  CreateGameInput,
  GameState,
  HandRecord,
  HandRecordPlayer,
  HandWinner,
  MyTurnResponse,
  PhaseActions,
  Player,
  Pot,
  SubmitActionInput,
  ValidAction,
} from "./gql/resolverTypes.js";
export {
  ActionType,
  GamePhase,
  PlayerStatus,
} from "./gql/resolverTypes.js";

// Internal types not in the GraphQL schema
export interface CreateGameOptions {
  players: { id: string; name: string; chips: number }[];
  smallBlind: number;
  bigBlind: number;
}
