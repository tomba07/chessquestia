import { useEffect } from "react";
import { Chessboard, COLOR, INPUT_EVENT_TYPE } from "cm-chessboard";
import { Markers } from "cm-chessboard/src/extensions/markers/Markers.js";
import { Chess } from "chess.js";
import {
  buildLegalMask,
  decodeMoves,
  loadMaiaMoveMaps,
  prepareMaiaPosition,
  sampleMove,
} from "./maia.js";
import { createSocialController } from "./socialUi.js";
import { SOLO_OPPONENTS } from "./soloOpponents.js";
import {
  apiJson,
  createAppShellController,
  defaultAuthInfo,
} from "./appShellController.js";
import { createBoardController } from "./boardController.js";
import {
  BotSplash,
  FriendAddDialog,
  GameView,
  Lobby,
} from "./components/AppScreens.jsx";
import { createBotSplash } from "./botSplash.js";
import { createBotTurnController } from "./botTurnController.js";
import { createChessnutController } from "./chessnutController.js";
import { createCoopConnectionController } from "./coopConnectionController.js";
import { createCoopGameViewController } from "./coopGameViewController.js";
import { createCoopInviteController } from "./coopInviteController.js";
import { createCoopRoomController } from "./coopRoomController.js";
import { createMaiaWorker } from "./maiaWorker.js";
import { createOpponentSelectionController } from "./opponentSelectionController.js";
import { createOpponentSpeechController } from "./opponentSpeechController.js";
import { createOutcomeScreen } from "./outcomeScreen.js";
import { createSoloSessionController } from "./soloSessionController.js";

