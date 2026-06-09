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
      coopRoom.showRoomPanel();
      coop.phase = "lobby";
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
