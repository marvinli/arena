import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory store to simulate DynamoDB tables
const tables: Record<string, Map<string, Record<string, unknown>>> = {};

function getTable(name: string): Map<string, Record<string, unknown>> {
  if (!tables[name]) tables[name] = new Map();
  return tables[name];
}

function makeKey(key: Record<string, unknown>): string {
  return Object.values(key).join("#");
}

vi.mock("@aws-sdk/lib-dynamodb", () => {
  class PutCommand {
    input: { TableName: string; Item: Record<string, unknown> };
    constructor(input: { TableName: string; Item: Record<string, unknown> }) {
      this.input = input;
    }
  }
  class GetCommand {
    input: {
      TableName: string;
      Key: Record<string, unknown>;
      ProjectionExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
    };
    constructor(input: {
      TableName: string;
      Key: Record<string, unknown>;
      ProjectionExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
    }) {
      this.input = input;
    }
  }
  class QueryCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class UpdateCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class DeleteCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  return { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand };
});

vi.mock("../src/db.js", () => {
  const docClient = {
    send: vi.fn(async (command: { input: Record<string, unknown> }) => {
      const cmdName = command.constructor.name;
      const input = command.input;
      const tableName = input.TableName as string;
      const table = getTable(tableName);

      if (cmdName === "PutCommand") {
        const item = input.Item as Record<string, unknown>;
        // Determine key based on table
        let key: string;
        if (tableName.endsWith("modules")) {
          key = item.moduleId as string;
        } else if (tableName.endsWith("instructions")) {
          key = `${item.moduleId}#${item.timestampMs}`;
        } else if (tableName.endsWith("channel-state")) {
          key = item.channelKey as string;
        } else if (tableName.endsWith("settings")) {
          key = item.key as string;
        } else if (tableName.endsWith("agent-messages")) {
          key = `${item.pk}#${item.seq}`;
        } else {
          key = makeKey(item);
        }
        table.set(key, { ...item });
        return {};
      }

      if (cmdName === "GetCommand") {
        const keyObj = input.Key as Record<string, unknown>;
        let key: string;
        if (tableName.endsWith("modules")) {
          key = keyObj.moduleId as string;
        } else if (tableName.endsWith("instructions")) {
          key = `${keyObj.moduleId}#${keyObj.timestampMs}`;
        } else if (tableName.endsWith("channel-state")) {
          key = keyObj.channelKey as string;
        } else if (tableName.endsWith("settings")) {
          key = keyObj.key as string;
        } else {
          key = makeKey(keyObj);
        }
        const item = table.get(key);
        return { Item: item ?? undefined };
      }

      if (cmdName === "UpdateCommand") {
        const keyObj = input.Key as Record<string, unknown>;
        let key: string;
        if (tableName.endsWith("modules")) {
          key = keyObj.moduleId as string;
        } else if (tableName.endsWith("channel-state")) {
          key = keyObj.channelKey as string;
        } else {
          key = makeKey(keyObj);
        }
        const item = table.get(key);
        if (!item) return {};
        // Parse simple SET update expressions
        const expr = input.UpdateExpression as string;
        const attrValues = (input.ExpressionAttributeValues ?? {}) as Record<
          string,
          unknown
        >;
        const attrNames = (input.ExpressionAttributeNames ?? {}) as Record<
          string,
          string
        >;

        const setMatch = expr.match(/SET\s+(.+)/);
        if (setMatch) {
          const assignments = setMatch[1].split(",");
          for (const assignment of assignments) {
            const [lhs, rhs] = assignment.split("=").map((s) => s.trim());
            const fieldName = attrNames[lhs] ?? lhs;
            item[fieldName] = attrValues[rhs];
          }
        }
        table.set(key, item);
        return {};
      }

      if (cmdName === "QueryCommand") {
        const keyCondExpr = input.KeyConditionExpression as string;
        const attrValues = (input.ExpressionAttributeValues ?? {}) as Record<
          string,
          unknown
        >;
        const scanForward = (input.ScanIndexForward as boolean) ?? true;
        const limit = input.Limit as number | undefined;

        // Parse key condition
        const items = [...table.values()];
        let filtered: Record<string, unknown>[];

        if (tableName.endsWith("instructions")) {
          const moduleId = attrValues[":mid"] as string;
          filtered = items.filter((item) => item.moduleId === moduleId);
          if (keyCondExpr.includes(">")) {
            const ts = attrValues[":ts"] as number;
            filtered = filtered.filter(
              (item) => (item.timestampMs as number) > ts,
            );
          }
          filtered.sort((a, b) =>
            scanForward
              ? (a.timestampMs as number) - (b.timestampMs as number)
              : (b.timestampMs as number) - (a.timestampMs as number),
          );
        } else if (tableName.endsWith("agent-messages")) {
          const pk = attrValues[":pk"] as string;
          filtered = items.filter((item) => item.pk === pk);
          filtered.sort((a, b) =>
            scanForward
              ? (a.seq as number) - (b.seq as number)
              : (b.seq as number) - (a.seq as number),
          );
        } else {
          filtered = items;
        }

        if (limit) {
          filtered = filtered.slice(0, limit);
        }

        return { Items: filtered };
      }

      return {};
    }),
  };

  return {
    default: docClient,
    tableNames: {
      modules: "test-modules",
      instructions: "test-instructions",
      channelState: "test-channel-state",
      settings: "test-settings",
      agentMessages: "test-agent-messages",
    },
  };
});

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
    // Clear all in-memory tables
    for (const key of Object.keys(tables)) {
      tables[key].clear();
    }
  });

  // ── Modules ──────────────────────────────────────────────

  describe("modules", () => {
    it("creates and retrieves a module", async () => {
      const mod = await createModule("mod-1", "poker", 0);
      expect(mod.moduleId).toBe("mod-1");
      expect(mod.type).toBe("poker");
      expect(mod.progIndex).toBe(0);
      expect(mod.status).toBe("running");
      expect(mod.createdAt).toBeGreaterThan(0);

      const fetched = await getModule("mod-1");
      expect(fetched).toEqual(mod);
    });

    it("returns undefined for nonexistent module", async () => {
      expect(await getModule("does-not-exist")).toBeUndefined();
    });

    it("completes a module", async () => {
      await createModule("mod-1", "poker", 0);
      await completeModule("mod-1");
      const fetched = await getModule("mod-1");
      expect(fetched?.status).toBe("completed");
    });
  });

  // ── Instructions ─────────────────────────────────────────

  describe("instructions", () => {
    it("inserts and retrieves instructions in order", async () => {
      await createModule("mod-1", "poker", 0);
      await insertInstruction("mod-1", 100, "GAME_START", { foo: 1 });
      await insertInstruction("mod-1", 200, "DEAL_HANDS", { bar: 2 });

      const all = await getInstructions("mod-1");
      expect(all).toHaveLength(2);
      expect(all[0].type).toBe("GAME_START");
      expect(all[0].timestampMs).toBe(100);
      expect(JSON.parse(all[0].payload)).toEqual({ foo: 1 });
      expect(all[1].type).toBe("DEAL_HANDS");
    });

    it("filters instructions after a timestamp", async () => {
      await createModule("mod-1", "poker", 0);
      await insertInstruction("mod-1", 100, "A", {});
      await insertInstruction("mod-1", 200, "B", {});
      await insertInstruction("mod-1", 300, "C", {});

      const after = await getInstructions("mod-1", 100);
      expect(after).toHaveLength(2);
      expect(after[0].type).toBe("B");
      expect(after[1].type).toBe("C");
    });

    it("returns latest instruction", async () => {
      await createModule("mod-1", "poker", 0);
      await insertInstruction("mod-1", 100, "A", {});
      await insertInstruction("mod-1", 200, "B", {});

      const latest = await getLatestInstruction("mod-1");
      expect(latest?.type).toBe("B");
      expect(latest?.timestampMs).toBe(200);
    });

    it("returns undefined for module with no instructions", async () => {
      await createModule("mod-1", "poker", 0);
      expect(await getLatestInstruction("mod-1")).toBeUndefined();
    });
  });

  // ── Channel State ────────────────────────────────────────

  describe("channel state", () => {
    it("returns undefined for unknown channel", async () => {
      expect(await getChannelState("unknown")).toBeUndefined();
    });

    it("upserts and retrieves channel state", async () => {
      await createModule("mod-1", "poker", 0);
      await upsertChannelState("ch-1", "mod-1", 100, '{"x":1}');

      const state = await getChannelState("ch-1");
      expect(state).toEqual({
        channelKey: "ch-1",
        moduleId: "mod-1",
        instructionTs: 100,
        stateSnapshot: '{"x":1}',
        ackedInstructionTs: null,
      });
    });

    it("overwrites on conflict", async () => {
      await createModule("mod-1", "poker", 0);
      await createModule("mod-2", "poker", 1);
      await upsertChannelState("ch-1", "mod-1", 100, '{"v":1}');
      await upsertChannelState("ch-1", "mod-2", 200, '{"v":2}');

      const state = await getChannelState("ch-1");
      expect(state?.moduleId).toBe("mod-2");
      expect(state?.instructionTs).toBe(200);
      expect(state?.stateSnapshot).toBe('{"v":2}');
    });

    it("handles null instructionTs and stateSnapshot", async () => {
      await createModule("mod-1", "poker", 0);
      await upsertChannelState("ch-1", "mod-1");

      const state = await getChannelState("ch-1");
      expect(state?.instructionTs).toBeNull();
      expect(state?.stateSnapshot).toBeNull();
    });
  });

  // ── Agent Messages ───────────────────────────────────────

  describe("agent messages", () => {
    it("appends messages with auto-incrementing seq", async () => {
      await createModule("mod-1", "poker", 0);
      await appendAgentMessage("mod-1", "p1", "user", "hello");
      await appendAgentMessage("mod-1", "p1", "assistant", "world");

      const msgs = await getAgentMessages("mod-1", "p1");
      expect(msgs).toHaveLength(2);
      expect(msgs[0].seq).toBe(0);
      expect(msgs[0].role).toBe("user");
      expect(msgs[0].content).toBe("hello");
      expect(msgs[1].seq).toBe(1);
      expect(msgs[1].role).toBe("assistant");
    });

    it("keeps separate sequences per player", async () => {
      await createModule("mod-1", "poker", 0);
      await appendAgentMessage("mod-1", "p1", "user", "a");
      await appendAgentMessage("mod-1", "p2", "user", "b");

      const p1 = await getAgentMessages("mod-1", "p1");
      const p2 = await getAgentMessages("mod-1", "p2");
      expect(p1).toHaveLength(1);
      expect(p2).toHaveLength(1);
      expect(p1[0].seq).toBe(0);
      expect(p2[0].seq).toBe(0);
    });

    it("returns empty array for no messages", async () => {
      await createModule("mod-1", "poker", 0);
      expect(await getAgentMessages("mod-1", "p1")).toEqual([]);
    });
  });

  // ── Settings ─────────────────────────────────────────────

  describe("settings", () => {
    it("returns undefined for unknown key", async () => {
      expect(await getSetting("unknown")).toBeUndefined();
    });

    it("sets and gets a setting", async () => {
      await setSetting("theme", "dark");
      expect(await getSetting("theme")).toBe("dark");
    });

    it("overwrites existing setting", async () => {
      await setSetting("theme", "dark");
      await setSetting("theme", "light");
      expect(await getSetting("theme")).toBe("light");
    });
  });
});