export default function App() {
  useEffect(() => {
    let disposed = false;
    let invitePollTimer = null;
    let debugHookTimer = null;
    (async () => {
      if (disposed) return;
  const BOT_MOVE_DELAY_MS = { min: 650, max: 1250 };
  const PROMOTION_TEST_FEN = "4k3/6P1/8/8/8/8/8/4K3 w - - 0 1";
  const GRIBBLE_VICTORY_TEST_FEN = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1";
  const CDN       = "/cm-chessboard/assets/";

  const strengthSlider = document.getElementById("strength-slider");
  const strengthVal    = document.getElementById("strength-val");

  // ── Load move mappings ────────────────────────────────────────────────────

  const { allMoves: allMovesMaia3, allMovesReversed: allMovesMaia3Reversed } = await loadMaiaMoveMaps();

  // ── Web Worker (Maia 3 ONNX inference) ───────────────────────────────────

  let coop = null;

  const statusDot   = document.getElementById("status-dot");
  const statusLabel = document.getElementById("status-label");
  const downloadBtn = document.getElementById("download-btn");
  const modelLoadingEl = document.getElementById("model-loading");
  const progressBar = document.getElementById("progress-bar");
  const progressFill = document.getElementById("progress-fill");
  let pendingSoloStart = false;

  const maia = createMaiaWorker({
    elements: { statusDot, statusLabel, downloadBtn, modelLoadingEl, progressBar, progressFill },
    getCoop: () => coop,
    readSoloProgress,
    onPendingSoloStart: () => pendingSoloStart,
    onReady: () => {
      if (pendingSoloStart) {
        const demoStart = pendingSoloStartDemo;
        pendingSoloStart = false;
        pendingSoloStartDemo = false;
        startSoloGameWithSplash({ demo: demoStart });
        return;
      }
      if (gameEl.style.display !== "none" && coop?.phase !== "playing") {
        if (!chess.isGameOver() && chess.turn() === "w") setStatus("Your turn");
      }
      if (gameEl.style.display !== "none" && coop?.phase === "playing") {
        setCoopTurnStatus();
      }
      maybeRunSoloBotTurn();
      maybeRunCoopBotTurn();
    },
  });
  maia.bindDownloadButton();
  const {
    hideModelLoading,
    requestModelDownload,
    runInference,
    showModelLoading,
    syncMaiaStatus,
  } = maia;

  // ── Game state ────────────────────────────────────────────────────────────

  const chess     = new Chess();
  const lobbyEl   = document.getElementById("lobby");
  const gameEl    = document.getElementById("game");
  const statusEl  = document.getElementById("game-status");
  const gameScoreEl = document.getElementById("game-score");
  const outcomeOverlayEl = document.getElementById("game-outcome-overlay");
  const outcomeBannerEl = document.getElementById("game-outcome-banner");
  const outcomeTitleEl = document.getElementById("game-outcome-title");
  const outcomeContinueBtn = document.getElementById("game-outcome-continue");
  const outcomeResultsEl = document.getElementById("game-outcome-results");
  const outcomeMovesEl = document.getElementById("game-outcome-moves");
  const outcomeTimeEl = document.getElementById("game-outcome-time");
  const outcomeUnlockEl = document.getElementById("game-outcome-unlock");
  const outcomeUnlockNameEl = document.getElementById("game-outcome-unlock-name");
  const outcomeUnlockTextEl = document.getElementById("game-outcome-unlock-text");
  const outcomeUnlockCardEl = document.getElementById("game-outcome-unlock-card");
  const outcomeChallengeBtn = document.getElementById("game-outcome-challenge");
  const victoryBoardPulseEl = document.getElementById("victory-board-pulse");
  const victoryScreenFlashEl = document.getElementById("victory-screen-flash");
  const gameBoardFrameEl = document.querySelector(".game-board-frame");
  const botSplashEl = document.getElementById("bot-splash");
  const botSplashArt = document.getElementById("bot-splash-art");
  const botSplashBanner = document.getElementById("bot-splash-banner");
  const botSplashName = document.getElementById("bot-splash-name");
  const botSplashText = document.getElementById("bot-splash-text");
  const botSplashStrength = document.getElementById("bot-splash-strength");
  const botSplashStart = document.getElementById("bot-splash-start");
  const cpChips   = document.getElementById("cp-chips");
  const promotionChoiceEl = document.getElementById("promotion-choice");
  const boardDevicePanel = document.getElementById("board-device-panel");
  const boardConnectBtn = document.getElementById("board-connect-btn");
  const boardConnectLabel = document.getElementById("board-connect-label");
  const boardDisconnectBtn = document.getElementById("board-disconnect-btn");
  const boardDeviceStatus = document.getElementById("board-device-status");
  const profileBoardToggle = document.getElementById("profile-board-toggle");
  const opponentSpeechEl = document.getElementById("opponent-speech");
  const opponentSpeechPortrait = document.getElementById("opponent-speech-portrait");
  const opponentSpeechName = document.getElementById("opponent-speech-name");
  const opponentSpeechText = document.getElementById("opponent-speech-text");
  const opponentSpeechClose = document.getElementById("opponent-speech-close");
  const STORAGE_PREFIX = "chessquestia";
  const LEGACY_STORAGE_PREFIX = "local-chess";
  const storageKey = (suffix) => `${STORAGE_PREFIX}.${suffix}`;
  const legacyStorageKey = (suffix) => `${LEGACY_STORAGE_PREFIX}.${suffix}`;
  const SOLO_GAME_KEY = storageKey("solo-game");
  const LEGACY_SOLO_GAME_KEY = legacyStorageKey("solo-game");
  const SOLO_PROGRESS_KEY = storageKey("solo-progress");
  const BOARD_DEVICE_VISIBLE_KEY = storageKey("board-device-visible");
  let board       = null;
  let botThinking = false;
  let soloSession = null;
  let setupMode = "solo";
  let opponentSelectionReadonly = false;
  let selectedOpponentTheme = "snib";
  let selectedOpponentIndex = 0;
  let soloStartInProgress = false;
  let pendingSoloStartDemo = false;
  let authInfo = defaultAuthInfo();
  let coopConnection = null;
  let pendingPromotion = null;
  let debugMoveInput = false;

  const opponentSelection = createOpponentSelectionController({
    elements: {
      strengthSlider,
      strengthVal,
      soloStartBtn: () => soloStartBtn,
    },
    opponents: SOLO_OPPONENTS,
    readProgress: () => readSoloProgress(),
    getCoopMaxUnlocked: () => coop?.maxUnlockedOpponentCount || 1,
    getReadonly: () => opponentSelectionReadonly,
    getSetupMode: () => setupMode,
    onSelected: ({ index, theme }) => {
      if (Number.isInteger(index)) selectedOpponentIndex = index;
      if (theme) selectedOpponentTheme = theme;
    },
    onHostStrengthChange: (strength) => {
      if (setupMode === "coop" && coop?.phase === "lobby" && coop.myIdx === 0)
        coop.ws?.send(JSON.stringify({ type: "strength", strength }));
    },
  });
  const applyOpponentLocks = () => {
    opponentSelection.applyLocks();
  };
  const clearOpponentSelection = opponentSelection.clearSelection;
  const currentOpponent = () => opponentSelection.currentOpponent(selectedOpponentIndex);
  const getElo = opponentSelection.getElo;
  const opponentThemeForStrength = opponentSelection.themeForStrength;
  const syncStrength = opponentSelection.syncStrength;
  const updateOpponentSelection = opponentSelection.updateSelection;

  function setStatus(text, cls = "") {
    statusEl.textContent = text;
    statusEl.className   = cls;
  }

  function setCoopTurnStatus() {
    if (!coop || coop.phase !== "playing") return;
    if (coop.activeIdx === coop.myIdx && !coop.midTurn) {
      setStatus(maia.modelReady ? "Your turn" : "Preparing game...", maia.modelReady ? "" : "thinking");
      return;
    }

    const activePlayer = coop.players?.[coop.activeIdx];
    const activeName = activePlayer?.name || "Player";
    setStatus(coop.midTurn ? `${activeName}: bot thinking...` : `${activeName}'s turn`, coop.midTurn ? "thinking" : "");
  }

  function canAcceptPlayerMove() {
    if (chess.isGameOver() || (!maia.modelReady && !debugMoveInput) || botThinking) return false;
    if (coop?.phase === "playing") return !coop.midTurn && coop.activeIdx === coop.myIdx;
    return soloSession.active && coop?.phase === "off" && chess.turn() === "w";
  }

  const boardController = createBoardController({
    elements: {
      scoreEl: gameScoreEl,
      frameEl: gameBoardFrameEl,
    },
    getBoard: () => board,
    getChess: () => chess,
    inputHandler,
    onDiffLeds: () => chessnutBoard.updateDiffLeds(),
  });
  const applyRemoteFen = boardController.applyRemoteFen;
  const clearCheckMarker = boardController.clearCheckMarker;
  const clearLastMove = boardController.clearLastMove;
  const commitBotMove = boardController.commitBotMove;
  const disableBoardMoveInput = boardController.disableMoveInput;
  const enableBoardMoveInput = boardController.enableMoveInput;
  const findKingSquare = boardController.findKingSquare;
  const isCurrentSideInCheck = boardController.isCurrentSideInCheck;
  const syncBoardAfterMove = boardController.syncAfterMove;
  const updateCheckMarker = boardController.updateCheckMarker;
  const updateGameScore = boardController.updateScore;

  function publishCoopMove() {
    if (coop?.phase === "playing") coop.moveCount = Number(coop.moveCount || 0) + 1;
    coop.ws?.send(JSON.stringify({ type: "move", fen: chess.fen(), gameOver: chess.isGameOver() }));
  }

  function isMyCoopBotTurn() {
    return coop?.phase === "playing"
      && coop.activeIdx === coop.myIdx
      && coop.midTurn
      && maia.modelReady
      && !chess.isGameOver();
  }

  const botTurns = createBotTurnController({
    botMoveDelayMs: BOT_MOVE_DELAY_MS,
    isBotThinking: () => botThinking,
    isMyCoopBotTurn,
    onCoopBotMove: () => coopBotMove(),
  });
  const clearCoopBotTimer = botTurns.clearCoopBotTimer;
  const nextBotMoveDelay = botTurns.nextBotMoveDelay;
  const scheduleCoopBotMove = botTurns.scheduleCoopBotMove;
  const thinkingMoveDelay = botTurns.thinkingMoveDelay;
  const wait = botTurns.wait;

  function promotionMoves(from, to) {
    return chess.moves({ verbose: true })
      .filter(move => move.from === from && move.to === to && move.promotion);
  }

  function hidePromotionChoice() {
    pendingPromotion = null;
    promotionChoiceEl.hidden = true;
    promotionChoiceEl.classList.remove("visible");
  }

  function showPromotionChoice(from, to) {
    const moves = promotionMoves(from, to);
    if (!moves.length) return false;
    pendingPromotion = { from, to };
    const promotions = new Set(moves.map(move => move.promotion));
    promotionChoiceEl.querySelectorAll("[data-promotion]").forEach((button) => {
      button.disabled = !promotions.has(button.dataset.promotion);
    });
    promotionChoiceEl.hidden = false;
    promotionChoiceEl.classList.add("visible");
    return true;
  }

  function choosePromotion(promotion) {
    const pending = pendingPromotion;
    hidePromotionChoice();
    if (!pending) return;
    applyPlayerMove(pending.from, pending.to, promotion);
  }

  function applyPlayerMove(from, to, promotion = "q") {
    if (!canAcceptPlayerMove()) return false;
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) return false;
      syncBoardAfterMove(move);
      if (coop?.phase === "playing") {
        publishCoopMove();
        if (checkGameOver()) return true;
        showPlayerMoveReaction(move);
        disableBoardMoveInput();
      } else {
        saveSoloGame();
        if (!checkGameOver()) {
          showPlayerMoveReaction(move);
          disableBoardMoveInput();
          setTimeout(botMove, nextBotMoveDelay());
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  function setGameOpponentTheme(value = getElo(), theme = selectedOpponentTheme) {
    const legacyThemes = { imp: "snib", witch: "vexi" };
    const nextTheme = theme || opponentThemeForStrength(value);
    gameEl.dataset.opponent = legacyThemes[nextTheme] || nextTheme;
  }

  const chessnutBoard = createChessnutController({
    elements: {
      panel: boardDevicePanel,
      connectBtn: boardConnectBtn,
      connectLabel: boardConnectLabel,
      disconnectBtn: boardDisconnectBtn,
      statusEl: boardDeviceStatus,
      profileToggle: profileBoardToggle,
    },
    storageKey: BOARD_DEVICE_VISIBLE_KEY,
    getFen: () => chess.fen(),
    getLegalMoves: () => chess.moves({ verbose: true }),
    canAcceptMove: canAcceptPlayerMove,
    applyMove: (from, to, promotion = "q") => applyPlayerMove(from, to, promotion),
  });

  const outcomeScreen = createOutcomeScreen({
    elements: {
      overlayEl: outcomeOverlayEl,
      bannerEl: outcomeBannerEl,
      titleEl: outcomeTitleEl,
      continueBtn: outcomeContinueBtn,
      resultsEl: outcomeResultsEl,
      movesEl: outcomeMovesEl,
      timeEl: outcomeTimeEl,
      unlockEl: outcomeUnlockEl,
      unlockNameEl: outcomeUnlockNameEl,
      unlockTextEl: outcomeUnlockTextEl,
      unlockCardEl: outcomeUnlockCardEl,
      challengeBtn: outcomeChallengeBtn,
      boardPulseEl: victoryBoardPulseEl,
      screenFlashEl: victoryScreenFlashEl,
    },
    getBoard: () => board,
    getCoopPhase: () => coop?.phase || "off",
    getGameStartedAt: () => coop?.phase !== "off" ? coop.startedAt : soloSession?.gameStartedAt,
    getLastMoveSquares: () => {
      const history = chess.history({ verbose: true });
      const move = history[history.length - 1];
      return move ? [move.from, move.to] : [];
    },
    getMoveCount: () => coop?.phase !== "off" ? coop.moveCount : chess.history().length,
    opponents: SOLO_OPPONENTS,
  });
  const clearVictoryBoardPulse = outcomeScreen.clearBoardPulse;
  const hideOutcomeBanner = outcomeScreen.hideBanner;
  const showOutcomeBannerAfterDelay = outcomeScreen.showBannerAfterDelay;
  const showVictoryBoardPulseAfterDelay = outcomeScreen.showBoardPulseAfterDelay;

  const {
    bindStartButton: bindBotSplashStartButton,
    clearBotSplashAutoTimer,
    maybeAutoStartCoopSplash,
    shouldAutoStartCoopSplash,
    showBotSplash,
  } = createBotSplash({
    elements: {
      botSplashEl,
      botSplashArt,
      botSplashBanner,
      botSplashName,
      botSplashText,
      botSplashStrength,
      botSplashStart,
    },
    getCurrentOpponent: currentOpponent,
  });

  const opponentSpeech = createOpponentSpeechController({
    elements: {
      speechEl: opponentSpeechEl,
      portraitEl: opponentSpeechPortrait,
      nameEl: opponentSpeechName,
      textEl: opponentSpeechText,
      closeBtn: opponentSpeechClose,
    },
    getCurrentOpponent: currentOpponent,
    isCurrentSideInCheck,
  });
  const hideOpponentSpeech = opponentSpeech.hide;
  const resetThinkingReactionCadence = opponentSpeech.resetThinkingCadence;
  const showBotMoveReaction = opponentSpeech.showBotMoveReaction;
  const showEndgameOpponentReaction = opponentSpeech.showEndgameReaction;
  const showGameStartSpeech = opponentSpeech.showGameStartSpeech;
  const showOpponentThinkingReaction = opponentSpeech.showThinkingReaction;
  const showPlayerMoveReaction = opponentSpeech.showPlayerMoveReaction;

  soloSession = createSoloSessionController({
    storageKeys: {
      soloGameKey: SOLO_GAME_KEY,
      legacySoloGameKey: LEGACY_SOLO_GAME_KEY,
      soloProgressKey: SOLO_PROGRESS_KEY,
    },
    opponentCount: SOLO_OPPONENTS.length,
    getAuthInfo: () => authInfo,
    getCoopPhase: () => coop?.phase || "off",
    getCurrentOpponent: currentOpponent,
    getElo,
    getFen: () => chess.fen(),
    getHistoryLength: () => chess.history().length,
    getOpponentIndex: () => selectedOpponentIndex,
    onProgressChanged: () => {
      applyOpponentLocks();
      syncMaiaStatus();
    },
  });

  function readSoloProgress() {
    return soloSession?.readProgress() || 1;
  }

  function syncSoloProgressFromAuth() {
    soloSession.syncProgressFromAuth();
  }

  function unlockNextOpponent() {
    return soloSession.unlockNextOpponent();
  }

  function showGame() {
    lobbyEl.style.display = "none";
    setGameOpponentTheme();
    updateGameScore();
    gameEl.style.display  = "flex";
    if (!board) {
      board = new Chessboard(document.getElementById("board"), {
        position: chess.fen(),
        orientation: COLOR.white,
        assetsUrl: CDN,
        style: {
          pieces: { file: CDN + "pieces/staunty.svg" },
          animationDuration: 220,
        },
        extensions: [{ class: Markers }],
      });
    }
    clearVictoryBoardPulse();
  }

  function showLobby() {
    gameEl.style.display  = "none";
    hideOpponentSpeech();
    hidePromotionChoice();
    lobbyEl.style.display = "";
    if (soloSession.active) clearSoloGame();
    if (authInfo.authEnabled && !authInfo.user) showAuthView();
    else showPlayView();
    if (authInfo.user && (location.search.includes("room=") || location.pathname !== "/"))
      history.replaceState(null, "", "/");
  }

  function shouldWarnBeforeExitingGame() {
    return gameEl.style.display !== "none" && !chess.isGameOver();
  }

  function confirmExitGame() {
    if (!shouldWarnBeforeExitingGame()) return true;
    const message = coop?.phase !== "off"
      ? "Exit this game? You will leave the current room."
      : "Exit this game? Your current solo game will be discarded.";
    return window.confirm(message);
  }

  function saveSoloGame() {
    soloSession.saveGame({
      opponentTheme: selectedOpponentTheme,
      opponentIndex: selectedOpponentIndex,
    });
  }

  function clearSoloGame() {
    soloSession.clearGame();
  }

  function recordSoloGameResult(result) {
    soloSession.recordResult(result);
  }

  function beginSoloGame({ showIntro = true, demo = false } = {}) {
    chess.reset();
    soloSession.startGame({ demo });
    debugMoveInput = false;
    cpChips.innerHTML = "";
    hidePromotionChoice();
    hideOutcomeBanner();
    hideModelLoading();
    if (demo) setDemoGameUrl();
    else setSoloGameUrl();
    showGame();
    board.setPosition(chess.fen());
    clearLastMove();
    clearCheckMarker();
    chessnutBoard.resetPlacement();
    updateGameScore();
    enableBoardMoveInput();
    botThinking = false;
    resetThinkingReactionCadence();
    setStatus("Your turn");
    if (showIntro) showGameStartSpeech();
    saveSoloGame();
  }

  async function startSoloGameWithSplash({ demo = false } = {}) {
    if (soloStartInProgress) return;
    soloStartInProgress = true;
    try {
      await showBotSplash(currentOpponent(), {
        mode: "solo",
        beforeFade: () => beginSoloGame({ showIntro: false, demo }),
      });
      showGameStartSpeech();
    } finally {
      soloStartInProgress = false;
    }
  }

  function startSoloGame({ demo = false } = {}) {
    if (!demo && soloStartBtn.disabled) return;
    if (!maia.modelReady) {
      pendingSoloStart = true;
      pendingSoloStartDemo = demo;
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }

    startSoloGameWithSplash({ demo });
  }

  function startSelectedGame() {
    if (setupMode === "coop") {
      startCoopWithSelectedBot();
      return;
    }
    startSoloGame();
  }

  function selectDemoOpponent() {
    const opponent = SOLO_OPPONENTS[0];
    syncStrength(String(opponent.elo));
    selectedOpponentIndex = 0;
    selectedOpponentTheme = opponent.theme;
    updateOpponentSelection(String(opponent.elo));
  }

  function startDemoGame() {
    setupMode = "solo";
    selectDemoOpponent();
    setDemoGameUrl();
    startSoloGame({ demo: true });
  }

  function restoreSoloGame() {
    if (location.search.includes("room=")) return;
    const state = soloSession.readSavedGame();
    if (!state) return;
    try {
      chess.load(state.fen);
      soloSession.restoreSavedSession(state);
      if (state.strength) syncStrength(String(state.strength));
      selectedOpponentIndex = Number(state.opponentIndex || 0);
      selectedOpponentTheme = state.opponentTheme || opponentThemeForStrength(state.strength || getElo());
      cpChips.innerHTML = "";
      hidePromotionChoice();
      showGame();
      board.setPosition(chess.fen(), false);
      clearLastMove();
      updateCheckMarker();
      updateGameScore();
      botThinking = false;
      if (checkGameOver()) return;
      if (chess.turn() === "w") {
        enableBoardMoveInput();
        setStatus(maia.modelReady ? "Your turn" : "Preparing game...");
      } else {
        disableBoardMoveInput();
        setStatus(maia.modelReady ? "Thinking…" : "Preparing game...", maia.modelReady ? "thinking" : "");
        maybeRunSoloBotTurn();
      }
    } catch {
      clearSoloGame();
    }
  }

  function setDebugPosition(fen, options = {}) {
    if (coop?.phase !== "off") throw new Error("Leave co-op before using a local debug position.");
    const opponentIndex = Number.isInteger(options.opponentIndex) ? options.opponentIndex : selectedOpponentIndex;
    const opponent = SOLO_OPPONENTS[opponentIndex];
    if (opponent) {
      selectedOpponentIndex = opponentIndex;
      selectedOpponentTheme = opponent.theme;
      syncStrength(String(opponent.elo));
      updateOpponentSelection(String(opponent.elo));
    }
    chess.load(fen);
    if (typeof soloSession.startGame === "function") {
      soloSession.startGame({ demo: options.demo !== false });
    } else {
      soloSession.restoreSavedSession({
        fen,
        gameId: `debug-${Date.now()}`,
        startedAt: Date.now(),
        savedAt: Date.now(),
      });
    }
    debugMoveInput = true;
    botThinking = false;
    cpChips.innerHTML = "";
    hidePromotionChoice();
    hideOutcomeBanner();
    hideModelLoading();
    showGame();
    board.setPosition(chess.fen(), false);
    clearLastMove();
    clearCheckMarker();
    updateCheckMarker();
    updateGameScore();
    enableBoardMoveInput();
    setStatus("Your turn");
    return chess.fen();
  }

  function installDebugHooks() {
    const debugAllowed = ["localhost", "127.0.0.1"].includes(location.hostname);
    if (!debugAllowed) return;
    const opponentIndexForDebug = (opponentKey) => {
      const normalized = String(opponentKey || "").trim().toLowerCase();
      const index = SOLO_OPPONENTS.findIndex(opponent => (
        opponent.theme === normalized
        || opponent.name.toLowerCase().includes(normalized)
        || String(opponent.elo) === normalized
      ));
      return index >= 0 ? index : selectedOpponentIndex;
    };
    const helper = {
      setPosition: setDebugPosition,
      testPromotion: () => setDebugPosition(PROMOTION_TEST_FEN),
      testVictory: (opponent = "gribble") => setDebugPosition(GRIBBLE_VICTORY_TEST_FEN, {
        opponentIndex: opponentIndexForDebug(opponent),
        demo: false,
      }),
      testGribbleVictory: () => setDebugPosition(GRIBBLE_VICTORY_TEST_FEN, { opponentIndex: 2, demo: false }),
    };
    const exposeHelper = () => {
      window.__chessquestiaDebug = helper;
      globalThis.__chessquestiaDebug = helper;
    };
    exposeHelper();
    if (!debugHookTimer) debugHookTimer = window.setInterval(exposeHelper, 1000);
  }
  installDebugHooks();

  function checkGameOver() {
    if (chess.isCheckmate()) {
      const playerWon = chess.turn() === "b";
      recordSoloGameResult(playerWon ? "victory" : "defeat");
      const canUnlockProgress = soloSession.active || coop?.phase === "playing" || coop?.phase === "over";
      const nextOpponent = playerWon ? SOLO_OPPONENTS[selectedOpponentIndex + 1] : null;
      const unlockedNext = playerWon && canUnlockProgress && unlockNextOpponent();
      const defeatedKingSquare = findKingSquare(playerWon ? "b" : "w");
      showVictoryBoardPulseAfterDelay(defeatedKingSquare, 120, playerWon ? "victory" : "defeat");
      showOutcomeBannerAfterDelay(playerWon ? "victory" : "defeat", 2200, {
        unlockedOpponent: unlockedNext ? nextOpponent : null,
      });
      showEndgameOpponentReaction(playerWon, 2050);
      setStatus(unlockedNext ? "New opponent unlocked." : "Checkmate", "over");
      disableBoardMoveInput();
      return true;
    }
    if (chess.isDraw()) {
      const reason = chess.isStalemate() ? "Stalemate"
        : chess.isInsufficientMaterial() ? "Insufficient material" : "Draw";
      recordSoloGameResult("draw");
      showVictoryBoardPulseAfterDelay(null, 120, "draw");
      showOutcomeBannerAfterDelay("draw", 1900);
      setStatus(reason, "over");
      disableBoardMoveInput();
      return true;
    }
    hideOutcomeBanner();
    return false;
  }

  async function botMove() {
    if (chess.isGameOver() || !maia.modelReady || botThinking) return;
    botThinking = true;
    setStatus("Thinking…", "thinking");
    const showedThinkingReaction = showOpponentThinkingReaction();
    if (showedThinkingReaction) {
      await wait(thinkingMoveDelay());
      if (chess.isGameOver() || !soloSession.active || coop?.phase !== "off" || gameEl.style.display === "none") {
        botThinking = false;
        return;
      }
    }

    const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
    const legalMask = buildLegalMask(workingFen, allMovesMaia3);

    const { logitsMove } = await runInference(tokens, getElo());
    const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesMaia3Reversed);
    const uci = sampleMove(moveProbs);

    const move = commitBotMove(uci);

    botThinking = false;
    saveSoloGame();
    if (!checkGameOver()) {
      showBotMoveReaction(move);
      enableBoardMoveInput();
      setStatus("Your turn");
    }
  }

  function maybeRunSoloBotTurn() {
    if (soloSession.active && coop?.phase === "off" && gameEl.style.display !== "none"
      && chess.turn() === "b" && maia.modelReady && !botThinking && !chess.isGameOver())
      setTimeout(botMove, nextBotMoveDelay());
  }

  function inputHandler(event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted:
        if (pendingPromotion) return false;
        if (coop.phase === "playing")
          return !coop.midTurn && coop.activeIdx === coop.myIdx && maia.modelReady;
        return chess.turn() === "w" && !botThinking && (maia.modelReady || debugMoveInput) && !chess.isGameOver();

      case INPUT_EVENT_TYPE.validateMoveInput: {
        if (showPromotionChoice(event.squareFrom, event.squareTo)) return false;
        return applyPlayerMove(event.squareFrom, event.squareTo, "q");
      }
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    document.querySelector("#board svg")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }, { capture: true });

  function requestPortraitOrientation() {
    screen.orientation?.lock?.("portrait").catch(() => {});
  }

  requestPortraitOrientation();
  window.addEventListener("orientationchange", requestPortraitOrientation);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (["localhost", "127.0.0.1"].includes(location.hostname))
    new EventSource("/dev-reload").onmessage = (e) => { if (e.data === "reload") location.reload(); };

  // ── Lobby UI ──────────────────────────────────────────────────────────────

  const lbMain       = document.getElementById("lb-main");
  const lbAuth       = document.getElementById("lb-auth");
  const lbSolo       = document.getElementById("lb-solo");
  const lbRoom       = document.getElementById("lb-room");
  const lbProfile    = document.getElementById("lb-profile");
  const lbFriends    = document.getElementById("lb-friends");
  const lbFriendInvite = document.getElementById("lb-friend-invite");
  const cpPlayerList = document.getElementById("cp-player-list");
  const cpStartBtn   = document.getElementById("cp-start");
  const cpLeaveBtn   = document.getElementById("cp-leave");
  const cpRoomMeta   = document.getElementById("cp-room-meta");
  const cpInviteMessage = document.getElementById("cp-invite-message");
  const cpInviteList = document.getElementById("cp-invite-list");
  const backBtn      = document.getElementById("back-btn");
  const authBar      = document.getElementById("auth-bar");
  const authLabel    = document.getElementById("auth-label");
  const authBtn      = document.getElementById("auth-btn");
  const authPrimaryBtn = document.getElementById("auth-primary-btn");
  const authDemoBtn = document.getElementById("auth-demo-btn");
  const authDevLoginCard = document.getElementById("auth-dev-login-card");
  const authDevLoginOptions = document.getElementById("auth-dev-login-options");
  const profileAccountCard = document.getElementById("profile-account-card");
  const profileAccountName = document.getElementById("profile-account-name");
  const profileAuthBtn = document.getElementById("profile-auth-btn");
  const devLoginCard = document.getElementById("dev-login-card");
  const devLoginOptions = document.getElementById("dev-login-options");
  const navPlay      = document.getElementById("nav-play");
  const navProfile   = document.getElementById("nav-profile");
  const navFriends   = document.getElementById("nav-friends");
  const coopInviteNotice = document.getElementById("coop-invite-notice");
  const coopInviteText = document.getElementById("coop-invite-text");
  const coopInviteJoin = document.getElementById("coop-invite-join");
  const coopInviteDismiss = document.getElementById("coop-invite-dismiss");
  const welcomeName  = document.getElementById("welcome-name");
  const botSelectTitle = document.getElementById("bot-select-title");
  const soloStartBtn = document.getElementById("solo-start-btn");
  const soloBackBtn  = document.getElementById("solo-back-btn");
  const friendSearch = document.getElementById("friend-search");
  const profileUsername = document.getElementById("profile-username");
  const usernameSaveBtn = document.getElementById("username-save");
  const usernameHelp = document.getElementById("username-help");
  const friendMessage = document.getElementById("friend-message");
  const friendRequestsEl = document.getElementById("friend-requests");
  const friendResultsEl = document.getElementById("friend-results");
  const friendListEl = document.getElementById("friend-list");
  const friendInviteLink = document.getElementById("friend-invite-link");
  const friendLinkCopy = document.getElementById("friend-link-copy");
  const friendLinkShare = document.getElementById("friend-link-share");
  const friendAddDialog = document.getElementById("friend-add-dialog");
  const friendAddClose = document.getElementById("friend-add-close");
  const friendInviteLanding = document.getElementById("friend-invite-landing");
  const searchParams = new URLSearchParams(location.search);
  const friendInvitePathMatch = location.pathname.match(/^\/plsbemyfriend\/([^/]+)$/);
  const incomingFriendUsername = friendInvitePathMatch
    ? decodeURIComponent(friendInvitePathMatch[1])
    : searchParams.get("friend");
  const initialView = searchParams.get("view");
  const demoGame = searchParams.get("demo");

  let social = null;
  const closeAddFriendDialog = (options) => social?.closeAddFriendDialog(options);
  const loadFriendInviteLanding = (...args) => social.loadFriendInviteLanding(...args);
  const loadInviteNotifications = (...args) => social.loadInviteNotifications(...args);
  const renderInviteNotification = (...args) => social?.renderInviteNotification(...args);
  const runFriendAction = (...args) => social.runFriendAction(...args);
  const showFriendsView = (...args) => social.showFriendsView(...args);
  const showProfileView = (...args) => social.showProfileView(...args);
  const startPresenceHeartbeat = (...args) => social.startPresenceHeartbeat(...args);

  const appShell = createAppShellController({
    elements: {
      authBar,
      authBtn,
      authDemoBtn,
      authDevLoginCard,
      authDevLoginOptions,
      authLabel,
      authPrimaryBtn,
      botSelectTitle,
      devLoginCard,
      devLoginOptions,
      lbAuth,
      lbFriendInvite,
      lbFriends,
      lbMain,
      lbProfile,
      lbRoom,
      lbSolo,
      lobbyEl,
      navFriends,
      navPlay,
      navProfile,
      playCoopBtn: document.getElementById("play-coop-btn"),
      playSoloBtn: document.getElementById("play-solo-btn"),
      profileAccountCard,
      profileAccountName,
      profileAuthBtn,
      soloStartBtn,
      welcomeName,
    },
    searchParams,
    getAuthInfo: () => authInfo,
    setAuthInfo: (nextAuthInfo) => { authInfo = nextAuthInfo; },
    onAuthLoaded: syncSoloProgressFromAuth,
    closeAddFriendDialog,
    renderInviteNotification,
    getPendingSoloStart: () => pendingSoloStart,
    hideModelLoading,
    setSetupMode: (mode) => { setupMode = mode; },
    setOpponentSelectionReadonly: (readonly) => { opponentSelectionReadonly = readonly; },
    applyOpponentLocks,
    updateOpponentSelection,
    clearOpponentSelection,
    getElo,
  });
  const {
    currentNextPath,
    promptSignIn,
    setDemoGameUrl,
    setNavActive,
    setSoloGameUrl,
    setViewUrl,
    showAuthView,
    showCoopBotSelection,
    showPlayView,
    showSoloSetup,
  } = appShell;

  const coopInvites = createCoopInviteController({
    apiJson,
    elements: {
      inviteMessageEl: cpInviteMessage,
      inviteListEl: cpInviteList,
    },
    getAuthInfo: () => authInfo,
    getRoomId: () => coop?.roomId,
    getJoinedUserIds: () => new Set((coop?.players || []).map(player => player.userId).filter(Boolean)),
  });
  const loadCoopInviteFriends = coopInvites.loadFriends;
  const renderCoopInviteFriends = coopInvites.renderInviteFriends;
  const sendCoopInvite = coopInvites.sendInvite;

  const urlRoom = new URLSearchParams(location.search).get("room");
  const urlGame = new URLSearchParams(location.search).get("game");
  const LAST_ROOM_KEY = storageKey("last-room");
  const LEGACY_LAST_ROOM_KEY = legacyStorageKey("last-room");
  const nameKey = (roomId) => storageKey(`room.${roomId}.name`);
  const legacyNameKey = (roomId) => legacyStorageKey(`room.${roomId}.name`);
  const playerKey = (roomId) => storageKey(`room.${roomId}.playerId`);

  const coopRoom = createCoopRoomController({
    elements: {
      cpPlayerList,
      cpRoomMeta,
      cpStartBtn,
      lbFriendInvite,
      lbFriends,
      lbMain,
      lbProfile,
      lbRoom,
      lbSolo,
    },
    storage: {
      lastRoomKey: LAST_ROOM_KEY,
      legacyLastRoomKey: LEGACY_LAST_ROOM_KEY,
      nameKey,
      legacyNameKey,
      playerKey,
    },
    getAuthInfo: () => authInfo,
    getCoop: () => coop,
    hideModelLoading,
    showModelLoading,
    renderCoopInviteFriends,
  });
  const coopPlayerName = coopRoom.playerName;
  const rememberRoom = coopRoom.rememberRoom;
  const renderRoomLobby = coopRoom.renderLobby;
  const setRoomUrl = coopRoom.setRoomUrl;
  const storedPlayerId = coopRoom.storedPlayerId;

  const coopGameView = createCoopGameViewController({
    elements: {
      cpChips,
      lbSolo,
      soloStartBtn,
    },
    getBoard: () => board,
    getChess: () => chess,
    getCoop: () => coop,
    getCurrentOpponent: currentOpponent,
    getElo,
    getSetupMode: () => setupMode,
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
    setOpponentSelectionReadonly: (readonly) => { opponentSelectionReadonly = readonly; },
    shouldAutoStartCoopSplash,
    shouldLoadInviteFriends: () => coopInvites.shouldLoadFriends(),
    showBotSplash,
    showCoopBotSelection,
    showGame,
    showGameStartSpeech,
    showRoomPanel: coopRoom.showRoomPanel,
    updateCheckMarker,
    updateGameScore,
    updateOpponentSelection,
    updatePlacementDiffs: () => chessnutBoard.updateDiffLeds(),
  });

  await appShell.loadAuth();

  social = createSocialController({
    apiJson,
    elements: {
      coopInviteDismiss,
      coopInviteJoin,
      coopInviteNotice,
      coopInviteText,
      friendAddClose,
      friendAddDialog,
      friendInviteLanding,
      friendInviteLink,
      friendLinkCopy,
      friendLinkShare,
      friendListEl,
      friendMessage,
      friendRequestsEl,
      friendResultsEl,
      friendSearch,
      lbAuth,
      lbFriendInvite,
      lbFriends,
      lbMain,
      lbProfile,
      lbRoom,
      lbSolo,
      navFriends,
      navProfile,
      profileUsername,
      usernameHelp,
      usernameSaveBtn,
    },
    getAuthInfo: () => authInfo,
    setAuthUser: appShell.setAuthUser,
    getCoopPhase: () => coop?.phase || "off",
    hideModelLoading,
    incomingFriendUsername,
    promptSignIn,
    setNavActive,
    setViewUrl,
  });
  social.bindEvents();

  appShell.bindEvents({
    onStartDemo: () => startDemoGame(),
    onConnectCoop: () => connectCoop("create"),
  });
  opponentSelection.bindCards();
  applyOpponentLocks();
  clearOpponentSelection();
  soloStartBtn.onclick = () => startSelectedGame();
  soloBackBtn.onclick = () => {
    pendingSoloStart = false;
    pendingSoloStartDemo = false;
    if (setupMode === "coop" && coop.phase === "lobby") {
      opponentSelectionReadonly = false;
      lbSolo.classList.remove("readonly");
      if (coop.myIdx === 0) coop.ws?.send(JSON.stringify({ type: "selecting-opponent", selecting: false }));
      coopRoom.showRoomPanel();
      renderRoomLobby(coop.players || [], coop.myIdx);
      return;
    }
    showPlayView();
  };

  cpStartBtn.onclick = () => enterCoopBotSelection();
  cpLeaveBtn.onclick = () => leaveCoop();

  cpInviteList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-coop-invite-user-id]");
    if (!button) return;
    sendCoopInvite(button.dataset.coopInviteUserId);
  });

  coopInviteJoin.onclick = () => {
    const roomId = coopInviteJoin.dataset.roomId;
    if (!roomId) return;
    location.href = `/?room=${encodeURIComponent(roomId)}`;
  };

  coopInviteDismiss.onclick = () => {
    const inviteId = coopInviteDismiss.dataset.inviteId;
    if (!inviteId) return;
    runFriendAction(`dismiss-invite:${inviteId}`, () => apiJson(`/api/coop/invites/${inviteId}/dismiss`, { method: "POST" }));
  };

  chessnutBoard.bind();
  opponentSpeech.bindCloseButton();
  promotionChoiceEl.querySelectorAll("[data-promotion]").forEach((button) => {
    button.onclick = () => choosePromotion(button.dataset.promotion);
  });

  backBtn.onclick = () => {
    if (!confirmExitGame()) return;
    if (coop.phase !== "off") leaveCoop();
    else showLobby();
  };
  outcomeScreen.bindActions({
    onContinue: () => {
      hideOutcomeBanner();
      if (coop.phase !== "off") leaveCoop();
      else showLobby();
    },
    onChallenge: (opponentIndex) => {
      const opponent = SOLO_OPPONENTS[opponentIndex];
      if (!opponent) return;
      hideOutcomeBanner();
      setupMode = "solo";
      selectedOpponentIndex = opponentIndex;
      selectedOpponentTheme = opponent.theme;
      syncStrength(String(opponent.elo));
      updateOpponentSelection(String(opponent.elo));
      soloStartBtn.disabled = false;
      startSoloGame();
    },
  });
  bindBotSplashStartButton();

  // ── Coop mode ─────────────────────────────────────────────────────────────

  coop = {
    ws: null, roomId: null,
    playerId: null,
    myIdx: -1,
    phase: "off",
    players: [], activeIdx: 0, midTurn: false, fen: null,
    startedAt: null,
    moveCount: 0,
    maxUnlockedOpponentCount: 1,
    strength: 1500,
    selectingOpponent: false,
    leaving: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
  };

  coopConnection = createCoopConnectionController({
    getCoop: () => coop,
    getElo,
    getMaiaReady: () => maia.modelReady,
    getPlayerName: coopPlayerName,
    getRoomFromUrl: () => new URLSearchParams(location.search).get("room"),
    readSoloProgress,
    setSetupMode: (mode) => { setupMode = mode; },
    showLobby,
    storedPlayerId,
    onMessage: handleCoopMsg,
    onPlayingReconnect: () => {
      disableBoardMoveInput();
      setStatus("Reconnecting…", "thinking");
    },
    onReconnectingLobby: coopRoom.showReconnectingLobby,
  });

  function startCoopWithSelectedBot() {
    if (opponentSelectionReadonly || soloStartBtn.disabled || coop.phase !== "lobby" || coop.myIdx !== 0) return;
    if (!maia.modelReady) {
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }
    coop.ws?.send(JSON.stringify({ type: "strength", strength: getElo() }));
    coop.ws?.send(JSON.stringify({ type: "start" }));
  }

  function enterCoopBotSelection() {
    if (coop.phase !== "lobby") return;
    const isHost = coop.myIdx === 0;
    if (isHost) coop.ws?.send(JSON.stringify({ type: "selecting-opponent", selecting: true }));
    showCoopBotSelection({ readonly: !isHost });
  }

  function connectCoop(...args) {
    coopConnection.connect(...args);
  }

  async function handleCoopMsg(msg) {
    if (msg.type === "error") {
      if (msg.code === "auth-required") {
        location.href = authInfo.loginUrl || `/auth/google?next=${encodeURIComponent(currentNextPath())}`;
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

    if (msg.type === "created") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.reconnectAttempts = 0;
      coopInvites.clearSent();
      rememberRoom(msg.roomId, coopPlayerName(msg.roomId), msg.playerId);
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
      rememberRoom(msg.roomId, coopPlayerName(msg.roomId), msg.playerId);
      setRoomUrl(msg.roomId);
      loadCoopInviteFriends();
      loadInviteNotifications();
      return;
    }

    if (msg.type === "room-state") {
      coop.roomId    = msg.roomId;
      coop.playerId  = msg.playerId;
      coop.players   = msg.players;
      coop.activeIdx = msg.activeIdx;
      coop.midTurn   = msg.midTurn;
      coop.fen       = msg.fen;
      coop.myIdx     = msg.myIdx;
      coop.startedAt = Number(msg.startedAt || coop.startedAt || Date.now());
      coop.moveCount = Number(msg.moveCount ?? coop.moveCount ?? 0);
      coop.strength  = msg.strength;
      coop.selectingOpponent = !!msg.selectingOpponent;
      coop.maxUnlockedOpponentCount = Math.max(readSoloProgress(), Number(msg.maxUnlockedOpponentCount || 1));
      coop.reconnectAttempts = 0;
      if (msg.strength) {
        syncStrength(String(msg.strength));
        if (setupMode === "coop" && lbSolo.style.display !== "none")
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

  function maybeRunCoopBotTurn() {
    if (!isMyCoopBotTurn()) {
      clearCoopBotTimer();
      return;
    }
    scheduleCoopBotMove();
  }

  async function coopBotMove() {
    if (!isMyCoopBotTurn() || botThinking) return;
    const roomId = coop.roomId;
    const fenBeforeThinking = chess.fen();
    botThinking = true;
    try {
      setStatus("Thinking…", "thinking");
      const showedThinkingReaction = showOpponentThinkingReaction();
      if (showedThinkingReaction) {
        await wait(thinkingMoveDelay());
        if (!isMyCoopBotTurn() || coop.roomId !== roomId || chess.fen() !== fenBeforeThinking) return;
      }
      const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
      const legalMask = buildLegalMask(workingFen, allMovesMaia3);

      const { logitsMove } = await runInference(tokens, coop.strength);
      if (!isMyCoopBotTurn() || coop.roomId !== roomId || chess.fen() !== fenBeforeThinking) return;

      const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesMaia3Reversed);
      const uci = sampleMove(moveProbs);

      const move = commitBotMove(uci);
      if (!move) return;
      publishCoopMove();
      if (!checkGameOver()) showBotMoveReaction(move);
    } finally {
      botThinking = false;
    }
  }

  function leaveCoop() {
    coopConnection.leave();
  }

  if (authInfo.user) {
    startPresenceHeartbeat();
    loadInviteNotifications();
    invitePollTimer = window.setInterval(loadInviteNotifications, 5000);
  }

  if (urlRoom) {
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
    } else {
      connectCoop("join", { roomId: urlRoom });
    }
  } else if (incomingFriendUsername) {
    await loadFriendInviteLanding();
  } else if (demoGame === "snib") {
    startDemoGame();
  } else if (urlGame === "solo") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else restoreSoloGame();
  } else if (initialView === "profile") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else showProfileView();
  } else if (initialView === "friends") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else showFriendsView();
  } else if (initialView === "solo") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else showSoloSetup();
  } else if (initialView === "coop") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else connectCoop("create");
  } else if (authInfo.authEnabled && !authInfo.user) {
    showAuthView();
  } else {
    restoreSoloGame();
  }
    })().catch((err) => {
      console.error(err);
    });
    return () => {
      disposed = true;
      if (invitePollTimer) window.clearInterval(invitePollTimer);
      if (debugHookTimer) window.clearInterval(debugHookTimer);
      botTurns.dispose();
      coopConnection?.dispose();
      outcomeScreen.dispose();
      clearBotSplashAutoTimer();
      window.removeEventListener("orientationchange", requestPortraitOrientation);
      if (window.__chessquestiaDebug?.setPosition === setDebugPosition)
        delete window.__chessquestiaDebug;
      opponentSpeech.clearTimers();
      social?.stopPresenceHeartbeat();
      chessnutBoard.disconnect();
    };
  }, []);

  return (
    <>
      <div className="app">
        <Lobby />
        <GameView />
        <BotSplash />
        <FriendAddDialog />
      </div>
      <div className="orientation-lock" role="status" aria-live="polite">
        <div>Rotate back to portrait</div>
      </div>
    </>
  );
}
