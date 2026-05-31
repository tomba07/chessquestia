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
import {
  BotSplash,
  FriendAddDialog,
  GameView,
  Lobby,
} from "./components/AppScreens.jsx";
import { createBotSplash } from "./botSplash.js";
import { createChessnutController } from "./chessnutController.js";
import { createCoopInviteController } from "./coopInviteController.js";
import { createMaiaWorker } from "./maiaWorker.js";
import { createOpponentSpeechController } from "./opponentSpeechController.js";
import { createOutcomeScreen } from "./outcomeScreen.js";
import { createSoloSessionController } from "./soloSessionController.js";

export default function App() {
  useEffect(() => {
    let disposed = false;
    let invitePollTimer = null;
    (async () => {
      if (disposed) return;
const LAST_MOVE = { class: "last-move", slice: "markerSquare" };
const CHECK_MARKER = { class: "king-check", slice: "markerSquare" };
  const BOT_MOVE_DELAY_MS = { min: 650, max: 1250 };
  const CDN       = "/cm-chessboard/assets/";

  const strengthSlider = document.getElementById("strength-slider");
  const strengthVal    = document.getElementById("strength-val");
  let opponentCards = [];
  function updateOpponentSelection(value) {
    opponentCards.forEach(card => {
      const selected = card.dataset.opponentStrength === String(value);
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }
  function clearOpponentSelection() {
    opponentCards.forEach(card => {
      card.classList.remove("selected");
      card.setAttribute("aria-pressed", "false");
    });
    if (soloStartBtn) soloStartBtn.disabled = true;
  }
  function opponentForStrength(value) {
    return SOLO_OPPONENTS.find(opponent => opponent.elo === parseInt(value, 10));
  }
  function syncStrength(value) {
    strengthSlider.value = value;
    strengthVal.textContent = value;
    const opponent = opponentForStrength(value);
    if (opponent) selectedOpponentIndex = SOLO_OPPONENTS.indexOf(opponent);
    selectedOpponentTheme = opponent?.theme || opponentThemeForStrength(value);
  }
  strengthSlider.oninput = () => syncStrength(strengthSlider.value);
  const getElo = () => parseInt(strengthSlider.value);

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
  let coopBotTimer = null;
  let soloSession = null;
  let setupMode = "solo";
  let opponentSelectionReadonly = false;
  let selectedOpponentTheme = "snib";
  let selectedOpponentIndex = 0;
  let unlockedOpponentCount = 1;
  let soloStartInProgress = false;
  let pendingSoloStartDemo = false;
  let authInfo = defaultAuthInfo();

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

  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function updateGameScore() {
    const score = chess.board().flat().reduce((total, piece) => {
      if (!piece) return total;
      const value = pieceValues[piece.type] || 0;
      return total + (piece.color === "w" ? value : -value);
    }, 0);
    gameScoreEl.textContent = score === 0 ? "+0" : score > 0 ? `+${score}` : String(score);
    gameScoreEl.className = score > 0 ? "ahead" : score < 0 ? "behind" : "";
  }

  function boardPlacement(fen = chess.fen()) {
    return fen.split(" ")[0];
  }

  function canAcceptPlayerMove() {
    if (chess.isGameOver() || !maia.modelReady || botThinking) return false;
    if (coop?.phase === "playing") return !coop.midTurn && coop.activeIdx === coop.myIdx;
    return soloSession.active && coop?.phase === "off" && chess.turn() === "w";
  }

  function legalMoveForPlacement(targetPlacement) {
    for (const move of chess.moves({ verbose: true })) {
      const probe = new Chess(chess.fen());
      const moveInput = {
        from: move.from,
        to: move.to,
      };
      if (move.promotion) moveInput.promotion = move.promotion;
      probe.move(moveInput);
      if (boardPlacement(probe.fen()) === targetPlacement) return move;
    }
    return null;
  }

  function markLastMove(from, to) {
    board.removeMarkers(LAST_MOVE);
    board.addMarker(LAST_MOVE, from);
    board.addMarker(LAST_MOVE, to);
    updateCheckMarker();
    chessnutBoard.updateDiffLeds();
  }

  function findKingSquare(color) {
    const position = chess.board();
    for (let rankIndex = 0; rankIndex < position.length; rankIndex += 1) {
      for (let fileIndex = 0; fileIndex < position[rankIndex].length; fileIndex += 1) {
        const piece = position[rankIndex][fileIndex];
        if (piece?.type === "k" && piece.color === color) {
          return `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
        }
      }
    }
    return null;
  }

  function isCurrentSideInCheck() {
    if (typeof chess.isCheck === "function") return chess.isCheck();
    if (typeof chess.inCheck === "function") return chess.inCheck();
    return false;
  }

  function updateCheckMarker() {
    board.removeMarkers(CHECK_MARKER);
    if (!isCurrentSideInCheck()) return;
    const kingSquare = findKingSquare(chess.turn());
    if (kingSquare) board.addMarker(CHECK_MARKER, kingSquare);
  }

  function syncBoardAfterMove(move) {
    board.setPosition(chess.fen(), true);
    markLastMove(move.from, move.to);
    updateGameScore();
  }

  function enableBoardMoveInput() {
    board.disableMoveInput();
    board.enableMoveInput(inputHandler);
    gameBoardFrameEl.classList.remove("not-your-turn");
  }

  function disableBoardMoveInput() {
    board?.disableMoveInput();
    gameBoardFrameEl.classList.add("not-your-turn");
  }

  function moveInputFromUci(uci) {
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q",
    };
  }

  function commitBotMove(uci) {
    const move = chess.move(moveInputFromUci(uci));
    if (!move) return null;
    syncBoardAfterMove(move);
    return move;
  }

  function publishCoopMove() {
    coop.ws?.send(JSON.stringify({ type: "move", fen: chess.fen(), gameOver: chess.isGameOver() }));
  }

  function applyRemoteFen(fen) {
    const incomingMove = legalMoveForPlacement(boardPlacement(fen));
    chess.load(fen);
    board.setPosition(fen, true);
    if (incomingMove) markLastMove(incomingMove.from, incomingMove.to);
    else {
      updateCheckMarker();
      chessnutBoard.updateDiffLeds();
    }
    updateGameScore();
  }

  function nextBotMoveDelay() {
    const { min, max } = BOT_MOVE_DELAY_MS;
    return Math.round(min + Math.random() * (max - min));
  }

  function thinkingMoveDelay() {
    return Math.round(1300 + Math.random() * 1100);
  }

  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function isMyCoopBotTurn() {
    return coop?.phase === "playing"
      && coop.activeIdx === coop.myIdx
      && coop.midTurn
      && maia.modelReady
      && !chess.isGameOver();
  }

  function clearCoopBotTimer() {
    if (!coopBotTimer) return;
    clearTimeout(coopBotTimer);
    coopBotTimer = null;
  }

  function scheduleCoopBotMove() {
    if (!isMyCoopBotTurn() || botThinking || coopBotTimer) return;
    coopBotTimer = setTimeout(() => {
      coopBotTimer = null;
      coopBotMove();
    }, nextBotMoveDelay());
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

  function opponentThemeForStrength(value) {
    return opponentForStrength(value)?.theme || "snib";
  }

  function setGameOpponentTheme(value = getElo(), theme = selectedOpponentTheme) {
    const legacyThemes = { imp: "snib", witch: "vexi" };
    const nextTheme = theme || opponentThemeForStrength(value);
    gameEl.dataset.opponent = legacyThemes[nextTheme] || nextTheme;
  }

  function currentOpponent() {
    return opponentForStrength(getElo()) || SOLO_OPPONENTS[selectedOpponentIndex] || SOLO_OPPONENTS[0];
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
    getGameStartedAt: () => soloSession?.gameStartedAt,
    getLastMoveSquares: () => {
      const history = chess.history({ verbose: true });
      const move = history[history.length - 1];
      return move ? [move.from, move.to] : [];
    },
    getMoveCount: () => chess.history().length,
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

  function applyOpponentLocks() {
    unlockedOpponentCount = soloSession.unlockedCountForMode({
      setupMode,
      coopMaxUnlocked: coop?.maxUnlockedOpponentCount || 1,
    });
    opponentCards.forEach((card, index) => {
      const unlocked = index < unlockedOpponentCount;
      const disabled = !unlocked || opponentSelectionReadonly;
      const art = card.querySelector(".opponent-card-art");
      card.disabled = disabled;
      card.classList.toggle("locked", !unlocked);
      card.classList.toggle("readonly", unlocked && opponentSelectionReadonly);
      card.setAttribute("aria-disabled", disabled ? "true" : "false");
      if (art) art.src = unlocked ? card.dataset.unlockedSrc : "/assets/cards/locked_card.png";
    });
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
    cpChips.innerHTML = "";
    hideOutcomeBanner();
    hideModelLoading();
    if (demo) setDemoGameUrl();
    else setSoloGameUrl();
    showGame();
    board.setPosition(chess.fen());
    board.removeMarkers(LAST_MOVE);
    board.removeMarkers(CHECK_MARKER);
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
      showGame();
      board.setPosition(chess.fen(), false);
      board.removeMarkers(LAST_MOVE);
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
        if (coop.phase === "playing")
          return !coop.midTurn && coop.activeIdx === coop.myIdx && maia.modelReady;
        return chess.turn() === "w" && !botThinking && maia.modelReady && !chess.isGameOver();

      case INPUT_EVENT_TYPE.validateMoveInput: {
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
  opponentCards = Array.from(document.querySelectorAll("[data-opponent-strength]"));
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

  function storedPlayerName(roomId) {
    return roomId ? (localStorage.getItem(nameKey(roomId)) || localStorage.getItem(legacyNameKey(roomId)) || "") : "";
  }

  function storedPlayerId(roomId) {
    return roomId ? (localStorage.getItem(playerKey(roomId)) || "") : "";
  }

  function rememberRoom(roomId, name, playerId) {
    if (!roomId) return;
    localStorage.setItem(LAST_ROOM_KEY, roomId);
    localStorage.removeItem(LEGACY_LAST_ROOM_KEY);
    if (name) localStorage.setItem(nameKey(roomId), name);
    if (playerId) localStorage.setItem(playerKey(roomId), playerId);
  }

  function coopPlayerName(roomId) {
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
  opponentCards.forEach(card => {
    card.onclick = () => {
      if (opponentSelectionReadonly || card.disabled || card.classList.contains("locked")) return;
      syncStrength(card.dataset.opponentStrength);
      selectedOpponentIndex = Number(card.dataset.opponentIndex || 0);
      selectedOpponentTheme = card.dataset.opponentTheme || opponentThemeForStrength(card.dataset.opponentStrength);
      updateOpponentSelection(card.dataset.opponentStrength);
      soloStartBtn.disabled = false;
      if (setupMode === "coop" && coop?.phase === "lobby" && coop.myIdx === 0)
        coop.ws?.send(JSON.stringify({ type: "strength", strength: getElo() }));
    };
  });
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
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
      lbFriendInvite.style.display = "none";
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
    maxUnlockedOpponentCount: 1,
    strength: 1500,
    selectingOpponent: false,
    leaving: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
  };

  function allPlayersReady(players) {
    return players.length > 0 && players.every(player => player.maiaReady);
  }

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

  function renderRoomLobby(players, myIdx) {
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

  function clearReconnectTimer() {
    if (!coop?.reconnectTimer) return;
    clearTimeout(coop.reconnectTimer);
    coop.reconnectTimer = null;
  }

  function connectCoop(action, opts = {}) {
    const roomId = opts.roomId || new URLSearchParams(location.search).get("room") || coop.roomId;
    const name = opts.name || coopPlayerName(roomId);
    clearReconnectTimer();
    coop.leaving = false;
    const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProto}//${location.host}`);
    coop.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(
      action === "create"
        ? { type: "create", name,
            strength: getElo(), maiaReady: maia.modelReady, unlockedOpponentCount: readSoloProgress() }
        : {
            type: "join",
            roomId,
            name,
            playerId: opts.playerId || coop.playerId || storedPlayerId(roomId),
            maiaReady: maia.modelReady,
            unlockedOpponentCount: readSoloProgress(),
          }
    ));
    ws.onmessage = ({ data }) => handleCoopMsg(JSON.parse(data));
    ws.onclose   = () => {
      if (coop.ws !== ws) return;
      handleCoopDisconnect();
    };
    ws.onerror   = () => ws.close();
  }

  function handleCoopDisconnect() {
    coop.ws = null;
    if (coop.leaving || coop.phase === "off") {
      coop.leaving = false;
      return;
    }

    const roomId = coop.roomId || new URLSearchParams(location.search).get("room");
    const name = coopPlayerName(roomId);
    if (!roomId || !name) {
      leaveCoop();
      return;
    }

    if (coop.phase === "lobby") {
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
      lbFriendInvite.style.display = "none";
      cpRoomMeta.textContent = "Reconnecting…";
      cpStartBtn.disabled = true;
    } else if (coop.phase === "playing") {
      disableBoardMoveInput();
      setStatus("Reconnecting…", "thinking");
    }

    const delay = Math.min(1000 * 2 ** coop.reconnectAttempts, 8000);
    coop.reconnectAttempts += 1;
    coop.reconnectTimer = setTimeout(() => {
      connectCoop("join", {
        roomId,
        name,
        playerId: coop.playerId || storedPlayerId(roomId),
      });
    }, delay);
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
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
      lbFriendInvite.style.display = "none";
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
        coop.phase = "lobby";
        if (!msg.selectingOpponent && setupMode === "coop" && lbSolo.style.display !== "none") {
          opponentSelectionReadonly = false;
          lbSolo.classList.remove("readonly");
          lbMain.style.display = "none";
          lbSolo.style.display = "none";
          lbRoom.style.display = "flex";
          lbProfile.style.display = "none";
          lbFriends.style.display = "none";
          lbFriendInvite.style.display = "none";
          if (coopInvites.shouldLoadFriends()) loadCoopInviteFriends();
          renderRoomLobby(msg.players, msg.myIdx);
          return;
        }
        if (msg.selectingOpponent && lbSolo.style.display === "none") {
          showCoopBotSelection({ readonly: msg.myIdx !== 0 });
          if (coopInvites.shouldLoadFriends()) loadCoopInviteFriends();
          return;
        }
        if (setupMode === "coop" && lbSolo.style.display !== "none") {
          opponentSelectionReadonly = msg.myIdx !== 0;
          lbSolo.classList.toggle("readonly", opponentSelectionReadonly);
          applyOpponentLocks();
          if (opponentSelectionReadonly) {
            updateOpponentSelection(String(msg.strength || getElo()));
            soloStartBtn.disabled = true;
          }
          if (coopInvites.shouldLoadFriends()) loadCoopInviteFriends();
          return;
        }
        lbMain.style.display = "none";
        lbSolo.style.display = "none";
        lbRoom.style.display = "flex";
        opponentSelectionReadonly = false;
        lbSolo.classList.remove("readonly");
        lbProfile.style.display = "none";
        lbFriends.style.display = "none";
        lbFriendInvite.style.display = "none";
        if (coopInvites.shouldLoadFriends()) loadCoopInviteFriends();
        renderRoomLobby(msg.players, msg.myIdx);
        return;
      }

      if (msg.phase === "playing" || msg.phase === "over") {
        const wasInActiveGame = coop.phase === "playing" || coop.phase === "over";
        coop.phase = msg.phase;

        if (!wasInActiveGame) {
          chess.load(msg.fen);
          cpChips.innerHTML = "";
          showGame();
          board.setPosition(msg.fen, false);
          board.removeMarkers(LAST_MOVE);
          updateCheckMarker();
          chessnutBoard.updateDiffLeds();
          updateGameScore();
          enableBoardMoveInput();
          hideOutcomeBanner();
          if (msg.phase === "playing") {
            showBotSplash(currentOpponent(), {
              mode: "coop",
              autoStart: shouldAutoStartCoopSplash(msg),
            }).then(() => {
              if (coop?.roomId === msg.roomId && coop?.phase === "playing") showGameStartSpeech();
            });
          }
        }

        // Render chips
        cpChips.innerHTML = "";
        msg.players.forEach((p, i) => {
          const chip = document.createElement("span");
          chip.className = "chip"
            + (i === msg.activeIdx && !msg.midTurn ? " active" : "")
            + (i === msg.myIdx ? " me" : "");
          chip.textContent = p.name;
          cpChips.appendChild(chip);
        });
        if (msg.midTurn) {
          const bot = document.createElement("span");
          bot.className = "chip active";
          bot.textContent = "Maia";
          cpChips.appendChild(bot);
        }

        if (msg.fen !== chess.fen()) applyRemoteFen(msg.fen);

        if (msg.phase === "over") {
          checkGameOver();
          disableBoardMoveInput();
        } else if (msg.activeIdx === msg.myIdx && !msg.midTurn) {
          hideOutcomeBanner();
          enableBoardMoveInput();
          setCoopTurnStatus();
        } else {
          hideOutcomeBanner();
          disableBoardMoveInput();
          setCoopTurnStatus();
        }
        maybeAutoStartCoopSplash(msg);
        maybeRunCoopBotTurn();
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
    clearReconnectTimer();
    coop.leaving = true;
    coop.ws?.close();
    coop.ws    = null;
    coop.phase = "off";
    setupMode = "solo";
    showLobby();
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
      outcomeScreen.dispose();
      clearBotSplashAutoTimer();
      window.removeEventListener("orientationchange", requestPortraitOrientation);
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
