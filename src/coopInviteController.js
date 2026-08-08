import {
  escapeHtml,
  friendMeta,
  friendRow,
} from "./socialUi.js";

export function createCoopInviteController({
  apiJson,
  elements,
  getAuthInfo,
  getRoomId,
  getJoinedUserIds,
}) {
  const { inviteMessageEl, inviteListEl } = elements;
  const state = {
    loading: false,
    error: "",
    friends: [],
    inviteStatuses: new Map(),
    sent: new Set(),
    busyKey: "",
  };

  function statusForFriend(friendId) {
    return state.inviteStatuses.get(friendId) || (state.sent.has(friendId) ? "pending" : "");
  }

  function renderInviteFriends() {
    inviteMessageEl.textContent = state.error;
    inviteMessageEl.className = `friend-message${state.error ? " visible" : ""}`;

    if (!getAuthInfo().user) {
      inviteListEl.innerHTML = `
        <div class="empty-state friend-empty">
          <div>
            <strong>Sign in to invite friends</strong>
            <span>Co-op rooms are connected to your account.</span>
          </div>
        </div>
      `;
      return;
    }

    if (state.loading) {
      inviteListEl.innerHTML = `<div class="empty-state friend-empty">Loading friends...</div>`;
      return;
    }

    const joinedUserIds = getJoinedUserIds();
    const friends = state.friends.filter(friend => {
      const status = statusForFriend(friend.id);
      return !joinedUserIds.has(friend.id) && status !== "accepted";
    });
    inviteListEl.innerHTML = friends.map(friend => {
      const sent = statusForFriend(friend.id) === "pending";
      const busy = state.busyKey === friend.id;
      return friendRow(
        friend,
        sent ? "Invite sent" : friendMeta(friend),
        `<button class="sm-btn ${sent ? "" : "primary-mini"}" type="button" data-coop-invite-user-id="${escapeHtml(friend.id)}" ${sent || busy ? "disabled" : ""}>${busy ? "Sending..." : sent ? "Sent" : "Invite"}</button>`
      );
    }).join("") || `
      <div class="empty-state friend-empty">
        <div>
          <strong>No friends to invite</strong>
          <span>Add friends first, then invite them here.</span>
        </div>
      </div>
    `;
  }

  async function loadFriends({ silent = false } = {}) {
    const roomId = getRoomId();
    if (!getAuthInfo().user || !roomId) {
      renderInviteFriends();
      return;
    }
    state.loading = !silent;
    state.error = "";
    renderInviteFriends();
    try {
      const [friendsPayload, invitesPayload] = await Promise.all([
        apiJson("/api/friends"),
        apiJson(`/api/coop/rooms/${encodeURIComponent(roomId)}/invites`),
      ]);
      state.friends = friendsPayload.friends || [];
      state.inviteStatuses = new Map((invitesPayload.invites || []).map(invite => [invite.userId, invite.status]));
      state.sent = new Set((invitesPayload.invites || [])
        .filter(invite => invite.status === "pending")
        .map(invite => invite.userId));
    } catch (err) {
      state.error = err.message;
      state.friends = [];
      state.inviteStatuses = new Map();
    } finally {
      state.loading = false;
      renderInviteFriends();
    }
  }

  async function sendInvite(userId) {
    const roomId = getRoomId();
    if (!roomId || !userId) return;
    state.busyKey = userId;
    state.error = "";
    renderInviteFriends();
    try {
      await apiJson("/api/coop/invites", {
        method: "POST",
        body: JSON.stringify({ roomId, userId }),
      });
      state.sent.add(userId);
    } catch (err) {
      state.error = err.message;
    } finally {
      state.busyKey = "";
      renderInviteFriends();
    }
  }

  function clearSent() {
    state.sent.clear();
    state.inviteStatuses.clear();
  }

  function shouldLoadFriends() {
    return (!state.friends.length || state.sent.size > 0) && !state.loading;
  }

  return {
    clearSent,
    loadFriends,
    renderInviteFriends,
    sendInvite,
    shouldLoadFriends,
  };
}
