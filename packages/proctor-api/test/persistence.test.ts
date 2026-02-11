import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const testDb = new Database(":memory:");
  testDb.pragma("journal_mode = WAL");
  return { testDb };
});

vi.mock("../src/db.js", () => ({ default: testDb }));

import {
  appendAgentMessage,
  completeModule,
  createModule,
  getAgentMessages,
  getChannelState,
  getInstructions,
  getLatestInstruction,
  getModule,
  getSetting,
  insertInstruction,
  setSetting,
  upsertChannelState,
} from "../src/persistence.js";

describe("persistence", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM agent_messages");
    testDb.exec("DELETE FROM instructions");
    testDb.exec("DELETE FROM channel_state");
    testDb.exec("DELETE FROM settings");
    testDb.exec("DELETE FROM modules");
  });

  // ── Modules ──────────────────────────────────────────────

  describe("modules", () => {
    it("creates and retrieves a module", () => {
      const mod = createModule("mod-1", "poker", 0);
      expect(mod.moduleId).toBe("mod-1");
      expect(mod.type).toBe("poker");
      expect(mod.progIndex).toBe(0);
      expect(mod.status).toBe("running");
      expect(mod.createdAt).toBeGreaterThan(0);

      const fetched = getModule("mod-1");
      expect(fetched).toEqual(mod);
    });

    it("returns undefined for nonexistent module", () => {
      expect(getModule("does-not-exist")).toBeUndefined();
    });

    it("completes a module", () => {
      createModule("mod-1", "poker", 0);
      completeModule("mod-1");
      const fetched = getModule("mod-1");
      expect(fetched?.status).toBe("completed");
    });
  });

  // ── Instructions ─────────────────────────────────────────

  describe("instructions", () => {
    it("inserts and retrieves instructions in order", () => {
      createModule("mod-1", "poker", 0);
      insertInstruction("mod-1", 100, "GAME_START", { foo: 1 });
      insertInstruction("mod-1", 200, "DEAL_HANDS", { bar: 2 });

      const all = getInstructions("mod-1");
      expect(all).toHaveLength(2);
      expect(all[0].type).toBe("GAME_START");
      expect(all[0].timestampMs).toBe(100);
      expect(JSON.parse(all[0].payload)).toEqual({ foo: 1 });
      expect(all[1].type).toBe("DEAL_HANDS");
    });

    it("filters instructions after a timestamp", () => {
      createModule("mod-1", "poker", 0);
      insertInstruction("mod-1", 100, "A", {});
      insertInstruction("mod-1", 200, "B", {});
      insertInstruction("mod-1", 300, "C", {});

      const after = getInstructions("mod-1", 100);
      expect(after).toHaveLength(2);
      expect(after[0].type).toBe("B");
      expect(after[1].type).toBe("C");
    });

    it("returns latest instruction", () => {
      createModule("mod-1", "poker", 0);
      insertInstruction("mod-1", 100, "A", {});
      insertInstruction("mod-1", 200, "B", {});

      const latest = getLatestInstruction("mod-1");
      expect(latest?.type).toBe("B");
      expect(latest?.timestampMs).toBe(200);
    });

    it("returns undefined for module with no instructions", () => {
      createModule("mod-1", "poker", 0);
      expect(getLatestInstruction("mod-1")).toBeUndefined();
    });
  });

  // ── Channel State ────────────────────────────────────────

  describe("channel state", () => {
    it("returns undefined for unknown channel", () => {
      expect(getChannelState("unknown")).toBeUndefined();
    });

    it("upserts and retrieves channel state", () => {
      createModule("mod-1", "poker", 0);
      upsertChannelState("ch-1", "mod-1", 100, '{"x":1}');

      const state = getChannelState("ch-1");
      expect(state).toEqual({
        channelKey: "ch-1",
        moduleId: "mod-1",
        instructionTs: 100,
        stateSnapshot: '{"x":1}',
      });
    });

    it("overwrites on conflict", () => {
      createModule("mod-1", "poker", 0);
      createModule("mod-2", "poker", 1);
      upsertChannelState("ch-1", "mod-1", 100, '{"v":1}');
      upsertChannelState("ch-1", "mod-2", 200, '{"v":2}');

      const state = getChannelState("ch-1");
      expect(state?.moduleId).toBe("mod-2");
      expect(state?.instructionTs).toBe(200);
      expect(state?.stateSnapshot).toBe('{"v":2}');
    });

    it("handles null instructionTs and stateSnapshot", () => {
      createModule("mod-1", "poker", 0);
      upsertChannelState("ch-1", "mod-1");

      const state = getChannelState("ch-1");
      expect(state?.instructionTs).toBeNull();
      expect(state?.stateSnapshot).toBeNull();
    });
  });

  // ── Agent Messages ───────────────────────────────────────

  describe("agent messages", () => {
    it("appends messages with auto-incrementing seq", () => {
      createModule("mod-1", "poker", 0);
      appendAgentMessage("mod-1", "p1", "user", "hello");
      appendAgentMessage("mod-1", "p1", "assistant", "world");

      const msgs = getAgentMessages("mod-1", "p1");
      expect(msgs).toHaveLength(2);
      expect(msgs[0].seq).toBe(0);
      expect(msgs[0].role).toBe("user");
      expect(msgs[0].content).toBe("hello");
      expect(msgs[1].seq).toBe(1);
      expect(msgs[1].role).toBe("assistant");
    });

    it("keeps separate sequences per player", () => {
      createModule("mod-1", "poker", 0);
      appendAgentMessage("mod-1", "p1", "user", "a");
      appendAgentMessage("mod-1", "p2", "user", "b");

      const p1 = getAgentMessages("mod-1", "p1");
      const p2 = getAgentMessages("mod-1", "p2");
      expect(p1).toHaveLength(1);
      expect(p2).toHaveLength(1);
      expect(p1[0].seq).toBe(0);
      expect(p2[0].seq).toBe(0);
    });

    it("returns empty array for no messages", () => {
      createModule("mod-1", "poker", 0);
      expect(getAgentMessages("mod-1", "p1")).toEqual([]);
    });
  });

  // ── Settings ─────────────────────────────────────────────

  describe("settings", () => {
    it("returns undefined for unknown key", () => {
      expect(getSetting("unknown")).toBeUndefined();
    });

    it("sets and gets a setting", () => {
      setSetting("theme", "dark");
      expect(getSetting("theme")).toBe("dark");
    });

    it("overwrites existing setting", () => {
      setSetting("theme", "dark");
      setSetting("theme", "light");
      expect(getSetting("theme")).toBe("light");
    });
  });
});
