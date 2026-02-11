import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/persistence.js", () => ({
  getChannelState: vi.fn(),
  upsertChannelState: vi.fn(),
  createModule: vi.fn(),
  completeModule: vi.fn(),
  insertInstruction: vi.fn(),
  appendAgentMessage: vi.fn(),
  getAgentMessages: vi.fn(() => []),
  getSetting: vi.fn(() => "true"),
  setSetting: vi.fn(),
}));

import { _resetGames } from "../src/services/games/poker/poker-engine/index.js";
import { _resetPubSub } from "../src/services/session/pubsub.js";
import { _resetSessions } from "../src/services/session/session-manager.js";
import { gql } from "./yoga-helper.js";

describe("proctor-api GraphQL", () => {
  beforeEach(() => {
    _resetSessions();
    _resetPubSub();
    _resetGames();
  });

  describe("getSession", () => {
    it("returns null for non-existent session", async () => {
      const result = await gql(
        /* GraphQL */ `
          query GetSession($channelKey: String!) {
            getSession(channelKey: $channelKey) {
              channelKey
            }
          }
        `,
        { channelKey: "nope" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.getSession).toBeNull();
    });
  });

  describe("stopSession", () => {
    it("throws for non-existent session", async () => {
      const result = await gql(
        /* GraphQL */ `
          mutation StopSession($channelKey: String!) {
            stopSession(channelKey: $channelKey)
          }
        `,
        { channelKey: "nope" },
      );

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain("Session not found");
    });
  });

  describe("getChannelState", () => {
    it("returns empty state for non-existent channel", async () => {
      const result = await gql(
        /* GraphQL */ `
          query GetChannelState($channelKey: String!) {
            getChannelState(channelKey: $channelKey) {
              channelKey
              handNumber
              players {
                id
              }
              communityCards {
                rank
              }
              pots {
                size
              }
            }
          }
        `,
        { channelKey: "nope" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.getChannelState.channelKey).toBe("nope");
      expect(result.data!.getChannelState.handNumber).toBe(0);
      expect(result.data!.getChannelState.players).toEqual([]);
    });
  });

  describe("connect", () => {
    it("returns empty state for new channel", async () => {
      const result = await gql(
        /* GraphQL */ `
          query Connect($channelKey: String!) {
            connect(channelKey: $channelKey) {
              moduleId
              moduleType
              gameState {
                channelKey
                handNumber
              }
            }
          }
        `,
        { channelKey: "new-channel" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.connect.moduleId).toBe("");
      expect(result.data!.connect.moduleType).toBe("poker");
      expect(result.data!.connect.gameState).toBeNull();
    });
  });

  describe("startModule", () => {
    it("returns true for new channel", async () => {
      const result = await gql(
        /* GraphQL */ `
          mutation StartModule($channelKey: String!) {
            startModule(channelKey: $channelKey)
          }
        `,
        { channelKey: "test-channel" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.startModule).toBe(true);
    });

    it("returns true idempotently when session already running", async () => {
      // First call starts the module
      await gql(
        /* GraphQL */ `
          mutation StartModule($channelKey: String!) {
            startModule(channelKey: $channelKey)
          }
        `,
        { channelKey: "test-channel-2" },
      );

      // Second call should be idempotent
      const result = await gql(
        /* GraphQL */ `
          mutation StartModule($channelKey: String!) {
            startModule(channelKey: $channelKey)
          }
        `,
        { channelKey: "test-channel-2" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.startModule).toBe(true);
    });
  });

  describe("completeInstruction", () => {
    it("records a bookmark", async () => {
      const result = await gql(
        /* GraphQL */ `
          mutation CompleteInstruction(
            $channelKey: String!
            $moduleId: String!
            $instructionId: String!
          ) {
            completeInstruction(
              channelKey: $channelKey
              moduleId: $moduleId
              instructionId: $instructionId
            )
          }
        `,
        {
          channelKey: "test-channel",
          moduleId: "mod-1",
          instructionId: "12345",
        },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.completeInstruction).toBe(true);
    });
  });
});
