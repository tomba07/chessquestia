export function createGamePerspectiveController({
  getChess,
  getCoop,
  getSoloSession,
}) {
  function playerColor() {
    const soloSession = getSoloSession();
    return soloSession?.active && getCoop()?.phase === "off"
      ? soloSession.playerColor
      : "w";
  }

  function isPlayerTurn() {
    return getChess().turn() === playerColor();
  }

  return {
    isPlayerTurn,
    playerColor,
  };
}
