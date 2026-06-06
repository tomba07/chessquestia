import { createCoopGameViewController } from "./coopGameViewController.js";
import { createCoopInviteController } from "./coopInviteController.js";
import { createCoopMessageController } from "./coopMessageController.js";
import { createCoopRoomController } from "./coopRoomController.js";

export function createCoopUiControllers({
  apiJson,
  elements,
  storage,
  getAuthInfo,
  getBoard,
  getChess,
  getCoop,
  getCurrentOpponent,
  getElo,
  getSetupMode,
  actions,
}) {
  const coopInvites = createCoopInviteController({
    apiJson,
    elements: {
      inviteMessageEl: elements.cpInviteMessage,
      inviteListEl: elements.cpInviteList,
    },
    getAuthInfo,
    getRoomId: () => getCoop()?.roomId,
    getJoinedUserIds: () => new Set((getCoop()?.players || []).map(player => player.userId).filter(Boolean)),
  });

  const coopRoom = createCoopRoomController({
    elements: {
      cpPlayerList: elements.cpPlayerList,
      cpRoomMeta: elements.cpRoomMeta,
      cpStartBtn: elements.cpStartBtn,
      lbFriendInvite: elements.lbFriendInvite,
      lbFriends: elements.lbFriends,
      lbMain: elements.lbMain,
      lbProfile: elements.lbProfile,
      lbRoom: elements.lbRoom,
      lbSolo: elements.lbSolo,
    },
    storage,
    getAuthInfo,
    getCoop,
    hideModelLoading: actions.hideModelLoading,
    showModelLoading: actions.showModelLoading,
    renderCoopInviteFriends: coopInvites.renderInviteFriends,
  });

  const coopGameView = createCoopGameViewController({
    elements: {
      cpChips: elements.cpChips,
      lbSolo: elements.lbSolo,
      soloStartBtn: elements.soloStartBtn,
    },
    getBoard,
    getChess,
    getCoop,
    getCurrentOpponent,
    getElo,
    getSetupMode,
    applyOpponentLocks: actions.applyOpponentLocks,
    applyRemoteFen: actions.applyRemoteFen,
    checkGameOver: actions.checkGameOver,
    clearLastMove: actions.clearLastMove,
    disableBoardMoveInput: actions.disableBoardMoveInput,
    enableBoardMoveInput: actions.enableBoardMoveInput,
    hideOutcomeBanner: actions.hideOutcomeBanner,
    loadCoopInviteFriends: coopInvites.loadFriends,
    maybeAutoStartCoopSplash: actions.maybeAutoStartCoopSplash,
    maybeRunCoopBotTurn: actions.maybeRunCoopBotTurn,
    renderRoomLobby: coopRoom.renderLobby,
    setCoopTurnStatus: actions.setCoopTurnStatus,
    setOpponentSelectionReadonly: actions.setOpponentSelectionReadonly,
    shouldAutoStartCoopSplash: actions.shouldAutoStartCoopSplash,
    shouldLoadInviteFriends: () => coopInvites.shouldLoadFriends(),
    showBotSplash: actions.showBotSplash,
    showCoopBotSelection: actions.showCoopBotSelection,
    showGame: actions.showGame,
    showGameStartSpeech: actions.showGameStartSpeech,
    showRoomPanel: coopRoom.showRoomPanel,
    updateCheckMarker: actions.updateCheckMarker,
    updateGameScore: actions.updateGameScore,
    updateOpponentSelection: actions.updateOpponentSelection,
    updatePlacementDiffs: actions.updatePlacementDiffs,
  });

  const coopMessages = createCoopMessageController({
    connectToAuth: actions.connectToAuth,
    coopGameView,
    coopInvites,
    coopRoom,
    getCoop,
    getCoopPlayerName: coopRoom.playerName,
    getSetupMode,
    loadCoopInviteFriends: coopInvites.loadFriends,
    loadInviteNotifications: actions.loadInviteNotifications,
    readSoloProgress: actions.readSoloProgress,
    rememberRoom: coopRoom.rememberRoom,
    setRoomUrl: coopRoom.setRoomUrl,
    showModelLoading: actions.showModelLoading,
    showPlayView: actions.showPlayView,
    syncStrength: actions.syncStrength,
    updateOpponentSelection: actions.updateOpponentSelection,
    elements: {
      lbSolo: elements.lbSolo,
    },
  });

  return {
    coopInvites,
    coopMessages,
    coopRoom,
    loadCoopInviteFriends: coopInvites.loadFriends,
    renderRoomLobby: coopRoom.renderLobby,
    sendCoopInvite: coopInvites.sendInvite,
  };
}
