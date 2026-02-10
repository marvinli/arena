# Programming Loop

The proctor-api runs a continuous loop through a cyclical array of **modules**. Each module produces a sequence of **instructions** that drive the front-end renderer. The proctor runs the game to completion regardless of whether a client is connected. The system tracks each client's position via persistent **channel state** so the front-end can disconnect and resume at any time — no start button, no initialization handshake.

## Concepts

### Programming

A fixed array defined in code. Each entry specifies a module type. The loop is cyclical — after the last entry, it wraps to the first.

```typescript
const PROGRAMMING: ModuleType[] = ["poker"];
// Later: ["poker", "poker-leaderboard"]
// Eventually: ["poker", "poker-leaderboard", "trivia", ...]
```

Modules are created just-in-time when the loop advances to that slot — never ahead of time. This avoids wasted inference costs from pre-generating content that might never be viewed.

### Module

An instance of a programming entry. Has a **type** (e.g., `"poker"`) and a generated **moduleId** (e.g., `"mod_a1b2c3"`). Each module type maps to an engine under `src/services/games/` that knows how to initialize itself, run, and emit instructions.

Modules are stored in the local database.

### Instruction

A discrete, renderable unit emitted by a module. Each instruction has a composite primary key:

| Component | Type | Example | Description |
|-----------|------|---------|-------------|
| `module_id` | TEXT | `mod_a1b2c3` | Which module this belongs to |
| `timestamp_ms` | INTEGER | `1707580800000` | Millisecond timestamp when emitted |

Instructions are ordered by `timestamp_ms` within a module. Since the proctor emits instructions sequentially (each awaits the previous), millisecond collisions are not possible in practice.

All instructions are stored individually in the database. The existing instruction types apply: `GAME_START`, `DEAL_HANDS`, `DEAL_COMMUNITY`, `PLAYER_TURN`, `PLAYER_ANALYSIS`, `PLAYER_ACTION`, `HAND_RESULT`, `LEADERBOARD`, `GAME_OVER`.

The `instructionId` sent to the front-end is the `timestamp_ms` value as a string.

### Channel State

Per `channelKey` (which identifies the client), the proctor tracks the client's position:

| Field | Description |
|-------|-------------|
| `channel_key` | Identifies the client |
| `module_id` | Current module instance |
| `instruction_ts` | Timestamp of last completed instruction |
| `state_snapshot` | JSON snapshot of game state at that instruction |

This is a bookmark — a pointer into the instruction stream. The proctor does not wait for `completeInstruction` before advancing the game. It writes instructions to the DB and pushes them to connected clients via SSE independently. The bookmark just records how far the client has rendered, so it can resume from that point after a disconnect.

The snapshot is updated alongside the bookmark on each `completeInstruction` call. This avoids the need to replay instructions to reconstruct state on reconnect — the snapshot is always the front-end's visual state at its last completed instruction.

## Database Schema

```sql
CREATE TABLE modules (
  module_id     TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  prog_index    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running',  -- running | completed
  created_at    INTEGER NOT NULL                  -- epoch ms
);

CREATE TABLE instructions (
  module_id     TEXT NOT NULL REFERENCES modules(module_id),
  timestamp_ms  INTEGER NOT NULL,
  type          TEXT NOT NULL,                    -- instruction type enum
  payload       TEXT NOT NULL,                    -- JSON
  PRIMARY KEY (module_id, timestamp_ms)
);

CREATE TABLE channel_state (
  channel_key     TEXT PRIMARY KEY,
  module_id       TEXT NOT NULL REFERENCES modules(module_id),
  instruction_ts  INTEGER,                        -- null = module just started
  state_snapshot  TEXT                             -- JSON, null until first completeInstruction
);

CREATE TABLE agent_messages (
  module_id     TEXT NOT NULL REFERENCES modules(module_id),
  player_id     TEXT NOT NULL,
  role          TEXT NOT NULL,                    -- 'system' | 'user' | 'assistant' | 'tool'
  content       TEXT NOT NULL,                    -- JSON (message content)
  seq           INTEGER NOT NULL,                 -- ordering within this agent's conversation
  PRIMARY KEY (module_id, player_id, seq)
);
```

