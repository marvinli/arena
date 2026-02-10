import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/persistence.js", () => ({
  getChannelState: vi.fn(),
  upsertChannelState: vi.fn(),
  createModule: vi.fn(),
  completeModule: vi.fn(),
  insertInstruction: vi.fn(),
  appendAgentMessage: vi.fn(),
  getAgentMessages: vi.fn(() => []),
}));

import { GAME_CONFIG } from "../../../src/game-config.js";
import {
  getChannelState as mockGetChannelState,
  upsertChannelState as mockUpsertChannelState,
} from "../../../src/persistence.js";
import {
  _resetSessions,
  completeInstruction,
  connect,
  createSession,
  getSession,
  stopSession,
} from "../../../src/services/session/session-manager.js";

describe("session-manager", () => {
  beforeEach(() => {
    _resetSessions();
  });

  describe("createSession", () => {
    it("creates a session with correct initial state", () => {
      const session = createSession("test-channel");
      expect(session.channelKey).toBe("test-channel");
      expect(session.status).toBe("RUNNING");
      expect(session.handNumber).toBe(0);
      expect(session.gameId).toBeNull();
      expect(session.players).toHaveLength(GAME_CONFIG.players.length);
      expect(session.players[0].id).toBe(GAME_CONFIG.players[0].playerId);
      expect(session.players[0].chips).toBe(GAME_CONFIG.startingChips);
    });

    it("throws on duplicate running session", () => {
      createSession("test-channel");
      expect(() => createSession("test-channel")).toThrow(
        "Session already running",
      );
    });

    it("replaces stopped session", () => {
      createSession("test-channel");
      stopSession("test-channel");
      const session = createSession("test-channel");
      expect(session.status).toBe("RUNNING");
    });
  });

  describe("getSession", () => {
    it("returns null for non-existent session", () => {
      expect(getSession("nope")).toBeNull();
    });

    it("returns existing session", () => {
      createSession("test-channel");
      const session = getSession("test-channel");
      expect(session).not.toBeNull();
      expect(session!.channelKey).toBe("test-channel");
    });
  });

  describe("stopSession", () => {
    it("marks session as stopped", () => {
      createSession("test-channel");
      stopSession("test-channel");
      const session = getSession("test-channel");
      expect(session!.status).toBe("STOPPED");
    });

    it("throws for non-existent session", () => {
      expect(() => stopSession("nope")).toThrow("Session not found");
    });
  });

  describe("connect", () => {
    it("returns empty state for new channel", () => {
      vi.mocked(mockGetChannelState).mockReturnValue(undefined);
      const result = connect("new-channel");
      expect(result.moduleId).toBe("");
      expect(result.moduleType).toBe("poker");
      expect(result.gameState).toBeNull();
    });

    it("returns snapshot for returning channel", () => {
      const snapshot = JSON.stringify({
        channelKey: "test-channel",
        handNumber: 3,
        players: [],
        communityCards: [],
        pots: [],
      });
      vi.mocked(mockGetChannelState).mockReturnValue({
        channelKey: "test-channel",
        moduleId: "mod-abc",
        instructionTs: 100,
        stateSnapshot: snapshot,
      });
      const result = connect("test-channel");
      expect(result.moduleId).toBe("mod-abc");
      expect(result.moduleType).toBe("poker");
      expect(result.gameState).toEqual(JSON.parse(snapshot));
    });
  });

  describe("completeInstruction", () => {
    it("returns true and persists bookmark", () => {
      const result = completeInstruction("test-channel", "mod-1", "12345");
      expect(result).toBe(true);
      expect(mockUpsertChannelState).toHaveBeenCalledWith(
        "test-channel",
        "mod-1",
        12345,
        null,
      );
    });
  });
});
