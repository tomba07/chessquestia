import { describe, expect, it, vi } from "vitest";
import { createSoloSessionController } from "../src/soloSessionController.js";

const STORAGE_KEYS = {
  soloGameKey: "test.solo-game",
  legacySoloGameKey: "test.legacy-solo-game",
  soloProgressKey: "test.solo-progress",
};

function createController(overrides = {}) {
  const state = {
    authInfo: { user: null, soloProgress: { unlockedOpponentCount: 1 } },
    coopPhase: "off",
    opponentIndex: 0,
    historyLength: 8,
    fen: "test-fen",
    elo: 500,
    opponent: { theme: "snib" },
    ...overrides,
  };
  const onProgressChanged = vi.fn();
  const controller = createSoloSessionController({
    storageKeys: STORAGE_KEYS,
    opponentCount: 5,
    getAuthInfo: () => state.authInfo,
    getCoopPhase: () => state.coopPhase,
    getCurrentOpponent: () => state.opponent,
    getElo: () => state.elo,
    getFen: () => state.fen,
    getHistoryLength: () => state.historyLength,
    getOpponentIndex: () => state.opponentIndex,
    onProgressChanged,
  });
  return { controller, onProgressChanged };
}

describe("solo session progression", () => {
  it("uses local progress for guests and applies co-op shared unlocks", () => {
    localStorage.setItem(STORAGE_KEYS.soloProgressKey, JSON.stringify({ unlocked: 3 }));
    const { controller } = createController({
      authInfo: { user: null, soloProgress: { unlockedOpponentCount: 2 } },
    });

    controller.syncProgressFromAuth();

    expect(controller.readProgress()).toBe(3);
    expect(controller.unlockedCountForMode({ setupMode: "coop", coopMaxUnlocked: 4 })).toBe(4);
  });

  it("uses server progress for signed-in users so admin resets can lower unlocks", () => {
    localStorage.setItem(STORAGE_KEYS.soloProgressKey, JSON.stringify({ unlocked: 5 }));
    const { controller, onProgressChanged } = createController({
      authInfo: { user: { id: "mirko" }, soloProgress: { unlockedOpponentCount: 3 } },
    });

    controller.syncProgressFromAuth();

    expect(controller.readProgress()).toBe(3);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.soloProgressKey)).unlocked).toBe(3);
    expect(onProgressChanged).toHaveBeenCalled();
  });

  it("unlocks the next opponent once and persists authenticated progress", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ soloProgress: { unlockedOpponentCount: 2 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { controller, onProgressChanged } = createController({
      authInfo: { user: { id: "mirko" }, soloProgress: { unlockedOpponentCount: 1 } },
    });
    controller.startGame();

    expect(controller.unlockNextOpponent()).toBe(true);
    expect(controller.unlockNextOpponent()).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.soloProgressKey)).unlocked).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ unlockedOpponentCount: 2 });
    expect(onProgressChanged).toHaveBeenCalled();
  });

  it("never unlocks progress in a demo game", () => {
    const { controller } = createController();
    controller.startGame({ demo: true });

    expect(controller.unlockNextOpponent()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.soloProgressKey)).toBeNull();
  });
});

describe("solo result recording", () => {
  it("records one result per game with moves, duration, opponent data, and server payload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T12:00:00Z"));
    const responsePayload = { id: "result-1", highscore: { fastest: { rank: 1 } } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responsePayload,
    });
    vi.stubGlobal("fetch", fetchMock);
    const { controller } = createController();
    controller.startGame({ playerColor: "b" });
    vi.setSystemTime(new Date("2026-06-14T12:01:05Z"));

    const payload = await controller.recordResult("victory");
    controller.recordResult("victory");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/game-results");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      mode: "solo",
      result: "victory",
      opponentStrength: 500,
      opponentKey: "snib",
      movesCount: 8,
      durationMs: 65000,
      finalFen: "test-fen",
    });
    expect(payload).toBe(responsePayload);
  });

  it.each([
    ["demo", { demo: true }, "off"],
    ["debug", { debug: true }, "off"],
    ["co-op", {}, "playing"],
  ])("does not record %s sessions", (_label, options, coopPhase) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { controller } = createController({ coopPhase });
    controller.startGame(options);

    controller.recordResult("victory");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
