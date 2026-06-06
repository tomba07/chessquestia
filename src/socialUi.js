export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[ch]));
}

export function friendName(person) {
  return person?.username || person?.name || person?.email || "Player";
}

export function friendMeta(person) {
  return person?.name || person?.email || "Chessquestia player";
}

export function friendAvatar(person) {
  const name = friendName(person);
  if (person?.picture) return `<img src="${escapeHtml(person.picture)}" alt="">`;
  return `<span>${escapeHtml(name.charAt(0).toUpperCase() || "P")}</span>`;
}

export function friendPresenceHtml(person) {
  const presence = person?.presence;
  if (!presence?.label) return "";
  const state = String(presence.state || "offline").replace(/[^a-z0-9_-]/g, "");
  return `<span class="friend-presence ${escapeHtml(state)}"><span class="friend-presence-dot"></span>${escapeHtml(presence.label)}</span>`;
}

export function friendRow(person, meta, actionHtml = "") {
  return `
    <article class="friend-card">
      <div class="friend-avatar">${friendAvatar(person)}</div>
      <div class="friend-card-body">
        <strong>${escapeHtml(friendName(person))}</strong>
        <div class="friend-card-meta">
          <span>${escapeHtml(meta || friendMeta(person))}</span>
          ${friendPresenceHtml(person)}
        </div>
      </div>
      ${actionHtml}
    </article>
  `;
}

function cleanUsername(value) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 20);
}

