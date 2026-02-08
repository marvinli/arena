import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetSessions,
  createSession,
  getSession,
  recordRenderComplete,
  registerClient,
  stopSession,
  unregisterClient,
  waitForRenderComplete,
} from "../src/session-manager.js";

const baseConfig = {
  players: [
    {
      playerId: "p1",
      name: "Alice",
      model: "test",
      systemPrompt: "Play poker",
    },
    {
      playerId: "p2",
      name: "Bob",
      model: "test",
      systemPrompt: "Play poker",
    },
  ],
  startingChips: 1000,
  smallBlind: 5,
  bigBlind: 10,
};

describe("session-manager", () => {
  beforeEach(() => {
    _resetSessions();
  });

  describe("createSession", () => {
    it("creates a session with correct initial state", () => {
      const session = createSession("test-channel", baseConfig);
      expect(session.channelKey).toBe("test-channel");
      expect(session.status).toBe("RUNNING");
      expect(session.handNumber).toBe(0);
      expect(session.gameId).toBeNull();
      expect(session.players).toHaveLength(2);
      expect(session.players[0].id).toBe("p1");
      expect(session.players[0].chips).toBe(1000);
    });

    it("throws on duplicate channelKey", () => {
      createSession("test-channel", baseConfig);
      expect(() => createSession("test-channel", baseConfig)).toThrow(
        "Session already exists",
      );
    });
  });

  describe("getSession", () => {
    it("returns null for non-existent session", () => {
      expect(getSession("nope")).toBeNull();
    });

    it("returns existing session", () => {
      createSession("test-channel", baseConfig);
      const session = getSession("test-channel");
      expect(session).not.toBeNull();
      expect(session!.channelKey).toBe("test-channel");
    });
  });

  describe("stopSession", () => {
    it("marks session as stopped", () => {
      createSession("test-channel", baseConfig);
      stopSession("test-channel");
      const session = getSession("test-channel");
      expect(session!.status).toBe("STOPPED");
    });

    it("throws for non-existent session", () => {
      expect(() => stopSession("nope")).toThrow("Session not found");
    });
  });

  describe("client registration", () => {
    it("tracks connected clients", () => {
      const session = createSession("test-channel", baseConfig);
      registerClient("test-channel", "client-1");
      registerClient("test-channel", "client-2");
      expect(session.connectedClients.size).toBe(2);
    });

    it("unregisters clients", () => {
      const session = createSession("test-channel", baseConfig);
      registerClient("test-channel", "client-1");
      unregisterClient("test-channel", "client-1");
      expect(session.connectedClients.size).toBe(0);
    });
  });

  describe("renderComplete tracking", () => {
    it("auto-advances when no clients connected", async () => {
      createSession("test-channel", baseConfig);
      const ac = new AbortController();
      // Should resolve immediately with no clients
      await waitForRenderComplete("test-channel", "inst-1", ac.signal);
    });

    it("resolves when renderComplete is called", async () => {
      createSession("test-channel", baseConfig);
      registerClient("test-channel", "client-1");
      const ac = new AbortController();

      const promise = waitForRenderComplete(
        "test-channel",
        "inst-1",
        ac.signal,
      );

      recordRenderComplete("test-channel", "inst-1");
      await promise;
    });

    it("resolves when client disconnects during wait", async () => {
      createSession("test-channel", baseConfig);
      registerClient("test-channel", "client-1");
      const ac = new AbortController();

      const promise = waitForRenderComplete(
        "test-channel",
        "inst-1",
        ac.signal,
      );

      unregisterClient("test-channel", "client-1");
      await promise;
    });

    it("resolves on abort signal", async () => {
      createSession("test-channel", baseConfig);
      registerClient("test-channel", "client-1");
      const ac = new AbortController();

      const promise = waitForRenderComplete(
        "test-channel",
        "inst-1",
        ac.signal,
      );

      ac.abort();
      await promise;
    });

    it("resolves on timeout", async () => {
      createSession("test-channel", baseConfig);
      registerClient("test-channel", "client-1");
      const ac = new AbortController();

      // Use a very short timeout
      await waitForRenderComplete("test-channel", "inst-1", ac.signal, 10);
    });
  });
});
