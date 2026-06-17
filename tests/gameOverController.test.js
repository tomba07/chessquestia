import { describe, expect, it, vi } from "vitest";
import { createGameOverController } from "../src/gameOverController.js";

function createController({
  checkmate = false,
  draw = false,
  stalemate = false,
  turn = "b",
  playerColor = "w",
} = {}) {
  const calls = {
    disable: vi.fn(),
    hide: vi.fn(),
    pulse: vi.fn(),
    reaction: vi.fn(),
    record: vi.fn(),
    show: vi.fn(),
    status: vi.fn(),
    unlock: vi.fn(() => true),
  };
  const opponents = [{ name: "Snib" }, { name: "Muckroot" }];
  const controller = createGameOverController({
    chess: {
      isCheckmate: () => checkmate,
      isDraw: () => draw,
      isStalemate: () => stalemate,
      isInsufficientMaterial: () => false,
      turn: () => turn,
    },
    disableBoardMoveInput: calls.disable,
    findKingSquare: vi.fn(() => "e8"),
    getCanUnlockProgress: () => true,
    getPlayerColor: () => playerColor,
    getSelectedOpponentIndex: () => 0,
    hideOutcomeBanner: calls.hide,
    opponents,
    recordResult: calls.record,
    setStatus: calls.status,
    showEndgameOpponentReaction: calls.reaction,
    showOutcomeBannerAfterDelay: calls.show,
    showVictoryBoardPulseAfterDelay: calls.pulse,
    unlockNextOpponent: calls.unlock,
  });
  return { calls, controller, opponents };
}

describe("game over decisions", () => {
  it("records victory, unlocks the next opponent, and schedules the victory UI", () => {
    const { calls, controller, opponents } = createController({ checkmate: true });
    const highscorePromise = Promise.resolve({ highscore: { fastest: { rank: 1 } } });
    calls.record.mockReturnValue(highscorePromise);

    expect(controller.check()).toBe(true);
    expect(calls.record).toHaveBeenCalledWith("victory");
    expect(calls.unlock).toHaveBeenCalledTimes(1);
    expect(calls.pulse).toHaveBeenCalledWith("e8", 120, "victory");
    expect(calls.show).toHaveBeenCalledWith("victory", 2200, expect.objectContaining({
      highscorePromise,
      unlockedOpponent: opponents[1],
    }));
    expect(calls.status).toHaveBeenCalledWith("New opponent unlocked.", "over");
    expect(calls.disable).toHaveBeenCalledTimes(1);
  });

  it("records defeat without attempting an unlock", () => {
    const { calls, controller } = createController({
      checkmate: true,
      turn: "w",
      playerColor: "w",
    });

    expect(controller.check()).toBe(true);
    expect(calls.record).toHaveBeenCalledWith("defeat");
    expect(calls.unlock).not.toHaveBeenCalled();
    expect(calls.pulse).toHaveBeenCalledWith("e8", 120, "defeat");
    expect(calls.show).toHaveBeenCalledWith("defeat", 2200, {
      highscorePromise: null,
      unlockedOpponent: null,
    });
  });

  it("records and presents a stalemate", () => {
    const { calls, controller } = createController({ draw: true, stalemate: true });

    expect(controller.check()).toBe(true);
    expect(calls.record).toHaveBeenCalledWith("draw");
    expect(calls.pulse).toHaveBeenCalledWith(null, 120, "draw");
    expect(calls.show).toHaveBeenCalledWith("draw", 1900);
    expect(calls.status).toHaveBeenCalledWith("Stalemate", "over");
  });

  it("hides the outcome UI while the game is still active", () => {
    const { calls, controller } = createController();

    expect(controller.check()).toBe(false);
    expect(calls.hide).toHaveBeenCalledTimes(1);
    expect(calls.record).not.toHaveBeenCalled();
  });
});
