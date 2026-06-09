export function createSoloSessionController({
  storageKeys,
  opponentCount,
  getAuthInfo,
  getCoopPhase,
  getCurrentOpponent,
  getElo,
  getFen,
  getHistoryLength,
  getOpponentIndex,
  onProgressChanged,
}) {
  const {
    soloGameKey,
    legacySoloGameKey,
    soloProgressKey,
  } = storageKeys;

  const recordedGameIds = new Set();
  let active = false;
  let gameId = null;
  let demoActive = false;
  let debugActive = false;
  let gameStartedAt = null;
  let playerColor = "w";
  let unlockedOpponentCount = 1;
  let serverUnlockedOpponentCount = 1;

  function clampProgress(unlocked) {
    return Math.min(opponentCount, Math.max(1, Number(unlocked) || 1));
  }

  function readLocalProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(soloProgressKey) || "{}");
      return clampProgress(saved.unlocked || 1);
    } catch {
      return 1;
    }
  }

  function writeLocalProgress(unlocked) {
    localStorage.setItem(soloProgressKey, JSON.stringify({
      unlocked: clampProgress(unlocked),
      updatedAt: Date.now(),
    }));
  }

  function readProgress() {
    return Math.max(readLocalProgress(), serverUnlockedOpponentCount);
  }

  function updateServerProgress(unlocked) {
    if (!getAuthInfo().user) return;
    const nextUnlockedCount = clampProgress(unlocked);
    fetch("/api/solo-progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlockedOpponentCount: nextUnlockedCount }),
    })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const serverUnlocked = clampProgress(payload?.soloProgress?.unlockedOpponentCount || 1);
        serverUnlockedOpponentCount = Math.max(serverUnlockedOpponentCount, serverUnlocked);
        if (serverUnlockedOpponentCount > readLocalProgress())
          writeLocalProgress(serverUnlockedOpponentCount);
        onProgressChanged();
      })
      .catch(() => {});
  }

  function saveProgress() {
    writeLocalProgress(unlockedOpponentCount);
    updateServerProgress(unlockedOpponentCount);
  }

  function syncProgressFromAuth() {
    const authInfo = getAuthInfo();
    serverUnlockedOpponentCount = clampProgress(authInfo.soloProgress?.unlockedOpponentCount || 1);
    const localUnlocked = readLocalProgress();
    if (authInfo.user && localUnlocked > serverUnlockedOpponentCount) {
      serverUnlockedOpponentCount = localUnlocked;
      updateServerProgress(localUnlocked);
    } else if (serverUnlockedOpponentCount > localUnlocked) {
      writeLocalProgress(serverUnlockedOpponentCount);
    }
  }

  function unlockedCountForMode({ setupMode, coopMaxUnlocked = 1 }) {
    unlockedOpponentCount = setupMode === "coop"
      ? Math.max(readProgress(), coopMaxUnlocked)
      : readProgress();
    return unlockedOpponentCount;
  }

  function unlockNextOpponent() {
    if (demoActive) return false;
    const opponentIndex = Math.max(0, getOpponentIndex());
    if (opponentIndex + 1 >= opponentCount) return false;
    const nextUnlockedCount = opponentIndex + 2;
    unlockedOpponentCount = readProgress();
    if (unlockedOpponentCount >= nextUnlockedCount) return false;
    unlockedOpponentCount = nextUnlockedCount;
    saveProgress();
    onProgressChanged();
    return true;
  }

  function createGameId() {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function startGame({ demo = false, debug = false, playerColor: nextPlayerColor = "w" } = {}) {
    active = true;
    demoActive = demo;
    debugActive = debug;
    playerColor = nextPlayerColor === "b" ? "b" : "w";
    gameId = createGameId();
    gameStartedAt = Date.now();
  }

  function restoreSavedSession(state) {
    active = true;
    demoActive = false;
    debugActive = false;
    playerColor = state.playerColor === "b" ? "b" : "w";
    gameId = state.gameId || createGameId();
    gameStartedAt = Number(state.startedAt || state.savedAt || Date.now());
  }

  function saveGame({ opponentTheme, opponentIndex }) {
    if (!active || demoActive || getCoopPhase() !== "off") return;
    localStorage.setItem(soloGameKey, JSON.stringify({
      gameId,
      fen: getFen(),
      strength: getElo(),
      opponentTheme,
      opponentIndex,
      playerColor,
      startedAt: gameStartedAt,
      savedAt: Date.now(),
    }));
  }

  function readSavedGame() {
    const saved = localStorage.getItem(soloGameKey) || localStorage.getItem(legacySoloGameKey);
    if (!saved) return null;
    try {
      const state = JSON.parse(saved);
      return state?.fen ? state : null;
    } catch {
      clearGame();
      return null;
    }
  }

  function clearGame() {
    active = false;
    gameId = null;
    demoActive = false;
    debugActive = false;
    gameStartedAt = null;
    playerColor = "w";
    localStorage.removeItem(soloGameKey);
    localStorage.removeItem(legacySoloGameKey);
  }

  function recordResult(result) {
    if (!active || demoActive || debugActive || getCoopPhase() !== "off") return;
    gameId = gameId || createGameId();
    if (recordedGameIds.has(gameId)) return;
    recordedGameIds.add(gameId);
    const opponent = getCurrentOpponent();
    fetch("/api/game-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        mode: "solo",
        result,
        gameId,
        opponentStrength: getElo(),
        opponentKey: opponent?.theme || null,
        movesCount: getHistoryLength(),
        durationMs: gameStartedAt ? Math.max(0, Date.now() - gameStartedAt) : null,
        finalFen: getFen(),
      }),
    }).catch(() => {});
  }

  return {
    clearGame,
    get active() { return active; },
    get gameStartedAt() { return gameStartedAt; },
    get playerColor() { return playerColor; },
    readProgress,
    readSavedGame,
    recordResult,
    restoreSavedSession,
    saveGame,
    startGame,
    syncProgressFromAuth,
    unlockNextOpponent,
    unlockedCountForMode,
  };
}
