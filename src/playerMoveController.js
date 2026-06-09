import { INPUT_EVENT_TYPE } from "cm-chessboard";

export function createPlayerMoveController({
  checkGameOver,
  chess,
  disableBoardMoveInput,
  getBotThinking,
  getCoop,
  getDebugMoveInput,
  getMaiaReady,
  getPlayerColor,
  getSoloActive,
  promotionChoice,
  publishCoopMove,
  saveSoloGame,
  scheduleSoloBotMove,
  showPlayerMoveReaction,
  syncBoardAfterMove,
}) {
  function canAcceptMove() {
    if (chess.isGameOver() || (!getMaiaReady() && !getDebugMoveInput()) || getBotThinking()) return false;
    const coop = getCoop();
    if (coop?.phase === "playing") return !coop.midTurn && coop.activeIdx === coop.myIdx;
    return getSoloActive() && coop?.phase === "off" && chess.turn() === getPlayerColor();
  }

  function applyMove(from, to, promotion = "q") {
    if (!canAcceptMove()) return false;
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) return false;
      syncBoardAfterMove(move);

      if (getCoop()?.phase === "playing") {
        publishCoopMove();
        if (checkGameOver()) return true;
        showPlayerMoveReaction(move);
        disableBoardMoveInput();
      } else {
        saveSoloGame();
        if (!checkGameOver()) {
          showPlayerMoveReaction(move);
          disableBoardMoveInput();
          scheduleSoloBotMove();
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  function inputHandler(event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted: {
        if (promotionChoice.hasPending()) return false;
        const coop = getCoop();
        if (coop?.phase === "playing")
          return !coop.midTurn && coop.activeIdx === coop.myIdx && getMaiaReady();
        return chess.turn() === getPlayerColor()
          && !getBotThinking()
          && (getMaiaReady() || getDebugMoveInput())
          && !chess.isGameOver();
      }

      case INPUT_EVENT_TYPE.validateMoveInput: {
        if (promotionChoice.show(event.squareFrom, event.squareTo)) return false;
        return applyMove(event.squareFrom, event.squareTo, "q");
      }
    }
  }

  return {
    applyMove,
    canAcceptMove,
    inputHandler,
  };
}
