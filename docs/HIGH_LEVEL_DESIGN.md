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
      game-config.ts  # Server-side game configuration (players, blinds, chips)
      db.ts           # SQLite database connection (better-sqlite3)
      services/
        session/
          session-manager.ts  # Session CRUD, client tracking, renderComplete acks
          pubsub.ts           # In-memory pub/sub for RenderInstructions
        games/
          poker/
            poker-engine/          # Pure rules engine (state, actions, hand evaluation, store)
            orchestrator/          # Game loop (session-loop, hand-loop, turn-resolver, emitter)
            agent-runner.ts        # AgentRunner interface + context/result types
            llm-agent-runner.ts    # LLM implementation of AgentRunner (ai SDK, multi-provider)
            instruction-builder.ts # Builds poker-specific RenderInstruction payloads
            message-formatter.ts   # Human-readable game event strings for agent conversations
            prompt-template.ts     # Shared system prompt template for agents
            fallback-lines.ts      # Fallback commentary when agent analysis fails
      gql/schema/
        Game/        # Poker game state queries/mutations
        Player/      # Player actions, turn data
        Hand/        # Hand history
        Channel/     # Session management (start/stop/run)
        GameState/   # Channel state for front-end reconnection
        RenderInstruction/  # Subscription + instruction types
        RenderComplete/     # Render ack mutation
  front-end/     # Renderer — no game logic, renders instructions from proctor-api, does TTS, controls pacing
  videographer/  # Camera — opens front-end in a browser, streams/records it (planned, not yet implemented)
```

New games get their own engine under `src/services/games/` (e.g., `src/services/games/blackjack/`) with corresponding GQL schema folders.

## Package Details

### proctor-api (orchestrator + game engines — GraphQL)

A single GraphQL server (port 4001) that serves two roles:

1. **Game engine** — pure rules and state. The poker engine (`src/services/games/poker/poker-engine/`) knows poker, nothing else. It tracks game phase, validates moves, evaluates hands, and records history. The engine functions are called directly in-process — no HTTP boundary.

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
- `mutate startSession(channelKey)` — create a new game session (config is server-side in `game-config.ts`)
- `mutate runSession(channelKey)` — start the orchestrator game loop (called after subscribing)
- `mutate stopSession(channelKey)` — stop a running session

**Render instruction types:** `GAME_START`, `DEAL_HANDS`, `DEAL_COMMUNITY`, `PLAYER_TURN`, `PLAYER_ANALYSIS`, `PLAYER_ACTION`, `HAND_RESULT`, `LEADERBOARD`, `GAME_OVER`

- `DEAL_HANDS` — all players are dealt their hole cards; includes the full table state (players, chip counts, blinds, positions) so the front-end can render the scene
- `DEAL_COMMUNITY` — community cards for flop/turn/river
- `PLAYER_TURN` — signals which player is about to act (front-end highlights the active seat)
- `PLAYER_ANALYSIS` — the agent's audience-facing commentary (e.g., "Player X has been very aggressive, I put his range at..."). The front-end renders this text and plays TTS.
- `PLAYER_ACTION` — the agent's action (fold/call/raise) with updated game state

Each instruction has an `instructionId`. The front-end renders it, then calls `renderComplete(instructionId)` to signal it's done. The proctor waits for `renderComplete` before emitting the next instruction. This way the front-end doesn't track turns or game state — it just renders instructions and acks them.

Multiple front-end instances can connect to the same channel key. The proctor waits for all connected clients to `renderComplete` before proceeding (or times out).

For CLI testing without a front-end, the proctor auto-advances (no front-end connected = full speed). The `run-game` script (`npm run run-game --workspace=@arena/proctor-api`) runs a game headlessly.

**State ownership:** The game engine owns game state (cards, pot, turns). Each agent owns its own conversation history (past reasoning across turns). The proctor owns global state (channel config, connected front-ends, which game is running, scene sequencing).

**Agent tools**

Each agent has a single tool: `submit_action`. The orchestrator calls the game engine directly on behalf of agents — `getMyTurn()` and `getHistory()` are proctor-internal calls, not agent-facing tools.

```
Tools available to agents:
  submit_action(action, amount?) → fold / call / raise / etc.
