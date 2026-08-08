export function createAppEventController({
  appShell,
  bindBotSplashStartButton,
  chessnutBoard,
  coopInviteList,
  coopRoom,
  getCoop,
  getSetupMode,
  hideOutcomeBanner,
  leaveCoop,
  opponentSelection,
  outcomeScreen,
  promotionChoice,
  renderRoomLobby,
  reopenCoopLobby,
  sendCoopInvite,
  setCoopSelectingOpponent,
  setOpponentSelectionReadonly,
  setSelectedOpponent,
  setSetupMode,
  showLobby,
  showPlayView,
  soloBackBtn,
  soloGame,
  soloStartBtn,
  startCoopBotSelection,
  startCoopRoom,
  syncStrength,
  updateOpponentSelection,
  elements,
}) {
  function handleCoopInviteListClick(event) {
    const button = event.target.closest("[data-coop-invite-user-id]");
    if (!button) return;
    sendCoopInvite(button.dataset.coopInviteUserId);
  }

  function bind() {
    appShell.bindEvents({
      onStartDemo: () => soloGame.startDemo(),
      onStartSolo: () => {
        if (getCoop().phase !== "off") leaveCoop();
        appShell.showSoloSetup();
      },
      onConnectCoop: () => startCoopRoom(),
    });
    opponentSelection.bindCards();
    opponentSelection.applyLocks();
    opponentSelection.clearSelection();

    soloStartBtn.onclick = () => soloGame.startSelected();
    soloBackBtn.onclick = () => {
      const coop = getCoop();
      soloGame.clearPendingStart();
      if (getSetupMode() === "coop" && coop.phase === "lobby") {
        setOpponentSelectionReadonly(false);
        elements.lbSolo.classList.remove("readonly");
        setCoopSelectingOpponent(false);
        coopRoom.showRoomPanel();
        renderRoomLobby(coop.players || [], coop.myIdx);
        return;
      }
      showPlayView();
    };

    elements.cpStartBtn.onclick = () => startCoopBotSelection();
    elements.cpLeaveBtn.onclick = () => leaveCoop();
    coopInviteList.addEventListener("click", handleCoopInviteListClick);

    chessnutBoard.bind();
    elements.opponentSpeech.bindCloseButton();
    promotionChoice.bind();

    elements.backBtn.onclick = () => {
      if (!elements.confirmExitGame()) return;
      if (getCoop().phase !== "off") leaveCoop();
      else showLobby();
    };

    outcomeScreen.bindActions({
      onContinue: () => {
        hideOutcomeBanner();
        if (getCoop().phase !== "off") leaveCoop();
        else showLobby();
      },
      onChallenge: (opponentIndex) => {
        const opponent = elements.opponents[opponentIndex];
        if (!opponent) return;
        const coop = getCoop();
        hideOutcomeBanner();
        if (coop && coop.phase !== "off") {
          setSetupMode("coop");
          setOpponentSelectionReadonly(false);
          elements.lbSolo.classList.remove("readonly");
          reopenCoopLobby?.();
          return;
        }
        setSelectedOpponent(opponentIndex, opponent.theme);
        syncStrength(String(opponent.elo));
        updateOpponentSelection(String(opponent.elo));
        soloStartBtn.disabled = false;
        setSetupMode("solo");
        soloGame.start();
      },
    });
    bindBotSplashStartButton();
  }

  function dispose() {
    soloStartBtn.onclick = null;
    soloBackBtn.onclick = null;
    elements.cpStartBtn.onclick = null;
    elements.cpLeaveBtn.onclick = null;
    coopInviteList.removeEventListener("click", handleCoopInviteListClick);
    elements.backBtn.onclick = null;
  }

  return {
    bind,
    dispose,
  };
}
