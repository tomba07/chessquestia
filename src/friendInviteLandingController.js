export function createFriendInviteLandingController({
  apiJson,
  closeAddFriendDialog,
  elements,
  escapeHtml,
  friendAvatar,
  friendName,
  getAuthInfo,
  hideModelLoading,
  incomingFriendUsername,
  onAccepted,
  renderInviteNotification,
  setNavActive,
  showFriendsView,
}) {
  const {
    friendInviteLanding,
    lbAuth,
    lbFriendInvite,
    lbFriends,
    lbLeaderboard,
    lbMain,
    lbProfile,
    lbRoom,
    lbSolo,
  } = elements;

  const state = {
    loading: false,
    user: null,
    error: "",
    message: "",
    accepting: false,
    showLogin: false,
  };

  function render() {
    const authInfo = getAuthInfo();
    const invitedUser = state.user;
    const invitedName = invitedUser ? friendName(invitedUser) : incomingFriendUsername;
    const signedInAsTarget = !!(authInfo.user && invitedUser && authInfo.user.id === invitedUser.id);
    const devUsers = authInfo.devLoginUsers || [];

    if (state.loading) {
      friendInviteLanding.innerHTML = `<div class="empty-state friend-empty">Loading invite...</div>`;
      return;
    }

    if (state.error && !invitedUser) {
      friendInviteLanding.innerHTML = `
        <div class="friend-invite-preview">
          <div class="friend-invite-avatar"><span>?</span></div>
          <span>Invite unavailable</span>
          <h2>Friend link</h2>
          <p>${escapeHtml(state.error)}</p>
        </div>
        <div class="friend-invite-actions">
          <button class="sm-btn primary-mini" type="button" data-friend-invite-action="friends">Go to friends</button>
        </div>
      `;
      return;
    }

    if (!invitedUser) {
      friendInviteLanding.innerHTML = "";
      return;
    }

    const authActions = authInfo.authEnabled && !authInfo.user
      ? state.showLogin
        ? authInfo.localAuthEnabled && devUsers.length
          ? `
            <div class="friend-invite-dev-login">
              <span>Choose a player to accept as</span>
              <div class="dev-login-options">
                ${devUsers.map(user => `
                  <button class="sm-btn primary-mini" type="button" data-friend-invite-login-url="${escapeHtml(user.loginUrl)}">
                    ${escapeHtml(user.name)}
                  </button>
                `).join("")}
              </div>
            </div>
          `
          : `
            <button class="sm-btn primary-mini friend-invite-primary" type="button" data-friend-invite-action="signin">
              Sign in to accept
            </button>
          `
        : `
          <button class="sm-btn primary-mini friend-invite-primary" type="button" data-friend-invite-action="continue">
            Continue
          </button>
        `
      : `
        <button class="sm-btn primary-mini friend-invite-primary" type="button" data-friend-invite-action="accept" ${state.accepting || signedInAsTarget ? "disabled" : ""}>
          ${signedInAsTarget ? "This is your link" : state.accepting ? "Adding..." : "Accept friend request"}
        </button>
      `;

    friendInviteLanding.innerHTML = `
      <div class="friend-invite-preview">
        <div class="friend-invite-avatar">${friendAvatar(invitedUser)}</div>
        <span>Friend invite</span>
        <h2>${escapeHtml(invitedName)}</h2>
        <p>Add each other as friends on Chessquestia.</p>
      </div>
      ${state.message ? `<div class="friend-message visible">${escapeHtml(state.message)}</div>` : ""}
      ${state.error ? `<div class="friend-message visible">${escapeHtml(state.error)}</div>` : ""}
      <div class="friend-invite-actions">
        ${authActions}
        <button class="sm-btn" type="button" data-friend-invite-action="friends">Friends</button>
      </div>
    `;
  }

  function show() {
    setNavActive("friends");
    closeAddFriendDialog({ render: false });
    hideModelLoading();
    if (lbAuth) lbAuth.style.display = "none";
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbLeaderboard.style.display = "none";
    lbFriendInvite.style.display = "flex";
    render();
    renderInviteNotification();
  }

  async function load() {
    if (!incomingFriendUsername) return;
    Object.assign(state, {
      loading: true,
      user: null,
      error: "",
      message: "",
      accepting: false,
      showLogin: false,
    });
    show();
    try {
      const payload = await apiJson(`/api/friends/user/${encodeURIComponent(incomingFriendUsername)}`);
      state.user = payload.user || null;
    } catch (err) {
      state.error = err.message;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function accept() {
    const authInfo = getAuthInfo();
    if (!incomingFriendUsername) return;
    if (authInfo.authEnabled && !authInfo.user) {
      state.showLogin = true;
      render();
      return;
    }

    state.accepting = true;
    state.error = "";
    state.message = "";
    render();
    try {
      const payload = await apiJson(`/api/friends/user/${encodeURIComponent(incomingFriendUsername)}`, {
        method: "POST",
      });
      state.message = payload.message || `You are now friends with ${incomingFriendUsername}.`;
      history.replaceState(null, "", "/?view=friends");
      await onAccepted(state.message);
    } catch (err) {
      state.error = err.message;
      render();
    } finally {
      state.accepting = false;
      render();
    }
  }

  function bindEvents() {
    friendInviteLanding.addEventListener("click", (event) => {
      const loginButton = event.target.closest("[data-friend-invite-login-url]");
      const authInfo = getAuthInfo();
      if (loginButton) {
        location.href = loginButton.dataset.friendInviteLoginUrl;
        return;
      }

      const button = event.target.closest("[data-friend-invite-action]");
      if (!button) return;
      const action = button.dataset.friendInviteAction;
      if (action === "continue") {
        if (authInfo.localAuthEnabled && (authInfo.devLoginUsers || []).length) {
          state.showLogin = true;
          render();
        } else {
          location.href = authInfo.loginUrl;
        }
      } else if (action === "signin") {
        location.href = authInfo.loginUrl;
      } else if (action === "accept") {
        accept();
      } else if (action === "friends") {
        history.replaceState(null, "", "/?view=friends");
        showFriendsView();
      }
    });
  }

  return {
    bindEvents,
    load,
    render,
    show,
  };
}
