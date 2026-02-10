import { GAME_CONFIG, type GameConfig } from "../../game-config.js";
import type {
  ProctorGameState,
  RenderInstruction,
} from "../../gql/resolverTypes.js";
import { getChannelState as getChannelStateFromDb } from "../../persistence.js";

export interface SessionPlayer {
  id: string;
  name: string;
  chips: number;
  modelId: string;
  modelName: string;
  provider: string;
}

export interface GameStateSnapshot {
  phase: string;
  button: number | null;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    bet: number;
    status: string;
    seatIndex: number;
  }>;
  communityCards: Array<{ rank: string; suit: string }>;
  pots: Array<{ size: number; eligiblePlayerIds: string[] }>;
}

export interface Session {
  channelKey: string;
  config: GameConfig;
  gameId: string | null;
  status: "RUNNING" | "STOPPED" | "FINISHED";
  handNumber: number;
  button: number | null;
  players: SessionPlayer[];
  currentHands: Array<{
    playerId: string;
    cards: Array<{ rank: string; suit: string }>;
  }>;
  lastInstruction: RenderInstruction | null;
  lastGameState: GameStateSnapshot | null;
  abortController: AbortController;
}

const sessions = new Map<string, Session>();

export function createSession(
  channelKey: string,
  configOverride?: GameConfig,
): Session {
  const config = configOverride ?? GAME_CONFIG;
  const existing = sessions.get(channelKey);
  if (existing) {
    if (existing.status === "RUNNING") {
      throw new Error(`Session already running: ${channelKey}`);
    }
    existing.abortController.abort();
    sessions.delete(channelKey);
  }

  const players: SessionPlayer[] = config.players.map((p) => ({
    id: p.playerId,
    name: p.name,
    chips: config.startingChips,
    modelId: p.modelId,
    modelName: p.modelName,
    provider: p.provider,
  }));

  const session: Session = {
    channelKey,
    config,
    gameId: null,
    status: "RUNNING",
    handNumber: 0,
    button: null,
    players,
    currentHands: [],
    lastInstruction: null,
    lastGameState: null,
    abortController: new AbortController(),
  };

  sessions.set(channelKey, session);
  return session;
}

export function getSession(channelKey: string): Session | null {
  return sessions.get(channelKey) ?? null;
}

export function stopSession(channelKey: string): void {
  const session = sessions.get(channelKey);
  if (!session) throw new Error(`Session not found: ${channelKey}`);
  session.status = "STOPPED";
  session.abortController.abort();
}

export function deleteSession(channelKey: string): void {
  sessions.delete(channelKey);
}

export interface ConnectResult {
  moduleId: string;
  moduleType: string;
  gameState: ProctorGameState | null;
}

export function connect(channelKey: string): ConnectResult {
  const state = getChannelStateFromDb(channelKey);

  if (!state) {
    return {
      moduleId: "",
      moduleType: "poker",
      gameState: null,
    };
  }

  return {
    moduleId: state.moduleId,
    moduleType: "poker",
    gameState: state.stateSnapshot
      ? (JSON.parse(state.stateSnapshot) as ProctorGameState)
      : null,
  };
}

export function completeInstruction(
  _channelKey: string,
  _moduleId: string,
  _instructionId: string,
): boolean {
  // Channel state is now persisted by the emitter on every instruction.
  // This mutation is kept as a client ack signal for future back-pressure.
  return true;
}

export function _resetSessions(): void {
  for (const session of sessions.values()) {
    session.abortController.abort();
  }
  sessions.clear();
}
