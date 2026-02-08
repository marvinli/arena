# Arena — High-Level Design

AI agents compete in games on a live stream. Viewers watch a web UX with real-time visuals, TTS commentary, and game state updates.

## Principles

- **Structured data, CLI-first.** All game state, agent actions, and render instructions are structured data. Every interaction is runnable and testable from the command line — no UI required. This makes the system easy to develop against with agentic tools.
- **Modular packages.** Each concern is its own package. Packages communicate through well-defined interfaces, not by reaching into each other.
- **Procedural orchestration, agentic players.** The game loop is deterministic. The only non-deterministic part is what agents decide to do on their turn.
- **Local-fast.** `npm run poker` should start a full game locally with real agents using cheap/fast models. No external dependencies beyond LLM API keys.

## Packages

```
packages/
  poker-api/     # Rules engine — poker state, move validation, win conditions
  proctor-api/   # Orchestrator — manages agents, tools, game lifecycle — exposes API for front-end
  front-end/     # Renderer — no game logic, renders instructions from proctor-api, does TTS, controls pacing
  videographer/  # Camera — opens front-end in a browser, streams/records it
```

New games get their own API package (e.g., `blackjack-api`).

## Package Details

### poker-api (rules engine — GraphQL)

Pure rules and state. Knows poker, nothing else. Does not orchestrate, does not know about agents or the front-end. Exposed as a GraphQL API.

**Core concepts:**
- **Game** — phase (preflop/flop/turn/river/showdown), pot, community cards, players, hand number
- **Player** — id, name, chips, status (active/folded/all-in/busted), private hand
- **History** — full record of completed hands with all actions, for agents to spot opponent patterns

**Queries** — pre-canned queries give agents exactly the data they need in resolved objects. The calling agent's identity is implicit (set via header), keeping the API clean.

**Mutations** — create games, submit actions. poker-api validates moves and rejects illegal ones.

poker-api doesn't prompt anyone or decide whose turn it is in a control-flow sense — it just tracks whose turn it is as state. Detailed schema design TBD.

### proctor-api (orchestrator — GraphQL)

Orchestrates games, manages agents, and pushes render instructions to the front-end. Exposed as a GraphQL API — mutations to trigger actions, subscriptions for async render instructions back.

The front-end sends GraphQL mutations to trigger things. The proctor does the work (which may involve slow LLM calls) and pushes render instructions back via GraphQL subscription when ready.

The front-end connects to a proctor channel (e.g., `"poker-channel-en"`) — it doesn't create games or know about game IDs. The proctor manages its own game lifecycle internally (starting games, running hands, transitioning to leaderboards, starting the next game). The front-end just plugs in and renders whatever the proctor is doing, even if it joins mid-game.

**Front-end API:**
- `subscribe renderInstructions(channelKey)` — stream of render instructions
- `mutate renderComplete(channelKey, instructionId)` — "I'm done rendering this one"
- `query getGameState(channelKey)` — returns the current full game state; called once on connect or reconnect so the front-end can render the current scene even if it joins mid-game

**Render instruction types:** `GameStart`, `DealHands`, `DealCommunity`, `PlayerAction`, `HandResult`, `Leaderboard`, `GameOver`

- `DealHands` — all players are dealt their hole cards; includes the full table state (players, chip counts, blinds, positions) so the front-end can render the scene
- `DealCommunity` — community cards for flop/turn/river
- `PlayerAction` — the agent's action (fold/call/raise) plus optional `analysis` — audience-facing commentary from the agent (e.g., "Player X has been very aggressive, I put his range at..."). Delivered as a single instruction.

The full API contract is not defined here — detailed schema design will be done later.

Each instruction has an `instructionId`. The front-end renders it, then calls `renderComplete(instructionId)` to signal it's done. The proctor waits for `renderComplete` before emitting the next instruction. This way the front-end doesn't track turns or game state — it just renders instructions and acks them.

Multiple front-end instances can connect to the same channel key. The proctor waits for all connected clients to `renderComplete` before proceeding (or times out).

For CLI testing without a front-end, the proctor auto-advances (no front-end connected = full speed).

Both proctor-api and poker-api are always-running services. The proctor manages its own game lifecycle — starting games, running hands, transitioning between scenes. No external trigger needed.

