import type { Card, GamePhase, GameState, PlayerAction } from "../types";
import { CHANNEL_KEY } from "./config";
import { mapCard, mapPlayers, mapPots } from "./mappers";
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

// ── Reconnect handler ───────────────────────────────────

function handleReconnect(cs: GqlChannelState): GameState {
  const avatarMap = new Map(
    cs.playerMeta.map((m) => [m.id, m.avatarUrl ?? ""]),
  );

  const holeCards = new Map<string, [Card, Card]>();
  for (const hand of cs.hands) {
    if (hand.cards.length >= 2) {
      holeCards.set(hand.playerId, [
        mapCard(hand.cards[0]),
        mapCard(hand.cards[1]),
      ]);
    }
  }

  const activePlayers = cs.players.filter((p) => p.status !== "BUSTED");
  const players = mapPlayers(activePlayers, cs.button, []).map((p) => ({
    ...p,
    avatar: avatarMap.get(p.id) ?? "",
    cards: holeCards.get(p.id) ?? null,
  }));

  const status = cs.status === "FINISHED" ? "finished" : "running";

  return {
    status,
    channelKey: CHANNEL_KEY,
    gameId: cs.gameId,
    handNumber: cs.handNumber,
    phase: (cs.phase as GamePhase) ?? "WAITING",
    smallBlind: cs.smallBlind,
    bigBlind: cs.bigBlind,
    button: cs.button,
    players,
    communityCards: cs.communityCards.map(mapCard),
    pots: mapPots(cs.pots),
    holeCards,
    speakingPlayerId: null,
    analysisText: null,
    isApiError: false,
    error: null,
  };
}

// ── Instruction handler ─────────────────────────────────

function handleInstruction(state: GameState, inst: GqlInstruction): GameState {
  switch (inst.type) {
    case "GAME_START": {
      const gs = inst.gameStart;
      if (!gs) return state;
      const avatarMap = new Map(
        (gs.playerMeta ?? []).map((m) => [m.id, m.avatarUrl ?? ""]),
      );
      const players = mapPlayers(gs.players, null, []).map((p) => ({
        ...p,
        avatar: avatarMap.get(p.id) ?? "",
      }));
      return {
        ...state,
        status: "running",
        gameId: gs.gameId,
        smallBlind: gs.smallBlind,
        bigBlind: gs.bigBlind,
        players,
      };
    }

    case "DEAL_HANDS": {
      const dh = inst.dealHands;
      if (!dh) return state;
      const holeCards = new Map<string, [Card, Card]>();
      for (const hand of dh.hands) {
        if (hand.cards.length >= 2) {
          holeCards.set(hand.playerId, [
            mapCard(hand.cards[0]),
            mapCard(hand.cards[1]),
          ]);
        }
      }
      const activeDh = dh.players.filter((p) => p.status !== "BUSTED");
      const players = mapPlayers(activeDh, dh.button, state.players).map(
        (p) => ({
          ...p,
          cards: holeCards.get(p.id) ?? null,
          lastAction: null as PlayerAction,
          isActive: false,
        }),
      );
      return {
        ...state,
        handNumber: dh.handNumber,
        phase: "PREFLOP" as GamePhase,
        button: dh.button,
        players,
        communityCards: [],
        pots: mapPots(dh.pots),
        holeCards,
      };
    }

    case "DEAL_COMMUNITY": {
      const dc = inst.dealCommunity;
      if (!dc) return state;
      const players = state.players.map((p) => ({
        ...p,
        lastAction: null as PlayerAction,
        currentBet: 0,
        isActive: false,
      }));
      return {
        ...state,
        phase: dc.phase as GamePhase,
        communityCards: dc.communityCards.map(mapCard),
        pots: mapPots(dc.pots),
        players,
      };
    }

    case "PLAYER_TURN": {
      const pt = inst.playerTurn;
      if (!pt) return state;
      const players = state.players.map((p) => ({
        ...p,
        isActive: p.id === pt.playerId,
      }));
      return { ...state, players };
    }

    case "PLAYER_ANALYSIS":
      return state;

    case "PLAYER_ACTION": {
      const pa = inst.playerAction;
      if (!pa) return state;
      const activePa = pa.players.filter((p) => p.status !== "BUSTED");
      const players = mapPlayers(activePa, state.button, state.players).map(
        (p) => {
          if (p.id === pa.playerId) {
            return {
              ...p,
              lastAction: pa.action as PlayerAction,
              isActive: false,
            };
          }
          return p;
        },
      );
      return {
        ...state,
        players,
        pots: mapPots(pa.pots),
      };
    }

    case "HAND_RESULT": {
      const hr = inst.handResult;
      if (!hr) return state;
      const activeHr = hr.players.filter((p) => p.status !== "BUSTED");
      const players = mapPlayers(activeHr, state.button, state.players).map(
        (p) => ({
          ...p,
          cards: state.holeCards.get(p.id) ?? null,
          lastAction: null as PlayerAction,
          isActive: false,
        }),
      );
      return {
        ...state,
        phase: "SHOWDOWN" as GamePhase,
        players,
        communityCards: hr.communityCards.map(mapCard),
        pots: mapPots(hr.pots),
      };
    }

    case "LEADERBOARD": {
      const lb = inst.leaderboard;
      if (!lb) return state;
      const activeLb = lb.players.filter((p) => p.status !== "BUSTED");
      const players = mapPlayers(activeLb, null, state.players).map((p) => ({
        ...p,
        cards: null as [Card, Card] | null,
        lastAction: null as PlayerAction,
        isActive: false,
        isDealer: false,
      }));
      return {
        ...state,
        phase: "WAITING" as GamePhase,
        players,
        communityCards: [],
        pots: [],
        button: null,
        holeCards: new Map(),
      };
    }

    case "GAME_OVER": {
      const go = inst.gameOver;
      if (!go) return state;
      const players = mapPlayers(go.players, null, state.players).map((p) => ({
        ...p,
        cards: null as [Card, Card] | null,
        lastAction: null as PlayerAction,
        isActive: false,
      }));
      return {
        ...state,
        status: "finished",
        players,
      };
    }

    default:
      return state;
  }
}
