export function createGameStatusController({
  element,
  getCoop,
  getCurrentOpponent,
  getMaiaReady,
}) {
  function set(text, cls = "") {
    element.textContent = text;
    element.className = cls;
  }

  function setCoopTurn() {
    const coop = getCoop();
    if (!coop || coop.phase !== "playing") return;
    if (coop.activeIdx === coop.myIdx && !coop.midTurn) {
      const ready = getMaiaReady();
      set(ready ? "Your turn" : "Preparing game...", ready ? "" : "thinking");
      return;
    }

    if (coop.midTurn) {
      const opponentName = getCurrentOpponent()?.shortName || "Opponent";
      set(`${opponentName}'s turn`, "thinking");
      return;
    }

    const activePlayer = coop.players?.[coop.activeIdx];
    set(`${activePlayer?.name || "Player"}'s turn`);
  }

  return {
    set,
    setCoopTurn,
  };
}
