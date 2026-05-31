import { escapeHtml } from "./socialUi.js";

export function defaultAuthInfo() {
  return {
    authEnabled: false,
    user: null,
    soloProgress: { unlockedOpponentCount: 1 },
    loginUrl: "/auth/google",
    logoutUrl: "/auth/logout",
  };
}

export async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

export function createAppShellController({
  elements,
  searchParams,
  getAuthInfo,
  setAuthInfo,
  onAuthLoaded,
  closeAddFriendDialog,
  renderInviteNotification,
  getPendingSoloStart,
  hideModelLoading,
  setSetupMode,
  setOpponentSelectionReadonly,
  applyOpponentLocks,
  updateOpponentSelection,
  clearOpponentSelection,
  getElo,
}) {
  const {
    authBar,
    authBtn,
    authDemoBtn,
    authDevLoginCard,
    authDevLoginOptions,
    authLabel,
    authPrimaryBtn,
    botSelectTitle,
    devLoginCard,
    devLoginOptions,
    lbAuth,
    lbFriendInvite,
    lbFriends,
    lbMain,
    lbProfile,
    lbRoom,
    lbSolo,
    lobbyEl,
    navFriends,
    navPlay,
    navProfile,
    playCoopBtn,
    playSoloBtn,
    profileAccountCard,
    profileAccountName,
    profileAuthBtn,
    soloStartBtn,
    welcomeName,
  } = elements;

  const currentNextPath = () => location.pathname + location.search;

  function nextAfterAuth() {
    const next = searchParams.get("next");
    if (next?.startsWith("/")) return next;
    return searchParams.get("auth") === "login" ? "/" : currentNextPath();
  }

  function setNavActive(target) {
    navPlay.classList.toggle("active", target === "play");
    navProfile.classList.toggle("active", target === "profile");
    navFriends.classList.toggle("active", target === "friends");
  }

  function setAuthLayout(active) {
    lobbyEl.classList.toggle("auth-mode", active);
  }

  function setViewUrl(view) {
    if (location.search.includes("room=")) return;
    const target = view === "play" ? "/" : `/?view=${view}`;
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  function setSoloGameUrl() {
    if (location.search.includes("room=")) return;
    const target = "/?game=solo";
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  function setDemoGameUrl() {
    if (location.search.includes("room=")) return;
    const target = "/?demo=snib";
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  function hideLobbySections() {
    lbAuth.style.display = "none";
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbFriendInvite.style.display = "none";
  }

  function showPlayView() {
    setAuthLayout(false);
    setViewUrl("play");
    setNavActive("play");
    closeAddFriendDialog({ render: false });
    if (!getPendingSoloStart()) hideModelLoading();
    hideLobbySections();
    lbMain.style.display = "flex";
    renderInviteNotification();
  }

  function showBotSelection(mode = "solo", { readonly = false } = {}) {
    setAuthLayout(false);
    setViewUrl(mode);
    setSetupMode(mode);
    setOpponentSelectionReadonly(readonly);
    closeAddFriendDialog({ render: false });
    setNavActive("play");
    lbSolo.classList.toggle("readonly", readonly);
    applyOpponentLocks();
    if (readonly) updateOpponentSelection(getElo());
    else clearOpponentSelection();
    botSelectTitle.textContent = readonly ? "Opponent selected" : "Choose your opponent";
    soloStartBtn.querySelector("span").textContent = readonly
      ? "Waiting for host"
      : mode === "coop" ? "Start" : "Continue";
    if (readonly) soloStartBtn.disabled = true;
    hideLobbySections();
    lbSolo.style.display = "flex";
    renderInviteNotification();
  }

  function setAuthViewUrl() {
    if (location.search.includes("room=")) return;
    const next = searchParams.get("next");
    const target = next ? `/?auth=login&next=${encodeURIComponent(next)}` : "/?auth=login";
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  function showAuthView() {
    setAuthLayout(true);
    setAuthViewUrl();
    setNavActive("");
    closeAddFriendDialog({ render: false });
    if (!getPendingSoloStart()) hideModelLoading();
    hideLobbySections();
    lbAuth.style.display = "flex";
    renderInviteNotification();
  }

  function showSoloSetup() {
    showBotSelection("solo");
  }

  function showCoopBotSelection({ readonly = false } = {}) {
    showBotSelection("coop", { readonly });
  }

  function promptSignIn() {
    showAuthView();
  }

  function renderDevLogin() {
    const authInfo = getAuthInfo();
    const users = authInfo.devLoginUsers || [];
    const canShow = authInfo.localAuthEnabled && !authInfo.user && users.length > 0;
    const loginButtons = canShow
      ? users.map(user => `
        <button class="sm-btn primary-mini" type="button" data-dev-login-url="${escapeHtml(user.loginUrl)}">
          ${escapeHtml(user.name)}
        </button>
      `).join("")
      : "";
    devLoginCard.style.display = canShow ? "flex" : "none";
    authDevLoginCard.style.display = canShow ? "flex" : "none";
    devLoginOptions.innerHTML = loginButtons;
    authDevLoginOptions.innerHTML = loginButtons;
  }

  async function loadAuth() {
    let authInfo;
    try {
      authInfo = await fetch(`/api/me?next=${encodeURIComponent(nextAfterAuth())}`).then(r => r.json());
    } catch {
      authInfo = defaultAuthInfo();
    }
    setAuthInfo(authInfo);
    onAuthLoaded();

    if (!authInfo.authEnabled) {
      authBar.style.display = "none";
      profileAccountCard.style.display = "none";
      authDevLoginCard.style.display = "none";
      renderDevLogin();
      return;
    }

    authBar.style.display = "none";
    profileAccountCard.style.display = "flex";
    renderDevLogin();
    if (authInfo.user) {
      const accountName = authInfo.user.name || authInfo.user.email || "Signed in";
      authLabel.textContent = accountName;
      profileAccountName.textContent = accountName;
      welcomeName.textContent = authInfo.user.username || authInfo.user.name || "Wanderer";
      authBtn.textContent = "Sign out";
      authBtn.onclick = () => { location.href = authInfo.logoutUrl; };
      profileAuthBtn.textContent = "Sign out";
      profileAuthBtn.onclick = () => { location.href = authInfo.logoutUrl; };
    } else {
      authLabel.textContent = "Sign in to save games";
      authBtn.textContent = "Sign in";
      authBtn.onclick = () => { location.href = authInfo.loginUrl; };
      profileAccountName.textContent = "Not signed in";
      authPrimaryBtn.onclick = () => { location.href = authInfo.loginUrl; };
      profileAuthBtn.textContent = "Sign in";
      profileAuthBtn.onclick = () => { location.href = authInfo.loginUrl; };
    }
  }

  function isAuthRequired() {
    const authInfo = getAuthInfo();
    return authInfo.authEnabled && !authInfo.user;
  }

  function requireAuth(action) {
    if (isAuthRequired()) {
      promptSignIn();
      return;
    }
    action();
  }

  function bindDevLoginOptions(container) {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-dev-login-url]");
      if (!button) return;
      location.href = button.dataset.devLoginUrl;
    });
  }

  function bindEvents({ onStartDemo, onConnectCoop }) {
    navPlay.onclick = () => requireAuth(showPlayView);
    bindDevLoginOptions(devLoginOptions);
    bindDevLoginOptions(authDevLoginOptions);
    authDemoBtn.onclick = onStartDemo;
    playSoloBtn.onclick = () => requireAuth(showSoloSetup);
    playCoopBtn.onclick = () => requireAuth(() => onConnectCoop());
  }

  function setAuthUser(user) {
    const authInfo = getAuthInfo();
    setAuthInfo({ ...authInfo, user });
  }

  return {
    bindEvents,
    currentNextPath,
    getAuthInfo,
    loadAuth,
    promptSignIn,
    setAuthUser,
    setDemoGameUrl,
    setNavActive,
    setSoloGameUrl,
    setViewUrl,
    showAuthView,
    showCoopBotSelection,
    showPlayView,
    showSoloSetup,
  };
}
