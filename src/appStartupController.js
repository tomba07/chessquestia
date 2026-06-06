export function readStartupRoute(locationRef = location) {
  const searchParams = new URLSearchParams(locationRef.search);
  const friendInvitePathMatch = locationRef.pathname.match(/^\/plsbemyfriend\/([^/]+)$/);
  return {
    demoGame: searchParams.get("demo"),
    game: searchParams.get("game"),
    initialView: searchParams.get("view"),
    incomingFriendUsername: friendInvitePathMatch
      ? decodeURIComponent(friendInvitePathMatch[1])
      : searchParams.get("friend"),
    roomId: searchParams.get("room"),
    searchParams,
  };
}

export function createAppStartupController({
  connectCoop,
  getAuthInfo,
  loadFriendInviteLanding,
  loadInviteNotifications,
  onInvitePollTimer,
  promptSignIn,
  route,
  showAuthView,
  showFriendsView,
  showLeaderboardView,
  showProfileView,
  showSoloSetup,
  soloGame,
  startPresenceHeartbeat,
}) {
  function requireAuth(action) {
    const authInfo = getAuthInfo();
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    action();
  }

  async function start() {
    if (getAuthInfo().user) {
      startPresenceHeartbeat();
      loadInviteNotifications();
      onInvitePollTimer(window.setInterval(loadInviteNotifications, 5000));
    }

    if (route.roomId) {
      requireAuth(() => connectCoop("join", { roomId: route.roomId }));
    } else if (route.incomingFriendUsername) {
      await loadFriendInviteLanding();
    } else if (route.demoGame === "snib") {
      soloGame.startDemo();
    } else if (route.game === "solo") {
      requireAuth(() => soloGame.restore());
    } else if (route.initialView === "profile") {
      requireAuth(() => showProfileView());
    } else if (route.initialView === "friends") {
      requireAuth(() => showFriendsView());
    } else if (route.initialView === "leaderboard") {
      requireAuth(() => showLeaderboardView());
    } else if (route.initialView === "solo") {
      requireAuth(() => showSoloSetup());
    } else if (route.initialView === "coop") {
      requireAuth(() => connectCoop("create"));
    } else if (getAuthInfo().authEnabled && !getAuthInfo().user) {
      showAuthView();
    } else {
      soloGame.restore();
    }
  }

  return {
    start,
  };
}
