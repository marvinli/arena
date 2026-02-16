import { useEffect } from "react";
import {
  DEAL_INTERVAL_MS,
  FLIP_DURATION_MS,
  FLIP_PAUSE_MS,
} from "../session/timing";

/**
 * Shared timer progression for deal animations.
 *
 * 3-phase: deal interval → flip pause → flip duration, then resets to -1.
 */
export function useAnimationStepper(
  step: number,
  totalDealSteps: number,
  setStep: (updater: (s: number) => number) => void,
): void {
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

    const timer = setTimeout(() => {
      if (step <= totalDealSteps) {
        setStep((s) => s + 1);
      } else {
        setStep(() => -1);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [step, totalDealSteps, setStep]);
}
