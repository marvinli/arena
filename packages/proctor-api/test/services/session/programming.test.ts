import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/persistence.js", () => ({
  getChannelState: vi.fn(),
  getModule: vi.fn(),
  completeModule: vi.fn(),
  createModule: vi.fn(),
  upsertChannelState: vi.fn(),
  getSetting: vi.fn(),
  insertInstruction: vi.fn(),
  appendAgentMessage: vi.fn(),
  getAgentMessages: vi.fn(() => []),
  ackInstruction: vi.fn(),
}));

import {
  completeModule as mockCompleteModule,
  getChannelState as mockGetChannelState,
  getModule as mockGetModule,
} from "../../../src/persistence.js";
import { _detectOrphanedModule } from "../../../src/services/session/programming.js";

describe("detectOrphanedModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no channel state exists", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue(undefined);

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
  });

  it("returns null when module does not exist", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: '{"handNumber":3,"players":[]}',
      ackedInstructionTs: null,
    });
    vi.mocked(mockGetModule).mockResolvedValue(undefined);

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
  });

  it("returns null when module is not running", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: '{"handNumber":3,"players":[]}',
      ackedInstructionTs: null,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-1",
      type: "poker",
      progIndex: 0,
      status: "completed",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
  });

  it("returns null when no state snapshot", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: null,
      ackedInstructionTs: null,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-1",
      type: "poker",
      progIndex: 0,
      status: "running",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
  });

  it("returns null when snapshot is corrupt JSON", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: "NOT VALID JSON {{{",
      ackedInstructionTs: null,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-1",
      type: "poker",
      progIndex: 0,
      status: "running",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
    // Should also complete the orphaned module
    expect(mockCompleteModule).toHaveBeenCalledWith("mod-1");
  });

  it("returns null when snapshot is missing players", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: JSON.stringify({ handNumber: 3 }),
      ackedInstructionTs: null,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-1",
      type: "poker",
      progIndex: 0,
      status: "running",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
  });

  it("returns null when snapshot is missing handNumber", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: JSON.stringify({
        players: [{ id: "p1", name: "Alice", chips: 1000, status: "ACTIVE" }],
      }),
      ackedInstructionTs: null,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-1",
      type: "poker",
      progIndex: 0,
      status: "running",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
  });

  it("returns null when players is not an array", async () => {
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: JSON.stringify({ handNumber: 3, players: "not-an-array" }),
      ackedInstructionTs: null,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-1",
      type: "poker",
      progIndex: 0,
      status: "running",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).toBeNull();
  });

  it("returns valid recovery data for orphaned running module", async () => {
    const players = [
      { id: "p1", name: "Alice", chips: 800, status: "ACTIVE" },
      { id: "p2", name: "Bob", chips: 1200, status: "ACTIVE" },
      { id: "p3", name: "Charlie", chips: 0, status: "BUSTED" },
    ];
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-1",
      instructionTs: 100,
      stateSnapshot: JSON.stringify({ handNumber: 7, players }),
      ackedInstructionTs: 50,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-1",
      type: "poker",
      progIndex: 0,
      status: "running",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).not.toBeNull();
    expect(result!.moduleId).toBe("mod-1");
    expect(result!.snapshot.handNumber).toBe(7);
    // All players from the snapshot are returned (filtering happens in runProgrammingLoop / resumeSession)
    expect(result!.snapshot.players).toHaveLength(3);
    expect(result!.snapshot.players).toEqual(players);
  });

  it("returns all players including busted ones in snapshot", async () => {
    const players = [
      { id: "p1", name: "Alice", chips: 500, status: "ACTIVE" },
      { id: "p2", name: "Bob", chips: 0, status: "BUSTED" },
    ];
    vi.mocked(mockGetChannelState).mockResolvedValue({
      channelKey: "test-channel",
      moduleId: "mod-2",
      instructionTs: 200,
      stateSnapshot: JSON.stringify({ handNumber: 3, players }),
      ackedInstructionTs: 100,
    });
    vi.mocked(mockGetModule).mockResolvedValue({
      moduleId: "mod-2",
      type: "poker",
      progIndex: 0,
      status: "running",
      createdAt: Date.now(),
    });

    const result = await _detectOrphanedModule("test-channel");
    expect(result).not.toBeNull();
    // detectOrphanedModule returns all players; filtering is done by the caller
    expect(result!.snapshot.players).toHaveLength(2);
    expect(result!.snapshot.players[0].status).toBe("ACTIVE");
    expect(result!.snapshot.players[1].status).toBe("BUSTED");
  });
});
