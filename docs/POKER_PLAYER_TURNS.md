# Poker Player Turns

How agents play poker. The proctor drives the game procedurally, invoking each agent on their turn and waiting for a tool call response. Agents maintain persistent conversation state across all turns within a game.

## Player Schema

Each player is an AI agent with metadata that controls its identity, model, and front-end presentation.

```typescript
interface PlayerConfig {
  id: string;              // Unique identifier (e.g., "aggressive-al")
  name: string;            // Display name (e.g., "Grok")
  modelId: string;         // LLM model identifier (e.g., "claude-sonnet-4-5-20250929")
  modelName: string;       // Friendly model name for display (e.g., "Claude Sonnet")
  provider: string;        // Model provider (e.g., "anthropic", "openai", "google")
  avatarUrl: string;       // Avatar image URL for front-end rendering
  ttsVoice: string;        // TTS voice model identifier (e.g., "EXAVITQu4vr4xnSDxMaL")
  temperature?: number;    // Optional creativity setting (default: provider default)
}
```

The front-end uses `name`, `avatarUrl`, and `ttsVoice` for rendering. The agent runner uses `modelId`, `provider`, and `temperature` for LLM calls. The prompt template uses all metadata fields to give the agent its identity.

### Session config

```typescript
interface SessionConfig {
  players: PlayerConfig[];
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  handsPerGame?: number;   // null = play until one player remains
}
```

## Shared Prompt Template

All agents use the same system prompt template. The template inserts player metadata to give each agent its identity. The model itself — not the prompt — provides behavioral differences.

```
You are {{name}}, a poker player in a Texas Hold'em tournament.
You are powered by {{modelName}} from {{provider}}.

You are playing against other AI models. Each opponent is a different model
with its own strategy. Play to win.

You will receive game updates as the hand progresses — community cards,
other players' actions, hand results. When it is your turn, you will be
given your hole cards, the current game state, and your valid actions.

When you are ready to act, call the submit_action tool with:
- Your action (fold, check, call, bet, or raise)
- The bet amount (required for bet and raise)
- Your analysis — audience-facing commentary explaining your thinking,
  your read on opponents, and why you chose this action. This is shown
  to viewers and spoken aloud via TTS. Be insightful and entertaining.

You may reason internally before calling submit_action. Take your time to
analyze the hand, consider pot odds, evaluate opponent tendencies, and
plan your strategy. But you MUST eventually call submit_action to complete
your turn.

Other players cannot see your analysis or your internal reasoning.
They only see the action you take (fold/check/call/bet/raise and the amount).
```

The template is stored as a single string in the codebase. The agent runner interpolates `{{name}}`, `{{modelName}}`, and `{{provider}}` at session start when constructing each agent's system prompt. No other customization per agent.

## Agent Tools

Each agent has one tool available during their turn.

### submit_action (required — ends the turn)

```typescript
{
  name: "submit_action",
  description: "Submit your poker action. This ends your turn.",
  parameters: {
    action: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE",
    amount?: number,    // Required for BET and RAISE. Ignored for others.
    analysis: string    // Audience-facing commentary. Shown to viewers, spoken via TTS.
  }
}
```

The agent runner validates the tool call against the valid actions from the game engine. If the agent submits an invalid action (wrong type, out-of-range amount), the agent runner sends back a tool result error and lets the agent retry. If retries are exhausted, auto-fold.

History is not provided via a separate tool — the proctor injects all game events (opponent actions, community cards, hand results) directly into the agent's conversation. The conversation IS the history.

### Agent turn loop

The agent runner handles each turn:

1. Send "your turn" message to LLM with game state, hole cards, valid actions
2. LLM responds with a `submit_action` tool call
3. Validate action against valid actions, return result to proctor
4. If no tool call or invalid action after retries → auto-fold

## Agent Conversation Lifecycle

Each agent maintains a **persistent conversation** for the duration of the game. The conversation accumulates messages across all turns and hands. This gives agents memory of what happened — they can reference earlier hands, recall opponent patterns, and build a mental model of the table.

### Conversation structure

```
System: [prompt template with metadata]

--- Hand 1 ---
User: [DEAL_HANDS — your hole cards, table state, positions]
User: [YOUR_TURN — game state, valid actions]
Assistant: [reasoning + submit_action tool call]
Tool: [action confirmed]
User: [OPPONENT_ACTION — Bob calls]
User: [OPPONENT_ACTION — Charlie raises to 80]
User: [YOUR_TURN — updated game state, valid actions]
Assistant: [reasoning + submit_action tool call]
Tool: [action confirmed]
User: [DEAL_COMMUNITY — flop: A♠ K♦ 7♣]
User: [OPPONENT_ACTION — Bob checks]
User: [YOUR_TURN — updated game state, valid actions]
Assistant: [reasoning + submit_action tool call]
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
Flop: A♠ K♦ 7♣
```
```
Turn: 9♥
```
```
River: 2♣
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
8. Emit render instructions to the front-end
9. Wait for `renderComplete` before proceeding

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
            inject YOUR_TURN into player's agent
            result = await agentRunner.runTurn(player)   // blocks until submit_action
            submitAction(player, result.action)
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
                break

    if game is over:
        emit GAME_OVER
        break
    else:
        emit LEADERBOARD
```

### Key design decision: proctor injects messages, not the agent runner

The proctor is responsible for building and injecting all game event messages (DEAL_HANDS, OPPONENT_ACTION, DEAL_COMMUNITY, HAND_RESULT) into each agent's conversation. The agent runner only handles the agentic tool-use loop for a single turn — it doesn't know about game flow.

This keeps the agent runner generic. It receives a conversation (with all prior messages already appended), adds the YOUR_TURN message, and runs the LLM loop until `submit_action` is called.

