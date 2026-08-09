export function createCoopSessionController({
  apiJson,
  connectCoop,
  showPlayView,
  storedPlayerId,
}) {
  async function resumeRoom(roomId) {
    const storedId = storedPlayerId(roomId);
    const query = storedId ? `?playerId=${encodeURIComponent(storedId)}` : "";
    try {
      const payload = await apiJson(`/api/coop/rooms/${encodeURIComponent(roomId)}/session${query}`);
      const session = payload.session || {};
      if (!session.canJoin) {
        alert("This co-op game has already started.");
        showPlayView();
        return;
      }
      connectCoop("join", {
        roomId,
        playerId: session.myPlayerId || storedId,
      });
    } catch (err) {
      alert(err.message || "Room not found.");
      showPlayView();
    }
  }

  return {
    resumeRoom,
  };
}
