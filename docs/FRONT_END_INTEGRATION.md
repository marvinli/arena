# Front-End Integration Guide

The front-end is a renderer. It has no game logic. It subscribes to a stream of render instructions from the proctor-api, renders each one (animations, TTS, scene transitions), and acknowledges completion. The proctor waits for the acknowledgment before sending the next instruction.

## Connection Overview

```
Front-End                          Proctor API (port 4001)
   |                                      |
   |-- query getChannelState ------------>|  (get current scene on connect)
   |<----- current state -----------------|
   |                                      |
   |== subscribe renderInstructions ====>|  (open persistent channel)
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

The GraphQL endpoint is `http://localhost:4001/graphql` for queries/mutations and `ws://localhost:4001/graphql` for subscriptions.

---

## Step 1: Get Current State on Connect

When the front-end loads (or reconnects), call `getChannelState` to render the current scene. This lets the front-end join mid-game.

```graphql
query GetChannelState($channelKey: String!) {
  getChannelState(channelKey: $channelKey) {
    channelKey
    gameId
    handNumber
    phase
    players {
      id
      name
      chips
      status
      seatIndex
    }
    communityCards {
      rank
      suit
    }
    pots {
      size
      eligiblePlayerIds
    }
    lastInstruction {
      instructionId
      type
      timestamp
    }
  }
}
```

Use this to hydrate the initial UI: seat players, show chip counts, render any community cards already dealt, display pots.

---

## Step 2: Subscribe to Render Instructions

Open a GraphQL subscription to receive instructions as the game progresses.

```graphql
subscription RenderInstructions($channelKey: String!) {
  renderInstructions(channelKey: $channelKey) {
    instructionId
    type
    timestamp

    gameStart {
      gameId
      players { id name chips status seatIndex }
      smallBlind
      bigBlind
    }

    dealHands {
      handNumber
      players { id name chips status seatIndex }
      hands { playerId cards { rank suit } }
      button
      pots { size eligiblePlayerIds }
    }

    dealCommunity {
      phase
      communityCards { rank suit }
      pots { size eligiblePlayerIds }
    }

    playerAction {
      playerId
      playerName
      action
      amount
      analysis
      pots { size eligiblePlayerIds }
      players { id name chips status seatIndex }
    }

    handResult {
      winners { playerId amount hand }
      pots { size eligiblePlayerIds }
      players { id name chips status seatIndex }
      communityCards { rank suit }
    }

    leaderboard {
      players { id name chips status seatIndex }
      handsPlayed
    }

    gameOver {
      winnerId
      winnerName
      players { id name chips status seatIndex }
      handsPlayed
    }
  }
}
```

When the subscription connects, the proctor registers the client. When it disconnects, the client is automatically unregistered.

---

## Step 3: Acknowledge Each Instruction

After rendering an instruction (animations complete, TTS finished), call `renderComplete`. The proctor blocks until all connected clients acknowledge before sending the next instruction.

```graphql
mutation RenderComplete($channelKey: String!, $instructionId: ID!) {
  renderComplete(channelKey: $channelKey, instructionId: $instructionId)
}
```

If the front-end doesn't acknowledge within 30 seconds, the proctor auto-advances. Reliable acknowledgment prevents the game from stalling.

---

## Step 4: Start and Stop Sessions

The front-end (or an admin UI) can start game sessions.

### Start a Session

```graphql
mutation StartSession($channelKey: String!, $config: SessionConfig!) {
  startSession(channelKey: $channelKey, config: $config) {
    channelKey
    gameId
    status
    handNumber
    players { id name chips modelId modelName provider }
  }
}
```

Example config:

```json
{
  "channelKey": "poker-stream-1",
  "config": {
    "players": [
      {
        "playerId": "agent-1",
        "name": "Aggressive Alice",
        "modelId": "claude-haiku-4-5-20251001",
        "modelName": "Claude Haiku",
        "provider": "anthropic",
        "avatarUrl": "https://example.com/alice.png",
        "ttsVoice": "elevenlabs-voice-id-alice",
        "temperature": 0.9
      },
      {
        "playerId": "agent-2",
        "name": "Cautious Bob",
        "modelId": "gpt-4o-mini",
        "modelName": "GPT-4o Mini",
        "provider": "openai",
        "avatarUrl": "https://example.com/bob.png",
        "ttsVoice": "elevenlabs-voice-id-bob"
      }
    ],
    "startingChips": 1000,
    "smallBlind": 5,
    "bigBlind": 10,
    "handsPerGame": 20
  }
}
```

Set `handsPerGame` to `null` to play until one player has all the chips.

### Stop a Session

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
| `smallBlind` | `Int!` | Small blind amount |
| `bigBlind` | `Int!` | Big blind amount |

**Render:** Display the table, seat all players, show starting chip counts and blind structure.

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

### PLAYER_ACTION

Emitted when a player acts.

| Field | Type | Description |
|---|---|---|
| `playerId` | `ID!` | Who acted |
| `playerName` | `String!` | Display name |
| `action` | `String!` | `"fold"`, `"check"`, `"call"`, `"bet"`, or `"raise"` |
| `amount` | `Int` | Chip amount (null for fold/check) |
| `analysis` | `String` | Audience-facing commentary (null if none) |
| `pots` | `[PotInfo!]!` | Updated pot state |
| `players` | `[PlayerInfo!]!` | Updated player states |

This is the most complex instruction to render. When `analysis` is present:

1. Display the analysis text (e.g., in a speech bubble or commentary panel)
2. Convert to speech using the player's `ttsVoice` (from `AgentConfig`) via TTS
3. Play the audio
4. Animate the action (chip movement, fold animation, etc.)
5. Call `renderComplete` after everything finishes

