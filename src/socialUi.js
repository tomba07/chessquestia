import { createFriendInviteLandingController } from "./friendInviteLandingController.js";
import { createFriendsController } from "./friendsController.js";
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
    lbDevTesting,
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

  const friendsController = createFriendsController({
    apiJson,
    cleanUsername,
    elements: {
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
    },
    escapeHtml,
    friendMeta,
    friendRow,
    friendState,
    getAuthInfo,
    promptSignIn,
    renderFriendLink,
    renderInviteNotification,
  });
  const closeAddFriendDialog = friendsController.closeAddDialog;
  const loadFriends = friendsController.load;
  const renderFriends = friendsController.render;
  const runFriendAction = friendsController.runAction;

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
      lbDevTesting,
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
    lbDevTesting.style.display = "none";
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
    lbDevTesting.style.display = "none";
    lbFriendInvite.style.display = "none";
    if (reload && !friendState.loading) loadFriends();
    else renderFriends();
    renderInviteNotification();
  }

  function bindEvents() {
    navProfile.onclick = () => showProfileView();
    navFriends.onclick = () => showFriendsView();
    socialRealtime.bindEvents();
    friendsController.bindEvents();
    profileUsername.addEventListener("input", () => {
      profileUsername.value = cleanUsername(profileUsername.value);
    });
    profileUsername.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveUsername();
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
