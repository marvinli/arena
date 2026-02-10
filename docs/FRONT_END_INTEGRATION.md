# Front-End Integration Guide

The front-end is a renderer. It has no game logic. It subscribes to a stream of render instructions from the proctor-api, renders each one (animations, TTS, scene transitions), and acknowledges completion. The proctor waits for the acknowledgment before sending the next instruction.

## Connection Overview

```
Front-End                          Proctor API (port 4001)
   |                                      |
   |-- mutate startSession ------------->|  (create session)
   |<----- session info ------------------|
   |                                      |
   |== subscribe renderInstructions ====>|  (open SSE channel, registers client)
   |                                      |
   |-- mutate runSession ---------------->|  (start orchestrator game loop)
   |                                      |
   |<==== RenderInstruction =============|  (proctor pushes instruction)
   |                                      |
   | (render animation, TTS, etc.)        |
   |                                      |
   |-- mutate renderComplete ----------->|  (signal done rendering)
   |                                      |
   |<==== next RenderInstruction ========|  (proctor sends next)
   |          ...                         |
```

The GraphQL endpoint is `http://localhost:4001/graphql` for queries/mutations. Subscriptions use SSE (Server-Sent Events) over the same endpoint with `Accept: text/event-stream`.

---

## Step 1: Start a Session

Create the session before subscribing, so the server is ready when the subscription connects. Game configuration (players, blinds, chips) lives server-side in `game-config.ts` — the front-end only provides a channel key.

```graphql
mutation StartSession($channelKey: String!) {
  startSession(channelKey: $channelKey) {
    channelKey
    status
  }
}
```

```json
{
  "channelKey": "poker-stream-1"
}
```

---

## Step 2: Subscribe to Render Instructions

Open an SSE subscription to receive instructions as the game progresses. The subscription registers the client on the server — the proctor won't advance until all connected clients have acknowledged each instruction.

```graphql
subscription RenderInstructions($channelKey: String!) {
  renderInstructions(channelKey: $channelKey) {
    instructionId
    type
    timestamp

    gameStart {
      gameId
      players { id name chips bet status seatIndex }
      playerMeta { id ttsVoice avatarUrl }
      smallBlind
      bigBlind
    }

    dealHands {
      handNumber
      players { id name chips bet status seatIndex }
      hands { playerId cards { rank suit } }
      button
      pots { size eligiblePlayerIds }
    }

    dealCommunity {
      phase
      communityCards { rank suit }
      pots { size eligiblePlayerIds }
    }

    playerTurn {
      playerId
      playerName
    }

    playerAnalysis {
      playerId
      playerName
      analysis
      isApiError
    }

    playerAction {
      playerId
      playerName
      action
      amount
      pots { size eligiblePlayerIds }
      players { id name chips bet status seatIndex }
    }

    handResult {
      winners { playerId amount hand }
      pots { size eligiblePlayerIds }
      players { id name chips bet status seatIndex }
      communityCards { rank suit }
    }

    leaderboard {
      players { id name chips bet status seatIndex }
      handsPlayed
    }

    gameOver {
      winnerId
      winnerName
      players { id name chips bet status seatIndex }
      handsPlayed
    }
  }
}
```

---

## Step 3: Start the Game Loop

After the subscription is connected, call `runSession` to start the orchestrator. This ensures the front-end is listening before any instructions are emitted.

```graphql
mutation RunSession($channelKey: String!) {
  runSession(channelKey: $channelKey)
}
```

---

## Step 4: Acknowledge Each Instruction

After rendering an instruction (animations complete, TTS finished), call `renderComplete`. The proctor blocks until all connected clients acknowledge before sending the next instruction.

```graphql
mutation RenderComplete($channelKey: String!, $instructionId: ID!) {
  renderComplete(channelKey: $channelKey, instructionId: $instructionId)
}
```

If the front-end doesn't acknowledge within 30 seconds, the proctor auto-advances. Reliable acknowledgment prevents the game from stalling.

---

## Step 5: Stop a Session

```graphql
mutation StopSession($channelKey: String!) {
  stopSession(channelKey: $channelKey)
}
```

