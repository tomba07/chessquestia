import { describe, expect, it, vi } from "vitest";
import { createCoopActionsController } from "../src/coopActionsController.js";
import { createCoopMessageController } from "../src/coopMessageController.js";
import { createInitialCoopState } from "../src/coopState.js";

describe("co-op match statistics", () => {
  it("hydrates server move count and start time from room state", async () => {
    const coop = createInitialCoopState();
    const applyActiveState = vi.fn();
    const controller = createCoopMessageController({
      connectToAuth: vi.fn(),
      coopGameView: { applyActiveState, applyLobbyState: vi.fn() },
      coopInvites: { clearSent: vi.fn() },
      coopRoom: { showRoomPanel: vi.fn() },
      getCoop: () => coop,
      getCoopPlayerName: vi.fn(),
      getSetupMode: () => "coop",
      loadCoopInviteFriends: vi.fn(),
      loadInviteNotifications: vi.fn(),
      readSoloProgress: () => 2,
      rememberRoom: vi.fn(),
      setRoomUrl: vi.fn(),
      showModelLoading: vi.fn(),
      showPlayView: vi.fn(),
      syncStrength: vi.fn(),
      updateOpponentSelection: vi.fn(),
      elements: { lbSolo: document.createElement("div") },
    });
    const message = {
      type: "room-state",
      roomId: "room-1",
      playerId: "player-2",
      phase: "playing",
      players: [{ name: "Mirko" }, { name: "Lena" }],
      activeIdx: 1,
      midTurn: false,
      fen: "test-fen",
      myIdx: 1,
      startedAt: 1718380000000,
      moveCount: 27,
      strength: 900,
      maxUnlockedOpponentCount: 3,
    };

    await controller.handleMessage(message);

    expect(coop.startedAt).toBe(1718380000000);
    expect(coop.moveCount).toBe(27);
    expect(coop.maxUnlockedOpponentCount).toBe(3);
    expect(applyActiveState).toHaveBeenCalledWith(message);
  });

  it("increments the local move count once when publishing a playing move", () => {
    const send = vi.fn();
    const coop = { phase: "playing", moveCount: 7, ws: { send } };
    const controller = createCoopActionsController({
      getConnection: () => null,
      getCoop: () => coop,
      getElo: () => 900,
      getGameOver: () => false,
      getFen: () => "next-fen",
      getMaiaReady: () => true,
      getOpponentSelectionReadonly: () => false,
      getSoloStartDisabled: () => false,
      requestModelDownload: vi.fn(),
      showCoopBotSelection: vi.fn(),
      showModelLoading: vi.fn(),
    });

    controller.publishMove();

    expect(coop.moveCount).toBe(8);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({
      type: "move",
      fen: "next-fen",
      gameOver: false,
    });
  });

  it("lets the co-op host reopen the lobby after game over", () => {
    const send = vi.fn();
    const coop = { phase: "over", myIdx: 0, ws: { send } };
    const controller = createCoopActionsController({
      getConnection: () => null,
      getCoop: () => coop,
      getElo: () => 900,
      getGameOver: () => true,
      getFen: () => "mate-fen",
      getMaiaReady: () => true,
      getOpponentSelectionReadonly: () => false,
      getSoloStartDisabled: () => false,
      requestModelDownload: vi.fn(),
      showCoopBotSelection: vi.fn(),
      showModelLoading: vi.fn(),
    });

    controller.reopenLobby();

    expect(JSON.parse(send.mock.calls[0][0])).toEqual({
      type: "reopen-lobby",
    });
  });

  it("does not let co-op guests reopen the lobby after game over", () => {
    const send = vi.fn();
    const coop = { phase: "over", myIdx: 1, ws: { send } };
    const controller = createCoopActionsController({
      getConnection: () => null,
      getCoop: () => coop,
      getElo: () => 900,
      getGameOver: () => true,
      getFen: () => "mate-fen",
      getMaiaReady: () => true,
      getOpponentSelectionReadonly: () => false,
      getSoloStartDisabled: () => false,
      requestModelDownload: vi.fn(),
      showCoopBotSelection: vi.fn(),
      showModelLoading: vi.fn(),
    });

    controller.reopenLobby();

    expect(send).not.toHaveBeenCalled();
  });
});
