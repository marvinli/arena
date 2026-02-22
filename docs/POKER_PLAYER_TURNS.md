# Poker Player Turns

How agents play poker. The proctor drives the game procedurally, invoking each agent on their turn and waiting for a tool call response. Agents maintain persistent conversation state across all turns within a game.

## Player Schema

Each player is an AI agent with metadata that controls its identity, model, and front-end presentation.

```typescript
interface PlayerConfig {
  id: string;              // Unique identifier (e.g., "agent-1")
  name: string;            // Display name (e.g., "Aaron")
  modelId: string;         // LLM model identifier (e.g., "deepseek-chat")
  provider: string;        // Model provider ("anthropic", "openai", "google", "deepseek", "xai", "bedrock")
  avatarUrl?: string;      // Avatar key for front-end rendering
  temperature?: number;    // Optional creativity setting (default: provider default)
  persona?: string;        // Poker persona key (e.g., "shark", "fish", "maniac")
  bio?: string;            // Character bio for the system prompt
  voiceDirective?: string; // How the character should speak (tone, metaphors, attitude)
}
```

The front-end uses `name` and `avatarUrl` for rendering. The agent runner uses `modelId`, `provider`, and `temperature` for LLM calls. The prompt template uses `name`, `bio`, `voiceDirective`, and the persona's strategy/commentary sections to give the agent a distinct character.

### Game config

Game config lives in `game-config.ts`, which imports from `characters.ts`. Each character has a `persona`, `bio`, `voiceDirective`, and `ttsVoice`. The `randomPlayers()` function picks a random subset from the full character roster for each session.

```typescript
interface AgentConfig {
  playerId: string;
  name: string;
  modelId: string;
  provider: string;
  persona: string;
  bio: string;
  avatarUrl?: string;
  ttsVoice?: string;
  temperature?: number;
}

interface GameConfig {
  players: AgentConfig[];
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  blindSchedule?: BlindLevel[];  // escalating blinds
  handsPerLevel?: number;        // hands before blinds increase
}
```

## Prompt Template & Persona System

Each agent gets a system prompt built from a shared template plus per-character customization. The template is in `prompts/system.ts` and the build logic is in `prompt-template.ts`.

### Persona system

Each character has a `persona` key (e.g., "shark", "fish", "maniac", "rock", "grinder", "degen", "snake", "robot") that maps to strategy and commentary instructions in `prompts/personas/`. These inject poker-style-specific guidance into the system prompt.

### Template variables

| Variable | Source | Description |
|---|---|---|
| `{{name}}` | `PlayerConfig.name` | Character name |
| `{{bio}}` | `PlayerConfig.bio` | Character background/identity |
| `{{voiceDirective}}` | `PlayerConfig.voiceDirective` | How the character speaks (tone, metaphors) |
| `{{personaStrategy}}` | `prompts/personas/` | Poker strategy for this persona type |
| `{{personaCommentary}}` | `prompts/personas/` | Commentary style for this persona type |
| `{{tournamentSection}}` | `TournamentInfo` | Starting chips, blind schedule |

The prompt emphasizes staying in character, keeping TTS output to 2 sentences / 20 words max, using plain English (no emoji/markup), and spelling out card ranks and suits in full words.

There is also a `hand-reaction.ts` prompt used by `promptReaction()` to get a short post-hand comment from agents.

## Agent Tools

Each agent has one tool available during their turn.

### submit_action (required — ends the turn)

```typescript
{
  name: "submit_action",
  description: "Submit your poker action. This ends your turn.",
  parameters: {
    action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE",
    amount?: number    // Required for BET and RAISE. Ignored for others.
  }
}
```

Note: `analysis` is NOT a parameter of the tool. The agent's audience-facing commentary is extracted from the **text output** that the LLM produces before calling `submit_action`. The agent speaks its thoughts aloud as natural text, then calls the tool. The agent runner captures `result.text` as the analysis.

The agent runner validates the tool call against the valid actions from the game engine. If the agent submits an invalid action (wrong type, out-of-range amount), the agent runner sends back a tool result error and lets the agent retry. If retries are exhausted, auto-check (if valid) or auto-fold.

History is not provided via a separate tool — the proctor injects all game events (opponent actions, community cards, hand results) directly into the agent's conversation. The conversation IS the history.

### Agent turn loop

The agent runner handles each turn:

1. Send "your turn" message to LLM with game state, hole cards, valid actions
2. LLM responds with natural text (analysis) + a `submit_action` tool call
3. Validate action against valid actions, return `{ action, analysis }` to proctor
4. If no tool call or invalid action after retries → auto-check (if valid) or auto-fold

## Agent Conversation Lifecycle

