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
    cpPlayerList.innerHTML = "";
    players.forEach((player, i) => {
      const row = document.createElement("div");
      row.className = "player-row";

      const name = document.createElement("div");
      name.className = "player-name";
      const unlocked = Number(player.unlockedCount || 1);
      name.textContent = `${player.name}${i === myIdx ? " (you)" : ""} · ${unlocked} bot${unlocked === 1 ? "" : "s"}`;

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

    const host = myIdx === 0;
    const ready = allPlayersReady(players);
    const connectedPlayers = players.filter(player => player.connected);
    const hasCoopPartner = connectedPlayers.length >= 2;
    const canOpenSelection = ready && hasCoopPartner && (host || coop.selectingOpponent);
    cpRoomMeta.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;
    cpStartBtn.style.display = "inline";
    cpStartBtn.disabled = !canOpenSelection;
    cpStartBtn.textContent = host
      ? ready && hasCoopPartner ? "Continue" : "Waiting..."
      : coop.selectingOpponent ? "View opponent" : "Waiting for host";
    cpStartBtn.title = !hasCoopPartner
      ? "Invite at least one friend before choosing an opponent."
      : ready ? host || coop.selectingOpponent ? "" : "The host chooses the opponent." : "The game is loading on all players' devices.";
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
