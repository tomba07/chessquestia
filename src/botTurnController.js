export function createBotTurnController({
  botMoveDelayMs,
  isBotThinking,
  isMyCoopBotTurn,
  onCoopBotMove,
}) {
  let coopBotTimer = null;

  function randomBetween(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }

  function nextBotMoveDelay() {
    return randomBetween(botMoveDelayMs.min, botMoveDelayMs.max);
  }

  function thinkingMoveDelay() {
    return randomBetween(1300, 2400);
  }

  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function clearCoopBotTimer() {
    if (!coopBotTimer) return;
    clearTimeout(coopBotTimer);
    coopBotTimer = null;
  }

  function scheduleCoopBotMove() {
    if (!isMyCoopBotTurn() || isBotThinking() || coopBotTimer) return;
    coopBotTimer = setTimeout(() => {
      coopBotTimer = null;
      onCoopBotMove();
    }, nextBotMoveDelay());
  }

  function dispose() {
    clearCoopBotTimer();
  }

  return {
    clearCoopBotTimer,
    dispose,
    nextBotMoveDelay,
    scheduleCoopBotMove,
    thinkingMoveDelay,
    wait,
  };
}