Each agent maintains a **persistent conversation** for the duration of the game. The conversation accumulates messages across all turns and hands. This gives agents memory of what happened — they can reference earlier hands, recall opponent patterns, and build a mental model of the table.

### Conversation structure

```
System: [prompt template with metadata]

--- Hand 1 ---
User: [DEAL_HANDS — your hole cards, table state, positions]
User: [YOUR_TURN — game state, valid actions]
Assistant: [spoken thoughts + submit_action tool call]
Tool: [action confirmed]
User: [OPPONENT_ACTION — Bob calls]
User: [OPPONENT_ACTION — Charlie raises to 80]
User: [YOUR_TURN — updated game state, valid actions]
Assistant: [spoken thoughts + submit_action tool call]
Tool: [action confirmed]
User: [DEAL_COMMUNITY — flop: A♠ K♦ 7♣]
User: [OPPONENT_ACTION — Bob checks]
User: [YOUR_TURN — updated game state, valid actions]
Assistant: [spoken thoughts + submit_action tool call]
Tool: [action confirmed]
...
User: [HAND_RESULT — winner, pot awarded]

--- Hand 2 ---
User: [DEAL_HANDS — new hole cards, updated chip counts]
...
```

### Message types injected by the proctor

The proctor injects structured messages into each agent's conversation as events happen. These are sent as **user messages** with a consistent format so the LLM can parse them.

#### DEAL_HANDS
Sent at the start of each hand. Includes the agent's hole cards and table state.
```
Hand #3 has been dealt.
Your hole cards: A♠ K♦
Players:
  Alice (you): 1,200 chips — Button
  Bob: 800 chips — Small Blind (10)
  Charlie: 950 chips — Big Blind (20)
Pot: 30
```

#### YOUR_TURN
Sent when it's this agent's turn to act.
```
It's your turn.
Phase: FLOP
Community cards: A♠ K♦ 7♣
Your hole cards: A♠ K♦
Pot: 120
Your chips: 1,180 (current bet: 0)
Valid actions:
  - CHECK
  - BET (min: 20, max: 1,180)

Call submit_action with your decision.
```

#### OPPONENT_ACTION
Sent when another player acts. Agents see all actions, but never see other agents' analysis or reasoning.
```
Bob calls 20.
```
```
Charlie raises to 80.
```
```
Bob folds.
```

#### DEAL_COMMUNITY
Sent when community cards are dealt.
```
FLOP: A♠ K♦ 7♣
```
```
TURN: 9♥
```
```
RIVER: 2♣
```

#### HAND_RESULT
Sent at the end of each hand.
```
Hand #3 result:
  Winner: Alice — wins 240 (pair of aces)
  Alice: 1,440 chips
  Bob: 780 chips
  Charlie: 780 chips
```

### Context management

The conversation grows across hands. For long games (50+ hands), the agent runner should manage context window limits:

- **Preferred**: Use the LLM provider's built-in context caching (Anthropic prompt caching, OpenAI cached completions) so early messages are cheap to re-send.
- **Fallback**: If the conversation exceeds the model's context window, truncate the oldest complete hands from the middle — keep the system prompt, the first hand (for calibration), and the most recent N hands.

## Proctor Flow

The proctor is **strictly procedural**. It has no intelligence. It follows a fixed loop, asks the game engine what to do, and invokes agents when told to. The game engine owns all poker logic — turn order, valid actions, phase transitions, win conditions.

### Proctor responsibilities

1. Create the game via the poker engine
2. Loop through hands until game over
3. Ask the game engine who acts next (`currentPlayerId`)
4. Skip busted players (the engine already excludes them from `currentPlayerId`)
5. Build game event messages and inject them into the agent's conversation
6. Invoke the agent and wait for `submit_action`
7. Submit the action to the game engine
8. Emit render instructions to the front-end (PLAYER_TURN → PLAYER_ANALYSIS → PLAYER_ACTION)

### What the proctor does NOT do

- Decide turn order (game engine does this)
- Validate actions (game engine does this — proctor just forwards)
- Evaluate hands or determine winners (game engine does this)
- Manage agent reasoning or conversation (agent runner does this)
- Decide what to render (instruction builder does this)

### Game loop pseudocode

```
createGame(players, blinds)
emit GAME_START

for each hand until gameOver or aborted:
    startHand()
    emit DEAL_HANDS
    inject DEAL_HANDS into all agents

    loop until hand ends:
        state = getGameState()

        if state.currentPlayerId exists:
            player = state.currentPlayerId
            emit PLAYER_TURN to front-end
            result = await agentRunner.runTurn(player)   // blocks until submit_action
            submitAction(player, result.action)
            if result.analysis:
                emit PLAYER_ANALYSIS to front-end
            emit PLAYER_ACTION to front-end
            inject OPPONENT_ACTION into all OTHER agents

        else:
            advancedState = advanceGame()

            if advancedState is new phase:
                emit DEAL_COMMUNITY to front-end
                inject DEAL_COMMUNITY into all agents

            if hand is over:
                emit HAND_RESULT to front-end
                inject HAND_RESULT into all agents
                prompt winners (and loser in heads-up showdown) for reactions
                if reaction: emit PLAYER_ANALYSIS to front-end
                break

    if game is over:
        emit GAME_OVER
        break
```