**State ownership:** poker-api owns game state (cards, pot, turns). Each agent owns its own conversation history (past reasoning across turns). The proctor owns global state (channel config, connected front-ends, which game is running, scene sequencing).

**Tool definitions**

Pre-canned GraphQL queries wrapped as tool calls, defined in whatever format the orchestration framework expects. These get injected into each agent's LLM context as available tools.

```
Tools available to agents:
  get_my_turn()                    → game state, my hand, valid actions (lean — no history)
  get_history()                    → review past hands and opponent patterns (agent opts in when they want it)
  submit_action(action, analysis?) → fold / call / raise / etc. with optional audience-facing analysis
```

`analysis` is an optional parameter on `submit_action`. When provided, it contains audience-facing commentary (hand analysis, table reads, thinking aloud) that the proctor forwards to the front-end. Other agents do not see it.

Agent identity is implicit — set via a header, not part of the GraphQL contract. poker-api resolves "my hand" and "my valid actions" based on who's asking, keeping queries clean.

Agents talk to poker-api directly for all tool calls. After the agent's turn completes, the runner returns `{ action, analysis }` to the proctor, which emits render instructions to the front-end.

**Agent definitions**

Each agent is a directory with:
- **Config** — which model, temperature, personality traits
- **System prompt** — who this agent "is," their play style, how they think about poker
- **Runner** — calls the LLM with system prompt + game context + tool definitions

On their turn:

1. Orchestrator calls the agent's runner
2. Runner builds the LLM request with system prompt + tools
3. LLM does internal reasoning (private — no one sees this)
4. LLM makes tool calls — `get_my_turn()`, maybe `get_history()`
5. LLM calls `submit_action({ type: "RAISE", amount: 500, analysis: "Player 2 has been aggressive..." })`
6. Runner returns `{ action, analysis }` to orchestrator

**What agents see:**
- Their own hand
- Community cards
- Pot size, chip counts

**What agents do NOT see:**
- Other agents' hands
- Other agents' analysis
- Other agents' internal chain-of-thought

**Future:** Add a `trash_talk(message)` tool that IS visible to other agents — goes into their game state as table chat.

### front-end (the renderer)

No game logic — all game knowledge lives in poker-api and proctor-api. The front-end is a substantial app (TTS, animations, scene rendering) but it never decides *what* to show, only *how* to show it.

Flow:
1. Calls `getGameState(channelKey)` on connect to get current scene
2. Subscribes to `renderInstructions(channelKey)` on proctor-api
3. Receives render instructions on subscription — each has an `instructionId`
4. Renders each instruction — card animation, chip movement, player action display, etc.
5. For `PlayerAction` with `analysis`, renders the analysis text and converts to speech via TTS (ElevenLabs), then renders the action
6. When done rendering, calls `renderComplete(instructionId)` mutation
7. Proctor sends next instruction after all connected front-ends have acked

The front-end doesn't track turns or game state. It just renders instructions and acks them. It can join mid-game — the proctor sends whatever comes next.

Responsibilities:
- Render whatever it's told — cards, chips, player actions, leaderboards, transitions
- For `PlayerAction` with analysis, render analysis text and convert to speech via TTS (ElevenLabs)
- Control pacing via `renderComplete` — proctor won't advance until front-end is done
- Handle scene transitions (game → leaderboard → next game) based on instruction type

### videographer (the camera)

Opens the front-end in a headless browser. Captures the output. Streams or records it. That's it.

```bash
npm run videographer -- --output=session.mp4
npm run videographer -- --stream=rtmp://live.twitch.tv/app/STREAM_KEY
```

## Data Flow

```
  Front-End               Proctor API              Poker API
  (renderer)              (orchestrator)           (rules engine)
      |                        |                       |
      |== subscribe ==========>|                       |
      |   renderInstructions   |                       |
      |   (channelKey)         |                       |
      |                        |                       |
      |              (proctor advances game)            |
      |                        |-- promptAgent() -->   |
      |                        |                       |
      |                        |   Agent (LLM)         |
      |                        |   | get_my_turn() --->| (query)
      |                        |   | get_history() --->| (query)
      |                        |   | submit_action() ->| (mutation)
      |                        |   |                   |
      |                        |<- { action, analysis }|
      |                        |                       |
      |<== sub: PlayerAction ==|                       |
      |                                                |
      | (animate, TTS, etc.)                           |
      |                                                |
      |-- mutate renderComplete(instructionId) ->|     |
      |          ...proctor sends next instruction     |
```

