import { setLive, startService, stopService } from "./actions.js";

export type SchedulerAction =
  | "startService"
  | "stopService"
  | "setLive"
  | "setNotLive";

const actions: Record<SchedulerAction, () => Promise<void>> = {
  startService,
  stopService,
  setLive: () => setLive(true),
  setNotLive: () => setLive(false),
};

export async function executeScheduledAction(action: string): Promise<void> {
  const fn = actions[action as SchedulerAction];
  if (!fn) {
    throw new Error(`Unknown scheduler action: ${action}`);
  }
  await fn();
}