## Turn Sequence — Detailed

A single player turn, step by step:

```
1. Proctor asks game engine: getGameState() → currentPlayerId = "alice"

2. Proctor builds YOUR_TURN message for Alice:
   - Reads game state from engine (phase, community cards, pots, player chips)
   - Reads Alice's hole cards from engine (getMyTurn)
   - Reads valid actions from engine
   - Formats as human-readable text

3. Proctor calls agentRunner.runTurn("alice", context):
   - Agent runner appends YOUR_TURN message to Alice's conversation
   - Agent runner sends conversation to LLM (Anthropic/OpenAI/Google API)
   - LLM reasons internally (text output — not shown to anyone)
   - LLM calls submit_action({ action: "RAISE", amount: 80, analysis: "..." })
   - Agent runner validates action against valid actions
   - Agent runner appends assistant message to conversation
   - Agent runner returns { action: { type: "RAISE", amount: 80 }, analysis: "..." }

4. Proctor submits action to game engine:
   - poker.submitAction(gameId, "alice", "RAISE", 80)
   - Engine validates and updates state

5. Proctor emits PLAYER_ACTION render instruction to front-end:
   - Includes action, amount, and analysis
   - Front-end renders analysis text, plays TTS with Alice's voice, shows raise animation
   - Front-end calls renderComplete when done

6. Proctor injects OPPONENT_ACTION into all other agents' conversations:
   - Bob's conversation gets: "Alice raises to 80."
   - Charlie's conversation gets: "Alice raises to 80."
   - Alice does NOT get this message (she already knows — she did it)
```

## Agent Runner Interface

```typescript
interface AgentRunner {
  /** Initialize a new agent for a game. Called once per player at session start. */
  initAgent(playerId: string, config: PlayerConfig): void;

  /** Append a game event message to an agent's conversation. */
  injectMessage(playerId: string, message: string): void;

  /**
   * Run the agent's turn. Appends YOUR_TURN to the conversation,
   * runs the LLM tool-use loop, returns the action and analysis.
   * The conversation is updated in place with the full exchange.
   */
  runTurn(playerId: string, turnContext: TurnContext): Promise<TurnResult>;
}

interface TurnContext {
  gameId: string;
  handNumber: number;
  phase: string;
  communityCards: Card[];
  myHand: Card[];
  players: PlayerState[];
  pots: Pot[];
  validActions: ValidAction[];
}

interface TurnResult {
  action: { type: string; amount?: number };
  analysis: string;
}
```

### Internal state per agent

```typescript
interface AgentState {
  playerId: string;
  config: PlayerConfig;
  systemPrompt: string;       // Template with metadata interpolated
  messages: Message[];         // Full conversation history
}

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };
```

The agent runner holds a `Map<string, AgentState>` — one entry per player in the game. Initialized at session start, persists until the game ends.

## Front-End Forwarding

The proctor emits render instructions to the front-end via pub/sub subscription. The front-end renders each instruction and calls `renderComplete` to signal it's done. The proctor blocks until `renderComplete` before proceeding.

For `PLAYER_ACTION` instructions:
1. Front-end receives the instruction with `analysis` and `action`
2. Front-end renders the analysis text on screen
3. Front-end converts analysis to speech using the player's `ttsVoice` via TTS (ElevenLabs)
4. Front-end plays the audio and animates the action (chips moving, cards folding, etc.)
5. Front-end calls `renderComplete`

The `ttsVoice` on `PlayerConfig` maps to a voice in the TTS provider. Each agent gets a distinct voice so viewers can distinguish who is speaking.

## Error Handling

### Agent timeout
The agent runner enforces a maximum turn duration (e.g., 60 seconds). If the agent doesn't call `submit_action` in time, auto-fold.

### LLM API failure
If the LLM call fails (network error, rate limit, invalid response), the agent runner catches the error and returns auto-fold. The proctor logs the error but continues the game.

### Invalid action from agent
If the agent calls `submit_action` with an action that isn't in `validActions` (e.g., CHECK when only FOLD/CALL/RAISE are valid), the agent runner returns a tool error and lets the agent retry (up to 3 retries). If all retries fail, auto-fold.

### Invalid bet amount
If the agent bets an amount outside the valid range, the agent runner returns a tool error with the valid range and lets the agent retry.

### Agent produces no tool call
If the agent produces only text and no tool call after the maximum iteration count, auto-fold.

### All error paths
Every error path results in a FOLD. The game always progresses. No error can stall the game loop.

## Separation of Concerns

| Component | Owns | Does NOT do |
|---|---|---|
| **Poker engine** | Turn order, valid actions, phase transitions, blinds, pot calculation, hand evaluation, win conditions, history | Anything about agents, LLMs, rendering, or sessions |
| **Proctor** | Game loop sequencing, invoking agents in order, injecting game events into agent conversations, emitting render instructions, skipping busted players | Deciding turn order (engine), validating actions (engine), reasoning about poker (agents), rendering (front-end) |
| **Agent runner** | LLM API calls, tool-use loop, conversation state per agent, prompt template interpolation, action validation against valid actions, retry logic, timeout enforcement | Game flow, turn order, knowing about other agents, rendering |
| **Instruction builder** | Formatting render instruction payloads from game state | Game logic, agent logic, delivery |
| **Session manager** | Session lifecycle, connected front-end clients, `renderComplete` tracking, abort signals | Game logic, agent logic, instruction content |
| **Pub/sub** | Delivering render instructions to subscribed front-ends | Everything else |
| **Front-end** | Rendering instructions, TTS, animations, `renderComplete` acks | Game logic, turn order, agent decisions |

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
