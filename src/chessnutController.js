import { Chess } from "chess.js";
import {
  CHESSNUT_CHARACTERISTICS,
  CHESSNUT_DEVICE_FILTERS,
  CHESSNUT_INIT_COMMAND,
  CHESSNUT_SERVICE_UUIDS,
  bestPhysicalPlacement,
  bytesToHex,
  chessnutBoardDataToPlacement,
  chessnutBytes,
  chessnutLedBytes,
  legalMoveFromPlacementDelta,
  placementDiffSquares,
  rotatePlacement,
} from "./chessnut.js";

function boardPlacement(fen) {
  return fen.split(" ")[0];
}

function pieceCount(placement) {
  return (placement.match(/[pnbrqkPNBRQK]/g) || []).length;
}

export function createChessnutController({
  elements,
  storageKey,
  getFen,
  getLegalMoves,
  canAcceptMove,
  applyMove,
}) {
  const {
    panel,
    connectBtn,
    connectLabel,
    disconnectBtn,
    statusEl,
    profileToggle,
  } = elements;

  const state = {
    device: null,
    server: null,
    writeChar: null,
    boardChar: null,
    miscChar: null,
    connected: false,
    connecting: false,
    lastPlacement: "",
    notifications: 0,
    orientation: "normal",
    pollTimer: null,
    polling: false,
    lastRawHex: "",
    lastSeenPlacement: "",
    lastOrientedPlacement: "",
    ledAnimationToken: 0,
  };

  function gamePlacement() {
    return boardPlacement(getFen());
  }

  function setStatus(text, status = "") {
    statusEl.textContent = text;
    panel.dataset.state = status;
  }

  function settingEnabled() {
    return localStorage.getItem(storageKey) === "1";
  }

  function shouldShowPanel() {
    return settingEnabled()
      && !window.matchMedia?.("(max-width: 860px)")?.matches;
  }

  function updateUi() {
    panel.hidden = !shouldShowPanel();
    connectBtn.disabled = state.connecting;
    disconnectBtn.hidden = !state.connected && !state.connecting;
    connectLabel.textContent = state.connected
      ? "Board connected"
      : state.connecting ? "Connecting..." : "Connect board";
  }

  function renderSetting() {
    if (profileToggle) profileToggle.checked = settingEnabled();
    updateUi();
  }

  function setSetting(enabled) {
    if (enabled) localStorage.setItem(storageKey, "1");
    else localStorage.removeItem(storageKey);
    renderSetting();
  }

  async function write(bytes) {
    if (state.writeChar.writeValueWithoutResponse && state.writeChar.properties?.writeWithoutResponse) {
      await state.writeChar.writeValueWithoutResponse(bytes);
      return;
    }
    if (state.writeChar.writeValueWithResponse && state.writeChar.properties?.write) {
      await state.writeChar.writeValueWithResponse(bytes);
      return;
    }
    await state.writeChar.writeValue(bytes);
  }

  async function setLeds(squares) {
    if (!state.connected || !state.writeChar) return;
    try {
      await write(chessnutLedBytes(squares));
    } catch {
      setStatus("LED update failed", "warning");
    }
  }

  function updateDiffLeds() {
    if (!state.connected || !state.lastOrientedPlacement) return;
    state.ledAnimationToken += 1;
    const diffs = placementDiffSquares(state.lastOrientedPlacement, gamePlacement());
    setLeds(diffs.slice(0, 16));
  }

  function legalMoveForPlacement(targetPlacement) {
    for (const move of getLegalMoves()) {
      const probe = new Chess(getFen());
      const moveInput = {
        from: move.from,
        to: move.to,
      };
      if (move.promotion) moveInput.promotion = move.promotion;
      probe.move(moveInput);
      if (boardPlacement(probe.fen()) === targetPlacement) return move;
    }
    return null;
  }

  function legalMoveFromBoardPlacement(placement) {
    const normalMove = legalMoveForPlacement(placement);
    if (normalMove) {
      state.orientation = "normal";
      return normalMove;
    }

    const rotatedMove = legalMoveForPlacement(rotatePlacement(placement));
    if (rotatedMove) {
      state.orientation = "rotated";
      return rotatedMove;
    }

    return null;
  }

  function handleBoardNotification(event) {
    state.notifications += 1;
    const bytes = chessnutBytes(event.target.value);
    state.lastRawHex = bytesToHex(bytes);
    const placement = chessnutBoardDataToPlacement(bytes);
    if (!placement) {
      setStatus(`Board data #${state.notifications}: unreadable`, "warning");
      return;
    }
    state.lastSeenPlacement = placement;
    const bestPlacement = bestPhysicalPlacement(placement, gamePlacement());
    const previousOrientedPlacement = state.lastOrientedPlacement;
    const nextOrientedPlacement = bestPlacement.placement;
    window.__chessnutDebug = {
      notifications: state.notifications,
      orientation: state.orientation,
      rawHex: state.lastRawHex,
      physicalPlacement: placement,
      previousOrientedPlacement,
      orientedPlacement: nextOrientedPlacement,
      gamePlacement: gamePlacement(),
      gameFen: getFen(),
      mismatchSquares: bestPlacement.diffs,
    };
    if (placement === state.lastPlacement) {
      updateDiffLeds();
      setStatus(`Board data #${state.notifications}`, "connected");
      return;
    }
    state.lastPlacement = placement;
    state.lastOrientedPlacement = nextOrientedPlacement;

    if (placement === gamePlacement()) {
      state.orientation = "normal";
      updateDiffLeds();
      setStatus(`Board in sync #${state.notifications}`, "connected");
      return;
    }

    if (rotatePlacement(placement) === gamePlacement()) {
      state.orientation = "rotated";
      updateDiffLeds();
      setStatus(`Board in sync rotated #${state.notifications}`, "connected");
      return;
    }

    if (!canAcceptMove()) {
      setStatus(`Waiting for your turn #${state.notifications}`, "warning");
      return;
    }

    const deltaMove = legalMoveFromPlacementDelta(getLegalMoves(), previousOrientedPlacement, nextOrientedPlacement);
    const move = deltaMove || legalMoveFromBoardPlacement(placement);
    if (move && applyMove(move.from, move.to, move.promotion || "q")) {
      setStatus(`Move received #${state.notifications}`, "connected");
      return;
    }

    if (pieceCount(bestPlacement.placement) < pieceCount(gamePlacement())) {
      setStatus(`Complete the move #${state.notifications}`, "warning");
      return;
    }
    updateDiffLeds();
    setStatus(`Board out of sync #${state.notifications}`, "warning");
  }

  async function pollBoard() {
    if (!state.connected || !state.boardChar || state.polling) return;
    state.polling = true;
    try {
      const value = await state.boardChar.readValue();
      handleBoardNotification({ target: { value } });
    } catch {
      if (!state.notifications) setStatus("Waiting for board data", "warning");
    } finally {
      state.polling = false;
    }
  }

  function startPolling() {
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    if (!state.boardChar?.properties?.read) return;
    state.pollTimer = window.setInterval(pollBoard, 600);
    pollBoard();
  }

  function handleDisconnect(eventOrStatus = "Disconnected") {
    const statusText = typeof eventOrStatus === "string" ? eventOrStatus : "Disconnected";
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    state.connected = false;
    state.server = null;
    state.writeChar = null;
    state.boardChar = null;
    state.miscChar = null;
    state.notifications = 0;
    state.ledAnimationToken += 1;
    state.pollTimer = null;
    state.polling = false;
    setStatus(statusText, "");
    updateUi();
  }

  async function findCharacteristics(server) {
    const found = {};
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const characteristic of characteristics) {
        const uuid = characteristic.uuid.toLowerCase();
        if (uuid === CHESSNUT_CHARACTERISTICS.write) found.writeChar = characteristic;
        if (uuid === CHESSNUT_CHARACTERISTICS.readBoardData) found.boardChar = characteristic;
        if (uuid === CHESSNUT_CHARACTERISTICS.readMiscData) found.miscChar = characteristic;
      }
    }
    return found;
  }

  async function connect() {
    if (!navigator.bluetooth) {
      setStatus("Use Chrome or Edge for Bluetooth", "warning");
      return;
    }
    if (state.connecting) return;

    state.connecting = true;
    setStatus("Select your Chessnut Air", "connecting");
    updateUi();
    try {
      const device = state.device || await navigator.bluetooth.requestDevice({
        filters: CHESSNUT_DEVICE_FILTERS,
        optionalServices: CHESSNUT_SERVICE_UUIDS,
      });
      state.device = device;
      device.removeEventListener("gattserverdisconnected", handleDisconnect);
      device.addEventListener("gattserverdisconnected", handleDisconnect);

      const server = await device.gatt.connect();
      const found = await findCharacteristics(server);
      if (!found.writeChar || !found.boardChar) throw new Error("Chessnut board services were not found.");

      state.server = server;
      state.writeChar = found.writeChar;
      state.boardChar = found.boardChar;
      state.miscChar = found.miscChar;
      await state.boardChar.startNotifications();
      state.boardChar.removeEventListener("characteristicvaluechanged", handleBoardNotification);
      state.boardChar.addEventListener("characteristicvaluechanged", handleBoardNotification);
      if (state.miscChar?.properties?.notify) await state.miscChar.startNotifications().catch(() => {});
      await write(CHESSNUT_INIT_COMMAND);

      state.connected = true;
      resetPlacement();
      state.notifications = 0;
      setStatus("Connected, waiting for board", "connected");
      startPolling();
    } catch (err) {
      const cancelled = err?.name === "NotFoundError";
      const needsGesture = err?.name === "SecurityError" || /user gesture/i.test(err?.message || "");
      const permissionBlocked = err?.name === "NotAllowedError" || /permission.*blocked|blocked.*permission/i.test(err?.message || "");
      const message = cancelled
        ? "Connection cancelled"
        : needsGesture ? "Click Connect board again"
          : permissionBlocked ? "Bluetooth is blocked for this site"
            : err.message || "Could not connect";
      handleDisconnect(message);
      setStatus(message, "warning");
    } finally {
      state.connecting = false;
      updateUi();
    }
  }

  async function disconnect() {
    try {
      if (state.boardChar) {
        state.boardChar.removeEventListener("characteristicvaluechanged", handleBoardNotification);
        await state.boardChar.stopNotifications().catch(() => {});
      }
      if (state.miscChar?.properties?.notify) await state.miscChar.stopNotifications().catch(() => {});
      await setLeds([]);
      state.device?.gatt?.disconnect();
    } finally {
      handleDisconnect();
    }
  }

  function resetPlacement() {
    state.lastPlacement = "";
    state.lastOrientedPlacement = "";
  }

  function bind() {
    connectBtn.onclick = () => connect();
    disconnectBtn.onclick = () => disconnect();
    if (profileToggle) profileToggle.onchange = () => setSetting(profileToggle.checked);
    window.matchMedia?.("(max-width: 860px)")?.addEventListener?.("change", renderSetting);
    if (!navigator.bluetooth) setStatus("Chrome or Edge required", "warning");
    renderSetting();
  }

  return {
    bind,
    connect,
    disconnect,
    resetPlacement,
    setLeds,
    updateDiffLeds,
  };
}
