import {
  insertInstruction,
  upsertChannelState,
} from "../../../../persistence.js";
import type { GameState, RenderInstruction } from "../../../../types.js";
import { publish } from "../../../session/pubsub.js";
import type { Session } from "../../../session/session-manager.js";

function buildSnapshot(session: Session): string {
  const gs = session.lastGameState;
  return JSON.stringify({
    channelKey: session.channelKey,
    status: session.status,
    gameId: session.gameId,
    handNumber: session.handNumber,
    phase: gs?.phase ?? null,
    button: gs?.button ?? null,
    smallBlind: session.config.smallBlind,
    bigBlind: session.config.bigBlind,
    players: gs?.players ?? [],
    communityCards: gs?.communityCards ?? [],
    pots: gs?.pots ?? [],
    hands: session.currentHands,
    playerMeta: session.config.players.map((p) => ({
      id: p.playerId,
      ttsVoice: p.ttsVoice ?? null,
      avatarUrl: p.avatarUrl ?? null,
    })),
  });
}

export function emit(
  moduleId: string,
  session: Session,
  instruction: RenderInstruction,
): void {
  session.lastInstruction = instruction;
  insertInstruction(
    moduleId,
    Number(instruction.instructionId),
    instruction.type,
    instruction,
  );
  upsertChannelState(
    session.channelKey,
    moduleId,
    Number(instruction.instructionId),
    buildSnapshot(session),
  );
  const fullInstruction = { ...instruction, moduleId };
  publish(session.channelKey, fullInstruction);
}

export function updateGameState(session: Session, state: GameState): void {
  session.gameId = state.gameId;
  session.lastGameState = {
    phase: state.phase,
    button: state.button ?? null,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      bet: p.bet,
      status: p.status,
      seatIndex: p.seatIndex,
    })),
    communityCards: state.communityCards.map((c) => ({
      rank: c.rank,
      suit: c.suit,
    })),
    pots: state.pots.map((p) => ({
      size: p.size,
      eligiblePlayerIds: p.eligiblePlayerIds,
    })),
  };

  for (const sp of session.players) {
    const gp = state.players.find((p) => p.id === sp.id);
    if (gp) sp.chips = gp.chips;
  }
}
