export function createCoopActionsController({
  getConnection,
  getCoop,
  getElo,
  getGameOver,
  getFen,
  getMaiaReady,
  getOpponentSelectionReadonly,
  getSoloStartDisabled,
  requestModelDownload,
  showCoopBotSelection,
  showModelLoading,
}) {
  function room() {
    return getCoop();
  }

  function send(message) {
    room()?.ws?.send(JSON.stringify(message));
  }

  function connect(...args) {
    getConnection()?.connect(...args);
  }

  function leave() {
    getConnection()?.leave();
  }

  function publishMove() {
    const coop = room();
    if (!coop) return;
    if (coop.phase === "playing") coop.moveCount = Number(coop.moveCount || 0) + 1;
    send({ type: "move", fen: getFen(), gameOver: getGameOver() });
  }

  function setSelectingOpponent(selecting) {
    const coop = room();
    if (coop?.myIdx !== 0) return;
    send({ type: "selecting-opponent", selecting });
  }

  function startWithSelectedBot() {
    const coop = room();
    if (
      getOpponentSelectionReadonly()
      || getSoloStartDisabled()
      || coop?.phase !== "lobby"
      || coop.myIdx !== 0
    ) {
      return;
    }

    if (!getMaiaReady()) {
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }

    send({ type: "strength", strength: getElo() });
    send({ type: "start" });
  }

  function reopenLobby() {
    const coop = room();
    if (
      getOpponentSelectionReadonly()
      || coop?.phase !== "over"
      || coop.myIdx !== 0
    ) {
      return;
    }

    if (!getMaiaReady()) {
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }

    send({ type: "reopen-lobby" });
  }

  function enterBotSelection() {
    const coop = room();
    if (coop?.phase !== "lobby") return;
    const isHost = coop.myIdx === 0;
    if (isHost) setSelectingOpponent(true);
    showCoopBotSelection({ readonly: !isHost });
  }

  return {
    connect,
    enterBotSelection,
    leave,
    publishMove,
    reopenLobby,
    setSelectingOpponent,
    startWithSelectedBot,
  };
}