SQLite with WAL mode (already initialized in `db.ts`).

### Agent Conversation Persistence

The `agent_messages` table stores each agent's full conversation history. The agent runner appends messages as they occur — system prompts, injected game context, agent responses, tool calls and results. On proctor restart, the agent runner loads the conversation history from the DB and resumes with full context.

This enables cold-start recovery of a game mid-hand without losing agent reasoning history. Each agent picks up exactly where it left off, with the same accumulated knowledge of opponent behavior and game events.

## Session Flow

The front-end follows a three-step connection protocol: **connect → subscribe → startModule**. This separation eliminates race conditions where instructions could be published before the SSE subscriber exists.

### New Client (no channel state)

```
Front-end opens
            │
            ▼
  1. connect(channelKey) query
     → returns { moduleId: "", moduleType: "poker", gameState: null }
            │
            ▼
  2. Subscribe to SSE (renderInstructions subscription)
     → SSE connection established
            │
            ▼
  3. startModule(channelKey) mutation
     → creates session, starts programming loop
            │
            ▼
  Programming loop creates module from PROGRAMMING[0]:
    INSERT INTO modules ...
    INSERT INTO channel_state ...
            │
            ▼
  Begin emitting instructions
  Each instruction is written to DB and pushed to client via SSE
```

### Returning Client (channel state exists)

```
Front-end opens
            │
            ▼
  1. connect(channelKey) query
     → returns { moduleId: "mod-abc", moduleType: "poker",
                 gameState: <snapshot> }
            │
            ▼
  Front-end dispatches RECONNECT with gameState snapshot
            │
            ▼
  2. Subscribe to SSE (renderInstructions subscription)
     → SSE connection established
            │
            ▼
  3. startModule(channelKey) mutation
     → session already running? returns true (no-op)
     → session not running? starts programming loop
            │
            ▼
  Stream instructions from current game position
```

