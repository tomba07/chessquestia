export function createInitialCoopState() {
  return {
    ws: null,
    roomId: null,
    playerId: null,
    myIdx: -1,
    phase: "off",
    players: [],
    activeIdx: 0,
    midTurn: false,
    fen: null,
    startedAt: null,
    moveCount: 0,
    maxUnlockedOpponentCount: 1,
    strength: 1500,
    selectingOpponent: false,
    leaving: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
  };
}
