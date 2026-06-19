export function createDevTestingController({
  elements,
  getAuthInfo,
  actions = {},
  scenarios,
}) {
  const {
    devTestingFab,
    devTestingPanel,
    devTestingCard,
    devTestingMessage,
    devTestVictoryHighscore,
    gameEl,
    lbAuth,
    lbFriendInvite,
    lbFriends,
    lbLeaderboard,
    lbMain,
    lbProfile,
    lbRoom,
    lbSolo,
    lobbyEl,
  } = elements;

  const {
    hideModelLoading = () => {},
    hideOutcomeBanner = () => {},
    hideOpponentSpeech = () => {},
    setNavActive = () => {},
    setViewUrl = () => {},
    showFallback = () => {},
  } = actions;

  const scenarioLabels = {
    victoryHighscore: "Victory: both highscores",
    victoryMovesHighscore: "Victory: moves highscore",
    victoryTimeHighscore: "Victory: time highscore",
    victoryUnlock: "Victory: unlock enemy",
  };

  function canUse() {
    const authInfo = getAuthInfo();
    return !!authInfo.user?.isAdmin && !!authInfo.devTestingEnabled;
  }

  function renderMessage(message, { success = false } = {}) {
    if (!devTestingMessage) return;
    devTestingMessage.textContent = message || "";
    devTestingMessage.className = `school-account-message${message ? " visible" : ""}${success ? " success" : ""}`;
  }

  function render() {
    const visible = canUse();
    if (devTestingFab) devTestingFab.hidden = !visible;
    if (devTestingCard) devTestingCard.hidden = !visible;
    if (!visible) renderMessage("");
  }

  function hideLobbySections() {
    [
      lbAuth,
      lbFriendInvite,
      lbFriends,
      lbLeaderboard,
      lbMain,
      lbProfile,
      lbRoom,
      lbSolo,
    ].filter(Boolean).forEach(section => { section.style.display = "none"; });
  }

  function showView() {
    render();
    if (!canUse()) {
      showFallback();
      return false;
    }
    hideModelLoading();
    hideOutcomeBanner();
    hideOpponentSpeech();
    if (gameEl) gameEl.style.display = "none";
    if (lobbyEl) lobbyEl.style.display = "";
    hideLobbySections();
    if (devTestingPanel) devTestingPanel.style.display = "flex";
    setNavActive("");
    setViewUrl("dev-testing");
    renderMessage("");
    return true;
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
    if (devTestingFab) devTestingFab.onclick = () => showView();
    if (!devTestingCard) return;
    devTestingCard.onclick = (event) => {
      const button = event.target.closest("[data-dev-test-scenario]");
      if (!button) return;
      const scenarioKey = button.dataset.devTestScenario;
      runScenario(scenarioLabels[scenarioKey] || scenarioKey, scenarios[scenarioKey]);
    };
  }

  function dispose() {
    if (devTestingFab) devTestingFab.onclick = null;
    if (devTestingCard) devTestingCard.onclick = null;
  }

  return {
    bindEvents,
    dispose,
    render,
    showView,
  };
}