```

Analysis (audience-facing commentary) is extracted from the agent's natural language text output before the tool call, not from a tool parameter. The agent speaks its thoughts aloud as plain text, then calls `submit_action`.

**Agent definitions**

Each agent is configured server-side in `game-config.ts`:
- **Model** — which LLM to use (provider + modelId)
- **System prompt** — shared template with player metadata interpolated (name, model name, provider)
- **Temperature** — optional creativity setting
- **Avatar URL** — front-end display image
- **TTS Voice** — OpenAI TTS voice name for spoken analysis

On their turn:

1. Orchestrator calls the agent runner
2. Runner builds the LLM request with system prompt + accumulated conversation + tool definitions
3. LLM speaks its thoughts aloud as natural text (audience-facing analysis)
4. LLM calls `submit_action` with its chosen action
5. Runner returns `{ action, analysis }` to orchestrator
6. Orchestrator submits the action to the game engine
7. Orchestrator emits `PLAYER_TURN`, then `PLAYER_ANALYSIS` (if analysis exists), then `PLAYER_ACTION` to the front-end

**What agents see:**
- Their own hand
- Community cards
- Pot size, chip counts
- All opponent actions (injected into conversation by the proctor)

**What agents do NOT see:**
- Other agents' hands
- Other agents' analysis
- Other agents' internal chain-of-thought

**Agent failure handling:** If an agent's LLM call fails or times out, the orchestrator auto-folds for that player. Invalid actions trigger a reject-and-retry loop (up to 3 retries), then auto-fold.

**Future:** Add a `trash_talk(message)` tool that IS visible to other agents — goes into their game state as table chat.

### front-end (the renderer)

No game logic — all game knowledge lives in proctor-api. The front-end is a substantial React app (TTS, animations, scene rendering) but it never decides *what* to show, only *how* to show it.

Flow:
1. Calls `startSession(channelKey)` mutation to create the session
2. Subscribes to `renderInstructions(channelKey)` via SSE (this registers the client on the server)
3. Calls `runSession(channelKey)` mutation to start the orchestrator game loop
4. Receives render instructions on subscription — each has an `instructionId`
5. Renders each instruction — card animation, chip movement, player action display, etc.
6. For `PLAYER_ANALYSIS`, renders the analysis text and converts to speech via OpenAI TTS (`gpt-4o-mini-tts` with streaming PCM), then for the following `PLAYER_ACTION` renders the action
7. When done rendering, calls `renderComplete(instructionId)` mutation
8. Proctor sends next instruction after all connected front-ends have acked

The front-end doesn't track turns or game state. It just renders instructions and acks them. It can join mid-game — the proctor sends whatever comes next.

Responsibilities:
- Render whatever it's told — cards, chips, player actions, leaderboards, transitions
- For `PLAYER_ANALYSIS`, render analysis text and convert to speech via OpenAI TTS
- Control pacing via `renderComplete` — proctor won't advance until front-end is done
- Handle scene transitions (game → leaderboard → next game) based on instruction type

### videographer (the camera) — planned

Opens the front-end in a headless browser. Captures the output. Streams or records it. That's it. Not yet implemented.

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
      |                        |   Agent (LLM, in-process)
      |                        |   | receives game state, hand, valid actions
      |                        |   | (speaks analysis as text, calls submit_action)
      |                        |   | returns { action, analysis }
      |                        |
      |                        |-- poker.submitAction(gameId, playerId, action)
      |                        |
      |<== sub: PLAYER_TURN ===|  (highlight active player)
      |-- renderComplete ------>|
      |<== sub: PLAYER_ANALYSIS |  (analysis text + TTS)
      |-- renderComplete ------>|
      |<== sub: PLAYER_ACTION ==|  (action animation)
      |-- renderComplete ------>|
      |          ...proctor sends next instruction
```

Videographer will just capture whatever the front-end renders. It has no connection to proctor-api.

## Agent Turn Example