### Get Session Status

```graphql
query GetSession($channelKey: String!) {
  getSession(channelKey: $channelKey) {
    channelKey
    gameId
    status
    handNumber
    players { id name chips modelId modelName provider }
  }
}
```

`status` is one of: `RUNNING`, `STOPPED`, `FINISHED`.

---

## Instruction Types Reference

Each `RenderInstruction` has exactly one non-null payload field matching its `type`. The front-end should dispatch on `type` and read the corresponding payload.

### GAME_START

Emitted once when the session begins.

| Field | Type | Description |
|---|---|---|
| `gameId` | `ID!` | Unique game identifier |
| `players` | `[PlayerInfo!]!` | All players with starting chips |
| `playerMeta` | `[PlayerMeta!]!` | Per-player metadata (ttsVoice, avatarUrl) |
| `smallBlind` | `Int!` | Small blind amount |
| `bigBlind` | `Int!` | Big blind amount |

`playerMeta` contains `{ id, ttsVoice, avatarUrl }` for each player. Store the voice IDs and avatar URLs on connect — they're used for TTS during `PLAYER_ANALYSIS` and for rendering player avatars.

**Render:** Display the table, seat all players with their avatars, show starting chip counts and blind structure.

### DEAL_HANDS

Emitted at the start of each hand.

| Field | Type | Description |
|---|---|---|
| `handNumber` | `Int!` | Current hand number (1-based) |
| `players` | `[PlayerInfo!]!` | Player states for this hand |
| `hands` | `[PlayerHand!]!` | Hole cards for every player |
| `button` | `Int` | Seat index of the dealer button |
| `pots` | `[PotInfo!]!` | Initial pot (blinds posted) |

`hands` contains the hole cards for **all** players. The front-end should show card backs for all players during the deal animation. Hole cards are only revealed at showdown (see `HAND_RESULT`).

Each `PlayerHand` has:
- `playerId: ID!` — which player
- `cards: [CardInfo!]!` — exactly 2 cards

**Render:** Animate dealing two cards face-down to each player. Show the dealer button. Display the pot with blinds posted.

### DEAL_COMMUNITY

Emitted when community cards are dealt (flop, turn, river).

| Field | Type | Description |
|---|---|---|
| `phase` | `String!` | `"FLOP"`, `"TURN"`, or `"RIVER"` |
| `communityCards` | `[CardInfo!]!` | All community cards dealt so far |
| `pots` | `[PotInfo!]!` | Current pot state |

Card counts by phase:
- **FLOP**: 3 cards
- **TURN**: 4 cards
- **RIVER**: 5 cards

**Render:** Animate dealing the new community cards. For flop, deal 3 cards. For turn and river, deal 1 card (the new card is the last in the array).

### PLAYER_TURN

Emitted when a player is about to act.

| Field | Type | Description |
|---|---|---|
| `playerId` | `ID!` | Who is about to act |
| `playerName` | `String!` | Display name |

**Render:** Highlight the active player's seat. This is a brief instruction — just visual emphasis.

### PLAYER_ANALYSIS

Emitted when a player has analysis (audience-facing commentary). Only emitted if the agent produced analysis text.

| Field | Type | Description |
|---|---|---|
| `playerId` | `ID!` | Who is speaking |
| `playerName` | `String!` | Display name |
| `analysis` | `String!` | Audience-facing commentary |
| `isApiError` | `Boolean!` | Whether the analysis was generated due to an API error (e.g., agent LLM call failed) |

**Render:** Display the analysis text (e.g., in a speech bubble). Convert to speech using the player's `ttsVoice` (from `GAME_START` `playerMeta`) via OpenAI TTS. The front-end can fire-and-forget the TTS and ack immediately — this lets the proctor pipeline the next instruction while audio plays. If `isApiError` is true, display an error indicator.

### PLAYER_ACTION

Emitted when a player acts. Always follows `PLAYER_TURN` (and optionally `PLAYER_ANALYSIS`).

