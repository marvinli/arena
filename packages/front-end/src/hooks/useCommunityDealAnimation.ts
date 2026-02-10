import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEAL_INTERVAL_MS,
  FLIP_DURATION_MS,
  FLIP_PAUSE_MS,
} from "../session/timing";
import type { Card } from "../types";

export interface CommunityCardState {
  visible: boolean;
  faceUp: boolean;
}

/**
 * Animates community cards as they're dealt: cards appear one at a time
 * face-down, then flip face-up simultaneously.
 *
 * Returns state for each of the 5 card slots (indices 0-4).
 */
export function useCommunityDealAnimation(
  communityCards: Card[],
): Map<number, CommunityCardState> {
  // step = -1 means not animating (pass-through)
  const [step, setStep] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef(0);
  // Track how many cards were already on the board before this animation
  const baseCountRef = useRef(0);

  const cardCount = communityCards.length;
  const newCards = cardCount - baseCountRef.current;

  // Detect new community cards synchronously during render to avoid a
  // flicker frame where cards appear face-up before the animation starts.
  if (cardCount > prevCountRef.current) {
    baseCountRef.current = prevCountRef.current;
    prevCountRef.current = cardCount;
    setStep(0);
  }

  // Animation steps:
  // 0..(newCards-1) = dealing cards face-down one at a time
  // newCards = pause before flip
  // newCards+1 = flip (wait for CSS transition)
  const totalDealSteps = newCards;

  // Timer progression
  useEffect(() => {
    if (step < 0) return;

    let delayMs: number;
    if (step < totalDealSteps) {
      delayMs = DEAL_INTERVAL_MS;
    } else if (step === totalDealSteps) {
      delayMs = FLIP_PAUSE_MS;
    } else {
      delayMs = FLIP_DURATION_MS;
    }

    timerRef.current = setTimeout(() => {
      if (step <= totalDealSteps) {
        setStep((s) => s + 1);
      } else {
        setStep(-1);
      }
    }, delayMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [step, totalDealSteps]);

  return useMemo(() => {
    const map = new Map<number, CommunityCardState>();

    if (step < 0) {
      // Not animating — all existing cards visible and face-up
      for (let i = 0; i < 5; i++) {
        map.set(i, { visible: i < cardCount, faceUp: true });
      }
      return map;
    }

    const base = baseCountRef.current;
    const faceUp = step > totalDealSteps;
    const cardsDealt = Math.min(step, totalDealSteps);

    for (let i = 0; i < 5; i++) {
      if (i < base) {
        // Cards already on the board before this animation
        map.set(i, { visible: true, faceUp: true });
      } else if (i < base + cardsDealt) {
        // Newly dealt cards (visible, face-down until flip)
        map.set(i, { visible: true, faceUp });
      } else {
        // Not yet dealt
        map.set(i, { visible: false, faceUp: false });
      }
    }

    return map;
  }, [step, cardCount, totalDealSteps]);
}
