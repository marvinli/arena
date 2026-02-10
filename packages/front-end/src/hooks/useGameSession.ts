import { useCallback, useEffect, useReducer, useRef } from "react";
import { gqlFetch } from "../graphql/client";
import {
  GET_CHANNEL_STATE,
  RENDER_COMPLETE_MUT,
  RENDER_INSTRUCTIONS_SUB,
  RUN_SESSION_MUT,
  START_SESSION_MUT,
  STOP_SESSION_MUT,
} from "../graphql/operations";
import { speakAnalysis } from "../tts";
import type {
  Card,
  GamePhase,
  GameState,
  Player,
  PlayerAction,
  Pot,
} from "../types";

// ── GraphQL response shapes ─────────────────────────────

interface GqlPlayerInfo {
  id: string;
  name: string;
  chips: number;
  bet: number;
  status: string;
  seatIndex: number;
}

interface GqlCardInfo {
  rank: string;
  suit: string;
}

interface GqlPotInfo {
  size: number;
  eligiblePlayerIds: string[];
}

interface GqlInstruction {
  instructionId: string;
  type: string;
  timestamp: string;
  gameStart?: {
    gameId: string;
    players: GqlPlayerInfo[];
    playerMeta: {
      id: string;
      ttsVoice: string | null;
      avatarUrl: string | null;
    }[];
    smallBlind: number;
    bigBlind: number;
  } | null;
  dealHands?: {
    handNumber: number;
    players: GqlPlayerInfo[];
    hands: { playerId: string; cards: GqlCardInfo[] }[];
    button: number | null;
    pots: GqlPotInfo[];
  } | null;
  dealCommunity?: {
    phase: string;
    communityCards: GqlCardInfo[];
    pots: GqlPotInfo[];
  } | null;
  playerTurn?: {
    playerId: string;
    playerName: string;
  } | null;
  playerAnalysis?: {
    playerId: string;
    playerName: string;
    analysis: string;
  } | null;
  playerAction?: {
    playerId: string;
    playerName: string;
    action: string;
    amount: number | null;
    pots: GqlPotInfo[];
    players: GqlPlayerInfo[];
  } | null;
  handResult?: {
    winners: { playerId: string; amount: number; hand: string | null }[];
    pots: GqlPotInfo[];
    players: GqlPlayerInfo[];
    communityCards: GqlCardInfo[];
  } | null;
  leaderboard?: {
    players: GqlPlayerInfo[];
    handsPlayed: number;
  } | null;
  gameOver?: {
    winnerId: string;
    winnerName: string;
    players: GqlPlayerInfo[];
    handsPlayed: number;
  } | null;
}

interface GqlChannelState {
  status: string | null;
  gameId: string | null;
  handNumber: number;
  phase: string | null;
  button: number | null;
  smallBlind: number;
  bigBlind: number;
  players: GqlPlayerInfo[];
  communityCards: GqlCardInfo[];
  pots: GqlPotInfo[];
  hands: { playerId: string; cards: GqlCardInfo[] }[];
  playerMeta: {
    id: string;
    ttsVoice: string | null;
    avatarUrl: string | null;
  }[];
}

// ── Session config ──────────────────────────────────────

const CHANNEL_KEY = "poker-stream-1";

const DEFAULT_CONFIG = {
  players: [
    {
      playerId: "agent-1",
      name: "Claude",
      modelId: "claude-sonnet-4-5-20250929",
      modelName: "Sonnet 4.5",
      provider: "anthropic",
      ttsVoice: "TX3LPaxmHKxFdv7VOQHJ", // Liam
    },
    {
      playerId: "agent-2",
      name: "ChatGPT",
      modelId: "gpt-5-mini",
      modelName: "5 Mini",
      provider: "openai",
      avatarUrl: "openai",
      ttsVoice: "t0jbNlBVZ17f02VDIeMI", // Jessica
    },
    {
      playerId: "agent-3",
      name: "Gemini",
      modelId: "gemini-2.5-flash",
      modelName: "2.5 Flash",
      provider: "google",
      avatarUrl: "google",
      ttsVoice: "EXAVITQu4vr4xnSDxMaL", // Sarah
    },
    {
      playerId: "agent-4",
      name: "Grok",
      modelId: "grok-3-mini-fast",
      modelName: "3 Mini",
      provider: "xai",
      avatarUrl: "xai",
      ttsVoice: "iP95p4xoKVk53GoZ742B", // Chris
    },
  ],
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  handsPerGame: 5,
};

// ── Timing ──────────────────────────────────────────────