| Field | Type | Description |
|---|---|---|
| `playerId` | `ID!` | Who acted |
| `playerName` | `String!` | Display name |
| `action` | `String!` | `"FOLD"`, `"CHECK"`, `"CALL"`, `"BET"`, or `"RAISE"` |
| `amount` | `Int` | Chip amount (null for fold/check) |
| `pots` | `[PotInfo!]!` | Updated pot state |
| `players` | `[PlayerInfo!]!` | Updated player states |

**Render:** Show the action label ("Alice raises to 200"), animate chips, update pot and player states.

### HAND_RESULT

Emitted when a hand completes (showdown or fold-to-win).

| Field | Type | Description |
|---|---|---|
| `winners` | `[WinnerInfo!]!` | Winner(s) with amounts and hand names |
| `pots` | `[PotInfo!]!` | Final pot state |
| `players` | `[PlayerInfo!]!` | Updated chip counts after payout |
| `communityCards` | `[CardInfo!]!` | All 5 community cards (or fewer if fold-out) |

Each `WinnerInfo` has:
- `playerId: ID!` — who won
- `amount: Int!` — chips won
- `hand: String` — hand name (e.g., `"PAIR"`, `"FLUSH"`, `"STRAIGHT"`) or null for fold wins

**Render:** Reveal all players' hole cards (from the `DEAL_HANDS` data stored earlier). Highlight the winning hand. Animate chips moving to the winner. Show updated chip counts.

### LEADERBOARD

Emitted between hands.

| Field | Type | Description |
|---|---|---|
| `players` | `[PlayerInfo!]!` | All players sorted by chips |
| `handsPlayed` | `Int!` | Total hands completed |

**Render:** Show standings, chip leader, any eliminations. Transition screen between hands.

### GAME_OVER

Emitted once when the game ends.

| Field | Type | Description |
|---|---|---|
| `winnerId` | `ID!` | Winner's player ID |
| `winnerName` | `String!` | Winner's display name |
| `players` | `[PlayerInfo!]!` | Final standings |
| `handsPlayed` | `Int!` | Total hands played |

**Render:** Victory screen, final standings, game statistics.

---

## Shared Types

### PlayerInfo

Present in most instruction payloads. Represents a player's current state.

```typescript
{
  id: string        // Unique player ID
  name: string      // Display name
  chips: number     // Current chip count
  bet: number       // Current bet in this round
  status: string    // "ACTIVE" | "FOLDED" | "ALL_IN" | "BUSTED"
  seatIndex: number // 0-based seat position
}
```

### PlayerMeta

Per-player metadata, included in `GAME_START`. Store these for the duration of the game.

```typescript
{
  id: string            // Player ID
  ttsVoice: string      // OpenAI TTS voice name (nullable)
  avatarUrl: string     // Avatar key or image URL (nullable)
}
```

### CardInfo

```typescript
{
  rank: string  // "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"
  suit: string  // "clubs", "diamonds", "hearts", "spades"
}
```

Suits are always full lowercase words, not symbols or abbreviations.

### PotInfo

```typescript
{
  size: number                // Total chips in pot
  eligiblePlayerIds: string[] // Players who can win this pot
}
```

Multiple pots occur with side pots (when a player is all-in for less than the full bet).

---

## Instruction Lifecycle

The sequence of instructions for a typical game:

```
GAME_START
  │
  ├── DEAL_HANDS (hand #1)
  │     ├── PLAYER_TURN (player about to act)
  │     ├── PLAYER_ANALYSIS (optional — if agent has commentary)
  │     ├── PLAYER_ACTION (player acts)
  │     ├── PLAYER_TURN (next player)
  │     ├── PLAYER_ACTION (next player acts, no analysis)
  │     ├── ...
  │     ├── DEAL_COMMUNITY (FLOP)
  │     ├── PLAYER_TURN ...
  │     ├── PLAYER_ANALYSIS ...
  │     ├── PLAYER_ACTION ...
  │     ├── DEAL_COMMUNITY (TURN)
  │     ├── PLAYER_TURN ...
  │     ├── PLAYER_ACTION ...
  │     ├── DEAL_COMMUNITY (RIVER)
  │     ├── PLAYER_TURN ...
  │     ├── PLAYER_ACTION ...
  │     └── HAND_RESULT
  │
  ├── LEADERBOARD
  │
  ├── DEAL_HANDS (hand #2)
  │     ├── ...
  │     └── HAND_RESULT
  │
  ├── LEADERBOARD
  │
  ├── ... (more hands)
  │
  └── GAME_OVER
```

