// Proctor types
// Poker types
export type {
  ActionRecord,
  Card,
  CardInfo,
  CreateGameInput,
  DealCommunityPayload,
  DealHandsPayload,
  GameOverPayload,
  GameStartPayload,
  GameState,
  HandRecord,
  HandRecordPlayer,
  HandResultPayload,
  HandWinner,
  LeaderboardPayload,
  MyTurnResponse,
  PhaseActions,
  Player,
  PlayerActionPayload,
  PlayerInfo,
  Pot,
  PotInfo,
  ProctorGameState,
  RenderInstruction,
  Session,
  SessionPlayer,
  SubmitActionInput,
  ValidAction,
  WinnerInfo,
} from "./gql/resolverTypes.js";
export {
  ActionType,
  GamePhase,
  InstructionType,
  PlayerStatus,
  SessionStatus,
} from "./gql/resolverTypes.js";

// Internal types not in the GraphQL schema
export interface CreateGameOptions {
  players: { id: string; name: string; chips: number }[];
  smallBlind: number;
  bigBlind: number;
}
