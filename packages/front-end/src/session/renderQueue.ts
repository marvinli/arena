import { speakAnalysis } from "../tts";
import { delay } from "./config";
import type { Action } from "./reducer";
import {
  communityAnimDuration,
  dealAnimDuration,
  ENDCARD_DISPLAY_MS,
  LEADERBOARD_DISPLAY_MS,
  POST_ACTION_PAUSE_MS,
  POST_HAND_PAUSE_MS,
  PRE_SHOWDOWN_PAUSE_MS,
  SHOWDOWN_DISPLAY_MS,
} from "./timing";
import type { GqlInstruction } from "./types";

// ── Public API ──────────────────────────────────────────

export interface RenderQueueDeps {
  dispatch: (action: Action) => void;
  voiceMap: Map<string, string>;
  signal: AbortSignal;
  onProcessed?: (instruction: GqlInstruction) => void;
}

export function createRenderQueue(deps: RenderQueueDeps) {
  const queue: GqlInstruction[] = [];
  let draining = false;

  // State persists across drain cycles (queue can empty and refill)
  const state: QueueState = {
    afterHandResult: false,
    prevCommunityCardCount: 0,
    ttsGate: Promise.resolve(),
  };

  function push(instruction: GqlInstruction) {
    queue.push(instruction);
    startDrain();
  }

  function startDrain() {
    if (draining) return;
    draining = true;
    void drain(queue, deps, state).finally(() => {
      draining = false;
    });
  }

  return { push };
}

// ── Handler interface ───────────────────────────────────

interface InstructionHandler {
  preWait?: (inst: GqlInstruction, ctx: DrainContext) => Promise<void>;
  execute: (inst: GqlInstruction, ctx: DrainContext) => void;
  postWait?: (inst: GqlInstruction, ctx: DrainContext) => Promise<void>;
}

interface DrainContext {
  dispatch: (action: Action) => void;
  voiceMap: Map<string, string>;
  signal: AbortSignal;
  /** Await the in-flight TTS gate. */
  awaitTts: () => Promise<void>;
  /** Shared mutable state across handlers. */
  state: QueueState;
}

interface QueueState {
  afterHandResult: boolean;
  prevCommunityCardCount: number;
  ttsGate: Promise<void>;
}

// ── Generic drain loop ──────────────────────────────────

async function drain(
  queue: GqlInstruction[],
  deps: RenderQueueDeps,
  state: QueueState,
): Promise<void> {
  const ctx: DrainContext = {
    dispatch: deps.dispatch,
    voiceMap: deps.voiceMap,
    signal: deps.signal,
    awaitTts: () => state.ttsGate,
    state,
  };

  while (queue.length > 0) {
    if (deps.signal.aborted) break;
    const inst = queue.shift();
    if (!inst) continue;

    const handler =
      handlers[inst.type as keyof typeof handlers] ?? defaultHandler;

    if (handler.preWait) await handler.preWait(inst, ctx);
    handler.execute(inst, ctx);
    if (handler.postWait) await handler.postWait(inst, ctx);
    deps.onProcessed?.(inst);
  }
}

// ── Default handler ─────────────────────────────────────

const defaultHandler: InstructionHandler = {
  execute(inst, ctx) {
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
  },
};

// ── Per-instruction-type handlers ───────────────────────

const gameStartHandler: InstructionHandler = {
  execute(inst, ctx) {
    if (inst.gameStart?.playerMeta) {
      for (const meta of inst.gameStart.playerMeta) {
        if (meta.ttsVoice) ctx.voiceMap.set(meta.id, meta.ttsVoice);
      }
    }
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
  },
};

const dealHandsHandler: InstructionHandler = {
  async preWait(_inst, ctx) {
    if (ctx.state.afterHandResult) {
      await delay(POST_HAND_PAUSE_MS, ctx.signal);
    }
  },
  execute(inst, ctx) {
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
    ctx.state.afterHandResult = false;
    ctx.state.prevCommunityCardCount = 0;
  },
  async postWait(inst, ctx) {
    const playerCount = inst.dealHands?.hands?.length ?? 0;
    await delay(dealAnimDuration(playerCount), ctx.signal);
  },
};

const dealCommunityHandler: InstructionHandler = {
  async preWait(_inst, ctx) {
    await delay(POST_ACTION_PAUSE_MS, ctx.signal);
  },
  execute(inst, ctx) {
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
  },
  async postWait(inst, ctx) {
    const totalCards = inst.dealCommunity?.communityCards?.length ?? 0;
    const newCards = totalCards - ctx.state.prevCommunityCardCount;
    ctx.state.prevCommunityCardCount = totalCards;
    await delay(communityAnimDuration(newCards), ctx.signal);
  },
};

const playerAnalysisHandler: InstructionHandler = {
  async preWait(_inst, ctx) {
    await ctx.awaitTts();
  },
  execute(inst, ctx) {
    if (!inst.playerAnalysis?.analysis) {
      ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
      return;
    }

    const { playerId, analysis, isApiError } = inst.playerAnalysis;
    const voiceId = ctx.voiceMap.get(playerId);

    ctx.dispatch({ type: "SPEAK_START", playerId, text: analysis, isApiError });

    ctx.state.ttsGate = (
      voiceId ? speakAnalysis(analysis, voiceId) : Promise.resolve()
    ).then(
      () => ctx.dispatch({ type: "SPEAK_END" }),
      () => ctx.dispatch({ type: "SPEAK_END" }),
    );
  },
  async postWait(_inst, ctx) {
    // Block the next instruction until TTS finishes so post-hand
    // reactions complete before DEAL_HANDS or GAME_OVER.
    await ctx.awaitTts();
  },
};

const playerActionHandler: InstructionHandler = {
  async preWait(_inst, ctx) {
    await ctx.awaitTts();
  },
  execute(inst, ctx) {
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
  },
};

const handResultHandler: InstructionHandler = {
  async preWait(_inst, ctx) {
    await delay(PRE_SHOWDOWN_PAUSE_MS, ctx.signal);
  },
  execute(inst, ctx) {
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
    ctx.state.afterHandResult = true;
  },
  async postWait(_inst, ctx) {
    await delay(SHOWDOWN_DISPLAY_MS, ctx.signal);
  },
};

const leaderboardHandler: InstructionHandler = {
  execute(inst, ctx) {
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
  },
  async postWait(_inst, ctx) {
    await delay(LEADERBOARD_DISPLAY_MS, ctx.signal);
  },
};

const gameOverHandler: InstructionHandler = {
  execute(inst, ctx) {
    ctx.dispatch({ type: "INSTRUCTION", instruction: inst });
    ctx.state.afterHandResult = false;
  },
  async postWait(_inst, ctx) {
    await delay(ENDCARD_DISPLAY_MS, ctx.signal);
  },
};

// ── Handler map ─────────────────────────────────────────

const handlers = {
  GAME_START: gameStartHandler,
  DEAL_HANDS: dealHandsHandler,
  DEAL_COMMUNITY: dealCommunityHandler,
  PLAYER_ANALYSIS: playerAnalysisHandler,
  PLAYER_ACTION: playerActionHandler,
  HAND_RESULT: handResultHandler,
  LEADERBOARD: leaderboardHandler,
  GAME_OVER: gameOverHandler,
} as const;
