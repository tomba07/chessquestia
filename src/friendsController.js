export function createFriendsController({
  apiJson,
  cleanUsername,
  elements,
  escapeHtml,
  friendMeta,
  friendRow,
  friendState,
  getAuthInfo,
  promptSignIn,
  renderFriendLink,
  renderInviteNotification,
}) {
  const {
    friendAddClose,
    friendAddDialog,
    friendAddMessage,
    friendListEl,
    friendMessage,
    friendRequestsEl,
    friendResultsEl,
    friendSearch,
    lbFriends,
    profileUsername,
    usernameHelp,
    usernameSaveBtn,
  } = elements;

  let searchTimer = null;

  function render() {
    const authInfo = getAuthInfo();
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
    friendRequestsEl.innerHTML = incomingHtml || outgoingHtml
      ? `<div class="friend-section-title">Requests</div>${incomingHtml}${outgoingHtml}`
      : "";

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

  async function load() {
    friendState.loading = true;
    friendState.error = "";
    render();
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
      render();
    }
  }

  async function search() {
    const query = friendState.searchQuery.trim();
    if (!query) {
      friendState.results = [];
      friendState.searching = false;
      render();
      return;
    }

    friendState.searching = true;
    friendState.error = "";
    render();
    try {
      const payload = await apiJson(`/api/friends/search?q=${encodeURIComponent(query)}`);
      friendState.results = payload.users || [];
    } catch (err) {
      friendState.error = err.message;
      friendState.results = [];
    } finally {
      friendState.searching = false;
      render();
    }
  }

  function openAddDialog() {
    const authInfo = getAuthInfo();
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    friendState.addDialogOpen = true;
    friendState.error = "";
    friendState.message = "";
    render();
    window.setTimeout(() => friendSearch.focus({ preventScroll: true }), 0);
  }

  function closeAddDialog({ render: shouldRender = true } = {}) {
    friendState.addDialogOpen = false;
    friendState.searchQuery = "";
    friendState.results = [];
    friendState.searching = false;
    friendState.message = "";
    friendSearch.value = "";
    window.clearTimeout(searchTimer);
    if (shouldRender) render();
  }

  async function runAction(key, action) {
    friendState.busyKey = key;
    friendState.error = "";
    friendState.message = "";
    render();
    try {
      await action();
      await load();
      if (friendState.searchQuery.trim()) await search();
    } catch (err) {
      friendState.error = err.message;
      render();
    } finally {
      friendState.busyKey = "";
      render();
    }
  }

  async function sendRequest(userId) {
    friendState.busyKey = `add:${userId}`;
    friendState.error = "";
    friendState.message = "";
    render();
    try {
      const payload = await apiJson("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      const result = friendState.results.find(user => user.id === userId);
      if (result) result.friendshipStatus = "outgoing_pending";
      friendState.message = payload.message || "Friend request sent.";
      render();
      await load();
      if (friendState.searchQuery.trim()) await search();
    } catch (err) {
      friendState.error = err.message;
      render();
    } finally {
      friendState.busyKey = "";
      render();
    }
  }

  function handleActionClick(event) {
    const button = event.target.closest("[data-friend-action]");
    if (!button) return;
    const action = button.dataset.friendAction;
    const userId = button.dataset.userId;
    const requestId = button.dataset.requestId;
    const inviteId = button.dataset.inviteId;
    const roomId = button.dataset.roomId;
    if (action === "add" && userId) {
      sendRequest(userId);
    } else if (action === "accept" && requestId) {
      runAction(`accept:${requestId}`, () => apiJson(`/api/friends/requests/${requestId}/accept`, { method: "POST" }));
    } else if (action === "decline" && requestId) {
      runAction(`decline:${requestId}`, () => apiJson(`/api/friends/requests/${requestId}/decline`, { method: "POST" }));
    } else if (action === "remove" && userId) {
      runAction(`remove:${userId}`, () => apiJson(`/api/friends/${encodeURIComponent(userId)}`, { method: "DELETE" }));
    } else if (action === "join-invite" && roomId) {
      location.href = `/?room=${encodeURIComponent(roomId)}`;
    } else if (action === "dismiss-invite" && inviteId) {
      runAction(`dismiss-invite:${inviteId}`, () => apiJson(`/api/coop/invites/${inviteId}/dismiss`, { method: "POST" }));
    } else if (action === "open-add") {
      openAddDialog();
    }
  }

  function bindEvents() {
    friendAddClose.onclick = () => closeAddDialog();
    friendAddDialog.addEventListener("click", (event) => {
      if (event.target === friendAddDialog) closeAddDialog();
    });
    friendAddDialog.addEventListener("click", handleActionClick);
    friendSearch.addEventListener("input", () => {
      friendSearch.value = cleanUsername(friendSearch.value);
      friendState.searchQuery = friendSearch.value;
      friendState.message = "";
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(search, 250);
      render();
    });
    friendSearch.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAddDialog();
    });
    lbFriends.addEventListener("click", handleActionClick);
  }

  return {
    bindEvents,
    closeAddDialog,
    load,
    render,
    runAction,
  };
}