const INSTRUCTION_DELAYS: Record<string, number> = {
  GAME_START: 1500,
  DEAL_HANDS: 2500,
  PLAYER_TURN: 500,
  PLAYER_ANALYSIS: 500,
  PLAYER_ACTION: 1500,
  DEAL_COMMUNITY: 1500,
  HAND_RESULT: 3000,
  LEADERBOARD: 2500,
  GAME_OVER: 1000,
};

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

// ── SSE subscription helper ─────────────────────────────

async function* sseSubscribe(
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
  onConnected?: () => void,
): AsyncGenerator<GqlInstruction> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`SSE subscribe failed: ${res.status} ${res.statusText}`);
  }

  // Signal that the SSE connection is established (client is registered server-side)
  onConnected?.();

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep incomplete last line in buffer
      buffer = lines.pop() ?? "";

      let eventType = "";
      let dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        } else if (line === "") {
          // End of event
          if (eventType === "next" && dataLines.length > 0) {
            const json = JSON.parse(dataLines.join("\n")) as {
              data?: { renderInstructions: GqlInstruction };
            };
            if (json.data?.renderInstructions) {
              yield json.data.renderInstructions;
            }
          } else if (eventType === "complete") {
            return;
          }
          eventType = "";
          dataLines = [];
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Channel state query helper ──────────────────────────

async function fetchChannelState(): Promise<GqlChannelState> {
  const result = await gqlFetch(GET_CHANNEL_STATE, {
    channelKey: CHANNEL_KEY,
  });
  return (result as { getChannelState: GqlChannelState }).getChannelState;
}

// Build display name map: "Claude" + "Sonnet 4.5" → "Claude Sonnet 4.5"
const DISPLAY_NAMES = new Map(
  DEFAULT_CONFIG.players.map((p) => [p.playerId, `${p.name} ${p.modelName}`]),
);

// ── Helpers ─────────────────────────────────────────────

function mapPots(gqlPots: GqlPotInfo[]): Pot[] {
  return gqlPots.map((p, i) => ({
    label: i === 0 ? "Main Pot" : `Side Pot ${i}`,
    amount: p.size,
  }));
}

function mapCard(c: GqlCardInfo): Card {
  return { rank: c.rank, suit: c.suit as Card["suit"] };
}

function mapPlayer(
  info: GqlPlayerInfo,
  button: number | null,
  existing?: Player,
): Player {
  return {
    id: info.id,
    name: DISPLAY_NAMES.get(info.id) ?? info.name,
    chips: info.chips,
    avatar: existing?.avatar ?? "",
    cards: existing?.cards ?? null,
    isDealer: info.seatIndex === button,
    isFolded: info.status === "FOLDED",
    isActive: existing?.isActive ?? false,
    isAllIn: info.status === "ALL_IN",
    lastAction: existing?.lastAction ?? null,
    currentBet: info.bet,
  };
}

function mapPlayers(
  infos: GqlPlayerInfo[],
  button: number | null,
  existingPlayers: Player[],
): Player[] {
  const existingMap = new Map(existingPlayers.map((p) => [p.id, p]));
  const sorted = [...infos].sort((a, b) => a.seatIndex - b.seatIndex);
  return sorted.map((info) =>
    mapPlayer(info, button, existingMap.get(info.id)),
  );
}

// ── Reducer ─────────────────────────────────────────────

type Action =
  | { type: "START"; channelKey: string }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }
  | { type: "INSTRUCTION"; instruction: GqlInstruction }
  | { type: "RECONNECT"; channelState: GqlChannelState }
  | { type: "SPEAK_START"; playerId: string }
  | { type: "SPEAK_END" };

const INITIAL_STATE: GameState = {
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
  error: null,
};

function reducer(state: GameState, action: Action): GameState {
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
      return { ...state, speakingPlayerId: action.playerId };

    case "SPEAK_END":
      return { ...state, speakingPlayerId: null };
  }
}

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
    error: null,
  };
}

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

// ── Hook ────────────────────────────────────────────────

