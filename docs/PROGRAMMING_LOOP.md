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

An instance of a programming entry. Has a **type** (e.g., `"poker"`) and a generated **moduleId** (a UUID via `crypto.randomUUID()`). Each module type maps to an engine under `src/services/games/` that knows how to initialize itself, run, and emit instructions.

Modules are stored in the local database.

### Instruction

A discrete, renderable unit emitted by a module. Each instruction has a composite primary key:

| Component | Type | Example | Description |
|-----------|------|---------|-------------|
| `module_id` | TEXT | `550e8400-...` | Which module this belongs to |
| `timestamp_ms` | INTEGER | `1707580800000` | Millisecond timestamp when emitted |

Instructions are ordered by `timestamp_ms` within a module. Since the proctor emits instructions sequentially (each awaits the previous), millisecond collisions are not possible in practice.

All instructions are stored individually in the database. The existing instruction types apply: `GAME_START`, `DEAL_HANDS`, `DEAL_COMMUNITY`, `PLAYER_TURN`, `PLAYER_ANALYSIS`, `PLAYER_ACTION`, `HAND_RESULT`, `LEADERBOARD`, `GAME_OVER`.

The `instructionId` sent to the front-end is the `timestamp_ms` value as a string.

### Channel State

Per `channelKey` (which identifies the client), the proctor tracks the client's position:

| Field | Description |
|-------|-------------|
| `channelKey` | Identifies the client (PK) |
| `moduleId` | Current module instance |
| `instructionTs` | Timestamp of last emitted instruction |
| `stateSnapshot` | JSON snapshot of game state at the last emitted instruction |
| `ackedInstructionTs` | Timestamp of last client-acked instruction |

The channel state tracks two positions: where the proctor has emitted to (`instructionTs` + `stateSnapshot`, updated on each `emit()`) and where the client has rendered to (`ackedInstructionTs`, updated on each `completeInstruction` call). The proctor does not wait for `completeInstruction` for most instructions. It writes instructions to the DB and pushes them to connected clients via SSE independently. The exceptions are `GAME_START` and `GAME_OVER` — the proctor gates on client ACKs for these instructions via `ack-gate.ts` to synchronize session boundaries.

On reconnect, the `connect` query returns the game state snapshot from the client's last acked instruction (not the latest emitted), so the front-end resumes from its actual rendering position.

## Database

All persistence uses **DynamoDB** (via `@aws-sdk/lib-dynamodb`). Table names are prefixed with `TABLE_PREFIX` (default `arena-`). The tables are:

| Table | Key | Description |
|---|---|---|
| `modules` | `moduleId` (PK) | Module instances (type, progIndex, status, createdAt) |
| `instructions` | `moduleId` (PK) + `timestampMs` (SK) | Render instructions with type, JSON payload, and stateSnapshot |
| `channel-state` | `channelKey` (PK) | Proctor bookmark (moduleId, instructionTs, stateSnapshot) + client ack position (ackedInstructionTs) |
| `agent-messages` | `pk` (PK, format: `moduleId#playerId`) + `seq` (SK) | Per-agent conversation history |
| `settings` | `key` (PK) | Key-value settings (e.g., live flag as `live:${channelKey}`) |

The `db.ts` module initializes the DynamoDB document client and exports table name constants. `persistence.ts` provides typed CRUD functions for all tables.

### Agent Conversation Persistence

The `agent-messages` table stores each agent's conversation history. The agent runner appends messages as they occur — injected game context (user messages), agent responses (assistant messages), and tool calls/results. System prompts are not stored (they are rebuilt from config on recovery). On proctor restart, the agent runner loads the conversation history from the DB and resumes with full context.

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
     → sets live flag to true, starts programming loop
            │
            ▼
  Programming loop creates module from PROGRAMMING[0]:
    persist module to DB
    persist channel state to DB
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
     → sets live flag to true
     → programming loop already active? returns immediately (no-op)
     → not active? starts programming loop (with orphan recovery)
            │
            ▼
  Stream instructions from current game position
```

When the client reconnects, `connect()` returns the game state snapshot at the client's last acked instruction. The client renders this snapshot, subscribes to SSE, then calls `startModule` which is idempotent — if the programming loop is already running, it returns immediately.

## Instruction Lifecycle

```
Module engine produces an event (deal, action, etc.)
                │
                ▼
  Build instruction with timestamp_ms
                │
                ├──────────────────────────────────┐
                ▼                                  ▼
  Persist instruction to DB               Push to connected
  (moduleId, timestampMs,                 clients via SSE
   type, payload, stateSnapshot)          (if any)
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
                                          Update ackedInstructionTs in DB
                                          Notify ack gate (for GAME_START/GAME_OVER)
