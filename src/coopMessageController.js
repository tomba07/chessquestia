export function createCoopMessageController({
  connectToAuth,
  coopGameView,
  coopInvites,
  coopRoom,
  getCoop,
  getCoopPlayerName,
  getSetupMode,
  loadCoopInviteFriends,
  loadInviteNotifications,
  readSoloProgress,
  rememberRoom,
  setRoomUrl,
  showModelLoading,
  showPlayView,
  syncStrength,
  updateOpponentSelection,
  elements,
}) {
  async function handleMessage(msg) {
    const coop = getCoop();

    function showPendingLobby({ host = false } = {}) {
      const self = {
        name: getCoopPlayerName(coop.roomId),
        connected: true,
        maiaReady: true,
        unlockedCount: readSoloProgress(),
      };
      const pendingPlayers = host
        ? [self]
        : [
          { name: "Host", connected: true, maiaReady: true, unlockedCount: 1 },
          self,
        ];
      const pendingState = {
        type: "room-state",
        roomId: coop.roomId,
        playerId: coop.playerId,
        phase: "lobby",
        players: pendingPlayers,
        activeIdx: 0,
        midTurn: false,
        fen: coop.fen,
        myIdx: host ? 0 : 1,
        startedAt: coop.startedAt,
        moveCount: coop.moveCount,
        strength: coop.strength,
        selectingOpponent: false,
        maxUnlockedOpponentCount: readSoloProgress(),
      };
      coopRoom.showRoomPanel();
      coop.phase = "lobby";
      coop.players = pendingPlayers;
      coopGameView.applyLobbyState(pendingState);
    }

    if (msg.type === "error") {
      if (msg.code === "auth-required") {
        connectToAuth();
        return;
      }
      if (msg.code === "waiting-for-maia") {
        showModelLoading("Preparing game...");
        alert(msg.message.replace("Waiting for Maia on:", "The game is still loading for:"));
        return;
      }
      if (msg.code === "coop-partner-required") {
        alert(msg.message);
        return;
      }
      alert(msg.message);
      showPlayView();
      return;
    }

    if (msg.type === "room-closed") {
      coop.phase = "off";
      coop.ws?.close();
      coop.ws = null;
      loadInviteNotifications();
      showPlayView();
      return;
    }

    if (msg.type === "created") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.reconnectAttempts = 0;
      coopInvites.clearSent();
      rememberRoom(msg.roomId, getCoopPlayerName(msg.roomId), msg.playerId);
      setRoomUrl(msg.roomId);
      loadCoopInviteFriends();
      showPendingLobby({ host: true });
      return;
    }

    if (msg.type === "joined") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.reconnectAttempts = 0;
      rememberRoom(msg.roomId, getCoopPlayerName(msg.roomId), msg.playerId);
      setRoomUrl(msg.roomId);
      loadCoopInviteFriends();
      loadInviteNotifications();
      showPendingLobby({ host: false });
      return;
    }

    if (msg.type === "room-state") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.players = msg.players;
      coop.activeIdx = msg.activeIdx;
      coop.midTurn = msg.midTurn;
      coop.fen = msg.fen;
      coop.myIdx = msg.myIdx;
      coop.startedAt = Number(msg.startedAt || coop.startedAt || Date.now());
      coop.moveCount = Number(msg.moveCount ?? coop.moveCount ?? 0);
      coop.strength = msg.strength;
      coop.selectingOpponent = !!msg.selectingOpponent;
      coop.maxUnlockedOpponentCount = Math.max(readSoloProgress(), Number(msg.maxUnlockedOpponentCount || 1));
      coop.reconnectAttempts = 0;

      if (msg.strength) {
        syncStrength(String(msg.strength));
        if (getSetupMode() === "coop" && elements.lbSolo.style.display !== "none")
          updateOpponentSelection(String(msg.strength));
      }

      if (msg.phase === "lobby") {
        coopGameView.applyLobbyState(msg);
        return;
      }

      if (msg.phase === "playing" || msg.phase === "over") {
        coopGameView.applyActiveState(msg);
      }
    }
  }

  return {
    handleMessage,
  };
}
