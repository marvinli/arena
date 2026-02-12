/**
 * Promise-based gate that lets the session loop await client ACKs
 * for specific instructions (e.g. GAME_START, GAME_OVER).
 */

const waiters = new Map<string, () => void>();
const preAcks = new Set<string>();

function key(moduleId: string, instructionId: string): string {
  return `${moduleId}:${instructionId}`;
}

/**
 * Wait for the client to ACK a specific instruction.
 * Resolves immediately if the ACK already arrived.
 * Resolves on abort so the caller can check `signal.aborted` and bail out.
 */
export function waitForAck(
  moduleId: string,
  instructionId: string,
  signal?: AbortSignal,
): Promise<void> {
  const k = key(moduleId, instructionId);

  if (preAcks.has(k)) {
    preAcks.delete(k);
    return Promise.resolve();
  }

  if (signal?.aborted) return Promise.resolve();

  return new Promise<void>((resolve) => {
    waiters.set(k, resolve);
    signal?.addEventListener(
      "abort",
      () => {
        waiters.delete(k);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Signal that the client has ACKed an instruction.
 * Resolves the matching waiter, or stores a pre-ack if no waiter exists yet.
 */
export function notifyAck(moduleId: string, instructionId: string): void {
  const k = key(moduleId, instructionId);
  const resolve = waiters.get(k);
  if (resolve) {
    waiters.delete(k);
    resolve();
  } else {
    preAcks.add(k);
  }
}

export function _resetAckGate(): void {
  waiters.clear();
  preAcks.clear();
}
