import { createFriendInviteLandingController } from "./friendInviteLandingController.js";
import { createSocialRealtimeController } from "./socialRealtimeController.js";

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

function friendPictureUrl(picture) {
  if (!picture) return "";
  try {
    const url = new URL(picture, location.origin);
    if (url.protocol === "https:" && (
      url.hostname === "googleusercontent.com"
      || url.hostname.endsWith(".googleusercontent.com")
    )) {
      return `/api/avatar?url=${encodeURIComponent(url.href)}`;
    }
  } catch {
    return "";
  }
  return picture;
}

export function friendAvatar(person) {
  const name = friendName(person);
  const initial = `<span>${escapeHtml(name.charAt(0).toUpperCase() || "P")}</span>`;
  const picture = friendPictureUrl(person?.picture);
  if (!picture) return initial;
  return `${initial}<img src="${escapeHtml(picture)}" alt="" onerror="this.remove()">`;
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
    coopInviteTitle,
    coopInviteText,
    friendAddClose,
    friendAddDialog,
    friendAddMessage,
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
    notificationBadge,
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
    message: "",
    busyKey: "",
    addDialogOpen: false,
  };

  let friendSearchTimer = null;
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

  let socialRealtime = null;
  const renderInviteNotification = () => socialRealtime?.renderInviteNotification();

  function renderFriends() {
    const authInfo = auth();
    friendMessage.textContent = friendState.error;
    friendMessage.className = `friend-message${friendState.error ? " visible" : ""}`;
    friendAddMessage.textContent = friendState.message || friendState.error;
    friendAddMessage.className = `friend-message${friendState.message ? " visible success" : friendState.error ? " visible" : ""}`;
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
    const requestSection = incomingHtml || outgoingHtml
      ? `<div class="friend-section-title">Requests</div>${incomingHtml}${outgoingHtml}`
      : "";
    friendRequestsEl.innerHTML = requestSection;

    if (friendState.searchQuery.trim()) {
      const resultHtml = friendState.results.map(user => {
        let action = "";
        if (user.friendshipStatus === "friend") action = `<span class="friend-status-label">Friend</span>`;
        else if (user.friendshipStatus === "outgoing_pending") action = `<span class="friend-status-label">Pending</span>`;
        else if (user.friendshipStatus === "incoming_pending") action = `<span class="friend-status-label">Request received</span>`;
        else {
          const sending = friendState.busyKey === `add:${user.id}`;
          action = `<button class="sm-btn primary-mini" type="button" data-friend-action="add" data-user-id="${escapeHtml(user.id)}" ${sending ? "disabled" : ""}>${sending ? "Sending..." : "Add"}</button>`;
        }
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
    friendState.message = "";
    renderFriends();
    window.setTimeout(() => friendSearch.focus({ preventScroll: true }), 0);
  }

  function closeAddFriendDialog({ render = true } = {}) {
    friendState.addDialogOpen = false;
    friendState.searchQuery = "";
    friendState.results = [];
    friendState.searching = false;
    friendState.message = "";
    friendSearch.value = "";
    window.clearTimeout(friendSearchTimer);
    if (render) renderFriends();
  }

  async function runFriendAction(key, action) {
    friendState.busyKey = key;
    friendState.error = "";
    friendState.message = "";
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

  async function sendFriendRequest(userId) {
    friendState.busyKey = `add:${userId}`;
    friendState.error = "";
    friendState.message = "";
    renderFriends();
    try {
      const payload = await apiJson("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      const result = friendState.results.find(user => user.id === userId);
      if (result) result.friendshipStatus = "outgoing_pending";
      friendState.message = payload.message || "Friend request sent.";
      renderFriends();
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

  socialRealtime = createSocialRealtimeController({
    apiJson,
    elements: {
      coopInviteDismiss,
      coopInviteJoin,
      coopInviteNotice,
      coopInviteTitle,
      coopInviteText,
      lbAuth,
      lbFriendInvite,
      lbFriends,
      lbRoom,
      notificationBadge,
    },
    friendState,
    getAuthInfo,
    getCoopPhase,
    getPersonName: friendName,
    loadFriends,
    renderFriends,
    runFriendAction,
    showFriendsView,
  });
  const loadInviteNotifications = socialRealtime.loadInviteNotifications;
  const startPresenceHeartbeat = socialRealtime.startPresenceHeartbeat;
  const stopPresenceHeartbeat = socialRealtime.stopPresenceHeartbeat;

  const friendInviteLandingController = createFriendInviteLandingController({
    apiJson,
    closeAddFriendDialog,
    elements: {
      friendInviteLanding,
      lbAuth,
      lbFriendInvite,
      lbFriends,
      lbLeaderboard,
      lbMain,
      lbProfile,
      lbRoom,
      lbSolo,
    },
    escapeHtml,
    friendAvatar,
    friendName,
    getAuthInfo,
    hideModelLoading,
    incomingFriendUsername,
    onAccepted: async (message) => {
      friendState.error = message;
      await loadFriends();
      showFriendsView({ reload: false });
      friendState.error = message;
      renderFriends();
    },
    renderInviteNotification,
    setNavActive,
    showFriendsView,
  });
  const loadFriendInviteLanding = friendInviteLandingController.load;
  const showFriendInviteView = friendInviteLandingController.show;

  function handleFriendActionClick(event) {
    const button = event.target.closest("[data-friend-action]");
    if (!button) return;
    const action = button.dataset.friendAction;
    const userId = button.dataset.userId;
    const requestId = button.dataset.requestId;
    const inviteId = button.dataset.inviteId;
    const roomId = button.dataset.roomId;
    if (action === "add" && userId) {
      sendFriendRequest(userId);
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
    socialRealtime.bindEvents();
    friendAddClose.onclick = () => closeAddFriendDialog();
    friendAddDialog.addEventListener("click", (event) => {
      if (event.target === friendAddDialog) closeAddFriendDialog();
    });
    friendAddDialog.addEventListener("click", handleFriendActionClick);
    friendSearch.addEventListener("input", () => {
      friendSearch.value = cleanUsername(friendSearch.value);
      friendState.searchQuery = friendSearch.value;
      friendState.message = "";
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
    lbFriends.addEventListener("click", handleFriendActionClick);
    friendInviteLandingController.bindEvents();
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
