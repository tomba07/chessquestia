export const DEV_VICTORY_FEN = "6k1/6Q1/5K2/8/8/8/8/8 b - - 0 1";

export function createDevTestingScenarios({
  chess,
  clearBotSplashAutoTimer,
  clearCheckMarker,
  clearLastMove,
  cpChips,
  disableBoardMoveInput,
  getBoard,
  getCoopPhase,
  hideModelLoading,
  hideOpponentSpeech,
  hideOutcomeBanner,
  opponents,
  setSelectedOpponent,
  setSetupMode,
  setStatus,
  showGame,
  showOutcomeBannerAfterDelay,
  showVictoryBoardPulseAfterDelay,
  soloSession,
  syncStrength,
  updateGameScore,
}) {
  function showVictoryScenario(details = {}) {
    if (getCoopPhase() !== "off") throw new Error("Leave co-op before running this scenario.");
    const firstOpponent = opponents[0];

    hideModelLoading();
    hideOutcomeBanner();
    clearBotSplashAutoTimer();
    hideOpponentSpeech();
    setSetupMode("solo");
    setSelectedOpponent({
      index: 0,
      theme: firstOpponent?.theme || "snib",
    });
    syncStrength(String(firstOpponent?.elo || 500));
    chess.load(DEV_VICTORY_FEN);
    soloSession.clearGame();
    if (cpChips) cpChips.innerHTML = "";
    showGame();
    getBoard()?.setPosition(chess.fen(), false);
    clearLastMove();
    clearCheckMarker();
    disableBoardMoveInput();
    updateGameScore();
    setStatus("Victory test", "over");
    showVictoryBoardPulseAfterDelay("g8", 0, "victory");
    showOutcomeBannerAfterDelay("victory", 0, details);
  }

  return {
    victoryHighscore() {
      showVictoryScenario({
        highscore: {
          fastest: { valueMs: 65000, isPersonalBest: true, rank: 2 },
          fewestMoves: { value: 12, isPersonalBest: true, rank: 1 },
        },
      });
    },
    victoryMovesHighscore() {
      showVictoryScenario({
        highscore: {
          fewestMoves: { value: 9, isPersonalBest: true, rank: 1 },
        },
      });
    },
    victoryTimeHighscore() {
      showVictoryScenario({
        highscore: {
          fastest: { valueMs: 42000, isPersonalBest: true, rank: 1 },
        },
      });
    },
    victoryUnlock() {
      showVictoryScenario({
        unlockedOpponent: opponents[1],
      });
    },
  };
}