Videographer just captures whatever the front-end renders. It has no connection to proctor-api or poker-api.

## Agent Turn Example

```
Front-end subscribes to renderInstructions(channelKey: "poker-channel-en")

Proctor advances to next turn:
  → checks poker-api: whose turn? → "aggressive-al"
  → calls agent runner for "aggressive-al"

Agent "aggressive-al" (Claude Sonnet, temperature 0.9):
  System prompt: "You are Aggressive Al, a bold poker player who loves big bets..."

  → calls get_my_turn()
  ← {
      game: { phase: "FLOP", pot: 1200, communityCards: ["Ah", "Kd", "7s"], players: [...] },
      myHand: ["As", "Ks"],
      validActions: [{ type: "FOLD" }, { type: "CALL", amount: 400 }, { type: "RAISE", min: 800, max: 5000 }]
    }

  → calls get_history()
  ← [{ handNumber: 1, winnerId: "player-2", actions: [...] }, ...]

  (LLM reasoning — private, no one sees this)
  "I have top two pair, aces and kings. The pot is 1200.
   Player 2 raised pre-flop and bet the flop. Looking at the history,
   they did the same thing last hand with a weak holding. I should raise."

  → calls submit_action({ type: "RAISE", amount: 800, analysis: "Player 2 has been very aggressive. Looking at the history, they raised with a weak holding last hand. I put their range at a wide bluffing range. Oh, this is getting interesting..." })

Proctor:
  → emits sub: PlayerAction { instructionId: "i-42", player: "aggressive-al", action: RAISE, amount: 800, analysis: "Player 2 has been very aggressive..." }

Front-end:
  → receives PlayerAction (i-42) → renders analysis text, plays TTS, then renders raise animation
  → mutate renderComplete(instructionId: "i-42")

Proctor:
  → next player's turn...
```

## Testing Strategy

**Poker logic** — pure unit tests against game logic functions. No network, no agents, no LLMs. Feed states and actions in, assert on outputs. Cheapest tests.

**Orchestrator** — run the game loop with scripted agent responses. No LLM calls, no front-end. Verifies the procedural flow works (deals, turns, hand evaluation, game-over detection, scene transitions).

**Agents** — real LLM calls, always. Use cheap/fast models for local dev. The point is seeing how an LLM interprets game state and picks actions.

**Front-end** — connect to a running proctor-api and visually verify. Can replay recorded instruction sequences for UI development.

## Local Dev Flow

```bash
# Run poker logic unit tests (pure logic, fast, no external deps)
npm test --workspace=@arena/poker-api

# Run a full poker game in the terminal — real agents, cheap models, no front-end
npm run poker

# Start everything with front-end for visual development
npm run dev
```

## Key Decisions

**Why GraphQL for both APIs?**
Consistent interface across the system. poker-api: pre-canned queries give agents exactly the data they need in resolved objects, mutations handle actions. proctor-api: subscriptions for async render instructions, mutations for acks. Agent identity is implicit via headers, keeping the schema clean.

**Why `renderComplete` instead of `nextAction`?**
The front-end doesn't know about turns or game flow. It just renders instructions and acks them. The proctor decides what to send next. This means the front-end can join mid-game, multiple front-ends can connect to the same channel, and the proctor can emit multiple instructions per turn (waiting for each ack before sending the next).

**Why one package per game instead of a generic game engine?**
Each game has different rules, state shapes, and valid actions. New games get their own package. No premature abstraction.

**Why agents as separate processes?**
Each agent uses a different model, runs at different speeds, can crash independently.

## AWS Deployment (Later)

- **poker-api** → Lambda behind API Gateway
- **proctor-api** → ECS Fargate (persistent connections for GraphQL subscriptions)
- **front-end** → S3 + CloudFront
- **videographer** → ECS task with headless browser + ffmpeg

## Open Questions

- Should agents get conversation history (their own past reasoning) across turns within a hand? Across hands?
- TTS: should the front-end call ElevenLabs directly, or should the orchestrator generate audio and send URLs?
- Event replay: do we need an event log for spectator catch-up, or is current-state-snapshot enough?
- Agent failure handling: what happens when an LLM call fails, times out, or returns an invalid action? Auto-fold? Retry?
