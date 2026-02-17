import {
  insertInstruction,
  upsertChannelState,
} from "../../../../persistence.js";
import type { GameState, RenderInstruction } from "../../../../types.js";
import { publish } from "../../../session/pubsub.js";
import type { Session } from "../../../session/session-manager.js";
import {
  toCardInfos,
  toPlayerInfos,
  toPlayerMeta,
  toPotInfos,
} from "../instruction-builder.js";

export function buildSnapshot(session: Session): string {
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
    playerMeta: toPlayerMeta(session.config.players, session.personaAssignments),
  });
}

async function persistInstruction(
  moduleId: string,
  session: Session,
  instruction: RenderInstruction,
): Promise<void> {
  const snapshot = buildSnapshot(session);
  await insertInstruction(
    moduleId,
    Number(instruction.instructionId),
    instruction.type,
    instruction,
    snapshot,
  );
  await upsertChannelState(
    session.channelKey,
    moduleId,
    Number(instruction.instructionId),
    snapshot,
  );
}

function publishInstruction(
  moduleId: string,
  session: Session,
  instruction: RenderInstruction,
): void {
  const fullInstruction = { ...instruction, moduleId };
  publish(session.channelKey, fullInstruction);
}

export async function emit(
  moduleId: string,
  session: Session,
  instruction: RenderInstruction,
): Promise<void> {
  session.lastInstruction = instruction;
  await persistInstruction(moduleId, session, instruction);
  publishInstruction(moduleId, session, instruction);
}

export function updateGameState(session: Session, state: GameState): void {
  session.gameId = state.gameId;
  session.lastGameState = {
    phase: state.phase,
    button: state.button ?? null,
    players: toPlayerInfos(state.players),
    communityCards: toCardInfos(state.communityCards),
    pots: toPotInfos(state.pots),
  };

  for (const sp of session.players) {
    const gp = state.players.find((p) => p.id === sp.id);
    if (gp) sp.chips = gp.chips;
  }
}
