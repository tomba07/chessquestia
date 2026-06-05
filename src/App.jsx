import { useEffect } from "react";
import { INPUT_EVENT_TYPE } from "cm-chessboard";
import { Chess } from "chess.js";
import { loadMaiaMoveMaps } from "./maia.js";
import { createSocialController } from "./socialUi.js";
import { SOLO_OPPONENTS } from "./soloOpponents.js";
import {
  apiJson,
  createAppShellController,
  defaultAuthInfo,
} from "./appShellController.js";
import { createAppEventController } from "./appEventController.js";
import { createAppRuntimeController } from "./appRuntimeController.js";
import {
  createAppStartupController,
  readStartupRoute,
} from "./appStartupController.js";
import { createBoardController } from "./boardController.js";
import { createBotMoveController } from "./botMoveController.js";
import {
  BotSplash,
  FriendAddDialog,
  GameView,
  Lobby,
} from "./components/AppScreens.jsx";
import { createBotSplash } from "./botSplash.js";
import { createChessnutController } from "./chessnutController.js";
import { createCoopConnectionController } from "./coopConnectionController.js";
import { createCoopGameViewController } from "./coopGameViewController.js";
import { createCoopInviteController } from "./coopInviteController.js";
import { createCoopMessageController } from "./coopMessageController.js";
import { createCoopRoomController } from "./coopRoomController.js";
import { createGameOverController } from "./gameOverController.js";
import { createGameScreenController } from "./gameScreenController.js";
import { createLocalDebugController } from "./localDebugController.js";
import { createMaiaWorker } from "./maiaWorker.js";
import { createOpponentSelectionController } from "./opponentSelectionController.js";
import { createOpponentSpeechController } from "./opponentSpeechController.js";
import { createOutcomeScreen } from "./outcomeScreen.js";
import { createPromotionController } from "./promotionController.js";
import { createSoloGameController } from "./soloGameController.js";
import { createSoloSessionController } from "./soloSessionController.js";

