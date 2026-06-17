import { describe, expect, it, vi } from "vitest";
import { createOutcomeScreen } from "../src/outcomeScreen.js";

function createElements() {
  document.body.innerHTML = `
    <div id="overlay" class="game-outcome-overlay" aria-hidden="true">
      <div id="banner"><span id="title"></span></div>
      <section id="results" hidden>
        <strong id="moves">0</strong>
        <strong id="time">0:00</strong>
      </section>
      <section id="highscore" hidden>
        <strong id="highscore-title"></strong>
        <span id="highscore-text"></span>
      </section>
      <section id="unlock" hidden>
        <strong id="unlock-name"></strong>
        <p id="unlock-text"></p>
        <button id="challenge" hidden></button>
      </section>
      <button id="continue"></button>
    </div>
    <div id="pulse"></div>
    <div id="flash"></div>
  `;
  const byId = id => document.getElementById(id);
  return {
    overlayEl: byId("overlay"),
    bannerEl: byId("banner"),
    titleEl: byId("title"),
    continueBtn: byId("continue"),
    resultsEl: byId("results"),
    movesEl: byId("moves"),
    timeEl: byId("time"),
    highscoreEl: byId("highscore"),
    highscoreTitleEl: byId("highscore-title"),
    highscoreTextEl: byId("highscore-text"),
    unlockEl: byId("unlock"),
    unlockNameEl: byId("unlock-name"),
    unlockTextEl: byId("unlock-text"),
    challengeBtn: byId("challenge"),
    boardPulseEl: byId("pulse"),
    screenFlashEl: byId("flash"),
  };
}

function createController({ coopPhase = "off", startedAt, moveCount = 27 } = {}) {
  const elements = createElements();
  const opponents = [
    { name: "Snib", splashText: "Cellar menace" },
    { name: "Muckroot", splashText: "Bog trickster" },
  ];
  const controller = createOutcomeScreen({
    elements,
    getBoard: () => null,
    getCoopPhase: () => coopPhase,
    getGameStartedAt: () => startedAt,
    getLastMoveSquares: () => [],
    getMoveCount: () => moveCount,
    opponents,
  });
  return { controller, elements, opponents };
}

describe("outcome screen", () => {
  it("shows victory statistics and unlocked opponent details", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T12:05:42Z"));
    const startedAt = Date.now() - 342000;
    const { controller, elements, opponents } = createController({ startedAt });

    controller.showBannerAfterDelay("victory", 100, {
      unlockedOpponent: opponents[1],
    });
    vi.advanceTimersByTime(100);

    expect(elements.overlayEl.classList.contains("visible")).toBe(true);
    expect(elements.titleEl.textContent).toBe("Victory");
    expect(elements.resultsEl.hidden).toBe(false);
    expect(elements.movesEl.textContent).toBe("27");
    expect(elements.timeEl.textContent).toBe("5:42");
    expect(elements.highscoreEl.hidden).toBe(true);
    expect(elements.unlockEl.hidden).toBe(false);
    expect(elements.unlockNameEl.textContent).toBe("Muckroot");
    expect(elements.unlockTextEl.textContent).toBe("Bog trickster");
    expect(elements.challengeBtn.hidden).toBe(false);
    expect(elements.challengeBtn.dataset.opponentIndex).toBe("1");
  });

  it("renders a returned personal-best highscore", () => {
    vi.useFakeTimers();
    const { controller, elements } = createController();

    controller.showBannerAfterDelay("victory", 0, {
      highscore: {
        fastest: { valueMs: 65000, isPersonalBest: true, rank: 2 },
        fewestMoves: { value: 12, isPersonalBest: true, rank: 1 },
      },
    });
    vi.runAllTimers();

    expect(elements.highscoreEl.hidden).toBe(false);
    expect(elements.highscoreTitleEl.textContent).toBe("New personal bests!");
    expect(elements.highscoreTextEl.textContent).toBe("Fastest time 1:05 (#2) · Fewest moves 12 (#1)");
  });

  it("updates the highscore area when an async server result arrives", async () => {
    vi.useFakeTimers();
    const { controller, elements } = createController();
    const highscorePromise = Promise.resolve({
      highscore: {
        fastest: { valueMs: 120000, isPersonalBest: false, rank: 5 },
        fewestMoves: { value: 18, isPersonalBest: false, rank: 3 },
      },
    });

    controller.showBannerAfterDelay("victory", 0, { highscorePromise });
    vi.runAllTimers();
    expect(elements.highscoreTitleEl.textContent).toBe("Checking records...");
    await highscorePromise;
    await Promise.resolve();

    expect(elements.highscoreEl.hidden).toBe(false);
    expect(elements.highscoreTitleEl.textContent).toBe("Leaderboard");
    expect(elements.highscoreTextEl.textContent).toBe("Your best ranks: #5 fastest · #3 fewest moves");
  });

  it.each(["defeat", "draw"])("does not show victory details for %s", outcome => {
    vi.useFakeTimers();
    const { controller, elements } = createController();

    controller.showBannerAfterDelay(outcome, 0);
    vi.runAllTimers();

    expect(elements.titleEl.textContent).toBe(outcome === "defeat" ? "Defeat" : "Draw");
    expect(elements.resultsEl.hidden).toBe(true);
    expect(elements.unlockEl.hidden).toBe(true);
  });

  it("hides the challenge action in co-op victories", () => {
    vi.useFakeTimers();
    const { controller, elements, opponents } = createController({ coopPhase: "playing" });

    controller.showBannerAfterDelay("victory", 0, {
      unlockedOpponent: opponents[1],
    });
    vi.runAllTimers();

    expect(elements.unlockEl.hidden).toBe(false);
    expect(elements.challengeBtn.hidden).toBe(true);
  });

  it("binds continue and challenge actions", () => {
    const { controller, elements } = createController();
    const onContinue = vi.fn();
    const onChallenge = vi.fn();
    elements.challengeBtn.dataset.opponentIndex = "1";

    controller.bindActions({ onContinue, onChallenge });
    elements.continueBtn.click();
    elements.challengeBtn.click();

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onChallenge).toHaveBeenCalledWith(1);
  });
});
