import type { GameState } from "../types";
import { handleDealCommunity } from "./handlers/dealCommunity";
import { handleDealHands } from "./handlers/dealHands";
import { handleGameOver } from "./handlers/gameOver";
import { handleGameStart } from "./handlers/gameStart";
import { handleHandResult } from "./handlers/handResult";
import { handleLeaderboard } from "./handlers/leaderboard";
import { handlePlayerAction } from "./handlers/playerAction";
import { handlePlayerTurn } from "./handlers/playerTurn";
import { handleReconnect } from "./handlers/reconnect";
import type { GqlChannelState, GqlInstruction } from "./types";

// ── Action types ────────────────────────────────────────

export type Action =
  | { type: "START"; channelKey: string }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }
  | { type: "INSTRUCTION"; instruction: GqlInstruction }
  | { type: "RECONNECT"; channelState: GqlChannelState }
  | {
      type: "SPEAK_START";
      playerId: string;
      text: string;
      isApiError: boolean;
    }
  | { type: "SPEAK_END" };

// ── Initial state ───────────────────────────────────────

export const INITIAL_STATE: GameState = {
  status: "idle",
  channelKey: null,
  gameId: null,
  handNumber: 0,
  phase: "WAITING",
  currentView: "poker",
  smallBlind: 0,
  bigBlind: 0,
  button: null,
  players: [],
  communityCards: [],
  pots: [],
  holeCards: new Map(),
  speakingPlayerId: null,
  analysisText: null,
  isApiError: false,
  error: null,
};

// ── Reducer ─────────────────────────────────────────────

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START":
      return {
        ...INITIAL_STATE,
        status: "connecting",
        channelKey: action.channelKey,
      };

    case "ERROR":
      return { ...state, status: "error", error: action.error };

    case "RESET":
      return INITIAL_STATE;

    case "INSTRUCTION":
      return handleInstruction(state, action.instruction);

    case "RECONNECT":
      return handleReconnect(action.channelState);

    case "SPEAK_START":
      return {
        ...state,
        speakingPlayerId: action.playerId,
        analysisText: action.text,
        isApiError: action.isApiError,
      };

    case "SPEAK_END":
      return {
        ...state,
        speakingPlayerId: null,
        analysisText: null,
        isApiError: false,
      };
  }
}

// ── Instruction dispatch ────────────────────────────────

function handleInstruction(state: GameState, inst: GqlInstruction): GameState {
  switch (inst.type) {
    case "GAME_START":
      return handleGameStart(state, inst);
    case "DEAL_HANDS":
      return handleDealHands(state, inst);
    case "DEAL_COMMUNITY":
      return handleDealCommunity(state, inst);
    case "PLAYER_TURN":
      return handlePlayerTurn(state, inst);
    case "PLAYER_ANALYSIS":
      return state;
    case "PLAYER_ACTION":
      return handlePlayerAction(state, inst);
    case "HAND_RESULT":
      return handleHandResult(state, inst);
    case "LEADERBOARD":
      return handleLeaderboard(state, inst);
    case "GAME_OVER":
      return handleGameOver(state, inst);
    default:
      return state;
  }
}