```

The proctor does **not** wait for `completeInstruction` for most instructions. It writes the instruction (with a state snapshot) to the DB and immediately continues the game loop. The front-end queues instructions and renders them in order at its own pace. `completeInstruction` updates the client's acked position and notifies the ack gate. The proctor gates on ACKs for `GAME_START` and `GAME_OVER` to synchronize session boundaries.

## Module Transitions

When a module completes (e.g., poker game ends with `GAME_OVER`):

1. Mark module completed in DB
2. Advance: `nextIndex = (currentIndex + 1) % PROGRAMMING.length`
3. Create next module in DB
4. Initialize the new module and begin emitting instructions

There is a brief natural pause between modules (a few seconds while the new module initializes — creating the game, setting up agents). The front-end stays on its current state (e.g., `GAME_OVER` screen) until the first instruction from the new module arrives. No special handling is needed on the front-end — a `GAME_START` following a `GAME_OVER` is just the next instruction in the stream.

## Reconnection

### Client reconnects, proctor still running (common case)

1. `connect(channelKey)` → looks up channel state, returns snapshot from client's last acked instruction
2. Front-end renders the snapshot and subscribes to SSE
3. `startModule(channelKey)` → programming loop already active, returns immediately
4. SSE replays unacked instructions from the acked position, then streams live instructions
5. Front-end processes new instructions normally through the reducer

The client may have missed many instructions while disconnected. It does not replay them — it jumps to its last acked state via the snapshot and picks up the instruction stream from there.

### Proctor was restarted (cold start)

On startup, the proctor checks if the live flag is set. If so, it calls `runProgrammingLoop` which detects orphaned modules:

1. Look up channel state → `(moduleId, stateSnapshot)`
2. Load module from DB by `moduleId`
3. If module was `running`:
   - Parse player chip stacks and hand number from `stateSnapshot`
   - Create a new poker game with the recovered chip stacks
   - Load agent conversation histories from `agent_messages`
   - Resume the module from the recovered hand number
4. If module was `completed` or no orphaned module exists:
   - Start the normal programming loop from the next index
5. Send a new `GAME_START` instruction to the front-end
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

### Also Available

```graphql
query live(channelKey: String!): Boolean!
query getSession(channelKey: String!): Session

mutation setLive(channelKey: String!, live: Boolean!): Boolean!
mutation stopSession(channelKey: String!): Boolean!
mutation resetDatabase(channelKey: String!): Boolean!
```

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

**Why doesn't the proctor wait for `completeInstruction` on most instructions?**
The proctor runs the game without waiting for the front-end to acknowledge most instructions. This decouples the game loop from the renderer — the game runs at inference speed, the front-end renders at its own pace. The exceptions are `GAME_START` and `GAME_OVER`, where the proctor gates on client ACKs via `ack-gate.ts` to synchronize session boundaries (ensuring the front-end is ready before playing hands, and has rendered the game-over screen before starting the next module).

**Why store a snapshot with each instruction instead of replaying instructions?**
Replaying instructions to derive state requires a server-side reducer per module type — duplicating front-end logic. A snapshot is simpler: a full game state snapshot is saved alongside each instruction at emit time. On reconnect, `connect()` reads the snapshot from the instruction at the client's last acked position and returns it verbatim. No replay logic, no divergence risk between server and client reducers.

**Why persist agent conversation history?**
Agent conversations are the most expensive artifact in the system — each message represents LLM inference time and cost. Losing them on proctor restart means agents lose all accumulated knowledge of opponent behavior, bluffing patterns, and hand history. Persisting conversations enables true cold-start recovery: the proctor restarts, loads conversations from the DB, and agents resume mid-game with full context.

**Why store every instruction in the DB?**
Instructions are the source of truth for what happened in a module. They provide a complete audit trail for debugging and support future features (replay, highlights, stats). Each instruction stores a full game state snapshot alongside it, which enables reconnection at any point in the game.

**Why create modules just-in-time?**
Each module may trigger LLM inference (agent system prompts, initial decisions). Creating modules ahead of time wastes API calls on content that might never be viewed — e.g., if the proctor restarts or the programming array changes before reaching that slot.
