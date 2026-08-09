import { describe, expect, it, vi } from "vitest";
import { createCoopActionsController } from "../src/coopActionsController.js";
import { createCoopConnectionController } from "../src/coopConnectionController.js";
import { createCoopInviteController } from "../src/coopInviteController.js";
import { createCoopMessageController } from "../src/coopMessageController.js";
import { createCoopRoomController } from "../src/coopRoomController.js";
import { createCoopSessionController } from "../src/coopSessionController.js";
import { createInitialCoopState } from "../src/coopState.js";
import { createGameStatusController } from "../src/gameStatusController.js";

describe("co-op match statistics", () => {
  it("polls room state while the co-op lobby is open", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    class FakeWebSocket {
      static OPEN = 1;
      constructor() {
        this.readyState = FakeWebSocket.OPEN;
        FakeWebSocket.instance = this;
      }
      send = send;
      close = vi.fn();
    }
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const coop = createInitialCoopState();
    coop.phase = "lobby";
    const controller = createCoopConnectionController({
      getCoop: () => coop,
      getElo: () => 900,
      getMaiaReady: () => true,
      getPlayerName: () => "mirko",
      getRoomFromUrl: () => null,
      readSoloProgress: () => 3,
      setSetupMode: vi.fn(),
      showLobby: vi.fn(),
      storedPlayerId: () => "",
      onMessage: vi.fn(),
      onPlayingReconnect: vi.fn(),
      onReconnectingLobby: vi.fn(),
    });

    controller.connect("join", { roomId: "room-1" });
    FakeWebSocket.instance.onopen();
    vi.advanceTimersByTime(2000);

    expect(send).toHaveBeenLastCalledWith(JSON.stringify({ type: "sync" }));
    controller.dispose();
  });

  it("resumes a room through the server before opening the co-op socket", async () => {
    const connectCoop = vi.fn();
    const controller = createCoopSessionController({
      apiJson: vi.fn(async (url) => {
        expect(url).toBe("/api/coop/rooms/room-1/session?playerId=player-1");
        return {
          session: {
            canJoin: true,
            myPlayerId: "player-1",
          },
        };
      }),
      connectCoop,
      showPlayView: vi.fn(),
      storedPlayerId: () => "player-1",
    });

    await controller.resumeRoom("room-1");

    expect(connectCoop).toHaveBeenCalledWith("join", {
      roomId: "room-1",
      playerId: "player-1",
    });
  });

  it("does not open the co-op socket when the server rejects room resume", async () => {
    const connectCoop = vi.fn();
    const showPlayView = vi.fn();
    vi.stubGlobal("alert", vi.fn());
    const controller = createCoopSessionController({
      apiJson: vi.fn(async () => {
        throw new Error("Room not found");
      }),
      connectCoop,
      showPlayView,
      storedPlayerId: () => "",
    });

    await controller.resumeRoom("stale-room");

    expect(connectCoop).not.toHaveBeenCalled();
    expect(showPlayView).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith("Room not found");
  });

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

  it("shows the room panel immediately after joining an invite", async () => {
    const coop = createInitialCoopState();
    const showRoomPanel = vi.fn();
    const controller = createCoopMessageController({
      connectToAuth: vi.fn(),
      coopGameView: { applyActiveState: vi.fn(), applyLobbyState: vi.fn() },
      coopInvites: { clearSent: vi.fn() },
      coopRoom: { showRoomPanel },
      getCoop: () => coop,
      getCoopPlayerName: () => "lena",
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

    await controller.handleMessage({
      type: "joined",
      roomId: "room-1",
      playerId: "player-lena",
    });

    expect(coop.roomId).toBe("room-1");
    expect(coop.playerId).toBe("player-lena");
    expect(coop.phase).toBe("lobby");
    expect(showRoomPanel).toHaveBeenCalledTimes(1);
  });

  it("hides accepted invitees from the co-op invite list", async () => {
    const inviteMessageEl = document.createElement("div");
    const inviteListEl = document.createElement("div");
    const controller = createCoopInviteController({
      apiJson: vi.fn(async (url) => {
        if (url === "/api/friends") {
          return {
            friends: [
              { id: "local:lena", username: "lena", name: "lena" },
              { id: "local:test1", username: "test1", name: "test1" },
            ],
          };
        }
        if (url === "/api/coop/rooms/room-1/invites") {
          return {
            invites: [
              { userId: "local:lena", status: "accepted" },
              { userId: "local:test1", status: "pending" },
            ],
          };
        }
        return {};
      }),
      elements: { inviteMessageEl, inviteListEl },
      getAuthInfo: () => ({ user: { username: "mirko" } }),
      getRoomId: () => "room-1",
      getJoinedUserIds: () => new Set(),
    });

    await controller.loadFriends();

    expect(inviteListEl.textContent).not.toContain("lena");
    expect(inviteListEl.textContent).toContain("test1");
    expect(inviteListEl.textContent).toContain("Invite sent");
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

  it("shows a reconnecting status when the active co-op player drops during a game", () => {
    const element = document.createElement("div");
    const coop = {
      phase: "playing",
      activeIdx: 1,
      myIdx: 0,
      midTurn: false,
      players: [
        { name: "mirko", connected: true },
        { name: "lena", connected: false, reconnecting: true },
      ],
    };
    const controller = createGameStatusController({
      element,
      getCoop: () => coop,
      getCurrentOpponent: () => ({ shortName: "Snib" }),
      getMaiaReady: () => true,
    });

    controller.setCoopTurn();

    expect(element.textContent).toBe("lena reconnecting...");
    expect(element.className).toBe("thinking");
  });

  it("shows reconnecting instead of the bot turn when the responsible co-op player drops mid-turn", () => {
    const element = document.createElement("div");
    const coop = {
      phase: "playing",
      activeIdx: 1,
      myIdx: 0,
      midTurn: true,
      players: [
        { name: "mirko", connected: true },
        { name: "lena", connected: false, reconnecting: true },
      ],
    };
    const controller = createGameStatusController({
      element,
      getCoop: () => coop,
      getCurrentOpponent: () => ({ shortName: "Snib" }),
      getMaiaReady: () => true,
    });

    controller.setCoopTurn();

    expect(element.textContent).toBe("lena reconnecting...");
    expect(element.className).toBe("thinking");
  });

  it("shows the host button to choose an opponent before a partner joins", () => {
    const cpStartBtn = document.createElement("button");
    const controller = createCoopRoomController({
      elements: {
        cpPlayerList: document.createElement("div"),
        cpRoomMeta: document.createElement("div"),
        cpStartBtn,
        lbFriendInvite: document.createElement("div"),
        lbFriends: document.createElement("div"),
        lbLeaderboard: document.createElement("div"),
        lbDevTesting: document.createElement("div"),
        lbMain: document.createElement("div"),
        lbProfile: document.createElement("div"),
        lbRoom: document.createElement("div"),
        lbSolo: document.createElement("div"),
      },
      storage: {
        lastRoomKey: "last-room",
        legacyLastRoomKey: "legacy-last-room",
        nameKey: roomId => `room.${roomId}.name`,
        legacyNameKey: roomId => `legacy.room.${roomId}.name`,
        playerKey: roomId => `room.${roomId}.player`,
      },
      getAuthInfo: () => ({ user: { username: "mirko" } }),
      getCoop: () => ({ selectingOpponent: false }),
      hideModelLoading: vi.fn(),
      showModelLoading: vi.fn(),
      renderCoopInviteFriends: vi.fn(),
    });

    controller.renderLobby([
      { name: "mirko", connected: true, maiaReady: true, unlockedCount: 3 },
    ], 0);

    expect(cpStartBtn.style.display).toBe("inline");
    expect(cpStartBtn.disabled).toBe(false);
    expect(cpStartBtn.textContent).toBe("Choose opponent");
    expect(cpStartBtn.title).toContain("Invite at least one friend before starting");
  });

  it("keeps the host choose-opponent button available while a joined partner prepares", () => {
    const cpStartBtn = document.createElement("button");
    const controller = createCoopRoomController({
      elements: {
        cpPlayerList: document.createElement("div"),
        cpRoomMeta: document.createElement("div"),
        cpStartBtn,
        lbFriendInvite: document.createElement("div"),
        lbFriends: document.createElement("div"),
        lbLeaderboard: document.createElement("div"),
        lbDevTesting: document.createElement("div"),
        lbMain: document.createElement("div"),
        lbProfile: document.createElement("div"),
        lbRoom: document.createElement("div"),
        lbSolo: document.createElement("div"),
      },
      storage: {
        lastRoomKey: "last-room",
        legacyLastRoomKey: "legacy-last-room",
        nameKey: roomId => `room.${roomId}.name`,
        legacyNameKey: roomId => `legacy.room.${roomId}.name`,
        playerKey: roomId => `room.${roomId}.player`,
      },
      getAuthInfo: () => ({ user: { username: "mirko" } }),
      getCoop: () => ({ selectingOpponent: false }),
      hideModelLoading: vi.fn(),
      showModelLoading: vi.fn(),
      renderCoopInviteFriends: vi.fn(),
    });

    controller.renderLobby([
      { name: "mirko", connected: true, maiaReady: true, unlockedCount: 3 },
      { name: "lena", connected: true, maiaReady: false, unlockedCount: 2 },
    ], 0);

    expect(cpStartBtn.style.display).toBe("inline");
    expect(cpStartBtn.disabled).toBe(false);
    expect(cpStartBtn.textContent).toBe("Choose opponent");
    expect(cpStartBtn.title).toContain("once every connected player is ready");
  });

  it("blocks starting a co-op game before a partner joins", () => {
    const send = vi.fn();
    const showStartBlocked = vi.fn();
    const coop = {
      phase: "lobby",
      myIdx: 0,
      players: [{ name: "mirko", connected: true }],
      ws: { send },
    };
    const controller = createCoopActionsController({
      getConnection: () => null,
      getCoop: () => coop,
      getElo: () => 900,
      getGameOver: () => false,
      getFen: () => "start-fen",
      getMaiaReady: () => true,
      getOpponentSelectionReadonly: () => false,
      getSoloStartDisabled: () => false,
      requestModelDownload: vi.fn(),
      showCoopBotSelection: vi.fn(),
      showModelLoading: vi.fn(),
      showStartBlocked,
    });

    controller.startWithSelectedBot();

    expect(send).not.toHaveBeenCalled();
    expect(showStartBlocked).toHaveBeenCalledWith("Invite at least one friend before starting a co-op game.");
  });
});
