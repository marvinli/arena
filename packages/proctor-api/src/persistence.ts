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

  CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
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

// ── Schema migrations (idempotent) ────────────────────────
try {
  db.exec("ALTER TABLE instructions ADD COLUMN state_snapshot TEXT");
} catch {
  /* column already exists */
}
try {
  db.exec("ALTER TABLE channel_state ADD COLUMN acked_instruction_ts INTEGER");
} catch {
  /* column already exists */
}

// ── Row types (match SQLite column names) ─────────────────

interface ModuleRow {
  module_id: string;
  type: string;
  prog_index: number;
  status: string;
  created_at: number;
}

interface InstructionRow {
  module_id: string;
  timestamp_ms: number;
  type: string;
  payload: string;
  state_snapshot: string | null;
}

interface ChannelStateRow {
  channel_key: string;
  module_id: string;
  instruction_ts: number | null;
  state_snapshot: string | null;
  acked_instruction_ts: number | null;
}

interface AgentMessageRow {
  module_id: string;
  player_id: string;
  role: string;
  content: string;
  seq: number;
}

interface MaxSeqRow {
  max_seq: number | null;
}

interface SettingRow {
  value: string;
}

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

const selectModuleStmt = db.prepare<[string], ModuleRow>(
  "SELECT module_id, type, prog_index, status, created_at FROM modules WHERE module_id = ?",
);

const completeModuleStmt = db.prepare(
  "UPDATE modules SET status = 'completed' WHERE module_id = ?",
);

function rowToModule(row: ModuleRow): Module {
  return {
    moduleId: row.module_id,
    type: row.type,
    progIndex: row.prog_index,
    status: row.status as "running" | "completed",
    createdAt: row.created_at,
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
  const row = selectModuleStmt.get(moduleId);
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
  "INSERT INTO instructions (module_id, timestamp_ms, type, payload, state_snapshot) VALUES (?, ?, ?, ?, ?)",
);

const selectInstructionsStmt = db.prepare<[string], InstructionRow>(
  "SELECT module_id, timestamp_ms, type, payload FROM instructions WHERE module_id = ? ORDER BY timestamp_ms",
);

const selectInstructionsAfterStmt = db.prepare<
  [string, number],
  InstructionRow
>(
  "SELECT module_id, timestamp_ms, type, payload FROM instructions WHERE module_id = ? AND timestamp_ms > ? ORDER BY timestamp_ms",
);

const selectLatestInstructionStmt = db.prepare<[string], InstructionRow>(
  "SELECT module_id, timestamp_ms, type, payload FROM instructions WHERE module_id = ? ORDER BY timestamp_ms DESC LIMIT 1",
);

function rowToInstruction(row: InstructionRow): Instruction {
  return {
    moduleId: row.module_id,
    timestampMs: row.timestamp_ms,
    type: row.type,
    payload: row.payload,
  };
}

export function insertInstruction(
  moduleId: string,
  timestampMs: number,
  type: string,
  payload: object,
  stateSnapshot: string | null = null,
): void {
  insertInstructionStmt.run(
    moduleId,
    timestampMs,
    type,
    JSON.stringify(payload),
    stateSnapshot,
  );
}

export function getInstructions(
  moduleId: string,
  afterTimestampMs?: number,
): Instruction[] {
  const rows =
    afterTimestampMs != null
      ? selectInstructionsAfterStmt.all(moduleId, afterTimestampMs)
      : selectInstructionsStmt.all(moduleId);
  return rows.map(rowToInstruction);
}

export function getLatestInstruction(
  moduleId: string,
): Instruction | undefined {
  const row = selectLatestInstructionStmt.get(moduleId);
  return row ? rowToInstruction(row) : undefined;
}

// ── Channel State ──────────────────────────────────────────

export interface ChannelState {
  channelKey: string;
  moduleId: string;
  instructionTs: number | null;
  stateSnapshot: string | null;
  ackedInstructionTs: number | null;
}

const selectChannelStateStmt = db.prepare<[string], ChannelStateRow>(
  "SELECT channel_key, module_id, instruction_ts, state_snapshot, acked_instruction_ts FROM channel_state WHERE channel_key = ?",
);

const upsertChannelStateStmt = db.prepare(`
  INSERT INTO channel_state (channel_key, module_id, instruction_ts, state_snapshot)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(channel_key) DO UPDATE SET
    module_id = excluded.module_id,
    instruction_ts = excluded.instruction_ts,
    state_snapshot = excluded.state_snapshot
`);

function rowToChannelState(row: ChannelStateRow): ChannelState {
  return {
    channelKey: row.channel_key,
    moduleId: row.module_id,
    instructionTs: row.instruction_ts,
    stateSnapshot: row.state_snapshot,
    ackedInstructionTs: row.acked_instruction_ts,
  };
}

export function getChannelState(channelKey: string): ChannelState | undefined {
  const row = selectChannelStateStmt.get(channelKey);
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

const ackInstructionStmt = db.prepare(
  "UPDATE channel_state SET acked_instruction_ts = ? WHERE channel_key = ?",
);

export function ackInstruction(
  channelKey: string,
  instructionTs: number,
): void {
  ackInstructionStmt.run(instructionTs, channelKey);
}

const selectInstructionSnapshotStmt = db.prepare<
  [string, number],
  { state_snapshot: string | null }
>(
  "SELECT state_snapshot FROM instructions WHERE module_id = ? AND timestamp_ms = ?",
);

export function getInstructionSnapshot(
  moduleId: string,
  timestampMs: number,
): string | null {
  const row = selectInstructionSnapshotStmt.get(moduleId, timestampMs);
  return row?.state_snapshot ?? null;
}

// ── Agent Messages ─────────────────────────────────────────

export interface AgentMessage {
  moduleId: string;
  playerId: string;
  role: string;
  content: string;
  seq: number;
}

const selectMaxSeqStmt = db.prepare<[string, string], MaxSeqRow>(
  "SELECT MAX(seq) AS max_seq FROM agent_messages WHERE module_id = ? AND player_id = ?",
);

const insertAgentMessageStmt = db.prepare(
  "INSERT INTO agent_messages (module_id, player_id, role, content, seq) VALUES (?, ?, ?, ?, ?)",
);

const selectAgentMessagesStmt = db.prepare<[string, string], AgentMessageRow>(
  "SELECT module_id, player_id, role, content, seq FROM agent_messages WHERE module_id = ? AND player_id = ? ORDER BY seq",
);

function rowToAgentMessage(row: AgentMessageRow): AgentMessage {
  return {
    moduleId: row.module_id,
    playerId: row.player_id,
    role: row.role,
    content: row.content,
    seq: row.seq,
  };
}

export function appendAgentMessage(
  moduleId: string,
  playerId: string,
  role: string,
  content: string,
): void {
  const row = selectMaxSeqStmt.get(moduleId, playerId);
  const nextSeq = row?.max_seq != null ? row.max_seq + 1 : 0;
  insertAgentMessageStmt.run(moduleId, playerId, role, content, nextSeq);
}

export function getAgentMessages(
  moduleId: string,
  playerId: string,
): AgentMessage[] {
  return selectAgentMessagesStmt.all(moduleId, playerId).map(rowToAgentMessage);
}

// ── Settings ──────────────────────────────────────────────

const selectSettingStmt = db.prepare<[string], SettingRow>(
  "SELECT value FROM settings WHERE key = ?",
);

const upsertSettingStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

export function getSetting(key: string): string | undefined {
  const row = selectSettingStmt.get(key);
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  upsertSettingStmt.run(key, value);
}
