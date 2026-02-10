import type { GameState, RenderInstruction } from "../../../../types.js";
import { publish } from "../../../session/pubsub.js";
import type { Session } from "../../../session/session-manager.js";
import { waitForRenderComplete } from "../../../session/session-manager.js";

export async function emit(
  session: Session,
  instruction: RenderInstruction,
  signal: AbortSignal,
): Promise<void> {
  session.lastInstruction = instruction;
  publish(session.channelKey, instruction);
  await waitForRenderComplete(
    session.channelKey,
    instruction.instructionId,
    signal,
  );
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
