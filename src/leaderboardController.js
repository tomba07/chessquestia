function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createLeaderboardController({
  apiJson,
  elements,
  getAuthInfo,
  getUnlockedOpponentCount,
  opponents,
  promptSignIn,
  setNavActive,
  setViewUrl,
}) {
  const {
    lbAuth,
    lbFriendInvite,
    lbFriends,
    lbLeaderboard,
    lbDevTesting,
    lbMain,
    lbProfile,
    lbRoom,
    lbSolo,
    leaderboardList,
    leaderboardMetric,
    leaderboardOpponents,
    achievementsStatsCard,
    achievementsTotalWins,
    achievementsDefeatedCount,
    navLeaderboard,
  } = elements;

  let opponentKey = opponents[0]?.theme || "snib";
  let metric = "fastest";
  let payload = null;
  let loading = false;
  let error = "";
  let defeatedOpponentKeys = new Set();
  let totalWins = null;
  let statsLoaded = false;
  let statsLoading = false;
  let statsError = "";

  function availableOpponents() {
    const unlockedCount = Math.max(1, Number(getUnlockedOpponentCount?.()) || 1);
    return opponents.slice(0, unlockedCount);
  }

  function normalizeOpponentKey() {
    const available = availableOpponents();
    if (!available.some(opponent => opponent.theme === opponentKey))
      opponentKey = available[0]?.theme || "snib";
  }

  function selectedOpponent() {
    const available = availableOpponents();
    return available.find(opponent => opponent.theme === opponentKey) || available[0];
  }

  function renderOpponentButtons() {
    normalizeOpponentKey();
    leaderboardOpponents.innerHTML = availableOpponents().map(opponent => {
      const active = opponent.theme === opponentKey;
      const defeated = defeatedOpponentKeys.has(opponent.theme);
      return `
      <button
        class="leaderboard-opponent${active ? " active" : ""}${defeated ? " defeated" : ""}"
        type="button"
        data-leaderboard-opponent="${opponent.theme}"
        aria-pressed="${active}"
      >
        <span class="leaderboard-opponent-art-wrap" aria-hidden="true">
          <img src="/assets/bots/${opponent.talkPortrait}" alt="" />
        </span>
        <span class="leaderboard-opponent-name">${opponent.shortName || opponent.name}</span>
        <span class="leaderboard-opponent-badges">
          <span class="leaderboard-opponent-badge${defeated ? "" : " muted"}">${defeated ? "Defeated" : "Not defeated"}</span>
        </span>
      </button>
    `;
    }).join("");
  }

  function renderAchievementStats() {
    if (!achievementsStatsCard || !achievementsTotalWins) return;
    const value = statsLoading
      ? "..."
      : statsError
        ? "-"
        : String(totalWins ?? 0);
    achievementsTotalWins.textContent = value;
    if (achievementsDefeatedCount) {
      achievementsDefeatedCount.textContent = statsLoading
        ? "..."
        : statsError
          ? "-"
          : String(defeatedOpponentKeys.size);
    }
    achievementsStatsCard.classList.toggle("is-loading", statsLoading);
    achievementsStatsCard.classList.toggle("has-error", !!statsError);
  }

  function renderRows() {
    const rows = metric === "fastest" ? payload?.fastest : payload?.fewestMoves;
    if (loading) {
      leaderboardList.innerHTML = `<div class="leaderboard-empty">Loading rankings...</div>`;
      return;
    }
    if (error) {
      leaderboardList.innerHTML = `<div class="leaderboard-empty">${error}</div>`;
      return;
    }
    if (!rows?.length) {
      leaderboardList.innerHTML = `<div class="leaderboard-empty">No victories recorded yet.</div>`;
      return;
    }

    leaderboardList.innerHTML = rows.map(row => {
      const playerName = row.playerName || "Player";
      const playerInitial = String(playerName).trim().charAt(0).toUpperCase() || "?";
      const topRank = Number(row.rank) === 1;
      return `
      <div class="leaderboard-row${row.isCurrentUser ? " current-user" : ""}${topRank ? " top-rank" : ""}">
        <span class="leaderboard-rank-cell"><strong class="leaderboard-rank">${row.rank}</strong></span>
        <span class="leaderboard-player-cell">
          <span class="leaderboard-player-avatar" aria-hidden="true">${escapeHtml(playerInitial)}</span>
          <span class="leaderboard-player">${escapeHtml(playerName)}</span>
        </span>
        <span class="leaderboard-mode">${row.mode === "coop" ? "Co-op" : "Solo"}</span>
        <strong class="leaderboard-score">
          ${metric === "fastest" ? formatDuration(row.durationMs) : `${row.movesCount} moves`}
        </strong>
      </div>
    `;
    }).join("");
  }

  function render() {
    renderAchievementStats();
    renderOpponentButtons();
    leaderboardMetric.querySelectorAll("[data-leaderboard-metric]").forEach(button => {
      const active = button.dataset.leaderboardMetric === metric;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const title = lbLeaderboard.querySelector("[data-leaderboard-title]");
    if (title) title.textContent = selectedOpponent()?.name || "Leaderboard";
    const scoreHead = lbLeaderboard.querySelector("[data-leaderboard-score-head]");
    if (scoreHead) scoreHead.textContent = metric === "fastest" ? "Time" : "Moves";
    renderRows();
  }

  async function load() {
    normalizeOpponentKey();
    loading = true;
    error = "";
    render();
    try {
      payload = await apiJson(`/api/leaderboards?opponent=${encodeURIComponent(opponentKey)}`);
    } catch (err) {
      payload = null;
      error = err.message || "Could not load rankings.";
    } finally {
      loading = false;
      render();
    }
  }

  async function loadStats({ force = false } = {}) {
    if (statsLoading || (statsLoaded && !force)) return;
    statsLoading = true;
    statsError = "";
    renderAchievementStats();
    try {
      const stats = await apiJson("/api/game-results/stats");
      const defeatedOpponents = Array.isArray(stats?.summary?.defeatedOpponents)
        ? stats.summary.defeatedOpponents
        : [];
      defeatedOpponentKeys = new Set(defeatedOpponents.map(result => result.opponentKey).filter(Boolean));
      totalWins = Number(stats?.summary?.totalWins || 0);
      statsLoaded = true;
    } catch (err) {
      defeatedOpponentKeys = new Set();
      totalWins = null;
      statsError = err.message || "Could not load stats.";
    } finally {
      statsLoading = false;
      renderAchievementStats();
      renderOpponentButtons();
    }
  }

  function hideOtherSections() {
    [lbAuth, lbFriendInvite, lbFriends, lbLeaderboard, lbDevTesting, lbMain, lbProfile, lbRoom, lbSolo]
      .filter(Boolean)
      .forEach(section => { section.style.display = "none"; });
  }

  function show() {
    const authInfo = getAuthInfo();
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    setViewUrl("leaderboard");
    setNavActive("leaderboard");
    hideOtherSections();
    lbLeaderboard.style.display = "flex";
    loadStats({ force: true });
    load();
  }

  function handleOpponentClick(event) {
    const button = event.target.closest("[data-leaderboard-opponent]");
    if (!button || button.dataset.leaderboardOpponent === opponentKey) return;
    opponentKey = button.dataset.leaderboardOpponent;
    load();
  }

  function handleMetricClick(event) {
    const button = event.target.closest("[data-leaderboard-metric]");
    if (!button || button.dataset.leaderboardMetric === metric) return;
    metric = button.dataset.leaderboardMetric;
    render();
  }

  function bind() {
    navLeaderboard.onclick = show;
    leaderboardOpponents.addEventListener("click", handleOpponentClick);
    leaderboardMetric.addEventListener("click", handleMetricClick);
  }

  function dispose() {
    navLeaderboard.onclick = null;
    leaderboardOpponents.removeEventListener("click", handleOpponentClick);
    leaderboardMetric.removeEventListener("click", handleMetricClick);
  }

  return {
    bind,
    dispose,
    show,
  };
}
