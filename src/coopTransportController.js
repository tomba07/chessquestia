import { createCoopActionsController } from "./coopActionsController.js";
import { createCoopConnectionController } from "./coopConnectionController.js";

export function createCoopTransportController({
  getCoop,
  getElo,
  getFen,
  getGameOver,
  getMaiaReady,
  getOpponentSelectionReadonly,
  getPlayerName,
  getRoomFromUrl,
  getSoloStartDisabled,
  onMessage,
  onPlayingReconnect,
  onReconnectingLobby,
  readSoloProgress,
  requestModelDownload,
  setSetupMode,
  showCoopBotSelection,
  showLobby,
  showModelLoading,
  storedPlayerId,
}) {
  const connection = createCoopConnectionController({
    getCoop,
    getElo,
    getMaiaReady,
    getPlayerName,
    getRoomFromUrl,
    readSoloProgress,
    setSetupMode,
    showLobby,
    storedPlayerId,
    onMessage,
    onPlayingReconnect,
    onReconnectingLobby,
  });

  const actions = createCoopActionsController({
    getConnection: () => connection,
    getCoop,
    getElo,
    getFen,
    getGameOver,
    getMaiaReady,
    getOpponentSelectionReadonly,
    getSoloStartDisabled,
    requestModelDownload,
    showCoopBotSelection,
    showModelLoading,
  });

  return {
    ...actions,
    dispose: connection.dispose,
  };
}
