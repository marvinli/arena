import { beforeEach, describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../src/game-config.js";
import { _resetGames } from "../src/services/games/poker/poker-engine/index.js";
import { _resetPubSub } from "../src/services/session/pubsub.js";
import { _resetSessions } from "../src/services/session/session-manager.js";
import { gql } from "./yoga-helper.js";

const START_SESSION = /* GraphQL */ `
  mutation StartSession($channelKey: String!) {
    startSession(channelKey: $channelKey) {
      channelKey
      status
      handNumber
      players {
        id
        name
        chips
      }
    }
  }
`;

describe("proctor-api GraphQL", () => {
  beforeEach(() => {
    _resetSessions();
    _resetPubSub();
    _resetGames();
  });

  describe("startSession", () => {
    it("creates a new session", async () => {
      const result = await gql(START_SESSION, {
        channelKey: "test-channel",
      });

      expect(result.errors).toBeUndefined();
      const session = result.data!.startSession;
      expect(session.channelKey).toBe("test-channel");
      expect(session.status).toBe("RUNNING");
      expect(session.handNumber).toBe(0);
      expect(session.players).toHaveLength(GAME_CONFIG.players.length);
      expect(session.players[0].chips).toBe(GAME_CONFIG.startingChips);
    });

    it("fails for duplicate channelKey", async () => {
      await gql(START_SESSION, { channelKey: "test-channel" });

      const result = await gql(START_SESSION, {
        channelKey: "test-channel",
      });

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain("Session already running");
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
      await gql(START_SESSION, { channelKey: "test-channel" });

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
      await gql(START_SESSION, { channelKey: "test-channel" });

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

  describe("renderComplete", () => {
    it("accepts renderComplete for existing session", async () => {
      await gql(START_SESSION, { channelKey: "test-channel" });

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
