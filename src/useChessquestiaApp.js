import { useEffect } from "react";
import { Chess } from "chess.js";
import { loadMaiaMoveMaps } from "./maia.js";
import { createSocialController } from "./socialUi.js";
import { SOLO_OPPONENTS } from "./soloOpponents.js";
import {
  apiJson,
  defaultAuthInfo,
} from "./appShellController.js";
import { createAppEventController } from "./appEventController.js";
import { createAppRuntimeController } from "./appRuntimeController.js";
import {
  createAppStartupController,
  readStartupRoute,
} from "./appStartupController.js";
import { getAppElements } from "./appElements.js";
import {
  BOARD_DEVICE_VISIBLE_KEY,
  COOP_ROOM_STORAGE,
  SOLO_STORAGE_KEYS,
} from "./appStorage.js";
import { createBoardController } from "./boardController.js";
import { createBotMoveController } from "./botMoveController.js";
import { createInitialCoopState } from "./coopState.js";
import { createCoopTransportController } from "./coopTransportController.js";
import { createCoopUiControllers } from "./coopUiControllers.js";
import { createGameOverController } from "./gameOverController.js";
import { createGamePerspectiveController } from "./gamePerspectiveController.js";
import { createGamePresentationControllers } from "./gamePresentationControllers.js";
import { createGameScreenController } from "./gameScreenController.js";
import { createGameStatusController } from "./gameStatusController.js";
import { createDevTestingController } from "./devTestingController.js";
import { createLocalDebugController } from "./localDebugController.js";
import {
  createLobbyShellController,
  createSocialBridge,
} from "./lobbyShellController.js";
import { createLeaderboardController } from "./leaderboardController.js";
import { createMaiaWorker } from "./maiaWorker.js";
import { createOpponentSelectionController } from "./opponentSelectionController.js";
import { createPlayerMoveController } from "./playerMoveController.js";
import { createSoloGameController } from "./soloGameController.js";
import { createSoloSessionController } from "./soloSessionController.js";
import { createSchoolAccountsController } from "./schoolAccountsController.js";

