const PROMOTION_TEST_FEN = "4k3/6P1/8/8/8/8/8/4K3 w - - 0 1";
const GRIBBLE_VICTORY_TEST_FEN = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1";

export function createLocalDebugController({
  boardActions,
  chess,
  clearChips,
  getBoard,
  getBotMoves,
  getCoopPhase,
  getSelectedOpponentIndex,
  hideModelLoading,
  hideOutcomeBanner,
  opponents,
  promotionChoice,
  setDebugMoveInput,
  setSelectedOpponent,
  setStatus,
  showGame,
  soloSession,
  syncStrength,
  updateOpponentSelection,
}) {
  let debugHookTimer = null;
  let helper = null;

  function opponentIndexForDebug(opponentKey) {
    const normalized = String(opponentKey || "").trim().toLowerCase();
    const index = opponents.findIndex(opponent => (
      opponent.theme === normalized
      || opponent.name.toLowerCase().includes(normalized)
      || String(opponent.elo) === normalized
    ));
    return index >= 0 ? index : getSelectedOpponentIndex();
  }

  function setDebugPosition(fen, options = {}) {
    if (getCoopPhase() !== "off") throw new Error("Leave co-op before using a local debug position.");
    const opponentIndex = Number.isInteger(options.opponentIndex) ? options.opponentIndex : getSelectedOpponentIndex();
    const opponent = opponents[opponentIndex];
    if (opponent) {
      setSelectedOpponent({ index: opponentIndex, theme: opponent.theme });
    }
    const strength = Number.isFinite(Number(options.strength))
      ? Number(options.strength)
      : opponent?.elo;
    if (strength) {
      syncStrength(String(strength));
      updateOpponentSelection(String(strength));
    }

    chess.load(fen);
    if (typeof soloSession.startGame === "function") {
      soloSession.startGame({ demo: options.demo !== false, debug: true });
    } else {
      soloSession.restoreSavedSession({
        fen,
        gameId: `debug-${Date.now()}`,
        startedAt: Date.now(),
        savedAt: Date.now(),
      });
    }

    setDebugMoveInput(true);
    getBotMoves()?.setThinking(false);
    clearChips();
    promotionChoice.hide();
    hideOutcomeBanner();
    hideModelLoading();
    showGame();
    getBoard()?.setPosition(chess.fen(), false);
    boardActions.clearLastMove();
    boardActions.clearCheckMarker();
    boardActions.updateCheckMarker();
    boardActions.updateGameScore();
    boardActions.enableMoveInput();
    setStatus("Your turn");
    return chess.fen();
  }

  function exposeHelper() {
    window.__chessquestiaDebug = helper;
    globalThis.__chessquestiaDebug = helper;
  }

  function bind() {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) return;
    helper = {
      setPosition: setDebugPosition,
      testPromotion: () => setDebugPosition(PROMOTION_TEST_FEN),
      testVictory: (opponent = "gribble") => setDebugPosition(GRIBBLE_VICTORY_TEST_FEN, {
        opponentIndex: opponentIndexForDebug(opponent),
        demo: false,
      }),
      testGribbleVictory: () => setDebugPosition(GRIBBLE_VICTORY_TEST_FEN, { opponentIndex: 2, demo: false }),
    };
    exposeHelper();
    debugHookTimer = window.setInterval(exposeHelper, 1000);
  }

  function dispose() {
    if (debugHookTimer) window.clearInterval(debugHookTimer);
    debugHookTimer = null;
    if (window.__chessquestiaDebug === helper) delete window.__chessquestiaDebug;
    if (globalThis.__chessquestiaDebug === helper) delete globalThis.__chessquestiaDebug;
    helper = null;
  }

  return {
    bind,
    dispose,
  };
}
