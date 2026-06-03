export function createOpponentSelectionController({
  elements,
  opponents,
  readProgress,
  getCoopMaxUnlocked,
  getReadonly,
  getSetupMode,
  onSelected,
  onHostStrengthChange,
}) {
  const { strengthSlider, strengthVal, soloStartBtn } = elements;
  const opponentCards = Array.from(document.querySelectorAll("[data-opponent-strength]"));
  const soloStartButton = () => typeof soloStartBtn === "function" ? soloStartBtn() : soloStartBtn;

  function opponentForStrength(value) {
    return opponents.find(opponent => opponent.elo === parseInt(value, 10));
  }

  function themeForStrength(value) {
    return opponentForStrength(value)?.theme || "snib";
  }

  function getElo() {
    return parseInt(strengthSlider.value);
  }

  function updateSelection(value) {
    opponentCards.forEach(card => {
      const selected = card.dataset.opponentStrength === String(value);
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function clearSelection() {
    opponentCards.forEach(card => {
      card.classList.remove("selected");
      card.setAttribute("aria-pressed", "false");
    });
    if (soloStartButton()) soloStartButton().disabled = true;
  }

  function syncStrength(value) {
    strengthSlider.value = value;
    strengthVal.textContent = value;
    const opponent = opponentForStrength(value);
    if (opponent) {
      onSelected({
        index: opponents.indexOf(opponent),
        theme: opponent.theme,
      });
    } else {
      onSelected({
        theme: themeForStrength(value),
      });
    }
  }

  function applyLocks() {
    const unlockedOpponentCount = getSetupMode() === "coop"
      ? Math.max(readProgress(), getCoopMaxUnlocked())
      : readProgress();
    opponentCards.forEach((card, index) => {
      const unlocked = index < unlockedOpponentCount;
      const readonly = getReadonly();
      const disabled = !unlocked || readonly;
      const art = card.querySelector(".opponent-card-art");
      card.disabled = disabled;
      card.classList.toggle("locked", !unlocked);
      card.classList.toggle("readonly", unlocked && readonly);
      card.setAttribute("aria-disabled", disabled ? "true" : "false");
      if (art) art.src = unlocked ? card.dataset.unlockedSrc : "/assets/cards/locked_card.png";
    });
    return unlockedOpponentCount;
  }

  function bindCards() {
    opponentCards.forEach(card => {
      card.onclick = () => {
        if (getReadonly() || card.disabled || card.classList.contains("locked")) return;
        syncStrength(card.dataset.opponentStrength);
        onSelected({
          index: Number(card.dataset.opponentIndex || 0),
          theme: card.dataset.opponentTheme || themeForStrength(card.dataset.opponentStrength),
        });
        updateSelection(card.dataset.opponentStrength);
        if (soloStartButton()) soloStartButton().disabled = false;
        onHostStrengthChange?.(getElo());
      };
    });
  }

  strengthSlider.oninput = () => syncStrength(strengthSlider.value);

  return {
    applyLocks,
    bindCards,
    clearSelection,
    currentOpponent: (selectedIndex) => opponentForStrength(getElo()) || opponents[selectedIndex] || opponents[0],
    getElo,
    opponentForStrength,
    syncStrength,
    themeForStrength,
    updateSelection,
  };
}
