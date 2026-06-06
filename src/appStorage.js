const STORAGE_PREFIX = "chessquestia";
const LEGACY_STORAGE_PREFIX = "local-chess";

export const storageKey = (suffix) => `${STORAGE_PREFIX}.${suffix}`;
export const legacyStorageKey = (suffix) => `${LEGACY_STORAGE_PREFIX}.${suffix}`;

export const SOLO_STORAGE_KEYS = {
  soloGameKey: storageKey("solo-game"),
  legacySoloGameKey: legacyStorageKey("solo-game"),
  soloProgressKey: storageKey("solo-progress"),
};

export const BOARD_DEVICE_VISIBLE_KEY = storageKey("board-device-visible");

export const COOP_ROOM_STORAGE = {
  lastRoomKey: storageKey("last-room"),
  legacyLastRoomKey: legacyStorageKey("last-room"),
  nameKey: (roomId) => storageKey(`room.${roomId}.name`),
  legacyNameKey: (roomId) => legacyStorageKey(`room.${roomId}.name`),
  playerKey: (roomId) => storageKey(`room.${roomId}.playerId`),
};
