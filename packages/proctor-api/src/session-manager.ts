import type { RenderInstruction, SessionConfig } from "./gql/resolverTypes.js";

export interface SessionPlayer {
  id: string;
  name: string;
  chips: number;
  model: string;
}

export interface GameStateSnapshot {
  phase: string;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    status: string;
    seatIndex: number;
  }>;
  communityCards: Array<{ rank: string; suit: string }>;
  pots: Array<{ size: number; eligiblePlayerIds: string[] }>;
}

export interface Session {
  channelKey: string;
  config: SessionConfig;
  gameId: string | null;
  status: "RUNNING" | "STOPPED" | "FINISHED";
  handNumber: number;
  players: SessionPlayer[];
  lastInstruction: RenderInstruction | null;
  lastGameState: GameStateSnapshot | null;
  connectedClients: Set<string>;
  pendingAcks: Map<string, Set<string>>;
  pendingAckResolvers: Map<string, () => void>;
  abortController: AbortController;
}

const sessions = new Map<string, Session>();

export function createSession(
  channelKey: string,
  config: SessionConfig,
): Session {
  if (sessions.has(channelKey)) {
    throw new Error(`Session already exists: ${channelKey}`);
  }

  const players: SessionPlayer[] = config.players.map((p) => ({
    id: p.playerId,
    name: p.name,
    chips: config.startingChips,
    model: p.model,
  }));

  const session: Session = {
    channelKey,
    config,
    gameId: null,
    status: "RUNNING",
    handNumber: 0,
    players,
    lastInstruction: null,
    lastGameState: null,
    connectedClients: new Set(),
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

export function registerClient(channelKey: string, clientId: string): void {
  const session = sessions.get(channelKey);
  if (!session) return;
  session.connectedClients.add(clientId);
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

  // No connected clients → auto-advance (CLI mode)
  if (session.connectedClients.size === 0) {
    return Promise.resolve();
  }

  // Register pending acks for all connected clients
  session.pendingAcks.set(instructionId, new Set(session.connectedClients));

  return new Promise<void>((resolve) => {
    const cleanup = () => {
      session.pendingAcks.delete(instructionId);
      session.pendingAckResolvers.delete(instructionId);
      resolve();
    };

    // Resolve on abort
    const onAbort = () => cleanup();
    signal.addEventListener("abort", onAbort, { once: true });

    // Timeout fallback
    const timer = setTimeout(cleanup, timeout);

    session.pendingAckResolvers.set(instructionId, () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    });
  });
}

export function _resetSessions(): void {
  for (const session of sessions.values()) {
    session.abortController.abort();
  }
  sessions.clear();
}
