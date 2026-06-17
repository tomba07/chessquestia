export function createDevTestingController({
  elements,
  getAuthInfo,
  scenarios,
}) {
  const {
    devTestingCard,
    devTestingMessage,
    devTestVictoryHighscore,
  } = elements;

  function renderMessage(message, { success = false } = {}) {
    if (!devTestingMessage) return;
    devTestingMessage.textContent = message || "";
    devTestingMessage.className = `school-account-message${message ? " visible" : ""}${success ? " success" : ""}`;
  }

  function render() {
    if (!devTestingCard) return;
    const authInfo = getAuthInfo();
    const canUse = !!authInfo.user?.isAdmin && !!authInfo.devTestingEnabled;
    devTestingCard.hidden = !canUse;
    if (!canUse) renderMessage("");
  }

  function runScenario(name, runner) {
    try {
      if (typeof runner !== "function") throw new Error(`${name} is not available.`);
      runner();
      renderMessage(`${name} scenario opened.`, { success: true });
    } catch (err) {
      renderMessage(err.message || `Could not open ${name}.`);
    }
  }

  function bindEvents() {
    if (!devTestVictoryHighscore) return;
    devTestVictoryHighscore.onclick = () => {
      runScenario("Victory + highscore", scenarios.victoryHighscore);
    };
  }

  function dispose() {
    if (!devTestVictoryHighscore) return;
    devTestVictoryHighscore.onclick = null;
  }

  return {
    bindEvents,
    dispose,
    render,
  };
}