When the client reconnects, the proctor sends the snapshot (the client's last known visual state) and then streams instructions from the game's current position. If the game has moved far ahead, the client jumps to the present — it does not replay missed instructions. The `startModule` call is idempotent — if the game is already running, it's a no-op.

## Instruction Lifecycle

```
Module engine produces an event (deal, action, etc.)
                │
                ▼
  Build instruction with timestamp_ms
                │
                ├──────────────────────────────────┐
                ▼                                  ▼
  INSERT INTO instructions                Push to connected
  (module_id, timestamp_ms,               clients via SSE
   type, payload)                         (if any)
                                                   │
                                                   ▼
                                          Front-end renders
                                          (animations, TTS, etc.)
                                                   │
                                                   ▼
                                          completeInstruction(channelKey,
                                            moduleId, instructionId)
                                                   │
                                                   ▼
                                          UPDATE channel_state
                                            SET instruction_ts = ?,
                                                state_snapshot = ?
```

The proctor does **not** wait for `completeInstruction`. It writes the instruction to the DB and immediately continues the game loop. The front-end queues instructions and renders them in order at its own pace. `completeInstruction` only updates the client's bookmark.

## Module Transitions

When a module completes (e.g., poker game ends with `GAME_OVER`):

1. Mark module completed: `UPDATE modules SET status = 'completed' WHERE module_id = ?`
2. Advance: `nextIndex = (currentIndex + 1) % PROGRAMMING.length`
3. Create next module JIT: `INSERT INTO modules ...`
4. Initialize the new module and begin emitting instructions

There is a brief natural pause between modules (a few seconds while the new module initializes — creating the game, setting up agents). The front-end stays on its current state (e.g., `GAME_OVER` screen) until the first instruction from the new module arrives. No special handling is needed on the front-end — a `GAME_START` following a `GAME_OVER` is just the next instruction in the stream.

## Reconnection

### Client reconnects, proctor still running (common case)

1. Look up channel state → `state_snapshot` + `instruction_ts`
2. Send `state_snapshot` to front-end (same shape as today's `getChannelState`)
3. Front-end renders the snapshot and subscribes to SSE
4. Proctor streams instructions from the game's current position
5. Front-end processes new instructions normally through the reducer

The client may have missed many instructions while disconnected. It does not replay them — it jumps to the present via the snapshot and picks up the live stream. The snapshot is whatever state the client last acknowledged, which may be behind. If the proctor is mid-hand, the client gets the snapshot (which might show a previous hand) and then quickly receives the current instructions to catch up.

### Proctor was restarted (cold start)

1. Look up channel state → `(module_id, instruction_ts, state_snapshot)`
2. Load module from DB: `SELECT FROM modules WHERE module_id = ?`
3. If module was `running`:
   - Reconstruct game engine state from stored instructions
   - Load agent conversation histories from `agent_messages`
   - Resume the module from where it left off
4. If module was `completed`:
   - Advance to the next module in the programming array
5. Send `state_snapshot` (or fresh state if starting a new module) to client
6. Resume instruction flow

### Front-end behavior on reconnect

The front-end needs no special reconnection logic beyond what it already has:

1. Connect with channelKey (no config, no initialization payload)
2. Receive a state payload (same shape as current `getChannelState` response)
3. Initialize reducer from this state
4. Begin processing new instructions normally

The proctor computes what the front-end needs. The front-end just renders what it's given.

## API Changes

### New

```graphql
# Step 1: Front-end calls this on mount. Returns current state or empty state.
query connect(channelKey: String!): ChannelConnection!

type ChannelConnection {
  moduleId: String!             # "" if no prior state
  moduleType: String!
  gameState: ProctorGameState   # Snapshot for the reducer, null if first connect
}

# Step 3: Front-end calls this after SSE subscription is established.
# Idempotent — if session already running, returns true immediately.
mutation startModule(channelKey: String!): Boolean!
```

### Changed

```graphql
# Renamed from renderComplete. Now records bookmark in DB.
mutation completeInstruction(
  channelKey: String!
  moduleId: String!
  instructionId: String!        # timestamp_ms as string
): Boolean!
```

### Removed

- `startSession(channelKey, config)` — proctor manages module lifecycle
- `runSession(channelKey)` — replaced by `startModule`

### Unchanged

- SSE subscription for render instructions
- Instruction types and payloads
- `getChannelState(channelKey)` — still available, now backed by DB snapshot

## Front-End Changes

### Removed
- Start game button
- `startSession` / `runSession` calls
- Session configuration UI

### Simplified
- On mount: `connect(channelKey)` → subscribe SSE → `startModule(channelKey)` → process instructions
- `renderComplete(instructionId)` becomes `completeInstruction(channelKey, moduleId, instructionId)`

### Unchanged
- Render queue and animation gates
- TTS pipeline
- Reducer and instruction handlers
- SSE reconnection logic

## Key Design Decisions

**Why doesn't the proctor wait for `completeInstruction`?**
The proctor runs the game to completion regardless of client state. `completeInstruction` is a bookmark, not a synchronization point. This decouples the game loop from the renderer — the game runs at inference speed, the front-end renders at its own pace, and disconnected clients don't block game progress.

**Why store a snapshot on channel state instead of replaying instructions?**
Replaying instructions to derive state requires a server-side reducer per module type — duplicating front-end logic. A snapshot is simpler: the client's visual state is captured on each `completeInstruction` and returned verbatim on reconnect. One column, no replay logic, no divergence risk between server and client reducers.

**Why persist agent conversation history?**
Agent conversations are the most expensive artifact in the system — each message represents LLM inference time and cost. Losing them on proctor restart means agents lose all accumulated knowledge of opponent behavior, bluffing patterns, and hand history. Persisting conversations enables true cold-start recovery: the proctor restarts, loads conversations from the DB, and agents resume mid-game with full context.

**Why store every instruction in the DB?**
Instructions are the source of truth for what happened in a module. They enable game engine state reconstruction on cold start, provide a complete audit trail for debugging, and support future features (replay, highlights, stats). They're also needed to reconstruct the poker engine state on proctor restart — the snapshot only captures the front-end's visual state, not the engine's internal state.

**Why create modules just-in-time?**
Each module may trigger LLM inference (agent system prompts, initial decisions). Creating modules ahead of time wastes API calls on content that might never be viewed — e.g., if the proctor restarts or the programming array changes before reaching that slot.