export function createSocialController({
  apiJson,
  elements,
  getAuthInfo,
  setAuthUser,
  getCoopPhase,
  hideModelLoading,
  incomingFriendUsername,
  promptSignIn,
  setNavActive,
  setViewUrl,
}) {
  const {
    coopInviteDismiss,
    coopInviteJoin,
    coopInviteNotice,
    coopInviteText,
    friendAddClose,
    friendAddDialog,
    friendInviteLanding,
    friendInviteLink,
    friendLinkCopy,
    friendLinkShare,
    friendListEl,
    friendMessage,
    friendRequestsEl,
    friendResultsEl,
    friendSearch,
    lbAuth,
    lbFriendInvite,
    lbFriends,
    lbLeaderboard,
    lbMain,
    lbProfile,
    lbRoom,
    lbSolo,
    navFriends,
    navProfile,
    profileUsername,
    usernameHelp,
    usernameSaveBtn,
  } = elements;

  const friendState = {
    loaded: false,
    loading: false,
    searching: false,
    searchQuery: "",
    friends: [],
    incoming: [],
    outgoing: [],
    invites: [],
    results: [],
    error: "",
    busyKey: "",
    addDialogOpen: false,
  };

  const friendInviteLandingState = {
    loading: false,
    user: null,
    error: "",
    message: "",
    accepting: false,
    showLogin: false,
  };

  let friendSearchTimer = null;
  let presenceTimer = null;
  const auth = () => getAuthInfo();

  function friendInviteUrl() {
    const username = auth().user?.username;
    return username
      ? `${location.origin}/plsbemyfriend/${encodeURIComponent(username)}`
      : "";
  }

  function renderFriendLink() {
    const url = friendInviteUrl();
    friendInviteLink.value = url || "Choose a username first";
    friendInviteLink.disabled = !url;
    friendLinkCopy.disabled = !url;
    friendLinkShare.disabled = !url;
  }

  function activeInvite() {
    return friendState.invites[0] || null;
  }

  function renderInviteNotification() {
    const invite = activeInvite();
    const canShowNotice = !!invite
      && getCoopPhase() === "off"
      && lbFriends.style.display === "none"
      && lbFriendInvite.style.display === "none"
      && lbRoom.style.display === "none";
    coopInviteNotice.style.display = canShowNotice ? "flex" : "none";
    if (!invite) return;
    coopInviteText.textContent = `${friendName(invite.inviter)} invited you to play.`;
    coopInviteJoin.dataset.roomId = invite.roomId;
    coopInviteDismiss.dataset.inviteId = String(invite.id);
  }

  function renderFriends() {
    const authInfo = auth();
    friendMessage.textContent = friendState.error;
    friendMessage.className = `friend-message${friendState.error ? " visible" : ""}`;
    friendAddDialog.hidden = !friendState.addDialogOpen;
    renderInviteNotification();

    if (authInfo.authEnabled && !authInfo.user) {
      friendState.addDialogOpen = false;
      friendAddDialog.hidden = true;
      friendSearch.disabled = true;
      profileUsername.disabled = true;
      usernameSaveBtn.disabled = true;
      renderFriendLink();
      friendRequestsEl.innerHTML = "";
      friendResultsEl.innerHTML = "";
      friendState.invites = [];
      renderInviteNotification();
      friendListEl.innerHTML = `
        <div class="empty-state friend-empty">
          <div>
            <strong>Sign in to add friends</strong>
            <span>Friends are connected to your Google account.</span>
          </div>
        </div>
      `;
      return;
    }

    friendSearch.disabled = false;
    profileUsername.disabled = false;
    usernameSaveBtn.disabled = false;
    renderFriendLink();
    if (document.activeElement !== profileUsername)
      profileUsername.value = authInfo.user?.username || "";
    usernameHelp.textContent = authInfo.user?.username
      ? `Other players can find you as ${authInfo.user.username}.`
      : "Choose a username so other players can find you.";

    const inviteHtml = friendState.invites.map(invite => friendRow(
      invite.inviter,
      `Invited you to room ${invite.roomId}`,
      `<div class="friend-actions">
        <button class="sm-btn primary-mini" type="button" data-friend-action="join-invite" data-room-id="${escapeHtml(invite.roomId)}">Join</button>
        <button class="sm-btn" type="button" data-friend-action="dismiss-invite" data-invite-id="${invite.id}" ${friendState.busyKey === `dismiss-invite:${invite.id}` ? "disabled" : ""}>Dismiss</button>
      </div>`
    )).join("");

    const incomingHtml = friendState.incoming.map(request => friendRow(
      { name: request.name, email: request.email, picture: request.picture },
      "Wants to be friends",
      `<div class="friend-actions">
        <button class="sm-btn primary-mini" type="button" data-friend-action="accept" data-request-id="${request.id}" ${friendState.busyKey === `accept:${request.id}` ? "disabled" : ""}>Accept</button>
        <button class="sm-btn" type="button" data-friend-action="decline" data-request-id="${request.id}" ${friendState.busyKey === `decline:${request.id}` ? "disabled" : ""}>Decline</button>
      </div>`
    )).join("");
    const outgoingHtml = friendState.outgoing.map(request => friendRow(
      { name: request.name, email: request.email, picture: request.picture },
      "Request sent",
      `<span class="friend-status-label">Pending</span>`
    )).join("");
    const inviteSection = inviteHtml
      ? `<div class="friend-section-title">Game invites</div>${inviteHtml}`
      : "";
    const requestSection = incomingHtml || outgoingHtml
      ? `<div class="friend-section-title">Requests</div>${incomingHtml}${outgoingHtml}`
      : "";
    friendRequestsEl.innerHTML = inviteSection || requestSection
      ? `${inviteSection}${requestSection}`
      : "";

    if (friendState.searchQuery.trim()) {
      const resultHtml = friendState.results.map(user => {
        let action = "";
        if (user.friendshipStatus === "friend") action = `<span class="friend-status-label">Friend</span>`;
        else if (user.friendshipStatus === "outgoing_pending") action = `<span class="friend-status-label">Sent</span>`;
        else if (user.friendshipStatus === "incoming_pending") action = `<span class="friend-status-label">Request received</span>`;
        else action = `<button class="sm-btn primary-mini" type="button" data-friend-action="add" data-user-id="${escapeHtml(user.id)}" ${friendState.busyKey === `add:${user.id}` ? "disabled" : ""}>Add</button>`;
        return friendRow(user, friendMeta(user), action);
      }).join("");
      friendResultsEl.innerHTML = `
        <div class="friend-section-title">Search results</div>
        ${friendState.searching ? `<div class="empty-state friend-empty">Searching...</div>` : resultHtml || `<div class="empty-state friend-empty">No players found.</div>`}
      `;
    } else {
      friendResultsEl.innerHTML = `<div class="empty-state friend-empty"><div><strong>Find a player</strong><span>Search by username to send a friend request.</span></div></div>`;
    }

    if (friendState.loading) {
      friendListEl.innerHTML = `
        <div class="friend-section-header">
          <div class="friend-section-title">Friends</div>
          <button class="sm-btn primary-mini friend-add-inline" type="button" data-friend-action="open-add">Add friend</button>
        </div>
        <div class="empty-state friend-empty">Loading friends...</div>
      `;
      return;
    }

    const friendsHtml = friendState.friends.map(friend => friendRow(
      friend,
      friendMeta(friend),
      `<button class="sm-btn" type="button" data-friend-action="remove" data-user-id="${escapeHtml(friend.id)}" ${friendState.busyKey === `remove:${friend.id}` ? "disabled" : ""}>Remove</button>`
    )).join("");
    friendListEl.innerHTML = `
      <div class="friend-section-header">
        <div class="friend-section-title">Friends</div>
        <button class="sm-btn primary-mini friend-add-inline" type="button" data-friend-action="open-add">Add friend</button>
      </div>
      ${friendsHtml || `<div class="empty-state friend-empty"><div><strong>No friends yet</strong><span>Search for someone who has signed in once.</span></div></div>`}
    `;
  }

  async function saveUsername() {
    const username = profileUsername.value.trim();
    usernameSaveBtn.disabled = true;
    usernameHelp.textContent = "Saving...";
    friendState.error = "";
    try {
      const payload = await apiJson("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ username }),
      });
      setAuthUser(payload.user);
      usernameHelp.textContent = `Saved as ${payload.user.username}.`;
      renderFriends();
    } catch (err) {
      usernameHelp.textContent = err.message;
    } finally {
      usernameSaveBtn.disabled = false;
    }
  }

  async function loadFriends() {
    friendState.loading = true;
    friendState.error = "";
    renderFriends();

    try {
      const [friendsPayload, requestsPayload, invitesPayload] = await Promise.all([
        apiJson("/api/friends"),
        apiJson("/api/friends/requests"),
        apiJson("/api/coop/invites"),
      ]);
      friendState.friends = friendsPayload.friends || [];
      friendState.incoming = requestsPayload.incoming || [];
      friendState.outgoing = requestsPayload.outgoing || [];
      friendState.invites = invitesPayload.invites || [];
      friendState.loaded = true;
      renderInviteNotification();
    } catch (err) {
      friendState.error = err.message;
      friendState.friends = [];
      friendState.incoming = [];
      friendState.outgoing = [];
      friendState.invites = [];
      renderInviteNotification();
    } finally {
      friendState.loading = false;
      renderFriends();
    }
  }

  async function loadInviteNotifications() {
    if (!auth().user) {
      friendState.invites = [];
      renderInviteNotification();
      return;
    }
    try {
      const payload = await apiJson("/api/coop/invites");
      friendState.invites = payload.invites || [];
    } catch {
      friendState.invites = [];
    }
    renderInviteNotification();
    if (lbFriends.style.display !== "none") renderFriends();
  }

  async function sendPresence({ refreshFriends = false } = {}) {
    if (!auth().user) return;
    try {
      await apiJson("/api/presence", { method: "POST" });
      if (refreshFriends && lbFriends.style.display !== "none" && !friendState.loading)
        await loadFriends();
    } catch {
      // Presence should never interrupt play.
    }
  }

  const handleVisibilityPresence = () => {
    if (document.visibilityState === "visible")
      sendPresence({ refreshFriends: true });
  };

  function startPresenceHeartbeat() {
    if (presenceTimer) return;
    sendPresence({ refreshFriends: true });
    presenceTimer = window.setInterval(() => sendPresence({ refreshFriends: true }), 20000);
    document.addEventListener("visibilitychange", handleVisibilityPresence);
  }

  function stopPresenceHeartbeat() {
    if (presenceTimer) window.clearInterval(presenceTimer);
    presenceTimer = null;
    document.removeEventListener("visibilitychange", handleVisibilityPresence);
  }

  async function searchFriends() {
    const query = friendState.searchQuery.trim();
    if (!query) {
      friendState.results = [];
      friendState.searching = false;
      renderFriends();
      return;
    }

    friendState.searching = true;
    friendState.error = "";
    renderFriends();
    try {
      const payload = await apiJson(`/api/friends/search?q=${encodeURIComponent(query)}`);
      friendState.results = payload.users || [];
    } catch (err) {
      friendState.error = err.message;
      friendState.results = [];
    } finally {
      friendState.searching = false;
      renderFriends();
    }
  }

  function openAddFriendDialog() {
    const authInfo = auth();
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    friendState.addDialogOpen = true;
    friendState.error = "";
    renderFriends();
    window.setTimeout(() => friendSearch.focus({ preventScroll: true }), 0);
  }

  function closeAddFriendDialog({ render = true } = {}) {
    friendState.addDialogOpen = false;
    friendState.searchQuery = "";
    friendState.results = [];
    friendState.searching = false;
    friendSearch.value = "";
    window.clearTimeout(friendSearchTimer);
    if (render) renderFriends();
  }

  async function runFriendAction(key, action) {
    friendState.busyKey = key;
    friendState.error = "";
    renderFriends();
    try {
      await action();
      await loadFriends();
      if (friendState.searchQuery.trim()) await searchFriends();
    } catch (err) {
      friendState.error = err.message;
      renderFriends();
    } finally {
      friendState.busyKey = "";
      renderFriends();
    }
  }

  function renderFriendInviteLanding() {
    const authInfo = auth();
    const state = friendInviteLandingState;
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

  function showFriendInviteView() {
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
    renderFriendInviteLanding();
    renderInviteNotification();
  }

  async function loadFriendInviteLanding() {
    if (!incomingFriendUsername) return;
    friendInviteLandingState.loading = true;
    friendInviteLandingState.error = "";
    friendInviteLandingState.message = "";
    friendInviteLandingState.user = null;
    friendInviteLandingState.accepting = false;
    friendInviteLandingState.showLogin = false;
    showFriendInviteView();
    try {
      const payload = await apiJson(`/api/friends/user/${encodeURIComponent(incomingFriendUsername)}`);
      friendInviteLandingState.user = payload.user || null;
    } catch (err) {
      friendInviteLandingState.error = err.message;
    } finally {
      friendInviteLandingState.loading = false;
      renderFriendInviteLanding();
    }
  }

  async function acceptFriendInvite() {
    const authInfo = auth();
    if (!incomingFriendUsername) return;
    if (authInfo.authEnabled && !authInfo.user) {
      friendInviteLandingState.showLogin = true;
      renderFriendInviteLanding();
      return;
    }

    friendInviteLandingState.accepting = true;
    friendInviteLandingState.error = "";
    friendInviteLandingState.message = "";
    renderFriendInviteLanding();
    try {
      const payload = await apiJson(`/api/friends/user/${encodeURIComponent(incomingFriendUsername)}`, {
        method: "POST",
      });
      friendInviteLandingState.message = payload.message || `You are now friends with ${incomingFriendUsername}.`;
      history.replaceState(null, "", "/?view=friends");
      friendState.error = friendInviteLandingState.message;
      await loadFriends();
      showFriendsView({ reload: false });
      friendState.error = friendInviteLandingState.message;
      renderFriends();
    } catch (err) {
      friendInviteLandingState.error = err.message;
      renderFriendInviteLanding();
    } finally {
      friendInviteLandingState.accepting = false;
      renderFriendInviteLanding();
    }
  }

  function showProfileView() {
    const authInfo = auth();
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    setViewUrl("profile");
    setNavActive("profile");
    closeAddFriendDialog({ render: false });
    hideModelLoading();
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "flex";
    lbFriends.style.display = "none";
    lbLeaderboard.style.display = "none";
    lbFriendInvite.style.display = "none";
    renderFriends();
    renderInviteNotification();
  }

  function showFriendsView({ reload = true } = {}) {
    const authInfo = auth();
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    setViewUrl("friends");
    setNavActive("friends");
    hideModelLoading();
    if (lbAuth) lbAuth.style.display = "none";
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "flex";
    lbLeaderboard.style.display = "none";
    lbFriendInvite.style.display = "none";
    if (reload && !friendState.loading) loadFriends();
    else renderFriends();
    renderInviteNotification();
  }

  function bindEvents() {
    navProfile.onclick = () => showProfileView();
    navFriends.onclick = () => showFriendsView();
    friendAddClose.onclick = () => closeAddFriendDialog();
    friendAddDialog.addEventListener("click", (event) => {
      if (event.target === friendAddDialog) closeAddFriendDialog();
    });
    friendSearch.addEventListener("input", () => {
      friendSearch.value = cleanUsername(friendSearch.value);
      friendState.searchQuery = friendSearch.value;
      window.clearTimeout(friendSearchTimer);
      friendSearchTimer = window.setTimeout(searchFriends, 250);
      renderFriends();
    });
    profileUsername.addEventListener("input", () => {
      profileUsername.value = cleanUsername(profileUsername.value);
    });
    profileUsername.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveUsername();
    });
    friendSearch.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAddFriendDialog();
    });
    usernameSaveBtn.onclick = () => saveUsername();
    friendLinkCopy.onclick = async () => {
      const url = friendInviteUrl();
      if (!url) return;
      await navigator.clipboard?.writeText(url);
      friendLinkCopy.textContent = "Copied";
      window.setTimeout(() => { friendLinkCopy.textContent = "Copy"; }, 1400);
    };
    friendLinkShare.onclick = async () => {
      const url = friendInviteUrl();
      if (!url) return;
      if (navigator.share) {
        await navigator.share({
          title: "Chessquestia",
          text: "Add me as a friend on Chessquestia.",
          url,
        });
      } else {
        friendLinkCopy.click();
      }
    };
    lbFriends.addEventListener("click", (event) => {
      const button = event.target.closest("[data-friend-action]");
      if (!button) return;
      const action = button.dataset.friendAction;
      const userId = button.dataset.userId;
      const requestId = button.dataset.requestId;
      const inviteId = button.dataset.inviteId;
      const roomId = button.dataset.roomId;
      if (action === "add" && userId) {
        runFriendAction(`add:${userId}`, () => apiJson("/api/friends/requests", {
          method: "POST",
          body: JSON.stringify({ userId }),
        }));
      } else if (action === "accept" && requestId) {
        runFriendAction(`accept:${requestId}`, () => apiJson(`/api/friends/requests/${requestId}/accept`, { method: "POST" }));
      } else if (action === "decline" && requestId) {
        runFriendAction(`decline:${requestId}`, () => apiJson(`/api/friends/requests/${requestId}/decline`, { method: "POST" }));
      } else if (action === "remove" && userId) {
        runFriendAction(`remove:${userId}`, () => apiJson(`/api/friends/${encodeURIComponent(userId)}`, { method: "DELETE" }));
      } else if (action === "join-invite" && roomId) {
        location.href = `/?room=${encodeURIComponent(roomId)}`;
      } else if (action === "dismiss-invite" && inviteId) {
        runFriendAction(`dismiss-invite:${inviteId}`, () => apiJson(`/api/coop/invites/${inviteId}/dismiss`, { method: "POST" }));
      } else if (action === "open-add") {
        openAddFriendDialog();
      }
    });
    friendInviteLanding.addEventListener("click", (event) => {
      const loginButton = event.target.closest("[data-friend-invite-login-url]");
      const authInfo = auth();
      if (loginButton) {
        location.href = loginButton.dataset.friendInviteLoginUrl;
        return;
      }

      const button = event.target.closest("[data-friend-invite-action]");
      if (!button) return;
      const action = button.dataset.friendInviteAction;
      if (action === "continue") {
        if (authInfo.localAuthEnabled && (authInfo.devLoginUsers || []).length) {
          friendInviteLandingState.showLogin = true;
          renderFriendInviteLanding();
        } else {
          location.href = authInfo.loginUrl;
        }
      } else if (action === "signin") {
        location.href = authInfo.loginUrl;
      } else if (action === "accept") {
        acceptFriendInvite();
      } else if (action === "friends") {
        history.replaceState(null, "", "/?view=friends");
        showFriendsView();
      }
    });
  }

  return {
    bindEvents,
    closeAddFriendDialog,
    friendMeta,
    friendRow,
    loadFriendInviteLanding,
    loadFriends,
    loadInviteNotifications,
    renderFriends,
    renderInviteNotification,
    runFriendAction,
    showFriendsView,
    showFriendInviteView,
    showProfileView,
    startPresenceHeartbeat,
    stopPresenceHeartbeat,
  };
}
