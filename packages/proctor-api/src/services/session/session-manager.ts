import { GAME_CONFIG, type GameConfig } from "../../game-config.js";
import type { RenderInstruction } from "../../gql/resolverTypes.js";

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
  connectedClients: Set<string>;
  hadClients: boolean;
  clientConnectResolver: (() => void) | null;
  pendingAcks: Map<string, Set<string>>;
  pendingAckResolvers: Map<string, () => void>;
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
    connectedClients: new Set(),
    hadClients: false,
    clientConnectResolver: null,
    pendingAcks: new Map(),
    pendingAckResolvers: new Map(),
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

export function registerClient(channelKey: string, clientId: string): void {
  const session = sessions.get(channelKey);
  if (!session) return;
  session.connectedClients.add(clientId);
  session.hadClients = true;

  // Wake the orchestrator if it paused waiting for a client reconnect
  if (session.clientConnectResolver) {
    const resolver = session.clientConnectResolver;
    session.clientConnectResolver = null;
    resolver();
  }
}

export function unregisterClient(channelKey: string, clientId: string): void {
  const session = sessions.get(channelKey);
  if (!session) return;
  session.connectedClients.delete(clientId);

  // Remove from any pending acks and check if instruction is now complete
  for (const [instructionId, clients] of session.pendingAcks) {
    clients.delete(clientId);
    if (clients.size === 0) {
      session.pendingAcks.delete(instructionId);
      const resolver = session.pendingAckResolvers.get(instructionId);
      if (resolver) {
        session.pendingAckResolvers.delete(instructionId);
        resolver();
      }
    }
  }
}

export function recordRenderComplete(
  channelKey: string,
  instructionId: string,
): void {
  const session = sessions.get(channelKey);
  if (!session) return;

  // Remove all clients for this instruction (any client can ack)
  const clients = session.pendingAcks.get(instructionId);
  if (!clients) return;

  // For simplicity: any renderComplete call from any source completes the instruction
  // In production, we'd track per-client acks
  session.pendingAcks.delete(instructionId);
  const resolver = session.pendingAckResolvers.get(instructionId);
  if (resolver) {
    session.pendingAckResolvers.delete(instructionId);
    resolver();
  }
}

const DEFAULT_ACK_TIMEOUT = 30_000;

export function waitForRenderComplete(
  channelKey: string,
  instructionId: string,
  signal: AbortSignal,
  timeout = DEFAULT_ACK_TIMEOUT,
): Promise<void> {
  const session = sessions.get(channelKey);
  if (!session) return Promise.resolve();

  // No connected clients
  if (session.connectedClients.size === 0) {
    if (!session.hadClients) {
      // Never had clients → auto-advance (CLI / headless mode)
      return Promise.resolve();
    }

    // Clients previously connected but all disconnected — pause orchestrator
    // and wait for a client to reconnect (or abort / timeout).
    return new Promise<void>((resolve) => {
      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        session.clientConnectResolver = null;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve();
      };

      const onAbort = () => cleanup();
      signal.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(cleanup, timeout);
      session.clientConnectResolver = cleanup;
    });
  }

  // Snapshot connected clients to avoid race with unregisterClient
  const clients = new Set(session.connectedClients);
  session.pendingAcks.set(instructionId, clients);

  return new Promise<void>((resolve) => {
    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      session.pendingAcks.delete(instructionId);
      session.pendingAckResolvers.delete(instructionId);
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };

    // Resolve on abort
    const onAbort = () => cleanup();
    signal.addEventListener("abort", onAbort, { once: true });

    // Timeout fallback
    const timer = setTimeout(cleanup, timeout);

    session.pendingAckResolvers.set(instructionId, () => {
      cleanup();
    });
  });
}

export function _resetSessions(): void {
  for (const session of sessions.values()) {
    session.abortController.abort();
  }
  sessions.clear();
}
