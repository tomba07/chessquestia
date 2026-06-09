import { Chessboard, COLOR } from "cm-chessboard";
import { Markers } from "cm-chessboard/src/extensions/markers/Markers.js";

const CHESSBOARD_ASSETS_URL = "/cm-chessboard/assets/";

export function createGameScreenController({
  clearSoloGame,
  clearVictoryBoardPulse,
  elements,
  getAuthInfo,
  getBoard,
  getChess,
  getCoopPhase,
  getElo,
  getPlayerColor,
  getSelectedOpponentTheme,
  getSoloActive,
  hideOpponentSpeech,
  inputHandler,
  opponentThemeForStrength,
  promotionChoice,
  setBoard,
  showAuthView,
  showPlayView,
  updateGameScore,
}) {
  function setOpponentTheme(value = getElo(), theme = getSelectedOpponentTheme()) {
    const legacyThemes = { imp: "snib", witch: "vexi" };
    const nextTheme = theme || opponentThemeForStrength(value);
    elements.gameEl.dataset.opponent = legacyThemes[nextTheme] || nextTheme;
  }

  function showGame() {
    elements.lobbyEl.style.display = "none";
    setOpponentTheme();
    updateGameScore();
    elements.gameEl.style.display = "flex";
    if (!getBoard()) {
      setBoard(new Chessboard(elements.boardEl, {
        position: getChess().fen(),
        orientation: getPlayerColor() === "b" ? COLOR.black : COLOR.white,
        assetsUrl: CHESSBOARD_ASSETS_URL,
        style: {
          pieces: { file: `${CHESSBOARD_ASSETS_URL}pieces/staunty.svg` },
          animationDuration: 220,
        },
        extensions: [{ class: Markers }],
      }));
    } else {
      const orientation = getPlayerColor() === "b" ? COLOR.black : COLOR.white;
      if (getBoard().getOrientation() !== orientation)
        getBoard().setOrientation(orientation, false);
    }
    clearVictoryBoardPulse();
  }

  function showLobby() {
    const authInfo = getAuthInfo();
    elements.gameEl.style.display = "none";
    hideOpponentSpeech();
    promotionChoice.hide();
    elements.lobbyEl.style.display = "";
    if (getSoloActive()) clearSoloGame();
    if (authInfo.authEnabled && !authInfo.user) showAuthView();
    else showPlayView();
    if (authInfo.user && (location.search.includes("room=") || location.pathname !== "/"))
      history.replaceState(null, "", "/");
  }

  function shouldWarnBeforeExitingGame() {
    return elements.gameEl.style.display !== "none" && !getChess().isGameOver();
  }

  function confirmExitGame() {
    if (!shouldWarnBeforeExitingGame()) return true;
    const message = getCoopPhase() !== "off"
      ? "Exit this game? You will leave the current room."
      : "Exit this game? Your current solo game will be discarded.";
    return window.confirm(message);
  }

  return {
    confirmExitGame,
    showGame,
    showLobby,
  };
}
