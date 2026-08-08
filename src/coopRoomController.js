export function createCoopRoomController({
  elements,
  storage,
  getAuthInfo,
  getCoop,
  hideModelLoading,
  showModelLoading,
  renderCoopInviteFriends,
}) {
  const {
    cpPlayerList,
    cpRoomMeta,
    cpStartBtn,
    lbFriendInvite,
    lbFriends,
    lbLeaderboard,
    lbDevTesting,
    lbMain,
    lbProfile,
    lbRoom,
    lbSolo,
  } = elements;
  const {
    lastRoomKey,
    legacyLastRoomKey,
    nameKey,
    legacyNameKey,
    playerKey,
  } = storage;

  function showRoomPanel() {
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbRoom.style.display = "flex";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbLeaderboard.style.display = "none";
    lbDevTesting.style.display = "none";
    lbFriendInvite.style.display = "none";
  }

  function storedPlayerName(roomId) {
    return roomId ? (localStorage.getItem(nameKey(roomId)) || localStorage.getItem(legacyNameKey(roomId)) || "") : "";
  }

  function storedPlayerId(roomId) {
    return roomId ? (localStorage.getItem(playerKey(roomId)) || "") : "";
  }

  function rememberRoom(roomId, name, playerId) {
    if (!roomId) return;
    localStorage.setItem(lastRoomKey, roomId);
    localStorage.removeItem(legacyLastRoomKey);
    if (name) localStorage.setItem(nameKey(roomId), name);
    if (playerId) localStorage.setItem(playerKey(roomId), playerId);
  }

  function playerName(roomId) {
    const authInfo = getAuthInfo();
    return authInfo.user?.username
      || authInfo.user?.name
      || authInfo.user?.email
      || storedPlayerName(roomId)
      || "Player";
  }

  function setRoomUrl(roomId) {
    const target = `/?room=${roomId}`;
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  function allPlayersReady(players) {
    return players.length > 0 && players.every(player => player.maiaReady);
  }

  function renderLobby(players, myIdx) {
    const coop = getCoop();
    const authInfo = getAuthInfo();
    const fallbackName = authInfo.user?.username || authInfo.user?.name || authInfo.user?.email || "Player";
    const lobbyPlayers = players?.length
      ? players
      : [{ name: fallbackName, connected: true, maiaReady: false, unlockedCount: 1 }];
    const effectiveMyIdx = players?.length ? myIdx : 0;
    cpPlayerList.innerHTML = "";
    lobbyPlayers.forEach((player, i) => {
      const row = document.createElement("div");
      row.className = "player-row";

      const name = document.createElement("div");
      name.className = "player-name";
      const unlocked = Number(player.unlockedCount || 1);
      name.textContent = `${player.name}${i === effectiveMyIdx ? " (you)" : ""} · ${unlocked} bot${unlocked === 1 ? "" : "s"}`;

      const status = document.createElement("div");
      const statusText = player.connected
        ? (player.maiaReady ? "Ready" : "Preparing")
        : "Offline";
      status.className = "player-status"
        + (statusText === "Ready" ? " ready" : "")
        + (statusText === "Preparing" ? " waiting" : "");
      status.textContent = statusText;

      row.append(name, status);
      cpPlayerList.appendChild(row);
    });

    const host = effectiveMyIdx === 0;
    const ready = allPlayersReady(lobbyPlayers);
    const connectedPlayers = lobbyPlayers.filter(player => player.connected);
    const hasCoopPartner = connectedPlayers.length >= 2;
    const canOpenSelection = host || coop.selectingOpponent;
    const playerCount = `${lobbyPlayers.length} player${lobbyPlayers.length === 1 ? "" : "s"}`;
    const hostName = lobbyPlayers[0]?.name || "Host";
    cpRoomMeta.textContent = host ? `${playerCount} · You are host` : `${playerCount} · Host: ${hostName}`;
    cpStartBtn.style.display = "inline";
    cpStartBtn.disabled = !canOpenSelection;
    cpStartBtn.textContent = host
      ? "Choose opponent"
      : coop.selectingOpponent ? "See host's selection" : "Host will choose opponent";
    cpStartBtn.title = ready
      ? hasCoopPartner
        ? host || coop.selectingOpponent ? "" : "The host will choose the opponent."
        : "You can choose the opponent now. Invite at least one friend before starting."
      : "You can choose the opponent now. The game can start once every connected player is ready.";
    if (ready || !host) hideModelLoading();
    else showModelLoading("Preparing game...");
    renderCoopInviteFriends();
  }

  function showReconnectingLobby() {
    showRoomPanel();
    cpRoomMeta.textContent = "Reconnecting...";
    cpStartBtn.disabled = true;
  }

  return {
    playerName,
    rememberRoom,
    renderLobby,
    setRoomUrl,
    showReconnectingLobby,
    showRoomPanel,
    storedPlayerId,
    storedPlayerName,
  };
}
