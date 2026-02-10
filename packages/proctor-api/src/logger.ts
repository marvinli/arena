import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(import.meta.dirname, "..", "logs");
mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = join(LOG_DIR, "error.log");

export function logError(tag: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  const message = args
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a)))
    .join(" ");
  const line = `[${ts}] [${tag}] ${message}\n`;
  appendFileSync(LOG_FILE, line);
  console.error(`[${tag}]`, ...args);
}
