export {
  GamePhase,
  PlayerStatus,
  ActionType,
} from "./gql/resolverTypes.js";

export type {
  Card,
  Player,
  Pot,
  ValidAction,
  GameState,
  MyTurnResponse,
  HandRecord,
  HandRecordPlayer,
  HandWinner,
  ActionRecord,
  PhaseActions,
  CreateGameInput,
  SubmitActionInput,
} from "./gql/resolverTypes.js";

// Internal types not in the GraphQL schema
export interface CreateGameOptions {
  players: { id: string; name: string; chips: number }[];
  smallBlind: number;
  bigBlind: number;
}
