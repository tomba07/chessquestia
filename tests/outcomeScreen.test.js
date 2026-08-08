import { describe, expect, it, vi } from "vitest";
import { createOutcomeScreen } from "../src/outcomeScreen.js";

function createElements() {
  document.body.innerHTML = `
    <div id="overlay" class="game-outcome-overlay" aria-hidden="true">
      <div id="banner"><span id="title"></span></div>
      <section id="results" hidden>
        <div class="outcome-result-row">
          <strong id="moves">0</strong>
          <div id="moves-best" hidden></div>
        </div>
        <div class="outcome-result-row">
          <strong id="time">0:00</strong>
          <div id="time-best" hidden></div>
        </div>
      </section>
      <section id="unlock" hidden>
        <strong id="unlock-name"></strong>
        <img id="unlock-card" alt="" />
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
    movesBestEl: byId("moves-best"),
    timeBestEl: byId("time-best"),
    unlockEl: byId("unlock"),
    unlockNameEl: byId("unlock-name"),
    unlockCardEl: byId("unlock-card"),
    challengeBtn: byId("challenge"),
    boardPulseEl: byId("pulse"),
    screenFlashEl: byId("flash"),
  };
}

function createController({
  coopPhase = "off",
  canChallengeUnlockedOpponent,
  startedAt,
  moveCount = 27,
} = {}) {
  const elements = createElements();
  const opponents = [
    { name: "Snib", card: "snib_card.png", splashText: "Cellar menace" },
    { name: "Muckroot", card: "muckroot_card.png", splashText: "Bog trickster" },
  ];
  const controller = createOutcomeScreen({
    elements,
    getBoard: () => null,
    getCoopPhase: () => coopPhase,
    getCanChallengeUnlockedOpponent: canChallengeUnlockedOpponent,
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
    expect(elements.movesBestEl.hidden).toBe(true);
    expect(elements.timeBestEl.hidden).toBe(true);
    expect(elements.unlockEl.hidden).toBe(false);
    expect(elements.unlockNameEl.textContent).toBe("Muckroot");
    expect(elements.unlockCardEl.getAttribute("src")).toBe("/assets/cards/muckroot_card.png");
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

    expect(elements.timeBestEl.hidden).toBe(false);
    expect(elements.timeBestEl.textContent).toBe("New best · #2");
    expect(elements.movesBestEl.hidden).toBe(false);
    expect(elements.movesBestEl.textContent).toBe("New best · #1");
  });

  it("updates result tile highscores when an async server result arrives", async () => {
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
    expect(elements.movesBestEl.textContent).toBe("Checking records...");
    expect(elements.timeBestEl.textContent).toBe("Checking records...");
    await highscorePromise;
    await Promise.resolve();

    expect(elements.timeBestEl.textContent).toBe("Leaderboard #5");
    expect(elements.movesBestEl.textContent).toBe("Leaderboard #3");
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

  it("shows the challenge action for eligible co-op victories", () => {
    vi.useFakeTimers();
    const { controller, elements, opponents } = createController({
      coopPhase: "over",
      canChallengeUnlockedOpponent: () => true,
    });

    controller.showBannerAfterDelay("victory", 0, {
      unlockedOpponent: opponents[1],
    });
    vi.runAllTimers();

    expect(elements.unlockEl.hidden).toBe(false);
    expect(elements.challengeBtn.hidden).toBe(false);
    expect(elements.challengeBtn.dataset.opponentIndex).toBe("1");
  });

  it("hides the challenge action for ineligible co-op victories", () => {
    vi.useFakeTimers();
    const { controller, elements, opponents } = createController({
      coopPhase: "over",
      canChallengeUnlockedOpponent: () => false,
    });

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
