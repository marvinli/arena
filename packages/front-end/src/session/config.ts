// ── Session config ──────────────────────────────────────

export const CHANNEL_KEY =
  import.meta.env.VITE_CHANNEL_KEY ?? "local-dev";

/** Cancellable delay that resolves immediately if the signal is aborted. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
