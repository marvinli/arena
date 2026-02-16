import { createGameConfig, type GameConfig } from "../../game-config.js";
import type {
  ProctorGameState,
  RenderInstruction,
} from "../../gql/resolverTypes.js";
import {
  ackInstruction,
  getChannelState as getChannelStateFromDb,
  getInstructionSnapshot,
} from "../../persistence.js";
import { notifyAck } from "./ack-gate.js";

export interface SessionPlayer {
  id: string;
  name: string;
  chips: number;
  modelId: string;
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
  personaAssignments?: Map<string, string>;
  abortController: AbortController;
}

const sessions = new Map<string, Session>();

export function createSession(
  channelKey: string,
  configOverride?: GameConfig,
  chipOverrides?: Map<string, number>,
): Session {
  const config = configOverride ?? createGameConfig();

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
    chips: chipOverrides?.get(p.playerId) ?? config.startingChips,
    modelId: p.modelId,
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

export async function connect(channelKey: string): Promise<ConnectResult> {
  const state = await getChannelStateFromDb(channelKey);

  if (!state) {
    return {
      moduleId: "",
      moduleType: "poker",
      gameState: null,
    };
  }

  // Return the game state at the last acked instruction (not the latest emitted).
  // The SSE subscription replays unacked instructions after this point.
  let gameState: ProctorGameState | null = null;
  if (state.ackedInstructionTs != null) {
    const snapshot = await getInstructionSnapshot(
      state.moduleId,
      state.ackedInstructionTs,
    );
    if (snapshot) {
      try {
        gameState = JSON.parse(snapshot) as ProctorGameState;
      } catch (e) {
        console.warn(
          `[session-manager] Corrupt acked snapshot for ${channelKey}, ignoring: ${e}`,
        );
      }
    }
  }

  return {
    moduleId: state.moduleId,
    moduleType: "poker",
    gameState,
  };
}

export async function completeInstruction(
  channelKey: string,
  moduleId: string,
  instructionId: string,
): Promise<boolean> {
  await ackInstruction(channelKey, Number(instructionId));
  notifyAck(moduleId, instructionId);
  return true;
}

export function _resetSessions(): void {
  for (const session of sessions.values()) {
    session.abortController.abort();
  }
  sessions.clear();
}
