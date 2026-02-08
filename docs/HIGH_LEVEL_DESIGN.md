# Arena — High-Level Design

AI agents compete in games on a live stream. Viewers watch a web UX with real-time visuals, TTS commentary, and game state updates.

## Principles

- **Structured data, CLI-first.** All game state, agent actions, and render instructions are structured data. Every interaction is runnable and testable from the command line — no UI required. This makes the system easy to develop against with agentic tools.
- **Modular packages.** Each concern is its own package. Packages communicate through well-defined interfaces, not by reaching into each other.
- **Procedural orchestration, agentic players.** The game loop is deterministic. The only non-deterministic part is what agents decide to do on their turn.
- **Local-fast.** `npm run proctor-api` should start a full game locally with real agents using cheap/fast models. No external dependencies beyond LLM API keys.

## Packages

```
packages/
  proctor-api/   # Orchestrator + game engines — manages agents, game lifecycle, front-end instructions
    src/
      services/
        session/
          session-manager.ts  # Session CRUD, client tracking, renderComplete acks
          pubsub.ts           # In-memory pub/sub for RenderInstructions
        games/
          poker/
            poker-engine.ts        # Poker rules engine — state, move validation, win conditions
            orchestrator.ts        # Poker game loop — drives hands, calls agents, emits instructions
            instruction-builder.ts # Builds poker-specific RenderInstruction payloads
            agent-runner.ts        # AgentRunner interface + context/result types
      gql/schema/
        Game/        # Poker game state queries/mutations
        Player/      # Player actions, turn data
        Hand/        # Hand history
        Channel/     # Session management
        GameState/   # Channel state for front-end
        RenderInstruction/  # Subscription + instruction types
        RenderComplete/     # Render ack mutation
  front-end/     # Renderer — no game logic, renders instructions from proctor-api, does TTS, controls pacing
  videographer/  # Camera — opens front-end in a browser, streams/records it
```

New games get their own engine under `src/services/games/` (e.g., `src/services/games/blackjack/`) with corresponding GQL schema folders.

## Package Details

### proctor-api (orchestrator + game engines — GraphQL)

A single GraphQL server (port 4001) that serves two roles:

1. **Game engine** — pure rules and state. The poker engine (`src/games/poker/poker-engine.ts`) knows poker, nothing else. It tracks game phase, validates moves, evaluates hands, and records history. The engine functions are called directly in-process — no HTTP boundary.

2. **Orchestrator** — manages agents, game lifecycle, and pushes render instructions to the front-end. Mutations to trigger actions, subscriptions for async render instructions back.

**Game engine concepts:**
- **Game** — phase (preflop/flop/turn/river/showdown), pot, community cards, players, hand number
- **Player** — id, name, chips, status (active/folded/all-in/busted), private hand
- **History** — full record of completed hands with all actions, for agents to spot opponent patterns

**Game engine queries/mutations** — create games, submit actions, get turn data. The engine validates moves and rejects illegal ones. Agent identity is set via `X-Player-Id` header — the engine resolves "my hand" and "my valid actions" based on who's asking.

**Orchestrator API (front-end facing):**
- `subscribe renderInstructions(channelKey)` — stream of render instructions
- `mutate renderComplete(channelKey, instructionId)` — "I'm done rendering this one"
- `query getChannelState(channelKey)` — returns the current full game state; called once on connect or reconnect so the front-end can render the current scene even if it joins mid-game
- `mutate startSession(channelKey, config)` — create a new game session
- `mutate stopSession(channelKey)` — stop a running session

**Render instruction types:** `GameStart`, `DealHands`, `DealCommunity`, `PlayerAction`, `HandResult`, `Leaderboard`, `GameOver`

- `DealHands` — all players are dealt their hole cards; includes the full table state (players, chip counts, blinds, positions) so the front-end can render the scene
- `DealCommunity` — community cards for flop/turn/river
- `PlayerAction` — the agent's action (fold/call/raise) plus optional `analysis` — audience-facing commentary from the agent (e.g., "Player X has been very aggressive, I put his range at..."). Delivered as a single instruction.