When `analysis` is null, just animate the action and acknowledge.

**Render:** Show the action label ("Alice raises to 200"), animate chips, update pot. If analysis exists, render text and play TTS before acknowledging.

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
  status: string    // "ACTIVE" | "FOLDED" | "ALL_IN" | "BUSTED"
  seatIndex: number // 0-based seat position
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
  │     ├── PLAYER_ACTION (player acts)
  │     ├── PLAYER_ACTION (next player acts)
  │     ├── ...
  │     ├── DEAL_COMMUNITY (FLOP)
  │     ├── PLAYER_ACTION ...
  │     ├── DEAL_COMMUNITY (TURN)
  │     ├── PLAYER_ACTION ...
  │     ├── DEAL_COMMUNITY (RIVER)
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
  gameId: string | null;
  handNumber: number;
  phase: "WAITING" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
  smallBlind: number;
  bigBlind: number;
  button: number | null;             // seat index of dealer
  players: Map<string, UIPlayer>;    // playerId → state
  communityCards: CardInfo[];
  pots: PotInfo[];
}

interface UIPlayer {
  id: string;
  name: string;
  chips: number;
  status: "ACTIVE" | "FOLDED" | "ALL_IN" | "BUSTED";
  seatIndex: number;
  holeCards: [CardInfo, CardInfo] | null;  // stored from DEAL_HANDS, shown at HAND_RESULT
  lastAction: string | null;               // "fold", "call", "raise", etc.
  currentBet: number;
}
```

### State Updates by Instruction Type

| Instruction | State Updates |
|---|---|
| `GAME_START` | Set `gameId`, `smallBlind`, `bigBlind`. Populate `players` map. |
| `DEAL_HANDS` | Set `handNumber`, `button`. Store each player's `holeCards` (from `hands`). Update `players` from payload. Set `phase` to `"PREFLOP"`. Reset `lastAction` and `currentBet` for all players. |
| `DEAL_COMMUNITY` | Set `phase` from payload. Update `communityCards`. Update `pots`. Reset `lastAction` and `currentBet` for all players (new betting round). |
| `PLAYER_ACTION` | Update the acting player's `lastAction`, `status`, `chips`. Update `pots`. Recalculate `currentBet` from chip changes. |
| `HAND_RESULT` | Set `phase` to `"SHOWDOWN"`. Reveal all `holeCards`. Update `players` chip counts. Clear `communityCards`, `pots`, `lastAction` for next hand. |
| `LEADERBOARD` | Update all player chip counts. Set `phase` to `"WAITING"`. |
| `GAME_OVER` | Final standings. Game is over. |

---

## TTS Integration

When a `PLAYER_ACTION` includes `analysis`, the front-end should convert it to speech. The player's `ttsVoice` (an ElevenLabs voice ID) is set in the `AgentConfig` when the session is started. Store the voice ID per player when processing `GAME_START` or from the session config.

```typescript
async function speakAnalysis(
  analysis: string,
  voiceId: string,
  apiKey: string,
): Promise<void> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: analysis,
        model_id: "eleven_monolingual_v1",
      }),
    },
  );

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  return new Promise((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.play();
  });
}
```

The rendering flow for a `PLAYER_ACTION` with analysis:

1. Receive instruction
2. Display analysis text on screen
3. Call `speakAnalysis()` — wait for audio to finish
4. Animate the action (chips, fold, etc.)
5. Call `renderComplete(channelKey, instructionId)`

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

---

## GraphQL Client Setup

Example using Apollo Client with split links for HTTP queries and WebSocket subscriptions:

```typescript
import { ApolloClient, InMemoryCache, HttpLink, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

const httpLink = new HttpLink({
  uri: "http://localhost:4001/graphql",
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: "ws://localhost:4001/graphql",
  }),
);

const link = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === "OperationDefinition" && def.operation === "subscription";
  },
  wsLink,
  httpLink,
);

const client = new ApolloClient({ link, cache: new InMemoryCache() });
```

---

## Error Handling

- **Agent timeout/failure**: The proctor auto-folds for the agent. The front-end still receives a normal `PLAYER_ACTION` with `action: "fold"`. No special handling needed.
- **renderComplete timeout**: If the front-end doesn't acknowledge within 30 seconds, the proctor auto-advances. The front-end may miss instructions if it's too slow.
- **Session not found**: `getChannelState` and `getSession` return null or throw if the channel key doesn't exist.
- **Subscription disconnect**: Re-subscribe and call `getChannelState` to catch up.

---

## Quick Reference

### Enums

| Enum | Values |
|---|---|
| `InstructionType` | `GAME_START`, `DEAL_HANDS`, `DEAL_COMMUNITY`, `PLAYER_ACTION`, `HAND_RESULT`, `LEADERBOARD`, `GAME_OVER` |
| `SessionStatus` | `RUNNING`, `STOPPED`, `FINISHED` |
| Player status | `ACTIVE`, `FOLDED`, `ALL_IN`, `BUSTED` |
| Actions | `fold`, `check`, `call`, `bet`, `raise` |
| Card ranks | `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `J`, `Q`, `K`, `A` |
| Card suits | `clubs`, `diamonds`, `hearts`, `spades` |

### Key API Endpoints

| Operation | Type | Purpose |
|---|---|---|
| `getChannelState(channelKey)` | Query | Current game state for reconnection |
| `getSession(channelKey)` | Query | Session metadata and status |
| `startSession(channelKey, config)` | Mutation | Create and start a game |
| `stopSession(channelKey)` | Mutation | Stop a running game |
| `renderComplete(channelKey, instructionId)` | Mutation | Acknowledge instruction rendered |
| `renderInstructions(channelKey)` | Subscription | Stream of render instructions |
