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
    sent: new Set(),
    busyKey: "",
  };

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
    const friends = state.friends.filter(friend => !joinedUserIds.has(friend.id));
    inviteListEl.innerHTML = friends.map(friend => {
      const sent = state.sent.has(friend.id);
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

  async function loadFriends() {
    if (!getAuthInfo().user || !getRoomId()) {
      renderInviteFriends();
      return;
    }
    state.loading = true;
    state.error = "";
    renderInviteFriends();
    try {
      const payload = await apiJson("/api/friends");
      state.friends = payload.friends || [];
    } catch (err) {
      state.error = err.message;
      state.friends = [];
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
  }

  function shouldLoadFriends() {
    return !state.friends.length && !state.loading;
  }

  return {
    clearSent,
    loadFriends,
    renderInviteFriends,
    sendInvite,
    shouldLoadFriends,
  };
}