export default function App() {
  useEffect(() => {
    let disposed = false;
    let invitePollTimer = null;
    (async () => {
      if (disposed) return;
  const BOT_MOVE_DELAY_MS = { min: 650, max: 1250 };

  const strengthSlider = document.getElementById("strength-slider");
  const strengthVal    = document.getElementById("strength-val");

  // ── Load move mappings ────────────────────────────────────────────────────

  const { allMoves: allMovesMaia3, allMovesReversed: allMovesMaia3Reversed } = await loadMaiaMoveMaps();

  // ── Web Worker (Maia 3 ONNX inference) ───────────────────────────────────

  let coop = null;
  let soloGame = null;
  let gameOver = null;
  let gameScreen = null;
  let coopMessages = null;
  let appEvents = null;
  let botMoves = null;

  const statusDot   = document.getElementById("status-dot");
  const statusLabel = document.getElementById("status-label");
  const downloadBtn = document.getElementById("download-btn");
  const modelLoadingEl = document.getElementById("model-loading");
  const progressBar = document.getElementById("progress-bar");
  const progressFill = document.getElementById("progress-fill");

  const maia = createMaiaWorker({
    elements: { statusDot, statusLabel, downloadBtn, modelLoadingEl, progressBar, progressFill },
    getCoop: () => coop,
    readSoloProgress,
    onPendingSoloStart: () => soloGame?.hasPendingStart() || false,
    onReady: () => {
      if (soloGame?.hasPendingStart()) {
        const demoStart = soloGame.consumePendingStart();
        soloGame.startWithSplash({ demo: demoStart });
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
  const boardEl   = document.getElementById("board");
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
  let soloSession = null;
  let setupMode = "solo";
  let opponentSelectionReadonly = false;
  let selectedOpponentTheme = "snib";
  let selectedOpponentIndex = 0;
  let authInfo = defaultAuthInfo();
  let coopConnection = null;
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
    if (chess.isGameOver() || (!maia.modelReady && !debugMoveInput) || botMoves?.isThinking()) return false;
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
        soloGame.saveGame();
        if (!checkGameOver()) {
          showPlayerMoveReaction(move);
          disableBoardMoveInput();
          setTimeout(() => botMoves.botMove(), botMoves.nextBotMoveDelay());
        }
      }
      return true;
    } catch {
      return false;
    }
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

  const promotionChoice = createPromotionController({
    element: promotionChoiceEl,
    getLegalMoves: () => chess.moves({ verbose: true }),
    onPromotionChosen: (from, to, promotion) => applyPlayerMove(from, to, promotion),
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

  botMoves = createBotMoveController({
    allMoves: allMovesMaia3,
    allMovesReversed: allMovesMaia3Reversed,
    botMoveDelayMs: BOT_MOVE_DELAY_MS,
    checkGameOver,
    chess,
    commitBotMove,
    enableBoardMoveInput,
    getCoop: () => coop,
    getElo,
    getGameVisible: () => gameEl.style.display !== "none",
    getMaiaReady: () => maia.modelReady,
    getSoloActive: () => soloSession.active,
    publishCoopMove,
    runInference,
    saveSoloGame: () => soloGame.saveGame(),
    setStatus,
    showBotMoveReaction,
    showOpponentThinkingReaction,
  });

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

  function showGame() {
    gameScreen.showGame();
  }

  function showLobby() {
    gameScreen.showLobby();
  }

  function confirmExitGame() {
    return gameScreen.confirmExitGame();
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
    botMoves.setThinking(false);
    cpChips.innerHTML = "";
    promotionChoice.hide();
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

  const localDebug = createLocalDebugController({
    getSelectedOpponentIndex: () => selectedOpponentIndex,
    opponents: SOLO_OPPONENTS,
    setDebugPosition,
  });
  localDebug.bind();

  function checkGameOver() {
    return gameOver.check();
  }

  function maybeRunSoloBotTurn() {
    botMoves?.maybeRunSoloBotTurn();
  }

  function inputHandler(event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted:
        if (promotionChoice.hasPending()) return false;
        if (coop.phase === "playing")
          return !coop.midTurn && coop.activeIdx === coop.myIdx && maia.modelReady;
        return chess.turn() === "w" && !botMoves?.isThinking() && (maia.modelReady || debugMoveInput) && !chess.isGameOver();

      case INPUT_EVENT_TYPE.validateMoveInput: {
        if (promotionChoice.show(event.squareFrom, event.squareTo)) return false;
        return applyPlayerMove(event.squareFrom, event.squareTo, "q");
      }
    }
  }

  const appRuntime = createAppRuntimeController();
  appRuntime.bind();

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
  const startupRoute = readStartupRoute();
  const { searchParams } = startupRoute;

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
    getPendingSoloStart: () => soloGame?.hasPendingStart() || false,
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

  gameScreen = createGameScreenController({
    clearSoloGame: () => soloGame.clearGame(),
    clearVictoryBoardPulse,
    elements: {
      boardEl,
      gameEl,
      lobbyEl,
    },
    getAuthInfo: () => authInfo,
    getBoard: () => board,
    getChess: () => chess,
    getCoopPhase: () => coop?.phase || "off",
    getElo,
    getSelectedOpponentTheme: () => selectedOpponentTheme,
    getSoloActive: () => soloSession.active,
    hideOpponentSpeech,
    inputHandler,
    opponentThemeForStrength,
    promotionChoice,
    setBoard: (nextBoard) => { board = nextBoard; },
    showAuthView,
    showPlayView,
    updateGameScore,
  });

  soloGame = createSoloGameController({
    chess,
    currentOpponent,
    elements: {
      cpChips,
      soloStartBtn,
    },
    getBoard: () => board,
    getElo,
    getModelReady: () => maia.modelReady,
    getSelectedOpponentIndex: () => selectedOpponentIndex,
    getSelectedOpponentTheme: () => selectedOpponentTheme,
    getSetupMode: () => setupMode,
    hideModelLoading,
    hideOutcomeBanner,
    maybeRunSoloBotTurn,
    onStartCoopWithSelectedBot: () => startCoopWithSelectedBot(),
    opponentThemeForStrength,
    opponents: SOLO_OPPONENTS,
    promotionChoice,
    requestModelDownload,
    resetBoardDevicePlacement: () => chessnutBoard.resetPlacement(),
    resetThinkingReactionCadence,
    setDebugMoveInput: (value) => { debugMoveInput = value; },
    setDemoGameUrl,
    setSelectedOpponentIndex: (value) => { selectedOpponentIndex = value; },
    setSelectedOpponentTheme: (value) => { selectedOpponentTheme = value; },
    setSetupMode: (mode) => { setupMode = mode; },
    setSoloGameUrl,
    setStatus,
    setBotThinking: (value) => { botMoves.setThinking(value); },
    showBotSplash,
    showGame,
    showGameStartSpeech,
    showModelLoading,
    soloSession,
    syncStrength,
    updateOpponentSelection,
    boardActions: {
      checkGameOver,
      clearCheckMarker,
      clearLastMove,
      disableMoveInput: disableBoardMoveInput,
      enableMoveInput: enableBoardMoveInput,
      updateCheckMarker,
      updateGameScore,
    },
  });

  gameOver = createGameOverController({
    chess,
    disableBoardMoveInput,
    findKingSquare,
    getCanUnlockProgress: () => soloSession.active || coop?.phase === "playing" || coop?.phase === "over",
    getSelectedOpponentIndex: () => selectedOpponentIndex,
    hideOutcomeBanner,
    opponents: SOLO_OPPONENTS,
    recordResult: (result) => soloGame.recordResult(result),
    setStatus,
    showEndgameOpponentReaction,
    showOutcomeBannerAfterDelay,
    showVictoryBoardPulseAfterDelay,
    unlockNextOpponent: () => soloSession.unlockNextOpponent(),
  });

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

  coopMessages = createCoopMessageController({
    connectToAuth: () => {
      location.href = authInfo.loginUrl || `/auth/google?next=${encodeURIComponent(currentNextPath())}`;
    },
    coopGameView,
    coopInvites,
    coopRoom,
    getCoop: () => coop,
    getCoopPlayerName: coopPlayerName,
    getSetupMode: () => setupMode,
    loadCoopInviteFriends,
    loadInviteNotifications,
    readSoloProgress,
    rememberRoom,
    setRoomUrl,
    showModelLoading,
    showPlayView,
    syncStrength,
    updateOpponentSelection,
    elements: {
      lbSolo,
    },
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
    incomingFriendUsername: startupRoute.incomingFriendUsername,
    promptSignIn,
    setNavActive,
    setViewUrl,
  });
  social.bindEvents();

  appEvents = createAppEventController({
    apiJson,
    appShell,
    bindBotSplashStartButton,
    chessnutBoard,
    coopInviteList: cpInviteList,
    coopInviteJoin,
    coopInviteDismiss,
    coopRoom,
    getCoop: () => coop,
    getSetupMode: () => setupMode,
    hideOutcomeBanner,
    leaveCoop,
    opponentSelection,
    outcomeScreen,
    promotionChoice,
    renderRoomLobby,
    runFriendAction,
    sendCoopInvite,
    setOpponentSelectionReadonly: (readonly) => { opponentSelectionReadonly = readonly; },
    setSelectedOpponent: (index, theme) => {
      selectedOpponentIndex = index;
      selectedOpponentTheme = theme;
    },
    setSetupMode: (mode) => { setupMode = mode; },
    showLobby,
    showPlayView,
    soloBackBtn,
    soloGame,
    soloStartBtn,
    startCoopBotSelection: enterCoopBotSelection,
    startCoopRoom: () => connectCoop("create"),
    syncStrength,
    updateOpponentSelection,
    elements: {
      backBtn,
      confirmExitGame,
      cpLeaveBtn,
      cpStartBtn,
      lbSolo,
      opponentSpeech,
      opponents: SOLO_OPPONENTS,
    },
  });
  appEvents.bind();

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
    await coopMessages.handleMessage(msg);
  }

  function maybeRunCoopBotTurn() {
    botMoves?.maybeRunCoopBotTurn();
  }

  function leaveCoop() {
    coopConnection.leave();
  }

  const startup = createAppStartupController({
    connectCoop,
    getAuthInfo: () => authInfo,
    loadFriendInviteLanding,
    loadInviteNotifications,
    onInvitePollTimer: (timer) => { invitePollTimer = timer; },
    promptSignIn,
    route: startupRoute,
    showAuthView,
    showFriendsView,
    showProfileView,
    showSoloSetup,
    soloGame,
    startPresenceHeartbeat,
  });
  await startup.start();
    })().catch((err) => {
      console.error(err);
    });
    return () => {
      disposed = true;
      if (invitePollTimer) window.clearInterval(invitePollTimer);
      botMoves?.dispose();
      coopConnection?.dispose();
      appEvents?.dispose();
      outcomeScreen.dispose();
      promotionChoice.dispose();
      clearBotSplashAutoTimer();
      appRuntime.dispose();
      localDebug.dispose();
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