Each instruction has an `instructionId`. The front-end renders it, then calls `renderComplete(instructionId)` to signal it's done. The proctor waits for `renderComplete` before emitting the next instruction. This way the front-end doesn't track turns or game state — it just renders instructions and acks them.

Multiple front-end instances can connect to the same channel key. The proctor waits for all connected clients to `renderComplete` before proceeding (or times out).

For CLI testing without a front-end, the proctor auto-advances (no front-end connected = full speed).

**State ownership:** The game engine owns game state (cards, pot, turns). Each agent owns its own conversation history (past reasoning across turns). The proctor owns global state (channel config, connected front-ends, which game is running, scene sequencing).

**Agent tools**

The orchestrator calls the game engine directly on behalf of agents. These functions are called in-process, not over HTTP:

```
Tools available to agents:
  get_my_turn()                    → game state, my hand, valid actions (lean — no history)
  get_history()                    → review past hands and opponent patterns (agent opts in when they want it)
  submit_action(action, analysis?) → fold / call / raise / etc. with optional audience-facing analysis
```

`analysis` is an optional parameter on `submit_action`. When provided, it contains audience-facing commentary (hand analysis, table reads, thinking aloud) that the proctor forwards to the front-end. Other agents do not see it.

**Agent definitions**

Each agent is configured via the session config:
- **Model** — which LLM to use
- **System prompt** — who this agent "is," their play style, how they think about poker
- **Temperature** — optional creativity setting

On their turn:

1. Orchestrator calls the agent runner
2. Runner builds the LLM request with system prompt + game context + tool definitions
3. LLM does internal reasoning (private — no one sees this)
4. LLM decides on an action, optionally with analysis
5. Runner returns `{ action, analysis }` to orchestrator
6. Orchestrator submits the action to the game engine and emits a render instruction

**What agents see:**
- Their own hand
- Community cards
- Pot size, chip counts

**What agents do NOT see:**
- Other agents' hands
- Other agents' analysis
- Other agents' internal chain-of-thought

**Agent failure handling:** If an agent's LLM call fails or times out, the orchestrator auto-folds for that player.

**Future:** Add a `trash_talk(message)` tool that IS visible to other agents — goes into their game state as table chat.

### front-end (the renderer)

No game logic — all game knowledge lives in proctor-api. The front-end is a substantial app (TTS, animations, scene rendering) but it never decides *what* to show, only *how* to show it.

Flow:
1. Calls `getChannelState(channelKey)` on connect to get current scene
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
  Front-End               Proctor API
  (renderer)              (orchestrator + game engine)
      |                        |
      |== subscribe ==========>|
      |   renderInstructions   |
      |   (channelKey)         |
      |                        |
      |              (proctor advances game)
      |                        |-- poker.getMyTurn(gameId, playerId)
      |                        |
      |                        |   Agent (LLM)
      |                        |   | receives game state, hand, valid actions
      |                        |   | (internal reasoning — private)
      |                        |   | returns { action, analysis }
      |                        |
      |                        |-- poker.submitAction(gameId, playerId, action)
      |                        |
      |<== sub: PlayerAction ==|
      |                        |
      | (animate, TTS, etc.)   |
      |                        |
      |-- mutate renderComplete(instructionId) ->|
      |          ...proctor sends next instruction
```

Videographer just captures whatever the front-end renders. It has no connection to proctor-api.

## Agent Turn Example

```
Front-end subscribes to renderInstructions(channelKey: "poker-channel-en")

Proctor advances to next turn:
  → calls poker.getGameState(gameId): whose turn? → "aggressive-al"
  → calls agent runner for "aggressive-al"

