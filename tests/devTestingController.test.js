import { describe, expect, it, vi } from "vitest";
import { createDevTestingController } from "../src/devTestingController.js";

function createElements() {
  document.body.innerHTML = `
    <button id="fab" hidden></button>
    <div id="lobby"></div>
    <div id="game"></div>
    <div id="main"></div>
    <div id="profile"></div>
    <div id="panel" style="display: none">
    </div>
    <section id="card" hidden>
      <button id="victory" type="button"></button>
      <div id="message"></div>
    </section>
  `;
  return {
    devTestingFab: document.getElementById("fab"),
    devTestingPanel: document.getElementById("panel"),
    devTestingCard: document.getElementById("card"),
    devTestingMessage: document.getElementById("message"),
    devTestVictoryHighscore: document.getElementById("victory"),
    gameEl: document.getElementById("game"),
    lbMain: document.getElementById("main"),
    lbProfile: document.getElementById("profile"),
    lobbyEl: document.getElementById("lobby"),
  };
}

describe("dev testing controller", () => {
  it("only renders for admin users", () => {
    let authInfo = { user: null };
    const controller = createDevTestingController({
      elements: createElements(),
      getAuthInfo: () => authInfo,
      scenarios: { victoryHighscore: vi.fn() },
    });

    controller.render();
    expect(document.getElementById("card").hidden).toBe(true);
    expect(document.getElementById("fab").hidden).toBe(true);

    authInfo = { user: { isAdmin: true }, devTestingEnabled: true };
    controller.render();
    expect(document.getElementById("card").hidden).toBe(false);
    expect(document.getElementById("fab").hidden).toBe(false);
  });

  it("hides for admins when dev testing is disabled", () => {
    const controller = createDevTestingController({
      elements: createElements(),
      getAuthInfo: () => ({ user: { isAdmin: true }, devTestingEnabled: false }),
      scenarios: { victoryHighscore: vi.fn() },
    });

    controller.render();

    expect(document.getElementById("card").hidden).toBe(true);
  });

  it("opens the dedicated dev testing page from the floating button", () => {
    const setNavActive = vi.fn();
    const setViewUrl = vi.fn();
    const controller = createDevTestingController({
      elements: createElements(),
      getAuthInfo: () => ({ user: { isAdmin: true }, devTestingEnabled: true }),
      actions: { setNavActive, setViewUrl },
      scenarios: { victoryHighscore: vi.fn() },
    });
    controller.bindEvents();
    controller.render();
    document.getElementById("main").style.display = "flex";
    document.getElementById("profile").style.display = "flex";

    document.getElementById("fab").click();

    expect(document.getElementById("lobby").style.display).toBe("");
    expect(document.getElementById("game").style.display).toBe("none");
    expect(document.getElementById("main").style.display).toBe("none");
    expect(document.getElementById("profile").style.display).toBe("none");
    expect(document.getElementById("panel").style.display).toBe("flex");
    expect(setNavActive).toHaveBeenCalledWith("");
    expect(setViewUrl).toHaveBeenCalledWith("dev-testing");
  });

  it("runs the victory highscore scenario from the button", () => {
    const scenario = vi.fn();
    const controller = createDevTestingController({
      elements: createElements(),
      getAuthInfo: () => ({ user: { isAdmin: true } }),
      scenarios: { victoryHighscore: scenario },
    });
    controller.bindEvents();

    document.getElementById("victory").click();

    expect(scenario).toHaveBeenCalledTimes(1);
    expect(document.getElementById("message").textContent).toBe("Victory + highscore scenario opened.");
  });
});
