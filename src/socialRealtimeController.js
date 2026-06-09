export function createSocialRealtimeController({
  apiJson,
  elements,
  friendState,
  getAuthInfo,
  getCoopPhase,
  getPersonName,
  loadFriends,
  renderFriends,
  runFriendAction,
  showFriendsView,
}) {
  const {
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
  } = elements;

  let notificationSocket = null;
  let notificationReconnectTimer = null;
  let presenceTimer = null;
  const dismissedNotificationKeys = new Set();

  function notificationKey(notification) {
    return `${notification.type}:${notification.id}`;
  }

  function notifications() {
    return [
      ...friendState.invites.map(invite => ({
        type: "game",
        id: invite.id,
        createdAt: invite.createdAt,
        invite,
      })),
      ...friendState.incoming.map(request => ({
        type: "friend",
        id: request.id,
        createdAt: request.created_at,
        request,
      })),
    ].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }

  function activeNotification() {
    return notifications().find(notification => (
      !dismissedNotificationKeys.has(notificationKey(notification))
    )) || null;
  }

  function renderInviteNotification() {
    const allNotifications = notifications();
    const notification = activeNotification();
    notificationBadge.textContent = String(allNotifications.length);
    notificationBadge.hidden = allNotifications.length === 0;
    const canShowNotice = !!notification
      && getCoopPhase() === "off"
      && lbAuth.style.display === "none"
      && (lbFriends.style.display === "none" || notification.type === "game")
      && lbFriendInvite.style.display === "none"
      && lbRoom.style.display === "none";
    coopInviteNotice.style.display = canShowNotice ? "flex" : "none";
    coopInviteNotice.classList.toggle("is-visible", canShowNotice);
    lbFriends.classList.toggle(
      "has-game-invite-notice",
      canShowNotice && notification?.type === "game" && lbFriends.style.display !== "none",
    );
    if (!notification) return;

    coopInviteJoin.dataset.notificationType = notification.type;
    coopInviteDismiss.dataset.notificationType = notification.type;
    coopInviteJoin.dataset.notificationId = String(notification.id);
    coopInviteDismiss.dataset.notificationId = String(notification.id);
    if (notification.type === "game") {
      coopInviteTitle.textContent = "Game invite";
      coopInviteText.textContent = `${getPersonName(notification.invite.inviter)} invited you to play.`;
      coopInviteJoin.textContent = "Join";
      coopInviteDismiss.textContent = "Dismiss";
      coopInviteJoin.dataset.roomId = notification.invite.roomId;
      coopInviteDismiss.dataset.inviteId = String(notification.id);
      return;
    }

    coopInviteTitle.textContent = "Friend request";
    coopInviteText.textContent = `${getPersonName(notification.request)} wants to be friends.`;
    coopInviteJoin.textContent = "Review";
    coopInviteDismiss.textContent = "Later";
    delete coopInviteJoin.dataset.roomId;
    delete coopInviteDismiss.dataset.inviteId;
  }

  async function loadInviteNotifications() {
    if (!getAuthInfo().user) {
      friendState.incoming = [];
      friendState.invites = [];
      renderInviteNotification();
      return;
    }
    try {
      const payload = await apiJson("/api/notifications");
      friendState.incoming = payload.friendRequests || [];
      friendState.invites = payload.gameInvites || [];
    } catch {
      friendState.incoming = [];
      friendState.invites = [];
    }
    renderInviteNotification();
    if (lbFriends.style.display !== "none") renderFriends();
  }

  async function sendPresence({ refreshFriends = false } = {}) {
    if (!getAuthInfo().user) return;
    try {
      await apiJson("/api/presence", { method: "POST" });
      if (refreshFriends && lbFriends.style.display !== "none" && !friendState.loading)
        await loadFriends();
    } catch {
      // Presence should never interrupt play.
    }
  }

  function handleVisibilityPresence() {
    if (document.visibilityState === "visible")
      sendPresence({ refreshFriends: true });
  }

  function startNotificationStream() {
    if (!getAuthInfo().user || notificationSocket?.readyState <= WebSocket.OPEN) return;
    const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${wsProtocol}//${location.host}`);
    notificationSocket = socket;
    socket.onmessage = ({ data }) => {
      try {
        if (JSON.parse(data).type === "notifications-changed") loadInviteNotifications();
      } catch {
        // Ignore non-JSON messages from unrelated socket features.
      }
    };
    socket.onclose = () => {
      if (notificationSocket !== socket) return;
      notificationSocket = null;
      if (!getAuthInfo().user) return;
      notificationReconnectTimer = window.setTimeout(startNotificationStream, 3000);
    };
    socket.onerror = () => socket.close();
  }

  function startPresenceHeartbeat() {
    if (presenceTimer) return;
    sendPresence({ refreshFriends: true });
    presenceTimer = window.setInterval(() => sendPresence({ refreshFriends: true }), 20000);
    document.addEventListener("visibilitychange", handleVisibilityPresence);
    startNotificationStream();
  }

  function stopPresenceHeartbeat() {
    if (presenceTimer) window.clearInterval(presenceTimer);
    presenceTimer = null;
    document.removeEventListener("visibilitychange", handleVisibilityPresence);
    window.clearTimeout(notificationReconnectTimer);
    notificationReconnectTimer = null;
    notificationSocket?.close();
    notificationSocket = null;
  }

  function bindEvents() {
    coopInviteJoin.onclick = () => {
      const type = coopInviteJoin.dataset.notificationType;
      if (type === "game") {
        const roomId = coopInviteJoin.dataset.roomId;
        if (roomId) location.href = `/?room=${encodeURIComponent(roomId)}`;
        return;
      }
      if (type === "friend") showFriendsView();
    };
    coopInviteDismiss.onclick = () => {
      const type = coopInviteDismiss.dataset.notificationType;
      const notificationId = coopInviteDismiss.dataset.notificationId;
      if (!notificationId) return;
      if (type === "game") {
        runFriendAction(`dismiss-invite:${notificationId}`, async () => {
          await apiJson(`/api/coop/invites/${notificationId}/dismiss`, { method: "POST" });
          await loadInviteNotifications();
        });
        return;
      }
      dismissedNotificationKeys.add(`friend:${notificationId}`);
      renderInviteNotification();
    };
  }

  return {
    bindEvents,
    loadInviteNotifications,
    renderInviteNotification,
    startPresenceHeartbeat,
    stopPresenceHeartbeat,
  };
}
