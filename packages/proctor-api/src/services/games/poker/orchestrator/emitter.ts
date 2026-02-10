import { insertInstruction } from "../../../../persistence.js";
import type { GameState, RenderInstruction } from "../../../../types.js";
import { publish } from "../../../session/pubsub.js";
import type { Session } from "../../../session/session-manager.js";

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
