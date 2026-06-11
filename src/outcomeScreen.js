const VICTORY_MARKER = { class: "victory-mate", slice: "markerSquare" };
const DEFEAT_MARKER = { class: "defeat-mate", slice: "markerSquare" };
const DRAW_MARKER = { class: "draw-result", slice: "markerSquare" };

function squareToBoardIndex(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10);
  return {
    file,
    rankIndex: 8 - rank,
  };
}

function formatOutcomeTime(startedAt) {
  if (!startedAt) return "0:00";
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function createOutcomeScreen({
  elements,
  getBoard,
  getCoopPhase,
  getGameStartedAt,
  getLastMoveSquares,
  getMoveCount,
  opponents,
}) {
  const {
    overlayEl,
    bannerEl,
    titleEl,
    continueBtn,
    resultsEl,
    movesEl,
    timeEl,
    unlockEl,
    unlockNameEl,
    unlockTextEl,
    challengeBtn,
    boardPulseEl,
    screenFlashEl,
  } = elements;
  let bannerTimer = null;
  let boardPulseTimer = null;

  function resetDetails() {
    resultsEl.hidden = true;
    unlockEl.hidden = true;
    challengeBtn.hidden = true;
    challengeBtn.removeAttribute("data-opponent-index");
    movesEl.textContent = "0";
    timeEl.textContent = "0:00";
    unlockNameEl.textContent = "";
    unlockTextEl.textContent = "";
  }

  function renderDetails(outcome, details = {}) {
    resetDetails();
    if (outcome !== "victory") return;

    resultsEl.hidden = false;
    movesEl.textContent = String(getMoveCount());
    timeEl.textContent = formatOutcomeTime(getGameStartedAt());

    const opponent = details.unlockedOpponent;
    if (!opponent) return;
    unlockEl.hidden = false;
    unlockNameEl.textContent = opponent.name;
    unlockTextEl.textContent = opponent.splashText || opponent.role || "";
    challengeBtn.hidden = getCoopPhase() !== "off";
    challengeBtn.dataset.opponentIndex = String(opponents.indexOf(opponent));
  }

  function clearBoardPulse() {
    if (boardPulseTimer) window.clearTimeout(boardPulseTimer);
    boardPulseTimer = null;
    boardPulseEl.classList.remove("active", "victory", "defeat", "draw");
    boardPulseEl.innerHTML = "";
    screenFlashEl.classList.remove("active", "victory", "defeat", "draw");
    const board = getBoard();
    board?.removeMarkers(VICTORY_MARKER);
    board?.removeMarkers(DEFEAT_MARKER);
    board?.removeMarkers(DRAW_MARKER);
  }

  function showBoardPulse(square, outcome = "victory") {
    clearBoardPulse();
    const moveSquares = getLastMoveSquares();
    const originSquare = square || moveSquares.at(-1);
    const origin = originSquare ? squareToBoardIndex(originSquare) : { file: 3.5, rankIndex: 3.5 };
    const highlightedSquares = [...new Set([square, ...moveSquares].filter(Boolean))];
    const marker = outcome === "draw" ? DRAW_MARKER
      : outcome === "defeat" ? DEFEAT_MARKER : VICTORY_MARKER;
    const board = getBoard();
    highlightedSquares.forEach(highlightSquare => board?.addMarker(marker, highlightSquare));

    screenFlashEl.classList.remove("active", "victory", "defeat", "draw");
    void screenFlashEl.offsetWidth;
    screenFlashEl.classList.add(outcome, "active");

    const cells = [];
    for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
      for (let file = 0; file < 8; file += 1) {
        const cell = document.createElement("span");
        cell.className = "victory-spread-cell";
        const distance = Math.abs(file - origin.file) + Math.abs(rankIndex - origin.rankIndex);
        cell.style.setProperty("--cell-file", file);
        cell.style.setProperty("--cell-rank", rankIndex);
        cell.style.setProperty("--spread-delay", `${Math.min(distance * 34, 360)}ms`);
        cells.push(cell);
      }
    }
    boardPulseEl.replaceChildren(...cells);
    void boardPulseEl.offsetWidth;
    boardPulseEl.classList.add(outcome, "active");
  }

  function showBoardPulseAfterDelay(square, delay = 280, outcome = "victory") {
    clearBoardPulse();
    boardPulseTimer = window.setTimeout(() => {
      boardPulseTimer = null;
      showBoardPulse(square, outcome);
    }, delay);
  }

  function hideBanner() {
    if (bannerTimer) window.clearTimeout(bannerTimer);
    bannerTimer = null;
    overlayEl.className = "game-outcome-overlay";
    overlayEl.setAttribute("aria-hidden", "true");
    bannerEl.className = "game-outcome-banner";
    titleEl.textContent = "";
    bannerEl.removeAttribute("aria-label");
    resetDetails();
    clearBoardPulse();
  }

  function showBanner(outcome, details = {}) {
    const outcomeTitles = { victory: "Victory", defeat: "Defeat", draw: "Draw" };
    overlayEl.className = "game-outcome-overlay visible";
    overlayEl.setAttribute("aria-hidden", "false");
    bannerEl.className = `game-outcome-banner ${outcome}`;
    titleEl.textContent = outcomeTitles[outcome] || "";
    bannerEl.setAttribute("aria-label", titleEl.textContent);
    renderDetails(outcome, details);
  }

  function showBannerAfterDelay(outcome, delay = 1000, details = {}) {
    if (bannerTimer) window.clearTimeout(bannerTimer);
    overlayEl.className = "game-outcome-overlay";
    overlayEl.setAttribute("aria-hidden", "true");
    bannerEl.className = "game-outcome-banner";
    titleEl.textContent = "";
    bannerEl.removeAttribute("aria-label");
    resetDetails();
    bannerTimer = window.setTimeout(() => {
      bannerTimer = null;
      showBanner(outcome, details);
    }, delay);
  }

  function bindActions({ onContinue, onChallenge }) {
    continueBtn.onclick = onContinue;
    challengeBtn.onclick = () => {
      const opponentIndex = Number(challengeBtn.dataset.opponentIndex);
      onChallenge?.(opponentIndex);
    };
  }

  function dispose() {
    if (bannerTimer) window.clearTimeout(bannerTimer);
    if (boardPulseTimer) window.clearTimeout(boardPulseTimer);
    bannerTimer = null;
    boardPulseTimer = null;
  }

  return {
    bindActions,
    clearBoardPulse,
    dispose,
    hideBanner,
    showBannerAfterDelay,
    showBoardPulseAfterDelay,
  };
}
