export function createCoopGameViewController({
  elements,
  getBoard,
  getChess,
  getCoop,
  getCurrentOpponent,
  getElo,
  getSetupMode,
  applyOpponentLocks,
  applyRemoteFen,
  checkGameOver,
  clearLastMove,
  disableBoardMoveInput,
  enableBoardMoveInput,
  hideOutcomeBanner,
  loadCoopInviteFriends,
  maybeAutoStartCoopSplash,
  maybeRunCoopBotTurn,
  renderRoomLobby,
  setCoopTurnStatus,
  setOpponentSelectionReadonly,
  shouldAutoStartCoopSplash,
  shouldLoadInviteFriends,
  showBotSplash,
  showCoopBotSelection,
  showGame,
  showGameStartSpeech,
  showRoomPanel,
  updateCheckMarker,
  updateGameScore,
  updatePlacementDiffs,
}) {
  const { cpChips, lbSolo, soloStartBtn } = elements;

  function coop() {
    return getCoop();
  }

  function chess() {
    return getChess();
  }

  function board() {
    return getBoard();
  }

  function maybeLoadCoopInviteFriends() {
    if (shouldLoadInviteFriends()) loadCoopInviteFriends();
  }

  function setReadonlySelection(readonly) {
    setOpponentSelectionReadonly(readonly);
    lbSolo.classList.toggle("readonly", readonly);
  }

  function showRoomLobby(players, myIdx) {
    maybeLoadCoopInviteFriends();
    renderRoomLobby(players, myIdx);
  }

  function renderChips(players, activeIdx, myIdx, midTurn) {
    cpChips.innerHTML = "";
    players.forEach((player, index) => {
      const chip = document.createElement("span");
      chip.className = "chip"
        + (index === activeIdx && !midTurn ? " active" : "")
        + (index === myIdx ? " me" : "");
      chip.textContent = player.name;
      cpChips.appendChild(chip);
    });
    if (midTurn) {
      const bot = document.createElement("span");
      bot.className = "chip active";
      bot.textContent = "Maia";
      cpChips.appendChild(bot);
    }
  }

  function applyLobbyState(msg) {
    const room = coop();
    room.phase = "lobby";

    if (!msg.selectingOpponent && getSetupMode() === "coop" && lbSolo.style.display !== "none") {
      setReadonlySelection(false);
      showRoomPanel();
      showRoomLobby(msg.players, msg.myIdx);
      return;
    }

    if (msg.selectingOpponent && lbSolo.style.display === "none") {
      showCoopBotSelection({ readonly: msg.myIdx !== 0 });
      maybeLoadCoopInviteFriends();
      return;
    }

    if (getSetupMode() === "coop" && lbSolo.style.display !== "none") {
      const readonly = msg.myIdx !== 0;
      setReadonlySelection(readonly);
      applyOpponentLocks();
      if (readonly) {
        updateOpponentSelection(String(msg.strength || getElo()));
        soloStartBtn.disabled = true;
      }
      maybeLoadCoopInviteFriends();
      return;
    }

    showRoomPanel();
    setReadonlySelection(false);
    showRoomLobby(msg.players, msg.myIdx);
  }

  function enterActiveGame(msg) {
    chess().load(msg.fen);
    cpChips.innerHTML = "";
    showGame();
    board().setPosition(msg.fen, false);
    clearLastMove();
    updateCheckMarker();
    updatePlacementDiffs();
    updateGameScore();
    enableBoardMoveInput();
    hideOutcomeBanner();
    if (msg.phase !== "playing") return;

    showBotSplash(getCurrentOpponent(), {
      mode: "coop",
      autoStart: shouldAutoStartCoopSplash(msg),
    }).then(() => {
      const room = coop();
      if (room?.roomId === msg.roomId && room?.phase === "playing") showGameStartSpeech();
    });
  }

  function applyTurnUi(msg) {
    if (msg.phase === "over") {
      checkGameOver();
      disableBoardMoveInput();
      return;
    }

    hideOutcomeBanner();
    if (msg.activeIdx === msg.myIdx && !msg.midTurn) enableBoardMoveInput();
    else disableBoardMoveInput();
    setCoopTurnStatus();
  }

  function applyActiveState(msg) {
    const room = coop();
    const wasInActiveGame = room.phase === "playing" || room.phase === "over";
    room.phase = msg.phase;

    if (!wasInActiveGame) enterActiveGame(msg);
    renderChips(msg.players, msg.activeIdx, msg.myIdx, msg.midTurn);

    if (msg.fen !== chess().fen()) applyRemoteFen(msg.fen);
    applyTurnUi(msg);
    maybeAutoStartCoopSplash(msg);
    maybeRunCoopBotTurn();
  }

  return {
    applyActiveState,
    applyLobbyState,
    renderChips,
  };
}
