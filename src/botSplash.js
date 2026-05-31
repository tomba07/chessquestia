const START_FEN_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

export function createBotSplash({ elements, getCurrentOpponent }) {
  const {
    botSplashEl,
    botSplashArt,
    botSplashBanner,
    botSplashName,
    botSplashText,
    botSplashStrength,
    botSplashStart,
  } = elements;

  let botSplashResolve = null;
  let botSplashBeforeFade = null;
  let botSplashAutoTimer = null;
  let botSplashMode = null;

  function isMobileSplashViewport() {
    return window.matchMedia?.("(max-width: 860px), (orientation: portrait)")?.matches;
  }

  function splashImageForOpponent(opponent, mobile = isMobileSplashViewport()) {
    return `/assets/splash/${mobile ? "mobile/" : ""}${opponent?.theme || "snib"}_splash.png`;
  }

  function splashBannerImage(mobile = isMobileSplashViewport()) {
    return mobile ? "/assets/splash/mobile/splash_banner_mobile.png" : "/assets/splash/splash_banner.png";
  }

  function renderBotSplashStrength(rank = 1) {
    botSplashStrength.innerHTML = "";
    Array.from({ length: 5 }, (_, index) => {
      const icon = document.createElement("img");
      icon.src = "/assets/splash/splash_strength_icon.png";
      icon.alt = "";
      icon.className = index < rank ? "filled" : "";
      botSplashStrength.appendChild(icon);
    });
  }

  function isStartingCoopPosition(fen) {
    return String(fen || "").split(" ")[0] === START_FEN_POSITION;
  }

  function shouldAutoStartCoopSplash(msg) {
    return msg.phase === "playing"
      && msg.activeIdx === msg.myIdx
      && !msg.midTurn
      && !isStartingCoopPosition(msg.fen);
  }

  function clearBotSplashAutoTimer() {
    if (botSplashAutoTimer) window.clearTimeout(botSplashAutoTimer);
    botSplashAutoTimer = null;
  }

  function scheduleBotSplashAutoStart() {
    clearBotSplashAutoTimer();
    botSplashAutoTimer = window.setTimeout(() => {
      botSplashAutoTimer = null;
      hideBotSplash();
    }, 500);
  }

  function hideBotSplash() {
    if (!botSplashResolve) return;
    clearBotSplashAutoTimer();
    const beforeFade = botSplashBeforeFade;
    botSplashBeforeFade = null;
    botSplashMode = null;
    beforeFade?.();
    const resolve = botSplashResolve;
    botSplashResolve = null;
    botSplashEl.classList.remove("visible", "auto-start");
    botSplashEl.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      botSplashEl.hidden = true;
      resolve();
    }, 280);
  }

  function showBotSplash(opponent = getCurrentOpponent(), { beforeFade = null, mode = "solo", autoStart = false } = {}) {
    return new Promise(resolve => {
      if (!opponent || !botSplashEl) {
        beforeFade?.();
        resolve();
        return;
      }
      if (botSplashResolve) {
        const pendingBeforeFade = botSplashBeforeFade;
        botSplashBeforeFade = null;
        botSplashResolve();
        pendingBeforeFade?.();
        botSplashResolve = null;
      }
      clearBotSplashAutoTimer();
      botSplashBeforeFade = beforeFade;
      botSplashMode = mode;
      const mobileSplash = isMobileSplashViewport();
      botSplashArt.src = splashImageForOpponent(opponent, mobileSplash);
      botSplashBanner.src = splashBannerImage(mobileSplash);
      botSplashName.textContent = opponent.name;
      botSplashText.textContent = opponent.splashText || opponent.concept || "";
      renderBotSplashStrength(opponent.rank);
      botSplashEl.classList.toggle("auto-start", autoStart);
      botSplashStart.hidden = false;
      botSplashResolve = resolve;
      botSplashEl.hidden = false;
      botSplashEl.setAttribute("aria-hidden", "false");
      botSplashEl.getBoundingClientRect();
      botSplashEl.classList.add("visible");
      if (autoStart) scheduleBotSplashAutoStart();
      else botSplashStart.focus({ preventScroll: true });
    });
  }

  function maybeAutoStartCoopSplash(msg) {
    if (botSplashMode !== "coop" || !botSplashResolve || !shouldAutoStartCoopSplash(msg)) return;
    botSplashEl.classList.add("auto-start");
    scheduleBotSplashAutoStart();
  }

  function bindStartButton() {
    botSplashStart.onclick = () => hideBotSplash();
  }

  return {
    bindStartButton,
    clearBotSplashAutoTimer,
    hideBotSplash,
    maybeAutoStartCoopSplash,
    shouldAutoStartCoopSplash,
    showBotSplash,
  };
}
