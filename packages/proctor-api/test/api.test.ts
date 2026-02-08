import { beforeEach, describe, expect, it } from "vitest";
import { _resetPubSub } from "../src/pubsub.js";
import { _resetSessions } from "../src/session-manager.js";
import { gql } from "./yoga-helper.js";

const SESSION_CONFIG = {
  players: [
    {
      playerId: "p1",
      name: "Alice",
      model: "test-model",
      systemPrompt: "Play poker",
    },
    {
      playerId: "p2",
      name: "Bob",
      model: "test-model",
      systemPrompt: "Play poker",
    },
  ],
  startingChips: 1000,
  smallBlind: 5,
  bigBlind: 10,
};

describe("proctor-api GraphQL", () => {
  beforeEach(() => {
    _resetSessions();
    _resetPubSub();
  });

  describe("startSession", () => {
    it("creates a new session", async () => {
      const result = await gql(
        /* GraphQL */ `
          mutation StartSession($channelKey: String!, $config: SessionConfig!) {
            startSession(channelKey: $channelKey, config: $config) {
              channelKey
              status
              handNumber
              players {
                id
                name
                chips
                model
              }
            }
          }
        `,
        { channelKey: "test-channel", config: SESSION_CONFIG },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.startSession).toEqual({
        channelKey: "test-channel",
        status: "RUNNING",
        handNumber: 0,
        players: [
          { id: "p1", name: "Alice", chips: 1000, model: "test-model" },
          { id: "p2", name: "Bob", chips: 1000, model: "test-model" },
        ],
      });
    });

    it("fails for duplicate channelKey", async () => {
      await gql(
        /* GraphQL */ `
          mutation StartSession($channelKey: String!, $config: SessionConfig!) {
            startSession(channelKey: $channelKey, config: $config) {
              channelKey
            }
          }
        `,
        { channelKey: "test-channel", config: SESSION_CONFIG },
      );

      const result = await gql(
        /* GraphQL */ `
          mutation StartSession($channelKey: String!, $config: SessionConfig!) {
            startSession(channelKey: $channelKey, config: $config) {
              channelKey
            }
          }
        `,
        { channelKey: "test-channel", config: SESSION_CONFIG },
      );

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain("Session already exists");
    });
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

    it("returns existing session", async () => {
      await gql(
        /* GraphQL */ `
          mutation StartSession($channelKey: String!, $config: SessionConfig!) {
            startSession(channelKey: $channelKey, config: $config) {
              channelKey
            }
          }
        `,
        { channelKey: "test-channel", config: SESSION_CONFIG },
      );

      const result = await gql(
        /* GraphQL */ `
          query GetSession($channelKey: String!) {
            getSession(channelKey: $channelKey) {
              channelKey
              status
              players {
                id
                name
              }
            }
          }
        `,
        { channelKey: "test-channel" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.getSession.channelKey).toBe("test-channel");
      expect(result.data!.getSession.status).toBe("RUNNING");
    });
  });

  describe("stopSession", () => {
    it("stops a running session", async () => {
      await gql(
        /* GraphQL */ `
          mutation StartSession($channelKey: String!, $config: SessionConfig!) {
            startSession(channelKey: $channelKey, config: $config) {
              channelKey
            }
          }
        `,
        { channelKey: "test-channel", config: SESSION_CONFIG },
      );

      const result = await gql(
        /* GraphQL */ `
          mutation StopSession($channelKey: String!) {
            stopSession(channelKey: $channelKey)
          }
        `,
        { channelKey: "test-channel" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.stopSession).toBe(true);

      // Verify it's stopped
      const check = await gql(
        /* GraphQL */ `
          query GetSession($channelKey: String!) {
            getSession(channelKey: $channelKey) {
              status
            }
          }
        `,
        { channelKey: "test-channel" },
      );
      expect(check.data!.getSession.status).toBe("STOPPED");
    });
  });

  describe("getGameState", () => {
    it("returns empty state for non-existent channel", async () => {
      const result = await gql(
        /* GraphQL */ `
          query GetGameState($channelKey: String!) {
            getGameState(channelKey: $channelKey) {
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
      expect(result.data!.getGameState.channelKey).toBe("nope");
      expect(result.data!.getGameState.handNumber).toBe(0);
      expect(result.data!.getGameState.players).toEqual([]);
    });
  });

  describe("renderComplete", () => {
    it("accepts renderComplete for existing session", async () => {
      await gql(
        /* GraphQL */ `
          mutation StartSession($channelKey: String!, $config: SessionConfig!) {
            startSession(channelKey: $channelKey, config: $config) {
              channelKey
            }
          }
        `,
        { channelKey: "test-channel", config: SESSION_CONFIG },
      );

      const result = await gql(
        /* GraphQL */ `
          mutation RenderComplete($channelKey: String!, $instructionId: ID!) {
            renderComplete(channelKey: $channelKey, instructionId: $instructionId)
          }
        `,
        { channelKey: "test-channel", instructionId: "inst-1" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data!.renderComplete).toBe(true);
    });
  });
});
