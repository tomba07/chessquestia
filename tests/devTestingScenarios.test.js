import { describe, expect, it, vi } from "vitest";
import {
  createDevTestingScenarios,
  DEV_VICTORY_FEN,
} from "../src/devTestingScenarios.js";

function createDeps({ coopPhase = "off" } = {}) {
  const board = {
    setPosition: vi.fn(),
  };
  return {
    chess: {
      fen: vi.fn(() => "test-fen"),
      load: vi.fn(),
    },
    clearBotSplashAutoTimer: vi.fn(),
    clearCheckMarker: vi.fn(),
    clearLastMove: vi.fn(),
    cpChips: { innerHTML: "old chips" },
    disableBoardMoveInput: vi.fn(),
    getBoard: () => board,
    getCoopPhase: () => coopPhase,
    hideModelLoading: vi.fn(),
    hideOpponentSpeech: vi.fn(),
    hideOutcomeBanner: vi.fn(),
    opponents: [
      { elo: 500, theme: "snib" },
      { name: "Muckroot", card: "muckroot_card.png" },
    ],
    setSelectedOpponent: vi.fn(),
    setSetupMode: vi.fn(),
    setStatus: vi.fn(),
    showGame: vi.fn(),
    showOutcomeBannerAfterDelay: vi.fn(),
    showVictoryBoardPulseAfterDelay: vi.fn(),
    soloSession: {
      clearGame: vi.fn(),
    },
    syncStrength: vi.fn(),
    updateGameScore: vi.fn(),
    board,
  };
}

describe("dev testing scenarios", () => {
  it("sets up the shared victory fixture before showing a moves highscore", () => {
    const deps = createDeps();
    const scenarios = createDevTestingScenarios(deps);

    scenarios.victoryMovesHighscore();

    expect(deps.setSetupMode).toHaveBeenCalledWith("solo");
    expect(deps.setSelectedOpponent).toHaveBeenCalledWith({ index: 0, theme: "snib" });
    expect(deps.syncStrength).toHaveBeenCalledWith("500");
    expect(deps.chess.load).toHaveBeenCalledWith(DEV_VICTORY_FEN);
    expect(deps.soloSession.clearGame).toHaveBeenCalled();
    expect(deps.cpChips.innerHTML).toBe("");
    expect(deps.showGame).toHaveBeenCalled();
    expect(deps.board.setPosition).toHaveBeenCalledWith("test-fen", false);
    expect(deps.showVictoryBoardPulseAfterDelay).toHaveBeenCalledWith("g8", 0, "victory");
    expect(deps.showOutcomeBannerAfterDelay).toHaveBeenCalledWith("victory", 0, {
      highscore: {
        fewestMoves: { value: 9, isPersonalBest: true, rank: 1 },
      },
    });
  });

  it("passes the unlocked opponent into the unlock scenario", () => {
    const deps = createDeps();
    const scenarios = createDevTestingScenarios(deps);

    scenarios.victoryUnlock();

    expect(deps.showOutcomeBannerAfterDelay).toHaveBeenCalledWith("victory", 0, {
      unlockedOpponent: deps.opponents[1],
    });
  });

  it("does not run scenarios while co-op is active", () => {
    const deps = createDeps({ coopPhase: "playing" });
    const scenarios = createDevTestingScenarios(deps);

    expect(() => scenarios.victoryHighscore()).toThrow("Leave co-op before running this scenario.");
    expect(deps.hideModelLoading).not.toHaveBeenCalled();
    expect(deps.chess.load).not.toHaveBeenCalled();
  });
});
