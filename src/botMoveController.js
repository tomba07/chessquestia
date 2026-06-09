import {
  buildLegalMask,
  decodeMoves,
  prepareMaiaPosition,
  sampleMove,
} from "./maia.js";
import { createBotTurnController } from "./botTurnController.js";

export function createBotMoveController({
  allMoves,
  allMovesReversed,
  botMoveDelayMs,
  checkGameOver,
  chess,
  commitBotMove,
  enableBoardMoveInput,
  getCoop,
  getElo,
  getGameVisible,
  getMaiaReady,
  getSoloActive,
  isPlayerTurn,
  publishCoopMove,
  runInference,
  saveSoloGame,
  setStatus,
  showBotMoveReaction,
  showOpponentThinkingReaction,
}) {
  let botThinking = false;

  function isMyCoopBotTurn() {
    const coop = getCoop();
    return coop?.phase === "playing"
      && coop.activeIdx === coop.myIdx
      && coop.midTurn
      && getMaiaReady()
      && !chess.isGameOver();
  }

  const botTurns = createBotTurnController({
    botMoveDelayMs,
    isBotThinking: () => botThinking,
    isMyCoopBotTurn,
    onCoopBotMove: () => coopBotMove(),
  });

  async function botMove() {
    if (chess.isGameOver() || !getMaiaReady() || botThinking) return;
    botThinking = true;
    setStatus("Thinking...", "thinking");
    const showedThinkingReaction = showOpponentThinkingReaction();
    if (showedThinkingReaction) {
      await botTurns.wait(botTurns.thinkingMoveDelay());
      const coop = getCoop();
      if (chess.isGameOver() || !getSoloActive() || coop?.phase !== "off" || !getGameVisible()) {
        botThinking = false;
        return;
      }
    }

    const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
    const legalMask = buildLegalMask(workingFen, allMoves);

    const { logitsMove } = await runInference(tokens, getElo());
    const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesReversed);
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
    const coop = getCoop();
    if (getSoloActive() && coop?.phase === "off" && getGameVisible()
      && !isPlayerTurn() && getMaiaReady() && !botThinking && !chess.isGameOver())
      setTimeout(botMove, botTurns.nextBotMoveDelay());
  }

  function maybeRunCoopBotTurn() {
    if (!isMyCoopBotTurn()) {
      botTurns.clearCoopBotTimer();
      return;
    }
    botTurns.scheduleCoopBotMove();
  }

  async function coopBotMove() {
    if (!isMyCoopBotTurn() || botThinking) return;
    const coop = getCoop();
    const roomId = coop.roomId;
    const fenBeforeThinking = chess.fen();
    botThinking = true;
    try {
      setStatus("Thinking...", "thinking");
      const showedThinkingReaction = showOpponentThinkingReaction();
      if (showedThinkingReaction) {
        await botTurns.wait(botTurns.thinkingMoveDelay());
        const currentCoop = getCoop();
        if (!isMyCoopBotTurn() || currentCoop.roomId !== roomId || chess.fen() !== fenBeforeThinking) return;
      }
      const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
      const legalMask = buildLegalMask(workingFen, allMoves);

      const { logitsMove } = await runInference(tokens, coop.strength);
      const currentCoop = getCoop();
      if (!isMyCoopBotTurn() || currentCoop.roomId !== roomId || chess.fen() !== fenBeforeThinking) return;

      const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesReversed);
      const uci = sampleMove(moveProbs);

      const move = commitBotMove(uci);
      if (!move) return;
      publishCoopMove();
      if (!checkGameOver()) showBotMoveReaction(move);
    } finally {
      botThinking = false;
    }
  }

  return {
    botMove,
    dispose: botTurns.dispose,
    isThinking: () => botThinking,
    maybeRunCoopBotTurn,
    maybeRunSoloBotTurn,
    nextBotMoveDelay: botTurns.nextBotMoveDelay,
    setThinking: (value) => { botThinking = value; },
  };
}
