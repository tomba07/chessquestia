import { describe, expect, it, vi } from "vitest";
import { createDevTestingController } from "../src/devTestingController.js";

function createElements() {
  document.body.innerHTML = `
    <section id="card" hidden>
      <button id="victory" type="button"></button>
      <div id="message"></div>
    </section>
  `;
  return {
    devTestingCard: document.getElementById("card"),
    devTestingMessage: document.getElementById("message"),
    devTestVictoryHighscore: document.getElementById("victory"),
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

    authInfo = { user: { isAdmin: true }, devTestingEnabled: true };
    controller.render();
    expect(document.getElementById("card").hidden).toBe(false);
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
