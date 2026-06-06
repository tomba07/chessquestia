import { createAppShellController } from "./appShellController.js";

export function createSocialBridge() {
  let controller = null;

  return {
    attach(nextController) {
      controller = nextController;
    },
    closeAddFriendDialog: (options) => controller?.closeAddFriendDialog(options),
    loadFriendInviteLanding: (...args) => controller?.loadFriendInviteLanding(...args),
    loadInviteNotifications: (...args) => controller?.loadInviteNotifications(...args),
    renderInviteNotification: (...args) => controller?.renderInviteNotification(...args),
    runFriendAction: (...args) => controller?.runFriendAction(...args),
    showFriendsView: (...args) => controller?.showFriendsView(...args),
    showProfileView: (...args) => controller?.showProfileView(...args),
    startPresenceHeartbeat: (...args) => controller?.startPresenceHeartbeat(...args),
    stopPresenceHeartbeat: () => controller?.stopPresenceHeartbeat(),
  };
}

export function createLobbyShellController({
  elements,
  searchParams,
  socialBridge,
  state,
  actions,
}) {
  return createAppShellController({
    elements,
    searchParams,
    getAuthInfo: state.getAuthInfo,
    setAuthInfo: state.setAuthInfo,
    onAuthLoaded: actions.syncSoloProgressFromAuth,
    closeAddFriendDialog: socialBridge.closeAddFriendDialog,
    renderInviteNotification: socialBridge.renderInviteNotification,
    getPendingSoloStart: state.getPendingSoloStart,
    hideModelLoading: actions.hideModelLoading,
    setSetupMode: state.setSetupMode,
    setOpponentSelectionReadonly: state.setOpponentSelectionReadonly,
    applyOpponentLocks: actions.applyOpponentLocks,
    updateOpponentSelection: actions.updateOpponentSelection,
    clearOpponentSelection: actions.clearOpponentSelection,
    getElo: state.getElo,
  });
}
