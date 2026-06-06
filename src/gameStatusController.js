export function createGameStatusController({
  element,
  getCoop,
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

    const activePlayer = coop.players?.[coop.activeIdx];
    const activeName = activePlayer?.name || "Player";
    set(coop.midTurn ? `${activeName}: bot thinking...` : `${activeName}'s turn`, coop.midTurn ? "thinking" : "");
  }

  return {
    set,
    setCoopTurn,
  };
}
