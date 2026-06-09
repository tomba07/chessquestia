export function createGameOverController({
  chess,
  disableBoardMoveInput,
  findKingSquare,
  getCanUnlockProgress,
  getPlayerColor,
  getSelectedOpponentIndex,
  hideOutcomeBanner,
  opponents,
  recordResult,
  setStatus,
  showEndgameOpponentReaction,
  showOutcomeBannerAfterDelay,
  showVictoryBoardPulseAfterDelay,
  unlockNextOpponent,
}) {
  function check() {
    if (chess.isCheckmate()) {
      const playerWon = chess.turn() !== getPlayerColor();
      recordResult(playerWon ? "victory" : "defeat");
      const nextOpponent = playerWon ? opponents[getSelectedOpponentIndex() + 1] : null;
      const unlockedNext = playerWon && getCanUnlockProgress() && unlockNextOpponent();
      const defeatedKingSquare = findKingSquare(chess.turn());

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
      recordResult("draw");
      showVictoryBoardPulseAfterDelay(null, 120, "draw");
      showOutcomeBannerAfterDelay("draw", 1900);
      setStatus(reason, "over");
      disableBoardMoveInput();
      return true;
    }

    hideOutcomeBanner();
    return false;
  }

  return {
    check,
  };
}
