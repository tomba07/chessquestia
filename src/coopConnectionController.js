export function createCoopConnectionController({
  getCoop,
  getElo,
  getMaiaReady,
  getPlayerName,
  getRoomFromUrl,
  readSoloProgress,
  setSetupMode,
  showLobby,
  storedPlayerId,
  onMessage,
  onPlayingReconnect,
  onReconnectingLobby,
}) {
  function coop() {
    return getCoop();
  }

  function clearReconnectTimer() {
    const room = coop();
    if (!room?.reconnectTimer) return;
    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = null;
  }

  function joinPayload(roomId, name, opts = {}) {
    const room = coop();
    return {
      type: "join",
      roomId,
      name,
      playerId: opts.playerId || room.playerId || storedPlayerId(roomId),
      maiaReady: getMaiaReady(),
      unlockedOpponentCount: readSoloProgress(),
    };
  }

  function createPayload(name) {
    return {
      type: "create",
      name,
      strength: getElo(),
      maiaReady: getMaiaReady(),
      unlockedOpponentCount: readSoloProgress(),
    };
  }

  function connect(action, opts = {}) {
    const room = coop();
    const roomId = opts.roomId || getRoomFromUrl() || room.roomId;
    const name = opts.name || getPlayerName(roomId);
    clearReconnectTimer();
    room.leaving = false;

    const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProto}//${location.host}`);
    room.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(
      action === "create" ? createPayload(name) : joinPayload(roomId, name, opts)
    ));
    ws.onmessage = ({ data }) => onMessage(JSON.parse(data));
    ws.onclose = () => {
      if (room.ws !== ws) return;
      handleDisconnect();
    };
    ws.onerror = () => ws.close();
  }

  function handleDisconnect() {
    const room = coop();
    room.ws = null;
    if (room.leaving || room.phase === "off") {
      room.leaving = false;
      return;
    }

    const roomId = room.roomId || getRoomFromUrl();
    const name = getPlayerName(roomId);
    if (!roomId || !name) {
      leave();
      return;
    }

    if (room.phase === "lobby") onReconnectingLobby();
    else if (room.phase === "playing") onPlayingReconnect();

    const delay = Math.min(1000 * 2 ** room.reconnectAttempts, 8000);
    room.reconnectAttempts += 1;
    room.reconnectTimer = setTimeout(() => {
      connect("join", {
        roomId,
        name,
        playerId: room.playerId || storedPlayerId(roomId),
      });
    }, delay);
  }

  function leave() {
    const room = coop();
    clearReconnectTimer();
    room.leaving = true;
    room.ws?.close();
    room.ws = null;
    room.phase = "off";
    setSetupMode("solo");
    showLobby();
  }

  function dispose() {
    clearReconnectTimer();
  }

  return {
    clearReconnectTimer,
    connect,
    dispose,
    leave,
  };
}
