export function createPromotionController({
  element,
  getLegalMoves,
  onPromotionChosen,
}) {
  let pendingPromotion = null;

  function promotionMoves(from, to) {
    return getLegalMoves()
      .filter(move => move.from === from && move.to === to && move.promotion);
  }

  function hide() {
    pendingPromotion = null;
    element.hidden = true;
    element.classList.remove("visible");
  }

  function show(from, to) {
    const moves = promotionMoves(from, to);
    if (!moves.length) return false;

    pendingPromotion = { from, to };
    const promotions = new Set(moves.map(move => move.promotion));
    element.querySelectorAll("[data-promotion]").forEach((button) => {
      button.disabled = !promotions.has(button.dataset.promotion);
    });
    element.hidden = false;
    element.classList.add("visible");
    return true;
  }

  function choose(promotion) {
    const pending = pendingPromotion;
    hide();
    if (!pending) return;
    onPromotionChosen(pending.from, pending.to, promotion);
  }

  function bind() {
    element.querySelectorAll("[data-promotion]").forEach((button) => {
      button.onclick = () => choose(button.dataset.promotion);
    });
  }

  function dispose() {
    element.querySelectorAll("[data-promotion]").forEach((button) => {
      button.onclick = null;
    });
  }

  return {
    bind,
    dispose,
    hasPending: () => !!pendingPromotion,
    hide,
    show,
  };
}
