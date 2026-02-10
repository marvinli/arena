import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../types";

export interface DealAnimationState {
  /** Number of cards visible for this player: 0, 1, or 2 */
  visibleCards: number;
  /** Whether visible cards should show face-up (true) or face-down (false) */
  faceUp: boolean;
}

const DEAL_INTERVAL_MS = 150;
const FLIP_PAUSE_MS = 300;
const FLIP_DURATION_MS = 400;

/**
 * Compute deal order: clockwise starting from the player after the dealer,
 * only including players who were dealt cards.
 */
function computeDealOrder(button: number | null, players: Player[]): number[] {
  if (button === null || players.length === 0) return [];

  // Find the dealer's index in the players array
  const dealerIdx = players.findIndex((_, i) => i === button);
  if (dealerIdx === -1) return [];

  const order: number[] = [];
  for (let i = 1; i <= players.length; i++) {
    const idx = (dealerIdx + i) % players.length;
    // Only include players who were actually dealt cards
    if (players[idx]?.cards !== null) {
      order.push(idx);
    }
  }
  return order;
}

/**
 * Drives a staged dealing animation when a new hand starts.
 *
 * Returns a map from player index to visibility state. When not animating,
 * all players get { visibleCards: 2, faceUp: true } (pass-through).
 */
export function useDealAnimation(
  handNumber: number,
  button: number | null,
  players: Player[],
): Map<number, DealAnimationState> {
  // step = -1 means not animating (pass-through)
  // step 0..2N = dealing cards, step 2N+1 = flipping
  const [step, setStep] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHandRef = useRef(0);

  const dealOrder = useMemo(
    () => (step >= 0 ? computeDealOrder(button, players) : []),
    [step, button, players],
  );

  const dealtPlayerCount = dealOrder.length;
  const totalDealSteps = dealtPlayerCount * 2;

  // Detect new hand synchronously during render to avoid a flicker frame
  // where cards appear face-up before the animation starts.
  if (handNumber > prevHandRef.current && handNumber > 0) {
    prevHandRef.current = handNumber;
    setStep(0);
  }

  // Timer progression
  useEffect(() => {
    if (step < 0) return;

    let delayMs: number;
    if (step < totalDealSteps) {
      // Dealing phase: one card per interval
      delayMs = DEAL_INTERVAL_MS;
    } else if (step === totalDealSteps) {
      // Pause before flip
      delayMs = FLIP_PAUSE_MS;
    } else {
      // Flip phase: wait for CSS transition, then done
      delayMs = FLIP_DURATION_MS;
    }

    timerRef.current = setTimeout(() => {
      if (step <= totalDealSteps) {
        setStep((s) => s + 1);
      } else {
        // Animation complete
        setStep(-1);
      }
    }, delayMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [step, totalDealSteps]);

  // Build the visibility map
  return useMemo(() => {
    const map = new Map<number, DealAnimationState>();

    if (step < 0 || dealtPlayerCount === 0) {
      // Not animating — pass-through
      for (let i = 0; i < players.length; i++) {
        map.set(i, { visibleCards: 2, faceUp: true });
      }
      return map;
    }

    // Cards flip face-up after all dealing steps + pause
    const faceUp = step > totalDealSteps;

    // Initialize all players to 0 visible cards
    for (let i = 0; i < players.length; i++) {
      map.set(i, { visibleCards: 0, faceUp });
    }

    // Count how many cards have been dealt so far
    const cardsDealt = Math.min(step, totalDealSteps);
    for (let s = 0; s < cardsDealt; s++) {
      const playerIdx = dealOrder[s % dealtPlayerCount];
      const current = map.get(playerIdx);
      if (current) {
        map.set(playerIdx, {
          ...current,
          visibleCards: current.visibleCards + 1,
        });
      }
    }

    return map;
  }, [step, players.length, dealtPlayerCount, totalDealSteps, dealOrder]);
}
