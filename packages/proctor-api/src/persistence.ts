import db from "./db.js";

// ── Schema initialization ──────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS modules (
    module_id     TEXT PRIMARY KEY,
    type          TEXT NOT NULL,
    prog_index    INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'running',
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS instructions (
    module_id     TEXT NOT NULL REFERENCES modules(module_id),
    timestamp_ms  INTEGER NOT NULL,
    type          TEXT NOT NULL,
    payload       TEXT NOT NULL,
    PRIMARY KEY (module_id, timestamp_ms)
  );

  CREATE TABLE IF NOT EXISTS channel_state (
    channel_key     TEXT PRIMARY KEY,
    module_id       TEXT NOT NULL REFERENCES modules(module_id),
    instruction_ts  INTEGER,
    state_snapshot  TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_messages (
    module_id     TEXT NOT NULL REFERENCES modules(module_id),
    player_id     TEXT NOT NULL,
    role          TEXT NOT NULL,
    content       TEXT NOT NULL,
    seq           INTEGER NOT NULL,
    PRIMARY KEY (module_id, player_id, seq)
  );
`);

// ── Modules ────────────────────────────────────────────────

export interface Module {
  moduleId: string;
  type: string;
  progIndex: number;
  status: "running" | "completed";
  createdAt: number;
}

const insertModuleStmt = db.prepare(
  "INSERT INTO modules (module_id, type, prog_index, status, created_at) VALUES (?, ?, ?, 'running', ?)",
);

const selectModuleStmt = db.prepare(
  "SELECT module_id, type, prog_index, status, created_at FROM modules WHERE module_id = ?",
);

const completeModuleStmt = db.prepare(
  "UPDATE modules SET status = 'completed' WHERE module_id = ?",
);

function rowToModule(row: Record<string, unknown>): Module {
  return {
    moduleId: row.module_id as string,
    type: row.type as string,
    progIndex: row.prog_index as number,
    status: row.status as "running" | "completed",
    createdAt: row.created_at as number,
  };
}

export function createModule(
  moduleId: string,
  type: string,
  progIndex: number,
): Module {
  const createdAt = Date.now();
  insertModuleStmt.run(moduleId, type, progIndex, createdAt);
  return { moduleId, type, progIndex, status: "running", createdAt };
}

export function getModule(moduleId: string): Module | undefined {
  const row = selectModuleStmt.get(moduleId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToModule(row) : undefined;
}

export function completeModule(moduleId: string): void {
  completeModuleStmt.run(moduleId);
}

// ── Instructions ───────────────────────────────────────────

export interface Instruction {
  moduleId: string;
  timestampMs: number;
  type: string;
  payload: string;
}

const insertInstructionStmt = db.prepare(
  "INSERT INTO instructions (module_id, timestamp_ms, type, payload) VALUES (?, ?, ?, ?)",
);

const selectInstructionsStmt = db.prepare(
  "SELECT module_id, timestamp_ms, type, payload FROM instructions WHERE module_id = ? ORDER BY timestamp_ms",
);

const selectInstructionsAfterStmt = db.prepare(
  "SELECT module_id, timestamp_ms, type, payload FROM instructions WHERE module_id = ? AND timestamp_ms > ? ORDER BY timestamp_ms",
);

const selectLatestInstructionStmt = db.prepare(
  "SELECT module_id, timestamp_ms, type, payload FROM instructions WHERE module_id = ? ORDER BY timestamp_ms DESC LIMIT 1",
);

function rowToInstruction(row: Record<string, unknown>): Instruction {
  return {
    moduleId: row.module_id as string,
    timestampMs: row.timestamp_ms as number,
    type: row.type as string,
    payload: row.payload as string,
  };
}

export function insertInstruction(
  moduleId: string,
  timestampMs: number,
  type: string,
  payload: object,
): void {
  insertInstructionStmt.run(
    moduleId,
    timestampMs,
    type,
    JSON.stringify(payload),
  );
}

export function getInstructions(
  moduleId: string,
  afterTimestampMs?: number,
): Instruction[] {
  const rows = (
    afterTimestampMs != null
      ? selectInstructionsAfterStmt.all(moduleId, afterTimestampMs)
      : selectInstructionsStmt.all(moduleId)
  ) as Record<string, unknown>[];
  return rows.map(rowToInstruction);
}

export function getLatestInstruction(
  moduleId: string,
): Instruction | undefined {
  const row = selectLatestInstructionStmt.get(moduleId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToInstruction(row) : undefined;
}

// ── Channel State ──────────────────────────────────────────

export interface ChannelState {
  channelKey: string;
  moduleId: string;
  instructionTs: number | null;
  stateSnapshot: string | null;
}

const selectChannelStateStmt = db.prepare(
  "SELECT channel_key, module_id, instruction_ts, state_snapshot FROM channel_state WHERE channel_key = ?",
);

const upsertChannelStateStmt = db.prepare(`
  INSERT INTO channel_state (channel_key, module_id, instruction_ts, state_snapshot)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(channel_key) DO UPDATE SET
    module_id = excluded.module_id,
    instruction_ts = excluded.instruction_ts,
    state_snapshot = excluded.state_snapshot
`);

function rowToChannelState(row: Record<string, unknown>): ChannelState {
  return {
    channelKey: row.channel_key as string,
    moduleId: row.module_id as string,
    instructionTs: row.instruction_ts as number | null,
    stateSnapshot: row.state_snapshot as string | null,
  };
}

export function getChannelState(channelKey: string): ChannelState | undefined {
  const row = selectChannelStateStmt.get(channelKey) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToChannelState(row) : undefined;
}

export function upsertChannelState(
  channelKey: string,
  moduleId: string,
  instructionTs: number | null = null,
  stateSnapshot: string | null = null,
): void {
  upsertChannelStateStmt.run(
    channelKey,
    moduleId,
    instructionTs,
    stateSnapshot,
  );
}

// ── Agent Messages ─────────────────────────────────────────

export interface AgentMessage {
  moduleId: string;
  playerId: string;
  role: string;
  content: string;
  seq: number;
}

const selectMaxSeqStmt = db.prepare(
  "SELECT MAX(seq) AS max_seq FROM agent_messages WHERE module_id = ? AND player_id = ?",
);

const insertAgentMessageStmt = db.prepare(
  "INSERT INTO agent_messages (module_id, player_id, role, content, seq) VALUES (?, ?, ?, ?, ?)",
);

const selectAgentMessagesStmt = db.prepare(
  "SELECT module_id, player_id, role, content, seq FROM agent_messages WHERE module_id = ? AND player_id = ? ORDER BY seq",
);

function rowToAgentMessage(row: Record<string, unknown>): AgentMessage {
  return {
    moduleId: row.module_id as string,
    playerId: row.player_id as string,
    role: row.role as string,
    content: row.content as string,
    seq: row.seq as number,
  };
}

export function appendAgentMessage(
  moduleId: string,
  playerId: string,
  role: string,
  content: string,
): void {
  const row = selectMaxSeqStmt.get(moduleId, playerId) as {
    max_seq: number | null;
  };
  const nextSeq = row.max_seq != null ? row.max_seq + 1 : 0;
  insertAgentMessageStmt.run(moduleId, playerId, role, content, nextSeq);
}

export function getAgentMessages(
  moduleId: string,
  playerId: string,
): AgentMessage[] {
  const rows = selectAgentMessagesStmt.all(moduleId, playerId) as Record<
    string,
    unknown
  >[];
  return rows.map(rowToAgentMessage);
}