export function useChessquestiaApp() {
  useEffect(() => {
    let disposed = false;
    let invitePollTimer = null;
    (async () => {
      if (disposed) return;
  const BOT_MOVE_DELAY_MS = { min: 650, max: 1250 };

  const appElements = getAppElements();
  const { strengthSlider, strengthVal } = appElements.strength;
  const { statusDot, statusLabel, downloadBtn, modelLoadingEl, progressBar, progressFill } = appElements.maia;
  const { lobbyEl, gameEl, boardEl, statusEl, gameScoreEl, gameBoardFrameEl, cpChips } = appElements.game;
  const { authBar, authBtn, authDemoBtn, authDevLoginCard, authDevLoginOptions, authLabel, authPrimaryBtn, backBtn, botSelectTitle, coopInviteDismiss, coopInviteJoin, coopInviteNotice, coopInviteTitle, coopInviteText, cpInviteList, cpInviteMessage, cpLeaveBtn, cpPlayerList, cpRoomMeta, cpStartBtn, devLoginCard, devLoginOptions, devTestVictoryHighscore, devTestingCard, devTestingMessage, friendAddClose, friendAddDialog, friendAddMessage, friendInviteLanding, friendInviteLink, friendLinkCopy, friendLinkShare, friendListEl, friendMessage, friendRequestsEl, friendResultsEl, friendSearch, lbAuth, lbFriendInvite, lbFriends, lbMain, lbProfile, lbRoom, lbSolo, navFriends, navPlay, navProfile, notificationBadge, playCoopBtn, playSoloBtn, profileAccountCard, profileAccountName, profileAuthBtn, profileUsername, soloBackBtn, soloStartBtn, usernameHelp, usernameSaveBtn, welcomeName } = appElements.lobby;

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
  let devTesting = null;
  let playerMoves = null;
  let coopTransport = null;

  const gamePerspective = createGamePerspectiveController({
    getChess: () => chess,
    getCoop: () => coop,
    getSoloSession: () => soloSession,
  });

  const gameStatus = createGameStatusController({
    element: statusEl,
    getCoop: () => coop,
    getCurrentOpponent: () => currentOpponent(),
    getMaiaReady: () => maia.modelReady,
  });

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
        if (!chess.isGameOver() && gamePerspective.isPlayerTurn())
          setStatus("Your turn");
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
  let board       = null;
  let soloSession = null;
  let setupMode = "solo";
  let opponentSelectionReadonly = false;
  let selectedOpponentTheme = "snib";
  let selectedOpponentIndex = 0;
  let authInfo = defaultAuthInfo();
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

  const setStatus = gameStatus.set;
  const setCoopTurnStatus = gameStatus.setCoopTurn;

  function canAcceptPlayerMove() {
    return playerMoves?.canAcceptMove() || false;
  }

  const boardController = createBoardController({
    elements: {
      scoreEl: gameScoreEl,
      frameEl: gameBoardFrameEl,
    },
    getBoard: () => board,
    getChess: () => chess,
    getScorePerspectiveColor: gamePerspective.playerColor,
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
    coopTransport?.publishMove();
  }

  function applyPlayerMove(from, to, promotion = "q") {
    return playerMoves?.applyMove(from, to, promotion) || false;
  }

  const {
    botSplash,
    chessnutBoard,
    opponentSpeech,
    outcomeScreen,
    promotionChoice,
  } = createGamePresentationControllers({
    applyPlayerMove,
    canAcceptPlayerMove,
    chess,
    elements: appElements.game,
    getBoard: () => board,
    getCoop: () => coop,
    getCurrentOpponent: currentOpponent,
    getSoloSession: () => soloSession,
    isCurrentSideInCheck,
    opponents: SOLO_OPPONENTS,
    boardDeviceStorageKey: BOARD_DEVICE_VISIBLE_KEY,
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
  } = botSplash;
  const hideOpponentSpeech = opponentSpeech.hide;
  const resetThinkingReactionCadence = opponentSpeech.resetThinkingCadence;
  const showBotMoveReaction = opponentSpeech.showBotMoveReaction;
  const showEndgameOpponentReaction = opponentSpeech.showEndgameReaction;
  const showGameStartSpeech = opponentSpeech.showGameStartSpeech;
  const showOpponentThinkingReaction = opponentSpeech.showThinkingReaction;
  const showPlayerMoveReaction = opponentSpeech.showPlayerMoveReaction;

  playerMoves = createPlayerMoveController({
    checkGameOver,
    chess,
    disableBoardMoveInput,
    getBotThinking: () => botMoves?.isThinking() || false,
    getCoop: () => coop,
    getDebugMoveInput: () => debugMoveInput,
    getMaiaReady: () => maia.modelReady,
    getSoloActive: () => soloSession.active,
    isPlayerTurn: gamePerspective.isPlayerTurn,
    promotionChoice,
    publishCoopMove,
    saveSoloGame: () => soloGame.saveGame(),
    scheduleSoloBotMove: () => setTimeout(() => botMoves.botMove(), botMoves.nextBotMoveDelay()),
    showPlayerMoveReaction,
    syncBoardAfterMove,
  });

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
    isPlayerTurn: gamePerspective.isPlayerTurn,
    publishCoopMove,
    runInference,
    saveSoloGame: () => soloGame.saveGame(),
    setStatus,
    showBotMoveReaction,
    showOpponentThinkingReaction,
  });

  soloSession = createSoloSessionController({
    storageKeys: SOLO_STORAGE_KEYS,
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

  function showDevVictoryHighscoreScenario() {
    if (coop?.phase && coop.phase !== "off") throw new Error("Leave co-op before running this scenario.");
    hideModelLoading();
    hideOutcomeBanner();
    clearBotSplashAutoTimer();
    hideOpponentSpeech();
    setupMode = "solo";
    selectedOpponentIndex = 0;
    selectedOpponentTheme = "snib";
    syncStrength(String(SOLO_OPPONENTS[0].elo));
    chess.load("6k1/6Q1/5K2/8/8/8/8/8 b - - 0 1");
    soloSession.clearGame();
    cpChips.innerHTML = "";
    showGame();
    board?.setPosition(chess.fen(), false);
    clearLastMove();
    clearCheckMarker();
    disableBoardMoveInput();
    updateGameScore();
    setStatus("Victory test", "over");
    showVictoryBoardPulseAfterDelay("g8", 0, "victory");
    showOutcomeBannerAfterDelay("victory", 0, {
      highscore: {
        fastest: { valueMs: 65000, isPersonalBest: true, rank: 2 },
        fewestMoves: { value: 12, isPersonalBest: true, rank: 1 },
      },
    });
  }

  function confirmExitGame() {
    return gameScreen.confirmExitGame();
  }

  const localDebug = createLocalDebugController({
    boardActions: {
      clearCheckMarker,
      clearLastMove,
      disableMoveInput: disableBoardMoveInput,
      enableMoveInput: enableBoardMoveInput,
      updateCheckMarker,
      updateGameScore,
    },
    chess,
    clearChips: () => { cpChips.innerHTML = ""; },
    getBoard: () => board,
    getBotMoves: () => botMoves,
    getCoopPhase: () => coop?.phase || "off",
    getSelectedOpponentIndex: () => selectedOpponentIndex,
    hideModelLoading,
    hideOutcomeBanner,
    isPlayerTurn: gamePerspective.isPlayerTurn,
    opponents: SOLO_OPPONENTS,
    promotionChoice,
    setDebugMoveInput: (value) => { debugMoveInput = value; },
    setSelectedOpponent: ({ index, theme }) => {
      selectedOpponentIndex = index;
      selectedOpponentTheme = theme;
    },
    setStatus,
    showGame,
    soloSession,
    syncStrength,
    updateOpponentSelection,
  });
  localDebug.bind();

  function checkGameOver() {
    return gameOver.check();
  }

  function maybeRunSoloBotTurn() {
    botMoves?.maybeRunSoloBotTurn();
  }

  function inputHandler(event) {
    return playerMoves?.inputHandler(event);
  }

  const appRuntime = createAppRuntimeController();
  appRuntime.bind();

  const startupRoute = readStartupRoute();
  const { searchParams } = startupRoute;

  const socialBridge = createSocialBridge();
  const appShell = createLobbyShellController({
    elements: {
      ...appElements.lobby,
      lobbyEl,
    },
    searchParams,
    socialBridge,
    state: {
      getAuthInfo: () => authInfo,
      setAuthInfo: (nextAuthInfo) => { authInfo = nextAuthInfo; },
      getPendingSoloStart: () => soloGame?.hasPendingStart() || false,
      setSetupMode: (mode) => { setupMode = mode; },
      setOpponentSelectionReadonly: (readonly) => { opponentSelectionReadonly = readonly; },
      getElo,
    },
    actions: {
      syncSoloProgressFromAuth,
      hideModelLoading,
      applyOpponentLocks,
      updateOpponentSelection,
      clearOpponentSelection,
    },
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

  const leaderboard = createLeaderboardController({
    apiJson,
    elements: appElements.lobby,
    getAuthInfo: () => authInfo,
    getUnlockedOpponentCount: () => readSoloProgress(),
    opponents: SOLO_OPPONENTS,
    promptSignIn,
    setNavActive,
    setViewUrl,
  });

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
    getPlayerColor: gamePerspective.playerColor,
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
    isPlayerTurn: gamePerspective.isPlayerTurn,
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
    getPlayerColor: gamePerspective.playerColor,
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

  const {
    coopMessages: initializedCoopMessages,
    coopRoom,
    loadCoopInviteFriends,
    renderRoomLobby,
    sendCoopInvite,
  } = createCoopUiControllers({
    apiJson,
    elements: {
      ...appElements.lobby,
      cpChips,
    },
    storage: COOP_ROOM_STORAGE,
    getAuthInfo: () => authInfo,
    getBoard: () => board,
    getChess: () => chess,
    getCoop: () => coop,
    getCurrentOpponent: currentOpponent,
    getElo,
    getSetupMode: () => setupMode,
    actions: {
      applyOpponentLocks,
      applyRemoteFen,
      checkGameOver,
      clearLastMove,
      connectToAuth: () => {
        location.href = authInfo.loginUrl || `/auth/google?next=${encodeURIComponent(currentNextPath())}`;
      },
      disableBoardMoveInput,
      enableBoardMoveInput,
      hideModelLoading,
      hideOutcomeBanner,
      loadInviteNotifications: socialBridge.loadInviteNotifications,
      maybeAutoStartCoopSplash,
      maybeRunCoopBotTurn,
      readSoloProgress,
      setCoopTurnStatus,
      setOpponentSelectionReadonly: (readonly) => { opponentSelectionReadonly = readonly; },
      shouldAutoStartCoopSplash,
      showBotSplash,
      showCoopBotSelection,
      showGame,
      showGameStartSpeech,
      showModelLoading,
      showPlayView,
      syncStrength,
      updateCheckMarker,
      updateGameScore,
      updateOpponentSelection,
      updatePlacementDiffs: () => chessnutBoard.updateDiffLeds(),
    },
  });
  coopMessages = initializedCoopMessages;

  await appShell.loadAuth();

  const schoolAccounts = createSchoolAccountsController({
    apiJson,
    elements: appElements.lobby,
    getAuthInfo: () => authInfo,
    currentNextPath,
  });
  schoolAccounts.bindEvents();
  schoolAccounts.render();
  schoolAccounts.loadAccounts();

  devTesting = createDevTestingController({
    elements: {
      devTestingCard,
      devTestingMessage,
      devTestVictoryHighscore,
    },
    getAuthInfo: () => authInfo,
    scenarios: {
      victoryHighscore: showDevVictoryHighscoreScenario,
    },
  });
  devTesting.bindEvents();
  devTesting.render();

  const social = createSocialController({
    apiJson,
    elements: {
      coopInviteDismiss,
      coopInviteJoin,
      coopInviteNotice,
      coopInviteTitle,
      coopInviteText,
      friendAddClose,
      friendAddDialog,
      friendAddMessage,
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
      lbLeaderboard: appElements.lobby.lbLeaderboard,
      lbMain,
      lbProfile,
      lbRoom,
      lbSolo,
      navFriends,
      navProfile,
      notificationBadge,
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
  socialBridge.attach(social);
  social.bindEvents();
  leaderboard.bind();

  appEvents = createAppEventController({
    appShell,
    bindBotSplashStartButton,
    chessnutBoard,
    coopInviteList: cpInviteList,
    coopRoom,
    getCoop: () => coop,
    getSetupMode: () => setupMode,
    hideOutcomeBanner,
    leaveCoop,
    opponentSelection,
    outcomeScreen,
    promotionChoice,
    renderRoomLobby,
    sendCoopInvite,
    setOpponentSelectionReadonly: (readonly) => { opponentSelectionReadonly = readonly; },
    setCoopSelectingOpponent: (selecting) => coopTransport?.setSelectingOpponent(selecting),
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

  coop = createInitialCoopState();

  coopTransport = createCoopTransportController({
    getCoop: () => coop,
    getElo,
    getFen: () => chess.fen(),
    getGameOver: () => chess.isGameOver(),
    getMaiaReady: () => maia.modelReady,
    getOpponentSelectionReadonly: () => opponentSelectionReadonly,
    getPlayerName: coopRoom.playerName,
    getRoomFromUrl: () => new URLSearchParams(location.search).get("room"),
    getSoloStartDisabled: () => soloStartBtn.disabled,
    readSoloProgress,
    requestModelDownload,
    setSetupMode: (mode) => { setupMode = mode; },
    showCoopBotSelection,
    showLobby,
    showModelLoading,
    storedPlayerId: coopRoom.storedPlayerId,
    onMessage: (msg) => coopMessages.handleMessage(msg),
    onPlayingReconnect: () => {
      disableBoardMoveInput();
      setStatus("Reconnecting…", "thinking");
    },
    onReconnectingLobby: coopRoom.showReconnectingLobby,
  });

  function startCoopWithSelectedBot() {
    coopTransport?.startWithSelectedBot();
  }

  function enterCoopBotSelection() {
    coopTransport?.enterBotSelection();
  }

  function connectCoop(...args) {
    coopTransport?.connect(...args);
  }

  function maybeRunCoopBotTurn() {
    botMoves?.maybeRunCoopBotTurn();
  }

  function leaveCoop() {
    coopTransport?.leave();
  }

  const startup = createAppStartupController({
    connectCoop,
    getAuthInfo: () => authInfo,
    loadFriendInviteLanding: socialBridge.loadFriendInviteLanding,
    loadInviteNotifications: socialBridge.loadInviteNotifications,
    onInvitePollTimer: (timer) => { invitePollTimer = timer; },
    promptSignIn,
    route: startupRoute,
    showAuthView,
    showFriendsView: socialBridge.showFriendsView,
    showLeaderboardView: leaderboard.show,
    showProfileView: socialBridge.showProfileView,
    showSoloSetup,
    soloGame,
    startPresenceHeartbeat: socialBridge.startPresenceHeartbeat,
  });
  await startup.start();
    })().catch((err) => {
      console.error(err);
    });
    return () => {
      disposed = true;
      if (invitePollTimer) window.clearInterval(invitePollTimer);
      botMoves?.dispose();
      coopTransport?.dispose();
      appEvents?.dispose();
      devTesting?.dispose();
      outcomeScreen.dispose();
      promotionChoice.dispose();
      clearBotSplashAutoTimer();
      appRuntime.dispose();
      localDebug.dispose();
      leaderboard.dispose();
      opponentSpeech.clearTimers();
      socialBridge.stopPresenceHeartbeat();
      chessnutBoard.disconnect();
    };
  }, []);
}