```
Front-end subscribes to renderInstructions(channelKey: "poker-stream-1")

Proctor advances to next turn:
  → calls poker.getGameState(gameId): whose turn? → "aggressive-al"
  → calls agent runner for "aggressive-al"

Agent "aggressive-al" (Claude Haiku, temperature default):
  System prompt: "You are Aggressive Al, a professional poker player..."

  Orchestrator builds turn context from:
    poker.getMyTurn(gameId, "aggressive-al"):
    ← {
        gameState: { phase: "FLOP", communityCards: [...], players: [...], pots: [...] },
        myHand: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
        validActions: [{ type: "FOLD" }, { type: "CALL", amount: 400 }, { type: "RAISE", min: 800, max: 5000 }]
      }

  Agent runner sends context to LLM:
  LLM responds with text + tool call:
    Text: "I have top pair with a good kicker. Player 2 has been betting
    aggressively but the pot odds are too good to fold. Let's raise to 800."

    Tool: submit_action({ action: "RAISE", amount: 800 })

  Agent returns: { action: { type: "RAISE", amount: 800 }, analysis: "I have top pair..." }

Orchestrator:
  → calls poker.submitAction(gameId, "aggressive-al", "RAISE", 800)
  → emits PLAYER_TURN { playerId: "aggressive-al", playerName: "Aggressive Al" }
  → waits for renderComplete
  → emits PLAYER_ANALYSIS { playerId: "aggressive-al", analysis: "I have top pair..." }
  → waits for renderComplete
  → emits PLAYER_ACTION { player: "aggressive-al", action: RAISE, amount: 800 }
  → waits for renderComplete

Front-end:
  → receives PLAYER_TURN → highlights Aggressive Al's seat
  → receives PLAYER_ANALYSIS → renders text, plays TTS with Al's voice
  → receives PLAYER_ACTION → renders raise animation
  → calls renderComplete after each

Proctor:
  → injects "Aggressive Al raises to 800." into all other agents' conversations
  → next player's turn...
```

## Testing Strategy

**Poker logic** — pure unit tests against poker-engine functions. No network, no agents, no LLMs. Feed states and actions in, assert on outputs. Cheapest tests.

**Poker GraphQL** — integration tests against the merged schema via `yoga.fetch()`. Tests that the GQL layer correctly delegates to the engine and handles auth (X-Player-Id header).

**Orchestrator** — run the game loop with scripted agent responses (ScriptedAgentRunner). No LLM calls, no front-end. Uses `vi.spyOn(pubsub, "publish")` to capture emitted instructions. Verifies the procedural flow works (deals, turns, hand evaluation, game-over detection, scene transitions).

**Session management** — unit tests for session creation, client registration, renderComplete tracking, abort handling.

**Agents** — real LLM calls, always. Use cheap/fast models for local dev. The point is seeing how an LLM interprets game state and picks actions.

**Front-end** — connect to a running proctor-api and visually verify.

## Local Dev Flow

```bash
# Run all proctor-api tests (poker engine + orchestrator + GQL, fast, no external deps)
npm run test:proctor-api

# Start the proctor-api dev server with hot reload
npm run proctor-api

# Start the front-end dev server (proxies /graphql to localhost:4001)
npm run front-end

# Run a headless game via CLI (no front-end needed)
npm run run-game --workspace=@arena/proctor-api
```

## Key Decisions

**Why GraphQL?**
Consistent interface across the system. Game engine: pre-canned queries give agents exactly the data they need in resolved objects, mutations handle actions. Orchestrator: subscriptions for async render instructions, mutations for acks. Agent identity is implicit via headers, keeping the schema clean.

**Why `renderComplete` instead of `nextAction`?**
The front-end doesn't know about turns or game flow. It just renders instructions and acks them. The proctor decides what to send next. This means the front-end can join mid-game, multiple front-ends can connect to the same channel, and the proctor can emit multiple instructions per turn (waiting for each ack before sending the next).

**Why split PLAYER_TURN / PLAYER_ANALYSIS / PLAYER_ACTION?**
Splitting the player's turn into three instructions allows the front-end to pipeline rendering. `PLAYER_TURN` highlights the active seat immediately. `PLAYER_ANALYSIS` triggers TTS (which can play while the proctor starts the next agent's LLM call). `PLAYER_ACTION` shows the action animation. Each is acked independently, giving the front-end fine-grained pacing control.

**Why game engines inside proctor-api instead of separate packages?**
Eliminates ~270 lines of HTTP client boilerplate per game. Game engines are called directly in-process — simpler, faster, easier to test. New games add an engine under `src/services/games/` and GQL schema folders under `src/gql/schema/`. The single server approach is right for a local-first system with no scaling requirements between game logic and orchestration.

**Why agents in-process instead of separate processes?**
Agents run inside the proctor-api process via the `ai` SDK (Vercel AI SDK). The agent runner holds per-agent conversation state in a Map and calls LLM APIs directly. This avoids IPC complexity and makes the system easy to run locally. Each agent uses a different model/provider, but they all run through the same agent runner. Failures are caught and handled (auto-fold) without affecting other agents.

## AWS Deployment (Later)

- **proctor-api** → ECS Fargate (persistent connections for GraphQL subscriptions)
- **front-end** → S3 + CloudFront
- **videographer** → ECS task with headless browser + ffmpeg
