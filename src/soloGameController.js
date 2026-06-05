export function createSoloGameController({
  chess,
  currentOpponent,
  elements,
  getBoard,
  getElo,
  getModelReady,
  getSelectedOpponentIndex,
  getSelectedOpponentTheme,
  getSetupMode,
  hideModelLoading,
  hideOutcomeBanner,
  maybeRunSoloBotTurn,
  onStartCoopWithSelectedBot,
  opponentThemeForStrength,
  opponents,
  promotionChoice,
  requestModelDownload,
  resetBoardDevicePlacement,
  resetThinkingReactionCadence,
  setDebugMoveInput,
  setDemoGameUrl,
  setSelectedOpponentIndex,
  setSelectedOpponentTheme,
  setSetupMode,
  setSoloGameUrl,
  setStatus,
  setBotThinking,
  showBotSplash,
  showGame,
  showGameStartSpeech,
  showModelLoading,
  soloSession,
  syncStrength,
  updateOpponentSelection,
  boardActions,
}) {
  let pendingStart = false;
  let pendingStartDemo = false;
  let startInProgress = false;

  const clearCoopChips = () => { elements.cpChips.innerHTML = ""; };

  function saveGame() {
    soloSession.saveGame({
      opponentTheme: getSelectedOpponentTheme(),
      opponentIndex: getSelectedOpponentIndex(),
    });
  }

  function clearGame() {
    soloSession.clearGame();
  }

  function recordResult(result) {
    soloSession.recordResult(result);
  }

  function begin({ showIntro = true, demo = false } = {}) {
    chess.reset();
    soloSession.startGame({ demo });
    setDebugMoveInput(false);
    clearCoopChips();
    promotionChoice.hide();
    hideOutcomeBanner();
    hideModelLoading();
    if (demo) setDemoGameUrl();
    else setSoloGameUrl();
    showGame();
    getBoard().setPosition(chess.fen());
    boardActions.clearLastMove();
    boardActions.clearCheckMarker();
    resetBoardDevicePlacement();
    boardActions.updateGameScore();
    boardActions.enableMoveInput();
    setBotThinking(false);
    resetThinkingReactionCadence();
    setStatus("Your turn");
    if (showIntro) showGameStartSpeech();
    saveGame();
  }

  async function startWithSplash({ demo = false } = {}) {
    if (startInProgress) return;
    startInProgress = true;
    try {
      await showBotSplash(currentOpponent(), {
        mode: "solo",
        beforeFade: () => begin({ showIntro: false, demo }),
      });
      showGameStartSpeech();
    } finally {
      startInProgress = false;
    }
  }

  function start({ demo = false } = {}) {
    if (!demo && elements.soloStartBtn.disabled) return;
    if (!getModelReady()) {
      pendingStart = true;
      pendingStartDemo = demo;
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }

    startWithSplash({ demo });
  }

  function startSelected() {
    if (getSetupMode() === "coop") {
      onStartCoopWithSelectedBot();
      return;
    }
    start();
  }

  function selectDemoOpponent() {
    const opponent = opponents[0];
    syncStrength(String(opponent.elo));
    setSelectedOpponentIndex(0);
    setSelectedOpponentTheme(opponent.theme);
    updateOpponentSelection(String(opponent.elo));
  }

  function startDemo() {
    setSetupMode("solo");
    selectDemoOpponent();
    setDemoGameUrl();
    start({ demo: true });
  }

  function restore() {
    if (location.search.includes("room=")) return;
    const state = soloSession.readSavedGame();
    if (!state) return;
    try {
      chess.load(state.fen);
      soloSession.restoreSavedSession(state);
      if (state.strength) syncStrength(String(state.strength));
      setSelectedOpponentIndex(Number(state.opponentIndex || 0));
      setSelectedOpponentTheme(state.opponentTheme || opponentThemeForStrength(state.strength || getElo()));
      clearCoopChips();
      promotionChoice.hide();
      showGame();
      getBoard().setPosition(chess.fen(), false);
      boardActions.clearLastMove();
      boardActions.updateCheckMarker();
      boardActions.updateGameScore();
      setBotThinking(false);
      if (boardActions.checkGameOver()) return;
      if (chess.turn() === "w") {
        boardActions.enableMoveInput();
        setStatus(getModelReady() ? "Your turn" : "Preparing game...");
      } else {
        boardActions.disableMoveInput();
        setStatus(getModelReady() ? "Thinking..." : "Preparing game...", getModelReady() ? "thinking" : "");
        maybeRunSoloBotTurn();
      }
    } catch {
      clearGame();
    }
  }

  function hasPendingStart() {
    return pendingStart;
  }

  function consumePendingStart() {
    const demoStart = pendingStartDemo;
    pendingStart = false;
    pendingStartDemo = false;
    return demoStart;
  }

  function clearPendingStart() {
    pendingStart = false;
    pendingStartDemo = false;
  }

  return {
    begin,
    clearGame,
    clearPendingStart,
    consumePendingStart,
    hasPendingStart,
    recordResult,
    restore,
    saveGame,
    start,
    startDemo,
    startSelected,
    startWithSplash,
  };
}