### Key design decision: proctor injects messages, not the agent runner

The proctor is responsible for building and injecting all game event messages (DEAL_HANDS, OPPONENT_ACTION, DEAL_COMMUNITY, HAND_RESULT) into each agent's conversation. The agent runner only handles the agentic tool-use loop for a single turn — it doesn't know about game flow.

This keeps the agent runner generic. It receives a conversation (with all prior messages already appended), adds the YOUR_TURN message, and runs the LLM loop until `submit_action` is called.

## Turn Sequence — Detailed

A single player turn, step by step:

```
1. Proctor asks game engine: getGameState() → currentPlayerId = "alice"

2. Proctor emits PLAYER_TURN to front-end:
   - { playerId: "alice", playerName: "Alice" }
   - Front-end highlights Alice's seat
   - Front-end calls completeInstruction

3. Proctor calls agentRunner.runTurn("alice", context):
   - Agent runner appends YOUR_TURN message to Alice's conversation
   - Agent runner sends conversation to LLM (Anthropic/OpenAI/Google API)
   - LLM responds with:
     Text: "I've got a strong top pair here. Bob's been passive all game,
     so his raise means something. I'll call and see the turn."
     Tool: submit_action({ action: "CALL" })
   - Agent runner validates action against valid actions
   - Agent runner appends assistant message + tool result to conversation
   - Agent runner returns { action: { type: "CALL" }, analysis: "I've got a strong top pair..." }

4. Proctor submits action to game engine:
   - poker.submitAction(gameId, "alice", "CALL")
   - Engine validates and updates state

5. Proctor emits PLAYER_ANALYSIS to front-end (because analysis exists):
   - { playerId: "alice", playerName: "Alice", analysis: "I've got a strong top pair..." }
   - Front-end displays text, plays TTS with Alice's voice
   - Front-end calls completeInstruction

6. Proctor emits PLAYER_ACTION to front-end:
   - { playerId: "alice", action: "CALL", amount: null, pots: [...], players: [...] }
   - Front-end renders call animation
   - Front-end calls completeInstruction

7. Proctor injects OPPONENT_ACTION into all other agents' conversations:
   - Bob's conversation gets: "Alice calls."
   - Charlie's conversation gets: "Alice calls."
   - Alice does NOT get this message (she already knows — she did it)
```

## Agent Runner Interface

```typescript
interface AgentRunner {
  /** Initialize a new agent for a game. Called once per player at session start. */
  initAgent(playerId: string, config: PlayerConfig, moduleId: string, tournamentInfo?: TournamentInfo): void;

  /** Append a game event message to an agent's conversation. */
  injectMessage(playerId: string, message: string): void | Promise<void>;

  /**
   * Run the agent's turn. Appends YOUR_TURN to the conversation,
   * runs the LLM tool-use loop, returns the action and analysis.
   * The conversation is updated in place with the full exchange.
   */
  runTurn(playerId: string, context: AgentTurnContext): Promise<AgentTurnResult>;

  /** Reject the last action with an error message and let the agent retry. */
  rejectAction(playerId: string, error: string): Promise<AgentTurnResult>;

  /** Prompt the agent for a short spoken reaction (no tool call). */
  promptReaction(playerId: string, message: string): Promise<string | undefined>;

  /** Restore persisted conversation history into an agent (for session recovery). */
  restoreMessages?(playerId: string, messages: Array<{ role: string; content: string }>): void;
}

interface AgentTurnContext {
  gameId: string;
  handNumber: number;
  phase: string;
  communityCards: Array<{ rank: string; suit: string }>;
  myHand: Array<{ rank: string; suit: string }>;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    bet: number;
    status: string;
  }>;
  pots: Array<{ size: number; eligiblePlayerIds: string[] }>;
  validActions: Array<{
    type: string;
    amount?: number | null;
    min?: number | null;
    max?: number | null;
  }>;
}

interface AgentTurnResult {
  action: { type: string; amount?: number };
  analysis?: string;  // extracted from LLM text output, not a tool parameter
}
```

### Internal state per agent

```typescript
interface AgentState {
  config: PlayerConfig;
  moduleId: string;             // For persisting messages to the DB
  systemPrompt: string;         // Template with metadata interpolated
  messages: ModelMessage[];      // Full conversation history (ai SDK message format)
  lastToolCallId?: string;      // For reject-and-retry flow
}
```

