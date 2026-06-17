import { createBotSplash } from "./botSplash.js";
import { createChessnutController } from "./chessnutController.js";
import { createOpponentSpeechController } from "./opponentSpeechController.js";
import { createOutcomeScreen } from "./outcomeScreen.js";
import { createPromotionController } from "./promotionController.js";

export function createGamePresentationControllers({
  applyPlayerMove,
  canAcceptPlayerMove,
  chess,
  elements,
  getBoard,
  getCoop,
  getCurrentOpponent,
  getSoloSession,
  isCurrentSideInCheck,
  opponents,
  boardDeviceStorageKey,
}) {
  const chessnutBoard = createChessnutController({
    elements: {
      panel: elements.boardDevicePanel,
      connectBtn: elements.boardConnectBtn,
      connectLabel: elements.boardConnectLabel,
      disconnectBtn: elements.boardDisconnectBtn,
      statusEl: elements.boardDeviceStatus,
      profileToggle: elements.profileBoardToggle,
    },
    storageKey: boardDeviceStorageKey,
    getFen: () => chess.fen(),
    getLegalMoves: () => chess.moves({ verbose: true }),
    canAcceptMove: canAcceptPlayerMove,
    applyMove: applyPlayerMove,
  });

  const promotionChoice = createPromotionController({
    element: elements.promotionChoiceEl,
    getLegalMoves: () => chess.moves({ verbose: true }),
    onPromotionChosen: applyPlayerMove,
  });

  const outcomeScreen = createOutcomeScreen({
    elements: {
      overlayEl: elements.outcomeOverlayEl,
      bannerEl: elements.outcomeBannerEl,
      titleEl: elements.outcomeTitleEl,
      continueBtn: elements.outcomeContinueBtn,
      resultsEl: elements.outcomeResultsEl,
      movesEl: elements.outcomeMovesEl,
      timeEl: elements.outcomeTimeEl,
      movesBestEl: elements.outcomeMovesBestEl,
      timeBestEl: elements.outcomeTimeBestEl,
      unlockEl: elements.outcomeUnlockEl,
      unlockNameEl: elements.outcomeUnlockNameEl,
      unlockTextEl: elements.outcomeUnlockTextEl,
      challengeBtn: elements.outcomeChallengeBtn,
      boardPulseEl: elements.victoryBoardPulseEl,
      screenFlashEl: elements.victoryScreenFlashEl,
    },
    getBoard,
    getCoopPhase: () => getCoop()?.phase || "off",
    getGameStartedAt: () => {
      const coop = getCoop();
      return coop?.phase !== "off" ? coop.startedAt : getSoloSession()?.gameStartedAt;
    },
    getLastMoveSquares: () => {
      const history = chess.history({ verbose: true });
      const move = history[history.length - 1];
      return move ? [move.from, move.to] : [];
    },
    getMoveCount: () => {
      const coop = getCoop();
      return coop?.phase !== "off" ? coop.moveCount : chess.history().length;
    },
    opponents,
  });

  const botSplash = createBotSplash({
    elements: {
      botSplashEl: elements.botSplashEl,
      botSplashArt: elements.botSplashArt,
      botSplashBanner: elements.botSplashBanner,
      botSplashName: elements.botSplashName,
      botSplashText: elements.botSplashText,
      botSplashStrength: elements.botSplashStrength,
      botSplashStart: elements.botSplashStart,
    },
    getCurrentOpponent,
  });

  const opponentSpeech = createOpponentSpeechController({
    elements: {
      speechEl: elements.opponentSpeechEl,
      portraitEl: elements.opponentSpeechPortrait,
      nameEl: elements.opponentSpeechName,
      textEl: elements.opponentSpeechText,
      closeBtn: elements.opponentSpeechClose,
    },
    getCurrentOpponent,
    isCurrentSideInCheck,
  });

  return {
    botSplash,
    chessnutBoard,
    opponentSpeech,
    outcomeScreen,
    promotionChoice,
  };
}