If all but one player folds before the river, the hand skips directly from the last `PLAYER_ACTION` to `HAND_RESULT` (no remaining `DEAL_COMMUNITY` instructions).

---

## Front-End State Model

The front-end should maintain local state derived from instructions. Here's a recommended model:

```typescript
interface GameState {
  status: "idle" | "connecting" | "running" | "finished" | "error";
  channelKey: string | null;
  gameId: string | null;
  handNumber: number;
  phase: "WAITING" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
  smallBlind: number;
  bigBlind: number;
  button: number | null;             // seat index of dealer
  players: UIPlayer[];
  communityCards: CardInfo[];
  pots: PotInfo[];
  holeCards: Map<string, [CardInfo, CardInfo]>;  // stored from DEAL_HANDS, revealed at HAND_RESULT
  speakingPlayerId: string | null;    // who is currently speaking via TTS
  error: string | null;
}

interface UIPlayer {
  id: string;
  name: string;
  chips: number;
  avatar: string;                     // from GAME_START playerMeta
  cards: [CardInfo, CardInfo] | null; // shown face-down during play, revealed at showdown
  isDealer: boolean;
  isFolded: boolean;
  isActive: boolean;                  // highlighted during PLAYER_TURN
  isAllIn: boolean;
  lastAction: string | null;          // "FOLD", "CALL", "RAISE", etc.
  currentBet: number;                 // from PlayerInfo.bet
}
```

### State Updates by Instruction Type

| Instruction | State Updates |
|---|---|
| `GAME_START` | Set `gameId`, `smallBlind`, `bigBlind`. Populate `players` with avatars from `playerMeta`. Store voice IDs for TTS. |
| `DEAL_HANDS` | Set `handNumber`, `button`. Store each player's `holeCards` (from `hands`). Update `players` from payload. Set `phase` to `"PREFLOP"`. Reset `lastAction` and `currentBet` for all players. |
| `DEAL_COMMUNITY` | Set `phase` from payload. Update `communityCards`. Update `pots`. Reset `lastAction` and `currentBet` for all players (new betting round). |
| `PLAYER_TURN` | Set `isActive` true for the acting player, false for all others. |
| `PLAYER_ANALYSIS` | Set `speakingPlayerId`. Trigger TTS. If `isApiError`, show error indicator. (State update is minimal — TTS is a side effect.) |
| `PLAYER_ACTION` | Update the acting player's `lastAction`, `status`, `chips`, `currentBet`. Update `pots`. Set `isActive` false. |
| `HAND_RESULT` | Set `phase` to `"SHOWDOWN"`. Reveal all `holeCards`. Update `players` chip counts. |
| `LEADERBOARD` | Update all player chip counts. Set `phase` to `"WAITING"`. Clear `communityCards`, `pots`, `holeCards`. |
| `GAME_OVER` | Set `status` to `"finished"`. Final standings. |

---

## TTS Integration

When a `PLAYER_ANALYSIS` instruction arrives, convert the analysis text to speech using the player's `ttsVoice` (from `GAME_START` `playerMeta`) via OpenAI TTS. The implementation streams raw PCM audio and pipes it directly to Web Audio API for low-latency playback.

```typescript
async function speakOpenAI(text: string, voice: string): Promise<void> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      response_format: "pcm",
    }),
  });

  if (!res.ok || !res.body) return;

  const ctx = new AudioContext({ sampleRate: 24000 });
  const reader = res.body.getReader();
  // Stream PCM chunks → Float32 → AudioBufferSource → scheduled playback
  // See src/tts.ts for full implementation
}
```

The rendering flow for a player turn:

