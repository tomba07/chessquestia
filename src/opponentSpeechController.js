import {
  opponentEmotionPortrait,
  opponentReactionLines,
  randomLine,
} from "./opponentReactions.js";

export function createOpponentSpeechController({
  elements,
  getCurrentOpponent,
  isCurrentSideInCheck,
}) {
  const {
    speechEl,
    portraitEl,
    nameEl,
    textEl,
    closeBtn,
  } = elements;

  let speechTimer = null;
  let wordTimer = null;
  let animationFrame = null;
  let hideTimer = null;
  let delayTimer = null;
  let botTurnsSinceMessage = 0;
  let nextThinkingAfterTurns = 3 + Math.floor(Math.random() * 3);

  function clearTimers() {
    if (speechTimer) window.clearTimeout(speechTimer);
    if (wordTimer) window.clearInterval(wordTimer);
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    if (hideTimer) window.clearTimeout(hideTimer);
    if (delayTimer) window.clearTimeout(delayTimer);
    speechTimer = null;
    wordTimer = null;
    animationFrame = null;
    hideTimer = null;
    delayTimer = null;
  }

  function hide() {
    clearTimers();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (speechEl.hidden || reduceMotion) {
      speechEl.hidden = true;
      speechEl.classList.remove("visible");
      speechEl.classList.remove("foreground");
      return;
    }
    speechEl.classList.remove("visible");
    hideTimer = window.setTimeout(() => {
      hideTimer = null;
      speechEl.hidden = true;
      speechEl.classList.remove("foreground");
    }, 480);
  }

  function revealText(text, wordDelay = 82) {
    if (wordTimer) window.clearInterval(wordTimer);
    wordTimer = null;
    const fullText = String(text || "");
    const words = fullText.trim().split(/\s+/).filter(Boolean);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!words.length || reduceMotion) {
      textEl.textContent = fullText;
      return 0;
    }
    let index = 0;
    textEl.textContent = "";
    wordTimer = window.setInterval(() => {
      index += 1;
      textEl.textContent = words.slice(0, index).join(" ");
      if (index >= words.length) {
        window.clearInterval(wordTimer);
        wordTimer = null;
      }
    }, wordDelay);
    return words.length * wordDelay;
  }

  function showSpeech({
    name,
    text,
    portrait = "/assets/bots/snib_talk.png",
    duration = 5600,
    foreground = false,
    sticky = true,
  }) {
    clearTimers();
    portraitEl.src = portrait;
    nameEl.textContent = name;
    textEl.textContent = "";
    speechEl.classList.remove("visible");
    speechEl.classList.toggle("foreground", foreground);
    speechEl.hidden = false;
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = null;
      speechEl.classList.add("visible");
    });
    const revealDuration = revealText(text);
    if (!sticky) {
      speechTimer = window.setTimeout(hide, Math.max(duration, revealDuration + 2400));
    }
  }

  function resetThinkingCadence() {
    botTurnsSinceMessage = 0;
    nextThinkingAfterTurns = 3 + Math.floor(Math.random() * 3);
  }

  function showReaction(emotion, {
    reaction = emotion,
    lines = null,
    duration = 2600,
    chance = 1,
    allowInterrupt = true,
    foreground = false,
    sticky = true,
  } = {}) {
    if (Math.random() > chance) return false;
    if (!allowInterrupt && !speechEl.hidden) return false;
    const opponent = getCurrentOpponent();
    const reactionLines = lines || opponentReactionLines(opponent, reaction);
    showSpeech({
      name: opponent.name,
      portrait: opponentEmotionPortrait(opponent, emotion),
      text: randomLine(reactionLines),
      duration,
      foreground,
      sticky,
    });
    resetThinkingCadence();
    return true;
  }

  function showThinkingReaction() {
    botTurnsSinceMessage += 1;
    if (botTurnsSinceMessage < nextThinkingAfterTurns) return false;
    return showReaction("thinking", {
      duration: 2400,
      allowInterrupt: true,
      sticky: false,
    });
  }

  function showEndgameReaction(playerWon, delay = 1900) {
    if (delayTimer) window.clearTimeout(delayTimer);
    delayTimer = window.setTimeout(() => {
      delayTimer = null;
      showReaction(playerWon ? "sad" : "win", {
        reaction: playerWon ? "playerVictory" : "botVictory",
        foreground: true,
        sticky: true,
      });
    }, delay);
  }

  function showPlayerMoveReaction(move) {
    if (isCurrentSideInCheck()) {
      showReaction("surprised", {
        reaction: "playerCheck",
        duration: 2400,
      });
    } else if (move?.captured) {
      showReaction(Math.random() < 0.55 ? "surprised" : "angry", {
        reaction: "playerCapture",
        duration: 2500,
      });
    }
  }

  function showBotMoveReaction(move) {
    if (isCurrentSideInCheck()) {
      showReaction("laughing", {
        reaction: "botCheck",
        duration: 2400,
        chance: 0.7,
      });
    } else if (move?.captured) {
      showReaction("laughing", {
        reaction: "botCapture",
        duration: 2500,
      });
    }
  }

  function showGameStartSpeech() {
    const opponent = getCurrentOpponent();
    const lines = opponent?.introLines || [];
    if (!opponent || !lines.length) {
      hide();
      return;
    }
    showSpeech({
      name: opponent.name,
      portrait: `/assets/bots/${opponent.talkPortrait || "snib_talk.png"}`,
      text: lines[Math.floor(Math.random() * lines.length)],
    });
    resetThinkingCadence();
  }

  function bindCloseButton() {
    closeBtn.onclick = () => hide();
  }

  return {
    bindCloseButton,
    clearTimers,
    hide,
    resetThinkingCadence,
    showBotMoveReaction,
    showEndgameReaction,
    showGameStartSpeech,
    showPlayerMoveReaction,
    showThinkingReaction,
  };
}
