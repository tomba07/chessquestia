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
    navLeaderboard,
  } = elements;

  let opponentKey = opponents[0]?.theme || "snib";
  let metric = "fastest";
  let payload = null;
  let loading = false;
  let error = "";

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
    leaderboardOpponents.innerHTML = availableOpponents().map(opponent => `
      <button
        class="leaderboard-opponent${opponent.theme === opponentKey ? " active" : ""}"
        type="button"
        data-leaderboard-opponent="${opponent.theme}"
        aria-pressed="${opponent.theme === opponentKey}"
      >
        <span class="leaderboard-opponent-art-wrap" aria-hidden="true">
          <img src="/assets/bots/${opponent.talkPortrait}" alt="" />
        </span>
        <span>${opponent.shortName || opponent.name}</span>
      </button>
    `).join("");
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

    leaderboardList.innerHTML = rows.map(row => `
      <div class="leaderboard-row${row.isCurrentUser ? " current-user" : ""}">
        <strong class="leaderboard-rank">${row.rank}</strong>
        <span class="leaderboard-player">${escapeHtml(row.playerName)}</span>
        <span class="leaderboard-mode">${row.mode === "coop" ? "Co-op" : "Solo"}</span>
        <strong class="leaderboard-score">
          ${metric === "fastest" ? formatDuration(row.durationMs) : `${row.movesCount} moves`}
        </strong>
      </div>
    `).join("");
  }

  function render() {
    renderOpponentButtons();
    leaderboardMetric.querySelectorAll("[data-leaderboard-metric]").forEach(button => {
      const active = button.dataset.leaderboardMetric === metric;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    lbLeaderboard.querySelector("[data-leaderboard-title]").textContent = selectedOpponent()?.name || "Leaderboard";
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