The agent runner holds a `Map<string, AgentState>` — one entry per player in the game. Initialized at session start, persists until the game ends.

### LLM provider support

The agent runner uses the Vercel AI SDK (`ai` package) with multi-provider support:
- `@ai-sdk/anthropic` — Anthropic (Claude)
- `@ai-sdk/openai` — OpenAI (GPT)
- `@ai-sdk/google` — Google (Gemini)
- `@ai-sdk/xai` — xAI (Grok)
- `@ai-sdk/deepseek` — DeepSeek
- `@ai-sdk/amazon-bedrock` — Amazon Bedrock (Nova, Mistral, etc.)

The provider is selected based on `PlayerConfig.provider`. Each agent can use a different provider/model.

## Front-End Forwarding

The proctor emits render instructions to the front-end via pub/sub subscription. The proctor does not wait for the front-end for most instructions — it emits and continues. The exceptions are `GAME_START` and `GAME_OVER`, where the proctor gates on client ACKs. The front-end queues instructions and renders at its own pace.

For each player turn, the proctor emits three instructions:

1. **PLAYER_TURN** — front-end highlights the active player's seat
2. **PLAYER_ANALYSIS** (optional) — front-end renders analysis text, plays TTS with the player's voice
3. **PLAYER_ACTION** — front-end shows the action animation (chips moving, cards folding, etc.)

Each character's `ttsVoice` config specifies a voice name for TTS (Inworld). Each agent gets a distinct voice so viewers can distinguish who is speaking. Voice names are sent to the front-end via `playerMeta` in the `GAME_START` instruction.

## Error Handling

### Agent timeout
The agent runner enforces a maximum turn duration (15s). If the agent doesn't call `submit_action` in time, auto-check (if valid) or auto-fold.

### LLM API failure
If the LLM call fails (network error, rate limit, invalid response), the agent runner retries up to 3 times with a 2-second delay. If all retries fail, the orchestrator auto-checks or auto-folds. The game continues.

### Invalid action from agent
If the agent calls `submit_action` with an action that isn't in `validActions` (e.g., CHECK when only FOLD/CALL/RAISE are valid), the orchestrator calls `agentRunner.rejectAction()` which replaces the tool result with an error and re-prompts the LLM. Up to 3 retries. If all retries fail, auto-check or auto-fold.

### Invalid bet amount
If the agent bets an amount outside the valid range, the same reject-and-retry flow applies. The error message includes the valid range.

### Agent produces no tool call
If the agent produces only text and no structured tool call, the agent runner first attempts to parse a tool call from the text output (some models like Llama 4 on Bedrock emit tool calls as JSON text instead of structured calls). If parsing also fails, the agent runner throws and the orchestrator auto-checks or auto-folds.

### All error paths
Every error path results in a CHECK (if valid) or FOLD. The game always progresses. No error can stall the game loop.

## Separation of Concerns

| Component | Owns | Does NOT do |
|---|---|---|
| **Poker engine** | Turn order, valid actions, phase transitions, blinds, pot calculation, hand evaluation, win conditions, history | Anything about agents, LLMs, rendering, or sessions |
| **Proctor** | Game loop sequencing, invoking agents in order, injecting game events into agent conversations, emitting render instructions, skipping busted players | Deciding turn order (engine), validating actions (engine), reasoning about poker (agents), rendering (front-end) |
| **Agent runner** | LLM API calls, tool-use loop, conversation state per agent, prompt template interpolation, action validation against valid actions, retry logic, timeout enforcement | Game flow, turn order, knowing about other agents, rendering |
| **Instruction builder** | Formatting render instruction payloads from game state | Game logic, agent logic, delivery |
| **Message formatter** | Human-readable game event strings for agent conversations | Game logic, agent logic, rendering |
| **Session manager** | Session lifecycle, connected front-end clients, `completeInstruction` tracking, abort signals | Game logic, agent logic, instruction content |
| **Pub/sub** | Delivering render instructions to subscribed front-ends | Everything else |
| **Front-end** | Rendering instructions, TTS, animations, `completeInstruction` acks | Game logic, turn order, agent decisions |

### Data flow summary

```
Game Engine ←——— Proctor ———→ Agent Runner ———→ LLM API
   (state)     (sequencing)   (conversation)    (reasoning)
                   |
                   ↓
          Instruction Builder
                   |
                   ↓
               Pub/Sub ———→ Front-End
                            (render + TTS)
```

The proctor sits in the center. It reads state from the game engine, sends context to the agent runner, receives actions back, submits them to the engine, and pushes instructions to the front-end. It is a thin procedural coordinator with no intelligence of its own.