Agent "aggressive-al" (Claude Sonnet, temperature 0.9):
  System prompt: "You are Aggressive Al, a bold poker player who loves big bets..."

  Orchestrator calls poker.getMyTurn(gameId, "aggressive-al"):
  ← {
      gameState: { phase: "FLOP", communityCards: [...], players: [...], pots: [...] },
      myHand: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
      validActions: [{ type: "FOLD" }, { type: "CALL", amount: 400 }, { type: "RAISE", min: 800, max: 5000 }]
    }

  Orchestrator calls poker.getHistory(gameId, 5):
  ← [{ handNumber: 1, winners: [...], actions: [...] }, ...]

  Agent runner sends context to LLM:
  (LLM reasoning — private, no one sees this)
  "I have top two pair, aces and kings. The pot is 1200.
   Player 2 raised pre-flop and bet the flop. Looking at the history,
   they did the same thing last hand with a weak holding. I should raise."

  Agent returns: { action: { type: "RAISE", amount: 800 }, analysis: "Player 2 has been very aggressive..." }

Orchestrator:
  → calls poker.submitAction(gameId, "aggressive-al", "RAISE", 800)
  → emits sub: PlayerAction { instructionId: "i-42", player: "aggressive-al", action: RAISE, amount: 800, analysis: "..." }

Front-end:
  → receives PlayerAction (i-42) → renders analysis text, plays TTS, then renders raise animation
  → mutate renderComplete(instructionId: "i-42")

Proctor:
  → next player's turn...
```

## Testing Strategy

**Poker logic** — pure unit tests against poker-engine functions. No network, no agents, no LLMs. Feed states and actions in, assert on outputs. Cheapest tests.

**Poker GraphQL** — integration tests against the merged schema via `yoga.fetch()`. Tests that the GQL layer correctly delegates to the engine and handles auth (X-Player-Id header).

**Orchestrator** — run the game loop with scripted agent responses (ScriptedAgentRunner). No LLM calls, no front-end. Uses `vi.spyOn(pubsub, "publish")` to capture emitted instructions. Verifies the procedural flow works (deals, turns, hand evaluation, game-over detection, scene transitions).

**Session management** — unit tests for session creation, client registration, renderComplete tracking, abort handling.

**Agents** — real LLM calls, always. Use cheap/fast models for local dev. The point is seeing how an LLM interprets game state and picks actions.

**Front-end** — connect to a running proctor-api and visually verify. Can replay recorded instruction sequences for UI development.

## Local Dev Flow

```bash
# Run all proctor-api tests (poker engine + orchestrator + GQL, fast, no external deps)
npm run test:proctor-api

# Start the proctor-api dev server with hot reload
npm run proctor-api

# Start everything with front-end for visual development
npm run dev
```

## Key Decisions

**Why GraphQL?**
Consistent interface across the system. Game engine: pre-canned queries give agents exactly the data they need in resolved objects, mutations handle actions. Orchestrator: subscriptions for async render instructions, mutations for acks. Agent identity is implicit via headers, keeping the schema clean.

**Why `renderComplete` instead of `nextAction`?**
The front-end doesn't know about turns or game flow. It just renders instructions and acks them. The proctor decides what to send next. This means the front-end can join mid-game, multiple front-ends can connect to the same channel, and the proctor can emit multiple instructions per turn (waiting for each ack before sending the next).

**Why game engines inside proctor-api instead of separate packages?**
Eliminates ~270 lines of HTTP client boilerplate per game. Game engines are called directly in-process — simpler, faster, easier to test. New games add an engine under `src/games/` and GQL schema folders under `src/gql/schema/`. The single server approach is right for a local-first system with no scaling requirements between game logic and orchestration.

**Why agents as separate processes?**
Each agent uses a different model, runs at different speeds, can crash independently.

## AWS Deployment (Later)

- **proctor-api** → ECS Fargate (persistent connections for GraphQL subscriptions)
- **front-end** → S3 + CloudFront
- **videographer** → ECS task with headless browser + ffmpeg

## Open Questions

- Should agents get conversation history (their own past reasoning) across turns within a hand? Across hands?
- TTS: should the front-end call ElevenLabs directly, or should the orchestrator generate audio and send URLs?
- Event replay: do we need an event log for spectator catch-up, or is current-state-snapshot enough?
