import { describe, expect, it, vi } from "vitest";
import { createAppEventController } from "../src/appEventController.js";

function createController({ coopPhase = "off" } = {}) {
  let outcomeActions;
  let appShellActions;
  const deps = {
    appShell: {
      bindEvents: vi.fn(actions => { appShellActions = actions; }),
      showSoloSetup: vi.fn(),
    },
    bindBotSplashStartButton: vi.fn(),
    chessnutBoard: { bind: vi.fn() },
    coopInviteList: document.createElement("div"),
    coopRoom: { showRoomPanel: vi.fn() },
    getCoop: () => ({ phase: coopPhase }),
    getSetupMode: () => coopPhase === "off" ? "solo" : "coop",
    hideOutcomeBanner: vi.fn(),
    leaveCoop: vi.fn(),
    opponentSelection: {
      applyLocks: vi.fn(),
      bindCards: vi.fn(),
      clearSelection: vi.fn(),
    },
    outcomeScreen: {
      bindActions: vi.fn(actions => { outcomeActions = actions; }),
    },
    promotionChoice: { bind: vi.fn() },
    renderRoomLobby: vi.fn(),
    reopenCoopLobby: vi.fn(),
    sendCoopInvite: vi.fn(),
    setCoopSelectingOpponent: vi.fn(),
    setOpponentSelectionReadonly: vi.fn(),
    setSelectedOpponent: vi.fn(),
    setSetupMode: vi.fn(),
    showLobby: vi.fn(),
    showPlayView: vi.fn(),
    soloBackBtn: document.createElement("button"),
    soloGame: {
      clearPendingStart: vi.fn(),
      start: vi.fn(),
      startDemo: vi.fn(),
      startSelected: vi.fn(),
    },
    soloStartBtn: document.createElement("button"),
    startCoopBotSelection: vi.fn(),
    startCoopRoom: vi.fn(),
    syncStrength: vi.fn(),
    updateOpponentSelection: vi.fn(),
    elements: {
      backBtn: document.createElement("button"),
      confirmExitGame: () => true,
      cpLeaveBtn: document.createElement("button"),
      cpStartBtn: document.createElement("button"),
      lbSolo: document.createElement("div"),
      opponentSpeech: { bindCloseButton: vi.fn() },
      opponents: [
        { elo: 500, theme: "snib" },
        { elo: 700, theme: "muckroot" },
      ],
    },
  };

  deps.soloStartBtn.disabled = true;
  const controller = createAppEventController(deps);
  controller.bind();
  return { appShellActions, deps, outcomeActions };
}

describe("app event controller", () => {
  it("reopens the co-op lobby when challenging an unlocked co-op opponent", () => {
    const { deps, outcomeActions } = createController({ coopPhase: "over" });

    outcomeActions.onChallenge(1);

    expect(deps.hideOutcomeBanner).toHaveBeenCalled();
    expect(deps.setSetupMode).toHaveBeenCalledWith("coop");
    expect(deps.setOpponentSelectionReadonly).toHaveBeenCalledWith(false);
    expect(deps.reopenCoopLobby).toHaveBeenCalledTimes(1);
    expect(deps.setSelectedOpponent).not.toHaveBeenCalled();
    expect(deps.syncStrength).not.toHaveBeenCalled();
    expect(deps.updateOpponentSelection).not.toHaveBeenCalled();
    expect(deps.soloGame.start).not.toHaveBeenCalled();
  });

  it("starts the unlocked opponent directly in solo", () => {
    const { deps, outcomeActions } = createController({ coopPhase: "off" });

    outcomeActions.onChallenge(1);

    expect(deps.setSelectedOpponent).toHaveBeenCalledWith(1, "muckroot");
    expect(deps.syncStrength).toHaveBeenCalledWith("700");
    expect(deps.updateOpponentSelection).toHaveBeenCalledWith("700");
    expect(deps.setSetupMode).toHaveBeenCalledWith("solo");
    expect(deps.soloGame.start).toHaveBeenCalledTimes(1);
    expect(deps.reopenCoopLobby).not.toHaveBeenCalled();
  });

  it("leaves co-op before opening solo setup", () => {
    const { appShellActions, deps } = createController({ coopPhase: "lobby" });

    appShellActions.onStartSolo();

    expect(deps.leaveCoop).toHaveBeenCalledTimes(1);
    expect(deps.appShell.showSoloSetup).toHaveBeenCalledTimes(1);
  });
});
