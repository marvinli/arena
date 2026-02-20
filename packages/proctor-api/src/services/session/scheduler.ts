import { Cron } from "croner";
import { logError } from "../../logger.js";
import { getSetting, setSetting } from "../../persistence.js";
import { runProgrammingLoop } from "./programming.js";

const TAG = "scheduler";

let startJob: Cron | undefined;
let stopJob: Cron | undefined;

/**
 * Parse "HH:MM" into { hour, minute }. Returns undefined on invalid input.
 */
function parseTime(
  value: string,
): { hour: number; minute: number } | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return { hour, minute };
}

/**
 * Get the current hour and minute in the given IANA timezone.
 */
function nowInTimezone(tz: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

/**
 * Returns true when the current time in `tz` falls within [start, stop).
 * Handles overnight windows (e.g. start=22:00, stop=06:00).
 */
function isInWindow(
  now: { hour: number; minute: number },
  start: { hour: number; minute: number },
  stop: { hour: number; minute: number },
): boolean {
  const nowMin = now.hour * 60 + now.minute;
  const startMin = start.hour * 60 + start.minute;
  const stopMin = stop.hour * 60 + stop.minute;

  if (startMin < stopMin) {
    return nowMin >= startMin && nowMin < stopMin;
  }
  // Overnight window
  return nowMin >= startMin || nowMin < stopMin;
}

async function handleStart(channelKey: string): Promise<void> {
  console.log(`[${TAG}] Start cron fired — setting live flag`);
  const liveKey = `live:${channelKey}`;
  await setSetting(liveKey, "true");
  // runProgrammingLoop is idempotent (uses activeLoops Set)
  runProgrammingLoop(channelKey).catch((err) => {
    logError(
      TAG,
      "Programming loop error:",
      err instanceof Error ? err.message : String(err),
    );
  });
}

async function handleStop(channelKey: string): Promise<void> {
  console.log(`[${TAG}] Stop cron fired — clearing live flag`);
  const liveKey = `live:${channelKey}`;
  await setSetting(liveKey, "false");
}

/**
 * Start the stream scheduler. Reads env vars:
 * - SCHEDULE_START — "HH:MM" (required to enable)
 * - SCHEDULE_STOP  — "HH:MM" (defaults to 1 hour after start)
 * - SCHEDULE_TIMEZONE — IANA timezone (defaults to "America/New_York")
 *
 * No-op when SCHEDULE_START is unset.
 */
export function startScheduler(channelKey: string): void {
  const startStr = process.env.SCHEDULE_START;
  if (!startStr) return;

  const stopStr = process.env.SCHEDULE_STOP;
  const tz = process.env.SCHEDULE_TIMEZONE ?? "America/New_York";

  const start = parseTime(startStr);
  if (!start) {
    logError(TAG, `Invalid SCHEDULE_START: "${startStr}"`);
    return;
  }

  const stop = stopStr
    ? parseTime(stopStr)
    : { hour: (start.hour + 1) % 24, minute: start.minute };
  if (!stop) {
    logError(TAG, `Invalid SCHEDULE_STOP: "${stopStr}"`);
    return;
  }

  console.log(
    `[${TAG}] Scheduling stream: start=${startStr} stop=${stopStr ?? `${String(stop.hour).padStart(2, "0")}:${String(stop.minute).padStart(2, "0")}`} tz=${tz}`,
  );

  // Cron expressions: "minute hour * * *"
  startJob = new Cron(
    `${start.minute} ${start.hour} * * *`,
    { timezone: tz },
    () => {
      handleStart(channelKey).catch((err) => {
        logError(
          TAG,
          "Start handler error:",
          err instanceof Error ? err.message : String(err),
        );
      });
    },
  );

  stopJob = new Cron(
    `${stop.minute} ${stop.hour} * * *`,
    { timezone: tz },
    () => {
      handleStop(channelKey).catch((err) => {
        logError(
          TAG,
          "Stop handler error:",
          err instanceof Error ? err.message : String(err),
        );
      });
    },
  );

  // Startup window check — handle mid-window restarts
  const now = nowInTimezone(tz);
  if (isInWindow(now, start, stop)) {
    console.log(`[${TAG}] Currently in schedule window — starting immediately`);
    handleStart(channelKey).catch((err) => {
      logError(
        TAG,
        "Startup start error:",
        err instanceof Error ? err.message : String(err),
      );
    });
  } else {
    // Outside window — ensure live flag is off (handles crash recovery)
    const liveKey = `live:${channelKey}`;
    getSetting(liveKey)
      .then((val) => {
        if (val === "true") {
          console.log(
            `[${TAG}] Outside schedule window but live flag is on — clearing`,
          );
          setSetting(liveKey, "false").catch((err) => {
            logError(
              TAG,
              "Startup stop error:",
              err instanceof Error ? err.message : String(err),
            );
          });
        }
      })
      .catch((err) => {
        logError(
          TAG,
          "Startup check error:",
          err instanceof Error ? err.message : String(err),
        );
      });
  }
}

export function stopScheduler(): void {
  startJob?.stop();
  stopJob?.stop();
  startJob = undefined;
  stopJob = undefined;
}

export function _resetScheduler(): void {
  stopScheduler();
}

// Exported for testing
export {
  parseTime as _parseTime,
  nowInTimezone as _nowInTimezone,
  isInWindow as _isInWindow,
};