1. Receive `PLAYER_TURN` → highlight player seat → ack
2. Receive `PLAYER_ANALYSIS` → display text, fire-and-forget TTS → ack (TTS plays in background)
3. Receive `PLAYER_ACTION` → animate action → ack

---

## Multiple Clients

Multiple front-end instances can subscribe to the same `channelKey`. The proctor tracks all connected clients and waits for **every** client to call `renderComplete` before advancing. If a client disconnects, it's automatically removed from the pending acknowledgments.

This enables:
- Multiple display screens showing the same game
- A control panel running alongside the main renderer
- Spectator views

---

## Reconnection

If the front-end disconnects and reconnects:

1. Call `getChannelState(channelKey)` to get the current scene
2. Render the current state (players, chips, community cards, pots)
3. Re-subscribe to `renderInstructions(channelKey)`
4. Continue processing instructions from where the game is now

The `lastInstruction` field in `getChannelState` tells you what was last emitted, which can help determine if an acknowledgment was missed.

### getChannelState Query

```graphql
query GetChannelState($channelKey: String!) {
  getChannelState(channelKey: $channelKey) {
    status
    gameId
    handNumber
    phase
    button
    smallBlind
    bigBlind
    players { id name chips bet status seatIndex }
    communityCards { rank suit }
    pots { size eligiblePlayerIds }
    hands { playerId cards { rank suit } }
    playerMeta { id ttsVoice avatarUrl }
  }
}
```

The `hands` and `playerMeta` fields allow the front-end to reconstruct hole cards and voice/avatar maps on reconnect without needing a separate `GAME_START` instruction.

---

## GraphQL Client Setup

The front-end uses a simple fetch-based GraphQL client. Subscriptions use SSE (Server-Sent Events) — no WebSocket library required.

```typescript
// Queries and mutations — simple fetch
async function gqlFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// Subscriptions — SSE
async function* sseSubscribe(
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
): AsyncGenerator<any> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Parse SSE events (event: next, data: {...})
    // yield parsed instruction data
  }
}
```

The Vite dev server proxies `/graphql` to `http://localhost:4001`, so no CORS configuration is needed.

---

## Error Handling

- **Agent timeout/failure**: The proctor auto-folds for the agent. The front-end still receives normal `PLAYER_TURN` + `PLAYER_ACTION` with `action: "FOLD"`. No special handling needed.
- **renderComplete timeout**: If the front-end doesn't acknowledge within 30 seconds, the proctor auto-advances. The front-end may miss instructions if it's too slow.
- **Session not found**: `getChannelState` and `getSession` return null or throw if the channel key doesn't exist.
- **Subscription disconnect**: Re-subscribe and call `getChannelState` to catch up.

---

## Quick Reference

### Enums

| Enum | Values |
|---|---|
| `InstructionType` | `GAME_START`, `DEAL_HANDS`, `DEAL_COMMUNITY`, `PLAYER_TURN`, `PLAYER_ANALYSIS`, `PLAYER_ACTION`, `HAND_RESULT`, `LEADERBOARD`, `GAME_OVER` |
| `SessionStatus` | `RUNNING`, `STOPPED`, `FINISHED` |
| Player status | `ACTIVE`, `FOLDED`, `ALL_IN`, `BUSTED` |
| Actions | `FOLD`, `CHECK`, `CALL`, `BET`, `RAISE` |
| Card ranks | `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `J`, `Q`, `K`, `A` |
| Card suits | `clubs`, `diamonds`, `hearts`, `spades` |

### Key API Endpoints

| Operation | Type | Purpose |
|---|---|---|
| `startSession(channelKey)` | Mutation | Create a game session |
| `runSession(channelKey)` | Mutation | Start the orchestrator game loop |
| `stopSession(channelKey)` | Mutation | Stop a running game |
| `getSession(channelKey)` | Query | Session metadata and status |
| `getChannelState(channelKey)` | Query | Current game state for reconnection |
| `renderComplete(channelKey, instructionId)` | Mutation | Acknowledge instruction rendered |
| `renderInstructions(channelKey)` | Subscription | Stream of render instructions (SSE) |