export function useGameSession() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  /** Start SSE loop: subscribe, ack, and drain render queue. */
  const startSSELoop = useCallback(function startSSELoop(
    abort: AbortController,
    voiceMap: Map<string, string>,
    onConnected?: () => void,
  ) {
    let ttsGate: Promise<void> = Promise.resolve();

    // ── Visual render queue ────────────────────────────
    const renderQueue: GqlInstruction[] = [];
    let draining = false;

    function startDrain() {
      if (draining) return;
      draining = true;
      void (async () => {
        try {
          while (renderQueue.length > 0) {
            if (abort.signal.aborted) break;
            const inst = renderQueue.shift();
            if (!inst) continue;

            // Wait for in-flight TTS before showing analysis or action
            if (
              inst.type === "PLAYER_ANALYSIS" ||
              inst.type === "PLAYER_ACTION"
            ) {
              await ttsGate;
            }

            // Capture player metadata before dispatching
            if (inst.gameStart?.playerMeta) {
              for (const meta of inst.gameStart.playerMeta) {
                if (meta.ttsVoice) voiceMap.set(meta.id, meta.ttsVoice);
              }
            }

            dispatch({ type: "INSTRUCTION", instruction: inst });

            const pauseMs = INSTRUCTION_DELAYS[inst.type] ?? 1000;
            await delay(pauseMs, abort.signal);

            // Fire-and-forget TTS after dispatching analysis
            if (
              inst.type === "PLAYER_ANALYSIS" &&
              inst.playerAnalysis?.analysis
            ) {
              const { playerId, analysis } = inst.playerAnalysis;
              const voiceId = voiceMap.get(playerId) ?? "";
              dispatch({ type: "SPEAK_START", playerId });
              ttsGate = speakAnalysis(analysis, voiceId).then(
                () => dispatch({ type: "SPEAK_END" }),
                () => dispatch({ type: "SPEAK_END" }),
              );
            }
          }
        } finally {
          draining = false;
        }
      })();
    }

    // ── SSE consumer — acks immediately for pipelining ─
    void (async () => {
      try {
        for await (const instruction of sseSubscribe(
          RENDER_INSTRUCTIONS_SUB,
          { channelKey: CHANNEL_KEY },
          abort.signal,
          onConnected,
        )) {
          renderQueue.push(instruction);
          startDrain();

          // Ack immediately so the proctor can pipeline the
          // next LLM call while we render at our own pace.
          await gqlFetch(RENDER_COMPLETE_MUT, {
            channelKey: CHANNEL_KEY,
            instructionId: instruction.instructionId,
          });
        }

        // SSE stream ended normally — check if game is still running
        if (!abort.signal.aborted) {
          const cs = await fetchChannelState();
          if (cs.status === "RUNNING") {
            startSSELoop(abort, voiceMap);
          } else if (cs.status === "FINISHED") {
            dispatch({ type: "RECONNECT", channelState: cs });
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (abort.signal.aborted) return;

        // SSE dropped — attempt to reconnect
        console.warn("[useGameSession] SSE dropped, attempting reconnect…");
        try {
          await delay(1000, abort.signal);
          if (abort.signal.aborted) return;

          const cs = await fetchChannelState();
          if (cs.status === "RUNNING") {
            // Populate voice map from playerMeta
            for (const meta of cs.playerMeta) {
              if (meta.ttsVoice) voiceMap.set(meta.id, meta.ttsVoice);
            }
            dispatch({ type: "RECONNECT", channelState: cs });
            // Restart SSE loop
            startSSELoop(abort, voiceMap);
          } else if (cs.status === "FINISHED") {
            dispatch({ type: "RECONNECT", channelState: cs });
          } else {
            const message = err instanceof Error ? err.message : String(err);
            dispatch({ type: "ERROR", error: message });
          }
        } catch {
          const message = err instanceof Error ? err.message : String(err);
          dispatch({ type: "ERROR", error: message });
        }
      }
    })();
  }, []);

  const startGame = useCallback(async () => {
    dispatch({ type: "START", channelKey: CHANNEL_KEY });

    try {
      // Check for an existing running session
      const cs = await fetchChannelState();

      const abort = new AbortController();
      abortRef.current = abort;

      if (cs.status === "RUNNING" || cs.status === "FINISHED") {
        // ── Reconnect to existing session ──────────────
        const voiceMap = new Map<string, string>();
        for (const meta of cs.playerMeta) {
          if (meta.ttsVoice) voiceMap.set(meta.id, meta.ttsVoice);
        }
        dispatch({ type: "RECONNECT", channelState: cs });

        if (cs.status === "RUNNING") {
          startSSELoop(abort, voiceMap);
        }
        return;
      }

      // ── No session — create a new one ──────────────
      await gqlFetch(START_SESSION_MUT, {
        channelKey: CHANNEL_KEY,
        config: DEFAULT_CONFIG,
      });

      // Wait for SSE connection to be established before starting the game
      let resolveConnected: () => void = () => {};
      const connected = new Promise<void>((r) => {
        resolveConnected = r;
      });

      const voiceMap = new Map<string, string>();
      startSSELoop(abort, voiceMap, resolveConnected);

      // Wait for SSE connection, then start the orchestrator
      await connected;
      await gqlFetch(RUN_SESSION_MUT, { channelKey: CHANNEL_KEY });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "ERROR", error: message });
    }
  }, [startSSELoop]);

  const stopGame = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    try {
      await gqlFetch(STOP_SESSION_MUT, { channelKey: CHANNEL_KEY });
    } catch {
      // Ignore stop errors
    }
    dispatch({ type: "RESET" });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { state, startGame, stopGame };
}
