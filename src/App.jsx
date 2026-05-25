import { useEffect } from "react";
import { Chessboard, COLOR, INPUT_EVENT_TYPE } from "cm-chessboard";
import { Markers } from "cm-chessboard/src/extensions/markers/Markers.js";
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
import {
  buildLegalMask,
  decodeMoves,
  loadMaiaMoveMaps,
  prepareMaiaPosition,
  sampleMove,
} from "./maia.js";
import {
  createSocialController,
  escapeHtml,
  friendMeta,
  friendRow,
} from "./socialUi.js";

function SideMenu() {
  return (
    <nav className="side-menu" aria-label="Main navigation">
      <div className="side-brand">Chessquestia</div>
      <button id="nav-play" className="side-link active" type="button"><img className="nav-icon" src="/assets/icons/solo_icon.png" alt="" />Home</button>
      <button id="nav-profile" className="side-link" type="button"><img className="nav-icon" src="/assets/icons/profile-icon.png" alt="" />Profile</button>
      <button id="nav-friends" className="side-link" type="button">
        <img className="nav-icon" src="/assets/icons/friends-icon.png" alt="" />Friends
      </button>
    </nav>
  );
}

function PlayPanel() {
  return (
    <div id="lb-main" className="lobby-section lobby-panel">
      <div className="home-copy">
        <div>Welcome back,</div>
        <strong id="welcome-name">Wanderer</strong>
        <span className="home-divider" aria-hidden="true"></span>
        <p>Every move shapes your story.</p>
      </div>
      <div className="mode-grid">
        <button id="play-solo-btn" className="mode-card" type="button">
          <img src="/assets/buttons/solo_button.png" alt="" />
          <span className="mode-card-copy">
            <strong><img className="mode-title-icon" src="/assets/icons/solo_icon.png" alt="" />Solo</strong>
            <span>Challenge AI opponents and sharpen your skills.</span>
          </span>
        </button>
        <button id="play-coop-btn" className="mode-card" type="button">
          <img src="/assets/buttons/coop_button.png" alt="" />
          <span className="mode-card-copy">
            <strong><img className="mode-title-icon" src="/assets/icons/coop-icon.png" alt="" />Co-op</strong>
            <span>Team up with friends and play together.</span>
          </span>
        </button>
      </div>
    </div>
  );
}

const SOLO_OPPONENTS = [
  { name: "Snib the Candle Goblin", elo: 500, card: "snib_card.png", rank: 1, tone: "easy", theme: "imp" },
  { name: "Muckroot the Bog Imp", elo: 600, card: "muckroot_card.png", rank: 2, tone: "easy", theme: "muckroot" },
  { name: "Gribble Thornnose", elo: 700, card: "gribble_card.png", rank: 3, tone: "medium", theme: "imp" },
  { name: "Vexi Blackcap", elo: 800, card: "vexi_card.png", rank: 4, tone: "medium", theme: "witch" },
  { name: "Drogar Gategrunt", elo: 900, card: "drogar_card.png", rank: 5, tone: "hard", theme: "imp" },
];

function OpponentRank({ rank }) {
  return (
    <span className="opponent-rank" aria-label={`${rank} out of five`}>
      {Array.from({ length: 5 }, (_, index) => (
        <img
          key={index}
          className={index < rank ? "filled" : ""}
          src="/assets/icons/solo_icon.png"
          alt=""
        />
      ))}
    </span>
  );
}

function SinglePlayerSetup() {
  return (
    <div id="lb-solo" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <button id="solo-back-btn" className="bot-back-btn" type="button" aria-label="Back">
        <img src="/assets/icons/back-icon.png" alt="" />
      </button>
      <div className="bot-select-head">
        <h2 id="bot-select-title">Choose your opponent</h2>
        <span className="home-divider" aria-hidden="true"></span>
      </div>
      <input type="hidden" id="strength-slider" defaultValue="1500" />
      <span id="strength-val" className="sr-only">1500</span>
      <div className="opponent-grid" aria-label="Choose your opponent">
        {SOLO_OPPONENTS.map((opponent, index) => (
          <button
            key={opponent.elo}
            className={`opponent-card${index > 0 ? " locked" : ""}`}
            type="button"
            data-opponent-strength={opponent.elo}
            data-opponent-theme={opponent.theme}
            data-opponent-index={index}
            data-unlocked-src={`/assets/cards/${opponent.card}`}
            aria-pressed="false"
            aria-disabled={index > 0 ? "true" : "false"}
            disabled={index > 0}
          >
            <img
              className="opponent-card-art"
              src={index > 0 ? "/assets/cards/locked_card.png" : `/assets/cards/${opponent.card}`}
              alt=""
            />
            <span className="opponent-card-copy">
              <strong>{opponent.name}</strong>
              <OpponentRank rank={opponent.rank} />
            </span>
            <span className="opponent-locked-copy">Locked</span>
          </button>
        ))}
      </div>
      <button id="solo-start-btn" className="bot-continue-btn" type="button" disabled>
        <img src="/assets/icons/submit-icon.png" alt="" />
        <span>Continue</span>
      </button>
    </div>
  );
}

function FriendsPanel() {
  return (
    <div id="lb-friends" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Friends</div>
        <span className="home-divider" aria-hidden="true"></span>
        <div className="panel-kicker">Players</div>
      </div>
      <div className="friend-link-card">
        <div className="friend-section-title">Friend link</div>
        <p>Share this once so someone can add you directly.</p>
        <div className="friend-link-actions">
          <input id="friend-invite-link" readOnly />
          <button id="friend-link-copy" className="sm-btn primary-mini" type="button">Copy</button>
          <button id="friend-link-share" className="sm-btn" type="button">Share</button>
        </div>
      </div>
      <div id="friend-message" className="friend-message"></div>
      <div id="friend-requests" className="friend-section"></div>
      <div id="friend-list" className="friend-section"></div>
    </div>
  );
}

function FriendAddDialog() {
  return (
    <div id="friend-add-dialog" className="friend-add-dialog-backdrop" hidden>
      <div className="friend-add-dialog" role="dialog" aria-modal="true" aria-labelledby="friend-add-title">
        <div className="friend-add-head">
          <h3 id="friend-add-title">Add friend</h3>
          <button id="friend-add-close" className="sm-btn" type="button">Close</button>
        </div>
        <label className="friend-search-box" htmlFor="friend-search">
          <span>Search username</span>
          <input id="friend-search" placeholder="Search username" autoComplete="off" autoCapitalize="none" />
        </label>
        <div id="friend-results" className="friend-section friend-search-results"></div>
      </div>
    </div>
  );
}

function FriendInvitePanel() {
  return (
    <div id="lb-friend-invite" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Friend invite</div>
        <span className="home-divider" aria-hidden="true"></span>
        <div className="panel-kicker">Players</div>
      </div>
      <div id="friend-invite-landing" className="friend-invite-landing"></div>
    </div>
  );
}

function ProfilePanel() {
  return (
    <div id="lb-profile" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Profile</div>
        <span className="home-divider" aria-hidden="true"></span>
        <div className="panel-kicker">Identity</div>
      </div>
      <div className="username-card">
        <label htmlFor="profile-username">Your username</label>
        <div className="username-row">
          <input id="profile-username" minLength="3" maxLength="20" autoCapitalize="none" autoComplete="off" />
          <button id="username-save" className="sm-btn primary-mini" type="button">Save</button>
        </div>
        <p id="username-help">Other players can search for this username.</p>
      </div>
      <div id="profile-account-card" className="profile-account-card" style={{ display: "none" }}>
        <div>
          <span>Signed in as</span>
          <strong id="profile-account-name"></strong>
        </div>
        <button id="profile-auth-btn" className="sm-btn" type="button"></button>
      </div>
      <div id="dev-login-card" className="dev-login-card" style={{ display: "none" }}>
        <span>Dev login</span>
        <div id="dev-login-options" className="dev-login-options"></div>
      </div>
    </div>
  );
}

function CoopRoomPanel() {
  return (
    <div id="lb-room" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Waiting room</div>
        <span className="home-divider" aria-hidden="true"></span>
        <div className="panel-kicker" id="cp-room-meta">Lobby</div>
      </div>
      <div id="cp-player-list"></div>
      <div className="room-invite-panel">
        <div className="friend-section-title">Invite friends</div>
        <div id="cp-invite-message" className="friend-message"></div>
        <div id="cp-invite-list" className="room-invite-list"></div>
      </div>
      <div className="lb-btns room-actions">
        <button id="cp-start" className="lb-btn primary" style={{ display: "none" }} type="button">Continue</button>
        <button id="cp-leave" className="sm-btn" type="button">Leave</button>
      </div>
    </div>
  );
}

function ModelLoading() {
  return (
    <div className="model-loading" id="model-loading" style={{ display: "none" }} aria-live="polite">
      <div className="model-status-row">
        <span className="status-dot" id="status-dot"></span>
        <span id="status-label">Preparing game...</span>
        <button id="download-btn" className="sm-btn" style={{ display: "none" }} type="button">Retry</button>
      </div>
      <div className="progress-bar" id="progress-bar">
        <div className="progress-fill" id="progress-fill"></div>
      </div>
    </div>
  );
}

function Lobby() {
  return (
    <div id="lobby">
      <SideMenu />
      <div className="lobby-title">Chessquestia</div>
      <div id="auth-bar" className="auth-bar" style={{ display: "none" }}>
        <span id="auth-label"></span>
        <button id="auth-btn" className="sm-btn" type="button"></button>
      </div>
      <div id="coop-invite-notice" className="coop-invite-notice" style={{ display: "none" }}>
        <div>
          <strong id="coop-invite-title">Co-op invite</strong>
          <span id="coop-invite-text"></span>
        </div>
        <div className="friend-actions">
          <button id="coop-invite-join" className="sm-btn primary-mini" type="button">Join</button>
          <button id="coop-invite-dismiss" className="sm-btn" type="button">Dismiss</button>
        </div>
      </div>
      <PlayPanel />
      <SinglePlayerSetup />
      <ProfilePanel />
      <FriendsPanel />
      <FriendInvitePanel />
      <CoopRoomPanel />
      <ModelLoading />
    </div>
  );
}

function GameView() {
  return (
    <div id="game">
      <button id="back-btn" className="game-back-btn" type="button" aria-label="Back to lobby">
        <img src="/assets/icons/back-icon.png" alt="" />
      </button>
      <div className="game-score-plaque" aria-live="polite">
        <div id="game-score">+0</div>
        <div id="game-status">...</div>
      </div>
      <div id="board-device-panel" className="board-device-panel" aria-live="polite">
        <button id="board-connect-btn" className="board-connect-btn" type="button">
          <span className="board-device-dot"></span>
          <span id="board-connect-label">Connect board</span>
        </button>
        <button id="board-disconnect-btn" className="board-disconnect-btn" type="button" aria-label="Disconnect board" hidden>
          ×
        </button>
        <div id="board-device-status" className="board-device-status">Chessnut Air</div>
      </div>
      <div id="game-outcome-overlay" className="game-outcome-overlay" aria-hidden="true">
        <div className="game-outcome-modal" role="dialog" aria-modal="true" aria-label="Game result">
          <div id="game-outcome-banner" className="game-outcome-banner">
            <span id="game-outcome-title" className="game-outcome-title"></span>
          </div>
          <button id="game-outcome-continue" className="bot-continue-btn game-outcome-continue" type="button">
            <img src="/assets/icons/submit-icon.png" alt="" />
            <span>Continue</span>
          </button>
        </div>
      </div>
      <div className="game-board-frame">
        <div id="board"></div>
      </div>
      <div id="cp-chips"></div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    let disposed = false;
    let invitePollTimer = null;
    let outcomeBannerTimer = null;
    (async () => {
      if (disposed) return;
const LAST_MOVE = { class: "last-move", slice: "markerSquare" };
  const CDN       = "/cm-chessboard/assets/";

  const strengthSlider = document.getElementById("strength-slider");
  const strengthVal    = document.getElementById("strength-val");
  let opponentCards = [];
  function updateOpponentSelection(value) {
    opponentCards.forEach(card => {
      const selected = card.dataset.opponentStrength === String(value);
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }
  function clearOpponentSelection() {
    opponentCards.forEach(card => {
      card.classList.remove("selected");
      card.setAttribute("aria-pressed", "false");
    });
    if (soloStartBtn) soloStartBtn.disabled = true;
  }
  function opponentForStrength(value) {
    return SOLO_OPPONENTS.find(opponent => opponent.elo === parseInt(value, 10));
  }
  function syncStrength(value) {
    strengthSlider.value = value;
    strengthVal.textContent = value;
    const opponent = opponentForStrength(value);
    if (opponent) selectedOpponentIndex = SOLO_OPPONENTS.indexOf(opponent);
    selectedOpponentTheme = opponent?.theme || opponentThemeForStrength(value);
  }
  strengthSlider.oninput = () => syncStrength(strengthSlider.value);
  const getElo = () => parseInt(strengthSlider.value);

  // ── Load move mappings ────────────────────────────────────────────────────

  const { allMoves: allMovesMaia3, allMovesReversed: allMovesMaia3Reversed } = await loadMaiaMoveMaps();

  // ── Web Worker (Maia 3 ONNX inference) ───────────────────────────────────

  const worker    = new Worker("/maia-worker.js");
  const pending   = new Map();
  let inferenceId = 0;
  let modelReady  = false;
  let modelDownloadRequested = false;
  let coop = null;

  const statusDot   = document.getElementById("status-dot");
  const statusLabel = document.getElementById("status-label");
  const downloadBtn = document.getElementById("download-btn");
  const modelLoadingEl = document.getElementById("model-loading");
  const progressBar = document.getElementById("progress-bar");
  const progressFill = document.getElementById("progress-fill");
  let pendingSoloStart = false;

  function showModelLoading(text = "Preparing game...") {
    modelLoadingEl.style.display = "flex";
    statusLabel.textContent = text;
  }

  function hideModelLoading() {
    modelLoadingEl.style.display = "none";
    downloadBtn.style.display = "none";
    progressBar.classList.remove("visible");
  }

  function requestModelDownload() {
    if (modelDownloadRequested || modelReady) return;
    modelDownloadRequested = true;
    worker.postMessage({ type: "download" });
  }

  function syncMaiaStatus() {
    if (coop?.ws?.readyState === WebSocket.OPEN)
      coop.ws.send(JSON.stringify({
        type: "maia-status",
        ready: modelReady,
        unlockedOpponentCount: readSoloProgress(),
      }));
  }

  function handleModelStatus(status) {
    if (status === "loading") {
      modelReady = false;
      statusDot.className = "status-dot working";
      if (pendingSoloStart || coop?.phase === "lobby") showModelLoading("Preparing game...");
    } else if (status === "no-cache") {
      modelReady = false;
      statusDot.className = "status-dot working";
      if (pendingSoloStart || coop?.phase === "lobby") showModelLoading("Preparing game...");
      downloadBtn.style.display = "none";
      requestModelDownload();
    } else if (status === "downloading") {
      modelReady = false;
      statusDot.className = "status-dot working";
      if (pendingSoloStart || coop?.phase === "lobby") showModelLoading("Preparing game...");
      downloadBtn.style.display = "none";
      progressBar.classList.add("visible");
    } else if (status === "ready") {
      modelReady = true;
      modelDownloadRequested = false;
      statusDot.className = "status-dot ready";
      hideModelLoading();
      if (pendingSoloStart) {
        pendingSoloStart = false;
        beginSoloGame();
        syncMaiaStatus();
        return;
      }
      // If a solo game is already in progress, unblock the player
      if (gameEl.style.display !== "none" && coop?.phase !== "playing") {
        if (!chess.isGameOver() && chess.turn() === "w") setStatus("Your turn");
      }
      if (gameEl.style.display !== "none" && coop?.phase === "playing") {
        setCoopTurnStatus();
      }
      maybeRunSoloBotTurn();
      maybeRunCoopBotTurn();
    }
    syncMaiaStatus();
  }

  worker.onmessage = ({ data: msg }) => {
    if (msg.type === "inference-result") {
      const r = pending.get(msg.id);
      pending.delete(msg.id);
      r?.resolve({ logitsMove: new Float32Array(msg.logitsMove) });
    } else if (msg.type === "status") {
      handleModelStatus(msg.status);
    } else if (msg.type === "progress") {
      progressFill.style.width = `${msg.progress}%`;
    } else if (msg.type === "error") {
      const r = pending.get(msg.id);
      if (r) { pending.delete(msg.id); r.reject(new Error(msg.message)); }
      else {
        modelReady = false;
        modelDownloadRequested = false;
        statusDot.className = "status-dot error";
        showModelLoading("The game model could not load.");
        downloadBtn.style.display = "inline-flex";
        syncMaiaStatus();
      }
    }
  };

  worker.postMessage({ type: "init", modelUrl: "/maia3/maia3_simplified.onnx", modelVersion: "3" });
  downloadBtn.onclick = () => requestModelDownload();

  function runInference(tokens, elo) {
    return new Promise((resolve, reject) => {
      const id = inferenceId++;
      pending.set(id, { resolve, reject });
      const t = tokens.slice();
      worker.postMessage(
        { type: "inference", id, tokens: t.buffer, eloSelfs: [elo], eloOppos: [elo], batchSize: 1 },
        [t.buffer],
      );
    });
  }

  // ── Game state ────────────────────────────────────────────────────────────

  const chess     = new Chess();
  const lobbyEl   = document.getElementById("lobby");
  const gameEl    = document.getElementById("game");
  const statusEl  = document.getElementById("game-status");
  const gameScoreEl = document.getElementById("game-score");
  const outcomeOverlayEl = document.getElementById("game-outcome-overlay");
  const outcomeBannerEl = document.getElementById("game-outcome-banner");
  const outcomeTitleEl = document.getElementById("game-outcome-title");
  const outcomeContinueBtn = document.getElementById("game-outcome-continue");
  const cpChips   = document.getElementById("cp-chips");
  const boardDevicePanel = document.getElementById("board-device-panel");
  const boardConnectBtn = document.getElementById("board-connect-btn");
  const boardConnectLabel = document.getElementById("board-connect-label");
  const boardDisconnectBtn = document.getElementById("board-disconnect-btn");
  const boardDeviceStatus = document.getElementById("board-device-status");
  const STORAGE_PREFIX = "chessquestia";
  const LEGACY_STORAGE_PREFIX = "local-chess";
  const storageKey = (suffix) => `${STORAGE_PREFIX}.${suffix}`;
  const legacyStorageKey = (suffix) => `${LEGACY_STORAGE_PREFIX}.${suffix}`;
  const SOLO_GAME_KEY = storageKey("solo-game");
  const LEGACY_SOLO_GAME_KEY = legacyStorageKey("solo-game");
  const SOLO_PROGRESS_KEY = storageKey("solo-progress");
  let board       = null;
  let botThinking = false;
  let soloActive  = false;
  let setupMode = "solo";
  let selectedOpponentTheme = "imp";
  let selectedOpponentIndex = 0;
  let unlockedOpponentCount = 1;
  const chessnut = {
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

  function setStatus(text, cls = "") {
    statusEl.textContent = text;
    statusEl.className   = cls;
  }

  function setCoopTurnStatus() {
    if (!coop || coop.phase !== "playing") return;
    if (coop.activeIdx === coop.myIdx && !coop.midTurn) {
      setStatus(modelReady ? "Your turn" : "Preparing game...", modelReady ? "" : "thinking");
      return;
    }

    const activePlayer = coop.players?.[coop.activeIdx];
    const activeName = activePlayer?.name || "Player";
    setStatus(coop.midTurn ? `${activeName}: bot thinking...` : `${activeName}'s turn`, coop.midTurn ? "thinking" : "");
  }

  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function updateGameScore() {
    const score = chess.board().flat().reduce((total, piece) => {
      if (!piece) return total;
      const value = pieceValues[piece.type] || 0;
      return total + (piece.color === "w" ? value : -value);
    }, 0);
    gameScoreEl.textContent = score === 0 ? "+0" : score > 0 ? `+${score}` : String(score);
    gameScoreEl.className = score > 0 ? "ahead" : score < 0 ? "behind" : "";
  }

  function setBoardDeviceStatus(text, state = "") {
    boardDeviceStatus.textContent = text;
    boardDevicePanel.dataset.state = state;
  }

  function updateBoardDeviceUi() {
    boardConnectBtn.disabled = chessnut.connecting;
    boardDisconnectBtn.hidden = !chessnut.connected && !chessnut.connecting;
    boardConnectLabel.textContent = chessnut.connected
      ? "Board connected"
      : chessnut.connecting ? "Connecting..." : "Connect board";
  }

  function boardPlacement(fen = chess.fen()) {
    return fen.split(" ")[0];
  }

  function updateChessnutDiffLeds() {
    if (!chessnut.connected || !chessnut.lastOrientedPlacement) return;
    chessnut.ledAnimationToken += 1;
    const diffs = placementDiffSquares(chessnut.lastOrientedPlacement, boardPlacement());
    setChessnutLeds(diffs.slice(0, 16));
  }

  function pieceCount(placement) {
    return (placement.match(/[pnbrqkPNBRQK]/g) || []).length;
  }

  function canAcceptPlayerMove() {
    if (chess.isGameOver() || !modelReady || botThinking) return false;
    if (coop?.phase === "playing") return !coop.midTurn && coop.activeIdx === coop.myIdx;
    return soloActive && coop?.phase === "off" && chess.turn() === "w";
  }

  function legalMoveForPlacement(targetPlacement) {
    for (const move of chess.moves({ verbose: true })) {
      const probe = new Chess(chess.fen());
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
      chessnut.orientation = "normal";
      return normalMove;
    }

    const rotatedMove = legalMoveForPlacement(rotatePlacement(placement));
    if (rotatedMove) {
      chessnut.orientation = "rotated";
      return rotatedMove;
    }

    return null;
  }

  async function writeChessnut(bytes) {
    if (chessnut.writeChar.writeValueWithoutResponse && chessnut.writeChar.properties?.writeWithoutResponse) {
      await chessnut.writeChar.writeValueWithoutResponse(bytes);
      return;
    }
    if (chessnut.writeChar.writeValueWithResponse && chessnut.writeChar.properties?.write) {
      await chessnut.writeChar.writeValueWithResponse(bytes);
      return;
    }
    await chessnut.writeChar.writeValue(bytes);
  }

  async function setChessnutLeds(squares) {
    if (!chessnut.connected || !chessnut.writeChar) return;
    try {
      await writeChessnut(chessnutLedBytes(squares));
    } catch {
      setBoardDeviceStatus("LED update failed", "warning");
    }
  }

  function markLastMove(from, to) {
    board.removeMarkers(LAST_MOVE);
    board.addMarker(LAST_MOVE, from);
    board.addMarker(LAST_MOVE, to);
    updateChessnutDiffLeds();
  }

  function syncBoardAfterMove(move) {
    board.setPosition(chess.fen(), false);
    markLastMove(move.from, move.to);
    updateGameScore();
  }

  function moveInputFromUci(uci) {
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q",
    };
  }

  function commitBotMove(uci) {
    const move = chess.move(moveInputFromUci(uci));
    if (!move) return null;
    syncBoardAfterMove(move);
    return move;
  }

  function publishCoopMove() {
    coop.ws?.send(JSON.stringify({ type: "move", fen: chess.fen(), gameOver: chess.isGameOver() }));
  }

  function applyRemoteFen(fen) {
    const incomingMove = legalMoveForPlacement(boardPlacement(fen));
    chess.load(fen);
    board.setPosition(fen, false);
    if (incomingMove) markLastMove(incomingMove.from, incomingMove.to);
    else updateChessnutDiffLeds();
    updateGameScore();
  }

  function applyPlayerMove(from, to, promotion = "q") {
    if (!canAcceptPlayerMove()) return false;
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) return false;
      syncBoardAfterMove(move);
      if (coop?.phase === "playing") {
        publishCoopMove();
        if (!chess.isGameOver()) { board.disableMoveInput(); setTimeout(coopBotMove, 300); }
      } else {
        saveSoloGame();
        if (!checkGameOver()) setTimeout(botMove, 300);
      }
      return true;
    } catch {
      return false;
    }
  }

  function handleChessnutBoardNotification(event) {
    chessnut.notifications += 1;
    const bytes = chessnutBytes(event.target.value);
    chessnut.lastRawHex = bytesToHex(bytes);
    const placement = chessnutBoardDataToPlacement(bytes);
    if (!placement) {
      setBoardDeviceStatus(`Board data #${chessnut.notifications}: unreadable`, "warning");
      return;
    }
    chessnut.lastSeenPlacement = placement;
    const bestPlacement = bestPhysicalPlacement(placement, boardPlacement());
    const previousOrientedPlacement = chessnut.lastOrientedPlacement;
    const nextOrientedPlacement = bestPlacement.placement;
    window.__chessnutDebug = {
      notifications: chessnut.notifications,
      orientation: chessnut.orientation,
      rawHex: chessnut.lastRawHex,
      physicalPlacement: placement,
      previousOrientedPlacement,
      orientedPlacement: nextOrientedPlacement,
      gamePlacement: boardPlacement(),
      gameFen: chess.fen(),
      mismatchSquares: bestPlacement.diffs,
    };
    if (placement === chessnut.lastPlacement) {
      updateChessnutDiffLeds();
      setBoardDeviceStatus(`Board data #${chessnut.notifications}`, "connected");
      return;
    }
    chessnut.lastPlacement = placement;
    chessnut.lastOrientedPlacement = nextOrientedPlacement;

    if (placement === boardPlacement()) {
      chessnut.orientation = "normal";
      updateChessnutDiffLeds();
      setBoardDeviceStatus(`Board in sync #${chessnut.notifications}`, "connected");
      return;
    }

    if (rotatePlacement(placement) === boardPlacement()) {
      chessnut.orientation = "rotated";
      updateChessnutDiffLeds();
      setBoardDeviceStatus(`Board in sync rotated #${chessnut.notifications}`, "connected");
      return;
    }

    if (!canAcceptPlayerMove()) {
      setBoardDeviceStatus(`Waiting for your turn #${chessnut.notifications}`, "warning");
      return;
    }

    const deltaMove = legalMoveFromPlacementDelta(chess.moves({ verbose: true }), previousOrientedPlacement, nextOrientedPlacement);
    const move = deltaMove || legalMoveFromBoardPlacement(placement);
    if (move && applyPlayerMove(move.from, move.to, move.promotion || "q")) {
      setBoardDeviceStatus(`Move received #${chessnut.notifications}`, "connected");
      return;
    }

    if (pieceCount(bestPlacement.placement) < pieceCount(boardPlacement())) {
      setBoardDeviceStatus(`Complete the move #${chessnut.notifications}`, "warning");
      return;
    }
    updateChessnutDiffLeds();
    setBoardDeviceStatus(`Board out of sync #${chessnut.notifications}`, "warning");
  }

  async function pollChessnutBoard() {
    if (!chessnut.connected || !chessnut.boardChar || chessnut.polling) return;
    chessnut.polling = true;
    try {
      const value = await chessnut.boardChar.readValue();
      handleChessnutBoardNotification({ target: { value } });
    } catch {
      if (!chessnut.notifications) setBoardDeviceStatus("Waiting for board data", "warning");
    } finally {
      chessnut.polling = false;
    }
  }

  function startChessnutPolling() {
    if (chessnut.pollTimer) window.clearInterval(chessnut.pollTimer);
    if (!chessnut.boardChar?.properties?.read) return;
    chessnut.pollTimer = window.setInterval(pollChessnutBoard, 600);
    pollChessnutBoard();
  }

  function handleChessnutDisconnect(eventOrStatus = "Disconnected") {
    const statusText = typeof eventOrStatus === "string" ? eventOrStatus : "Disconnected";
    if (chessnut.pollTimer) window.clearInterval(chessnut.pollTimer);
    chessnut.connected = false;
    chessnut.server = null;
    chessnut.writeChar = null;
    chessnut.boardChar = null;
    chessnut.miscChar = null;
    chessnut.notifications = 0;
    chessnut.ledAnimationToken += 1;
    chessnut.pollTimer = null;
    chessnut.polling = false;
    setBoardDeviceStatus(statusText, "");
    updateBoardDeviceUi();
  }

  async function findChessnutCharacteristics(server) {
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

  async function connectChessnutBoard() {
    if (!navigator.bluetooth) {
      setBoardDeviceStatus("Use Chrome or Edge for Bluetooth", "warning");
      return;
    }
    if (chessnut.connecting) return;

    chessnut.connecting = true;
    setBoardDeviceStatus("Select your Chessnut Air", "connecting");
    updateBoardDeviceUi();
    try {
      const device = chessnut.device || await navigator.bluetooth.requestDevice({
        filters: CHESSNUT_DEVICE_FILTERS,
        optionalServices: CHESSNUT_SERVICE_UUIDS,
      });
      chessnut.device = device;
      device.removeEventListener("gattserverdisconnected", handleChessnutDisconnect);
      device.addEventListener("gattserverdisconnected", handleChessnutDisconnect);

      const server = await device.gatt.connect();
      const found = await findChessnutCharacteristics(server);
      if (!found.writeChar || !found.boardChar) throw new Error("Chessnut board services were not found.");

      chessnut.server = server;
      chessnut.writeChar = found.writeChar;
      chessnut.boardChar = found.boardChar;
      chessnut.miscChar = found.miscChar;
      await chessnut.boardChar.startNotifications();
      chessnut.boardChar.removeEventListener("characteristicvaluechanged", handleChessnutBoardNotification);
      chessnut.boardChar.addEventListener("characteristicvaluechanged", handleChessnutBoardNotification);
      if (chessnut.miscChar?.properties?.notify) await chessnut.miscChar.startNotifications().catch(() => {});
      await writeChessnut(CHESSNUT_INIT_COMMAND);

      chessnut.connected = true;
      chessnut.lastPlacement = "";
      chessnut.lastOrientedPlacement = "";
      chessnut.notifications = 0;
      setBoardDeviceStatus("Connected, waiting for board", "connected");
      startChessnutPolling();
    } catch (err) {
      const cancelled = err?.name === "NotFoundError";
      const needsGesture = err?.name === "SecurityError" || /user gesture/i.test(err?.message || "");
      const permissionBlocked = err?.name === "NotAllowedError" || /permission.*blocked|blocked.*permission/i.test(err?.message || "");
      const message = cancelled
        ? "Connection cancelled"
        : needsGesture ? "Click Connect board again"
          : permissionBlocked ? "Bluetooth is blocked for this site"
            : err.message || "Could not connect";
      handleChessnutDisconnect(message);
      setBoardDeviceStatus(message, "warning");
    } finally {
      chessnut.connecting = false;
      updateBoardDeviceUi();
    }
  }

  async function disconnectChessnutBoard() {
    try {
      if (chessnut.boardChar) {
        chessnut.boardChar.removeEventListener("characteristicvaluechanged", handleChessnutBoardNotification);
        await chessnut.boardChar.stopNotifications().catch(() => {});
      }
      if (chessnut.miscChar?.properties?.notify) await chessnut.miscChar.stopNotifications().catch(() => {});
      await setChessnutLeds([]);
      chessnut.device?.gatt?.disconnect();
    } finally {
      handleChessnutDisconnect();
    }
  }

  function hideOutcomeBanner() {
    if (outcomeBannerTimer) window.clearTimeout(outcomeBannerTimer);
    outcomeBannerTimer = null;
    outcomeOverlayEl.className = "game-outcome-overlay";
    outcomeOverlayEl.setAttribute("aria-hidden", "true");
    outcomeBannerEl.className = "game-outcome-banner";
    outcomeTitleEl.textContent = "";
    outcomeBannerEl.removeAttribute("aria-label");
  }

  function showOutcomeBanner(outcome) {
    outcomeOverlayEl.className = "game-outcome-overlay visible";
    outcomeOverlayEl.setAttribute("aria-hidden", "false");
    outcomeBannerEl.className = `game-outcome-banner ${outcome}`;
    outcomeTitleEl.textContent = outcome === "victory" ? "Victory" : "Defeat";
    outcomeBannerEl.setAttribute("aria-label", outcomeTitleEl.textContent);
    window.setTimeout(() => outcomeContinueBtn.focus({ preventScroll: true }), 0);
  }

  function showOutcomeBannerAfterDelay(outcome) {
    if (outcomeBannerTimer) window.clearTimeout(outcomeBannerTimer);
    outcomeOverlayEl.className = "game-outcome-overlay";
    outcomeOverlayEl.setAttribute("aria-hidden", "true");
    outcomeBannerEl.className = "game-outcome-banner";
    outcomeTitleEl.textContent = "";
    outcomeBannerEl.removeAttribute("aria-label");
    outcomeBannerTimer = window.setTimeout(() => {
      outcomeBannerTimer = null;
      showOutcomeBanner(outcome);
    }, 1000);
  }

  function opponentThemeForStrength(value) {
    return opponentForStrength(value)?.theme || (parseInt(value, 10) <= 1000 ? "imp" : "witch");
  }

  function setGameOpponentTheme(value = getElo(), theme = selectedOpponentTheme) {
    gameEl.dataset.opponent = theme || opponentThemeForStrength(value);
  }

  function readSoloProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(SOLO_PROGRESS_KEY) || "{}");
      const unlocked = Number(saved.unlocked || 1);
      return Math.min(SOLO_OPPONENTS.length, Math.max(1, unlocked));
    } catch {
      return 1;
    }
  }

  function saveSoloProgress() {
    localStorage.setItem(SOLO_PROGRESS_KEY, JSON.stringify({
      unlocked: unlockedOpponentCount,
      updatedAt: Date.now(),
    }));
  }

  function applyOpponentLocks() {
    unlockedOpponentCount = setupMode === "coop"
      ? Math.max(readSoloProgress(), coop?.maxUnlockedOpponentCount || 1)
      : readSoloProgress();
    opponentCards.forEach((card, index) => {
      const unlocked = index < unlockedOpponentCount;
      const art = card.querySelector(".opponent-card-art");
      card.disabled = !unlocked;
      card.classList.toggle("locked", !unlocked);
      card.setAttribute("aria-disabled", unlocked ? "false" : "true");
      if (art) art.src = unlocked ? card.dataset.unlockedSrc : "/assets/cards/locked_card.png";
    });
  }

  function unlockNextOpponent() {
    const opponentIndex = Math.max(0, selectedOpponentIndex);
    if (opponentIndex + 1 >= SOLO_OPPONENTS.length) return false;
    const nextUnlockedCount = opponentIndex + 2;
    unlockedOpponentCount = readSoloProgress();
    if (unlockedOpponentCount >= nextUnlockedCount) return false;
    unlockedOpponentCount = nextUnlockedCount;
    saveSoloProgress();
    syncMaiaStatus();
    applyOpponentLocks();
    return true;
  }

  function showGame() {
    lobbyEl.style.display = "none";
    setGameOpponentTheme();
    updateGameScore();
    gameEl.style.display  = "flex";
    if (!board) {
      board = new Chessboard(document.getElementById("board"), {
        position: chess.fen(),
        orientation: COLOR.white,
        assetsUrl: CDN,
        style: { pieces: { file: CDN + "pieces/staunty.svg" } },
        extensions: [{ class: Markers }],
      });
    }
  }

  function showLobby() {
    gameEl.style.display  = "none";
    lobbyEl.style.display = "";
    showPlayView();
    if (soloActive) clearSoloGame();
    if (location.search.includes("room=") || location.pathname !== "/")
      history.replaceState(null, "", "/");
  }

  function shouldWarnBeforeExitingGame() {
    return gameEl.style.display !== "none" && !chess.isGameOver();
  }

  function confirmExitGame() {
    if (!shouldWarnBeforeExitingGame()) return true;
    const message = coop?.phase !== "off"
      ? "Exit this game? You will leave the current room."
      : "Exit this game? Your current solo game will be discarded.";
    return window.confirm(message);
  }

  function saveSoloGame() {
    if (!soloActive || coop.phase !== "off") return;
    localStorage.setItem(SOLO_GAME_KEY, JSON.stringify({
      fen: chess.fen(),
      strength: getElo(),
      opponentTheme: selectedOpponentTheme,
      opponentIndex: selectedOpponentIndex,
      savedAt: Date.now(),
    }));
  }

  function clearSoloGame() {
    soloActive = false;
    localStorage.removeItem(SOLO_GAME_KEY);
    localStorage.removeItem(LEGACY_SOLO_GAME_KEY);
  }

  function beginSoloGame() {
    chess.reset();
    soloActive = true;
    cpChips.innerHTML = "";
    hideOutcomeBanner();
    hideModelLoading();
    setSoloGameUrl();
    showGame();
    board.setPosition(chess.fen());
    board.removeMarkers(LAST_MOVE);
    chessnut.lastPlacement = "";
    chessnut.lastOrientedPlacement = "";
    updateGameScore();
    board.enableMoveInput(inputHandler);
    botThinking = false;
    setStatus("Your turn");
    saveSoloGame();
  }

  function startSoloGame() {
    if (soloStartBtn.disabled) return;
    if (!modelReady) {
      pendingSoloStart = true;
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }

    beginSoloGame();
  }

  function startSelectedGame() {
    if (setupMode === "coop") {
      startCoopWithSelectedBot();
      return;
    }
    startSoloGame();
  }

  function restoreSoloGame() {
    if (location.search.includes("room=")) return;
    const saved = localStorage.getItem(SOLO_GAME_KEY) || localStorage.getItem(LEGACY_SOLO_GAME_KEY);
    if (!saved) return;
    try {
      const state = JSON.parse(saved);
      if (!state?.fen) return;
      chess.load(state.fen);
      soloActive = true;
      if (state.strength) syncStrength(String(state.strength));
      selectedOpponentIndex = Number(state.opponentIndex || 0);
      selectedOpponentTheme = state.opponentTheme || opponentThemeForStrength(state.strength || getElo());
      cpChips.innerHTML = "";
      showGame();
      board.setPosition(chess.fen(), false);
      board.removeMarkers(LAST_MOVE);
      updateGameScore();
      botThinking = false;
      if (checkGameOver()) return;
      board.enableMoveInput(inputHandler);
      if (chess.turn() === "w") {
        setStatus(modelReady ? "Your turn" : "Preparing game...");
      } else {
        setStatus(modelReady ? "Thinking…" : "Preparing game...", modelReady ? "thinking" : "");
        maybeRunSoloBotTurn();
      }
    } catch {
      clearSoloGame();
    }
  }

  function checkGameOver() {
    if (chess.isCheckmate()) {
      const playerWon = chess.turn() === "b";
      const canUnlockProgress = soloActive || coop?.phase === "playing" || coop?.phase === "over";
      const unlockedNext = playerWon && canUnlockProgress && unlockNextOpponent();
      showOutcomeBannerAfterDelay(playerWon ? "victory" : "defeat");
      setStatus(unlockedNext ? "New opponent unlocked." : "Checkmate", "over");
      board.disableMoveInput();
      return true;
    }
    if (chess.isDraw()) {
      const reason = chess.isStalemate() ? "Stalemate"
        : chess.isInsufficientMaterial() ? "Insufficient material" : "Draw";
      setStatus(reason, "over");
      hideOutcomeBanner();
      board.disableMoveInput();
      return true;
    }
    hideOutcomeBanner();
    return false;
  }

  async function botMove() {
    if (chess.isGameOver() || !modelReady || botThinking) return;
    botThinking = true;
    setStatus("Thinking…", "thinking");

    const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
    const legalMask = buildLegalMask(workingFen, allMovesMaia3);

    const { logitsMove } = await runInference(tokens, getElo());
    const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesMaia3Reversed);
    const uci = sampleMove(moveProbs);

    commitBotMove(uci);

    botThinking = false;
    saveSoloGame();
    if (!checkGameOver()) setStatus("Your turn");
  }

  function maybeRunSoloBotTurn() {
    if (soloActive && coop?.phase === "off" && gameEl.style.display !== "none"
      && chess.turn() === "b" && modelReady && !botThinking && !chess.isGameOver())
      setTimeout(botMove, 300);
  }

  function inputHandler(event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted:
        if (coop.phase === "playing")
          return !coop.midTurn && coop.activeIdx === coop.myIdx && modelReady;
        return chess.turn() === "w" && !botThinking && modelReady && !chess.isGameOver();

      case INPUT_EVENT_TYPE.validateMoveInput: {
        return applyPlayerMove(event.squareFrom, event.squareTo, "q");
      }
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    document.querySelector("#board svg")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }, { capture: true });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (["localhost", "127.0.0.1"].includes(location.hostname))
    new EventSource("/dev-reload").onmessage = (e) => { if (e.data === "reload") location.reload(); };

  // ── Lobby UI ──────────────────────────────────────────────────────────────

  const lbMain       = document.getElementById("lb-main");
  const lbSolo       = document.getElementById("lb-solo");
  const lbRoom       = document.getElementById("lb-room");
  const lbProfile    = document.getElementById("lb-profile");
  const lbFriends    = document.getElementById("lb-friends");
  const lbFriendInvite = document.getElementById("lb-friend-invite");
  const cpPlayerList = document.getElementById("cp-player-list");
  const cpStartBtn   = document.getElementById("cp-start");
  const cpLeaveBtn   = document.getElementById("cp-leave");
  const cpRoomMeta   = document.getElementById("cp-room-meta");
  const cpInviteMessage = document.getElementById("cp-invite-message");
  const cpInviteList = document.getElementById("cp-invite-list");
  const backBtn      = document.getElementById("back-btn");
  const authBar      = document.getElementById("auth-bar");
  const authLabel    = document.getElementById("auth-label");
  const authBtn      = document.getElementById("auth-btn");
  const profileAccountCard = document.getElementById("profile-account-card");
  const profileAccountName = document.getElementById("profile-account-name");
  const profileAuthBtn = document.getElementById("profile-auth-btn");
  const devLoginCard = document.getElementById("dev-login-card");
  const devLoginOptions = document.getElementById("dev-login-options");
  const navPlay      = document.getElementById("nav-play");
  const navProfile   = document.getElementById("nav-profile");
  const navFriends   = document.getElementById("nav-friends");
  const coopInviteNotice = document.getElementById("coop-invite-notice");
  const coopInviteText = document.getElementById("coop-invite-text");
  const coopInviteJoin = document.getElementById("coop-invite-join");
  const coopInviteDismiss = document.getElementById("coop-invite-dismiss");
  const welcomeName  = document.getElementById("welcome-name");
  const botSelectTitle = document.getElementById("bot-select-title");
  const soloStartBtn = document.getElementById("solo-start-btn");
  const soloBackBtn  = document.getElementById("solo-back-btn");
  opponentCards = Array.from(document.querySelectorAll("[data-opponent-strength]"));
  const friendSearch = document.getElementById("friend-search");
  const profileUsername = document.getElementById("profile-username");
  const usernameSaveBtn = document.getElementById("username-save");
  const usernameHelp = document.getElementById("username-help");
  const friendMessage = document.getElementById("friend-message");
  const friendRequestsEl = document.getElementById("friend-requests");
  const friendResultsEl = document.getElementById("friend-results");
  const friendListEl = document.getElementById("friend-list");
  const friendInviteLink = document.getElementById("friend-invite-link");
  const friendLinkCopy = document.getElementById("friend-link-copy");
  const friendLinkShare = document.getElementById("friend-link-share");
  const friendAddDialog = document.getElementById("friend-add-dialog");
  const friendAddClose = document.getElementById("friend-add-close");
  const friendInviteLanding = document.getElementById("friend-invite-landing");
  const searchParams = new URLSearchParams(location.search);
  const friendInvitePathMatch = location.pathname.match(/^\/plsbemyfriend\/([^/]+)$/);
  const incomingFriendUsername = friendInvitePathMatch
    ? decodeURIComponent(friendInvitePathMatch[1])
    : searchParams.get("friend");
  const initialView = searchParams.get("view");

  function setNavActive(target) {
    navPlay.classList.toggle("active", target === "play");
    navProfile.classList.toggle("active", target === "profile");
    navFriends.classList.toggle("active", target === "friends");
  }

  const coopInviteState = {
    loading: false,
    error: "",
    friends: [],
    sent: new Set(),
    busyKey: "",
  };

  async function apiJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  function setViewUrl(view) {
    if (location.search.includes("room=")) return;
    const target = view === "play" ? "/" : `/?view=${view}`;
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  function setSoloGameUrl() {
    if (location.search.includes("room=")) return;
    const target = "/?game=solo";
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  let social = null;
  const closeAddFriendDialog = (options) => social?.closeAddFriendDialog(options);
  const loadFriendInviteLanding = (...args) => social.loadFriendInviteLanding(...args);
  const loadInviteNotifications = (...args) => social.loadInviteNotifications(...args);
  const renderInviteNotification = (...args) => social?.renderInviteNotification(...args);
  const runFriendAction = (...args) => social.runFriendAction(...args);
  const showFriendsView = (...args) => social.showFriendsView(...args);
  const showProfileView = (...args) => social.showProfileView(...args);
  const startPresenceHeartbeat = (...args) => social.startPresenceHeartbeat(...args);

  function showPlayView() {
    setViewUrl("play");
    setNavActive("play");
    closeAddFriendDialog({ render: false });
    if (!pendingSoloStart) hideModelLoading();
    lbMain.style.display = "flex";
    lbSolo.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbFriendInvite.style.display = "none";
    renderInviteNotification();
  }

  function showBotSelection(mode = "solo") {
    setViewUrl(mode);
    setupMode = mode;
    closeAddFriendDialog({ render: false });
    setNavActive("play");
    applyOpponentLocks();
    clearOpponentSelection();
    botSelectTitle.textContent = mode === "coop" ? "Choose your opponent" : "Choose your opponent";
    soloStartBtn.querySelector("span").textContent = mode === "coop" ? "Start" : "Continue";
    lbMain.style.display = "none";
    lbSolo.style.display = "flex";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbFriendInvite.style.display = "none";
    renderInviteNotification();
  }

  function showSoloSetup() {
    showBotSelection("solo");
  }

  function showCoopBotSelection() {
    showBotSelection("coop");
  }

  const urlRoom = new URLSearchParams(location.search).get("room");
  const urlGame = new URLSearchParams(location.search).get("game");
  const LAST_ROOM_KEY = storageKey("last-room");
  const LEGACY_LAST_ROOM_KEY = legacyStorageKey("last-room");
  const nameKey = (roomId) => storageKey(`room.${roomId}.name`);
  const legacyNameKey = (roomId) => legacyStorageKey(`room.${roomId}.name`);
  const playerKey = (roomId) => storageKey(`room.${roomId}.playerId`);

  function storedPlayerName(roomId) {
    return roomId ? (localStorage.getItem(nameKey(roomId)) || localStorage.getItem(legacyNameKey(roomId)) || "") : "";
  }

  function storedPlayerId(roomId) {
    return roomId ? (localStorage.getItem(playerKey(roomId)) || "") : "";
  }

  function rememberRoom(roomId, name, playerId) {
    if (!roomId) return;
    localStorage.setItem(LAST_ROOM_KEY, roomId);
    localStorage.removeItem(LEGACY_LAST_ROOM_KEY);
    if (name) localStorage.setItem(nameKey(roomId), name);
    if (playerId) localStorage.setItem(playerKey(roomId), playerId);
  }

  function coopPlayerName(roomId) {
    return authInfo.user?.username
      || authInfo.user?.name
      || authInfo.user?.email
      || storedPlayerName(roomId)
      || "Player";
  }

  function setRoomUrl(roomId) {
    const target = `/?room=${roomId}`;
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  const currentNextPath = () => location.pathname + location.search;
  let authInfo = { authEnabled: false, user: null, loginUrl: "/auth/google", logoutUrl: "/auth/logout" };

  function renderDevLogin() {
    const users = authInfo.devLoginUsers || [];
    const canShow = authInfo.localAuthEnabled && !authInfo.user && users.length > 0;
    devLoginCard.style.display = canShow ? "flex" : "none";
    devLoginOptions.innerHTML = canShow
      ? users.map(user => `
        <button class="sm-btn primary-mini" type="button" data-dev-login-url="${escapeHtml(user.loginUrl)}">
          ${escapeHtml(user.name)}
        </button>
      `).join("")
      : "";
  }

  async function loadAuth() {
    try {
      authInfo = await fetch(`/api/me?next=${encodeURIComponent(currentNextPath())}`).then(r => r.json());
    } catch {
      authInfo = { authEnabled: false, user: null, loginUrl: "/auth/google", logoutUrl: "/auth/logout" };
    }

    if (!authInfo.authEnabled) {
      authBar.style.display = "none";
      profileAccountCard.style.display = "none";
      renderDevLogin();
      return;
    }

    authBar.style.display = "none";
    profileAccountCard.style.display = "flex";
    renderDevLogin();
    if (authInfo.user) {
      const accountName = authInfo.user.name || authInfo.user.email || "Signed in";
      authLabel.textContent = accountName;
      profileAccountName.textContent = accountName;
      welcomeName.textContent = authInfo.user.username || authInfo.user.name || "Wanderer";
      authBtn.textContent = "Sign out";
      authBtn.onclick = () => { location.href = authInfo.logoutUrl; };
      profileAuthBtn.textContent = "Sign out";
      profileAuthBtn.onclick = () => { location.href = authInfo.logoutUrl; };
    } else {
      authLabel.textContent = "Sign in to save games";
      authBtn.textContent = "Sign in";
      authBtn.onclick = () => { location.href = authInfo.loginUrl; };
      profileAccountName.textContent = "Not signed in";
      profileAuthBtn.textContent = "Sign in";
      profileAuthBtn.onclick = () => { location.href = authInfo.loginUrl; };
    }
  }

  await loadAuth();

  function promptSignIn() {
    if (authInfo.localAuthEnabled && (authInfo.devLoginUsers || []).length) {
      showProfileView();
      return;
    }
    location.href = authInfo.loginUrl;
  }

  social = createSocialController({
    apiJson,
    elements: {
      coopInviteDismiss,
      coopInviteJoin,
      coopInviteNotice,
      coopInviteText,
      friendAddClose,
      friendAddDialog,
      friendInviteLanding,
      friendInviteLink,
      friendLinkCopy,
      friendLinkShare,
      friendListEl,
      friendMessage,
      friendRequestsEl,
      friendResultsEl,
      friendSearch,
      lbFriendInvite,
      lbFriends,
      lbMain,
      lbProfile,
      lbRoom,
      lbSolo,
      navFriends,
      navProfile,
      profileUsername,
      usernameHelp,
      usernameSaveBtn,
    },
    getAuthInfo: () => authInfo,
    setAuthUser: (user) => { authInfo.user = user; },
    getCoopPhase: () => coop?.phase || "off",
    hideModelLoading,
    incomingFriendUsername,
    promptSignIn,
    setNavActive,
    setViewUrl,
  });
  social.bindEvents();

  navPlay.onclick = () => showPlayView();
  devLoginOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dev-login-url]");
    if (!button) return;
    location.href = button.dataset.devLoginUrl;
  });
  document.getElementById("play-solo-btn").onclick = () => {
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    showSoloSetup();
  };
  opponentCards.forEach(card => {
    card.onclick = () => {
      if (card.disabled || card.classList.contains("locked")) return;
      syncStrength(card.dataset.opponentStrength);
      selectedOpponentIndex = Number(card.dataset.opponentIndex || 0);
      selectedOpponentTheme = card.dataset.opponentTheme || opponentThemeForStrength(card.dataset.opponentStrength);
      updateOpponentSelection(card.dataset.opponentStrength);
      soloStartBtn.disabled = false;
    };
  });
  applyOpponentLocks();
  clearOpponentSelection();
  soloStartBtn.onclick = () => startSelectedGame();
  soloBackBtn.onclick = () => {
    pendingSoloStart = false;
    if (setupMode === "coop" && coop.phase === "lobby") {
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
      lbFriendInvite.style.display = "none";
      renderRoomLobby(coop.players || [], coop.myIdx);
      return;
    }
    showPlayView();
  };

  document.getElementById("play-coop-btn").onclick = () => {
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    connectCoop("create");
  };

  cpStartBtn.onclick = () => showCoopBotSelection();
  cpLeaveBtn.onclick = () => leaveCoop();

  cpInviteList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-coop-invite-user-id]");
    if (!button) return;
    sendCoopInvite(button.dataset.coopInviteUserId);
  });

  coopInviteJoin.onclick = () => {
    const roomId = coopInviteJoin.dataset.roomId;
    if (!roomId) return;
    location.href = `/?room=${encodeURIComponent(roomId)}`;
  };

  coopInviteDismiss.onclick = () => {
    const inviteId = coopInviteDismiss.dataset.inviteId;
    if (!inviteId) return;
    runFriendAction(`dismiss-invite:${inviteId}`, () => apiJson(`/api/coop/invites/${inviteId}/dismiss`, { method: "POST" }));
  };

  boardConnectBtn.onclick = () => connectChessnutBoard();
  boardDisconnectBtn.onclick = () => disconnectChessnutBoard();
  if (!navigator.bluetooth) setBoardDeviceStatus("Chrome or Edge required", "warning");
  updateBoardDeviceUi();

  backBtn.onclick = () => {
    if (!confirmExitGame()) return;
    if (coop.phase !== "off") leaveCoop();
    else showLobby();
  };
  outcomeContinueBtn.onclick = () => {
    hideOutcomeBanner();
    if (coop.phase !== "off") leaveCoop();
    else showLobby();
  };

  // ── Coop mode ─────────────────────────────────────────────────────────────

  coop = {
    ws: null, roomId: null,
    playerId: null,
    myIdx: -1,
    phase: "off",
    players: [], activeIdx: 0, midTurn: false, fen: null,
    maxUnlockedOpponentCount: 1,
    strength: 1500,
    leaving: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
  };

  function allPlayersReady(players) {
    return players.length > 0 && players.every(player => player.maiaReady);
  }

  function renderCoopInviteFriends() {
    cpInviteMessage.textContent = coopInviteState.error;
    cpInviteMessage.className = `friend-message${coopInviteState.error ? " visible" : ""}`;

    if (!authInfo.user) {
      cpInviteList.innerHTML = `
        <div class="empty-state friend-empty">
          <div>
            <strong>Sign in to invite friends</strong>
            <span>Co-op rooms are connected to your account.</span>
          </div>
        </div>
      `;
      return;
    }

    if (coopInviteState.loading) {
      cpInviteList.innerHTML = `<div class="empty-state friend-empty">Loading friends...</div>`;
      return;
    }

    const joinedUserIds = new Set((coop.players || []).map(player => player.userId).filter(Boolean));
    const friends = coopInviteState.friends.filter(friend => !joinedUserIds.has(friend.id));
    cpInviteList.innerHTML = friends.map(friend => {
      const sent = coopInviteState.sent.has(friend.id);
      const busy = coopInviteState.busyKey === friend.id;
      return friendRow(
        friend,
        sent ? "Invite sent" : friendMeta(friend),
        `<button class="sm-btn ${sent ? "" : "primary-mini"}" type="button" data-coop-invite-user-id="${escapeHtml(friend.id)}" ${sent || busy ? "disabled" : ""}>${busy ? "Sending..." : sent ? "Sent" : "Invite"}</button>`
      );
    }).join("") || `
      <div class="empty-state friend-empty">
        <div>
          <strong>No friends to invite</strong>
          <span>Add friends first, then invite them here.</span>
        </div>
      </div>
    `;
  }

  async function loadCoopInviteFriends() {
    if (!authInfo.user || !coop.roomId) {
      renderCoopInviteFriends();
      return;
    }
    coopInviteState.loading = true;
    coopInviteState.error = "";
    renderCoopInviteFriends();
    try {
      const payload = await apiJson("/api/friends");
      coopInviteState.friends = payload.friends || [];
    } catch (err) {
      coopInviteState.error = err.message;
      coopInviteState.friends = [];
    } finally {
      coopInviteState.loading = false;
      renderCoopInviteFriends();
    }
  }

  async function sendCoopInvite(userId) {
    if (!coop.roomId || !userId) return;
    coopInviteState.busyKey = userId;
    coopInviteState.error = "";
    renderCoopInviteFriends();
    try {
      await apiJson("/api/coop/invites", {
        method: "POST",
        body: JSON.stringify({ roomId: coop.roomId, userId }),
      });
      coopInviteState.sent.add(userId);
    } catch (err) {
      coopInviteState.error = err.message;
    } finally {
      coopInviteState.busyKey = "";
      renderCoopInviteFriends();
    }
  }

  function startCoopWithSelectedBot() {
    if (soloStartBtn.disabled || coop.phase !== "lobby" || coop.myIdx !== 0) return;
    if (!modelReady) {
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }
    coop.ws?.send(JSON.stringify({ type: "strength", strength: getElo() }));
    coop.ws?.send(JSON.stringify({ type: "start" }));
  }

  function renderRoomLobby(players, myIdx) {
    cpPlayerList.innerHTML = "";
    players.forEach((player, i) => {
      const row = document.createElement("div");
      row.className = "player-row";

      const name = document.createElement("div");
      name.className = "player-name";
      const unlocked = Number(player.unlockedCount || 1);
      name.textContent = `${player.name}${i === myIdx ? " (you)" : ""} · ${unlocked} bot${unlocked === 1 ? "" : "s"}`;

      const status = document.createElement("div");
      const statusText = player.connected
        ? (player.maiaReady ? "Ready" : "Preparing")
        : "Offline";
      status.className = "player-status"
        + (statusText === "Ready" ? " ready" : "")
        + (statusText === "Preparing" ? " waiting" : "");
      status.textContent = statusText;

      row.append(name, status);
      cpPlayerList.appendChild(row);
    });

    const host = myIdx === 0;
    const ready = allPlayersReady(players);
    const connectedPlayers = players.filter(player => player.connected);
    const hasCoopPartner = connectedPlayers.length >= 2;
    cpRoomMeta.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;
    cpStartBtn.style.display = host ? "inline" : "none";
    cpStartBtn.disabled = !ready || !hasCoopPartner;
    cpStartBtn.textContent = ready && hasCoopPartner ? "Continue" : "Waiting...";
    cpStartBtn.title = !hasCoopPartner
      ? "Invite at least one friend before choosing an opponent."
      : ready ? "" : "The game is loading on all players' devices.";
    if (ready || !host) hideModelLoading();
    else showModelLoading("Preparing game...");
    renderCoopInviteFriends();
  }

  function clearReconnectTimer() {
    if (!coop?.reconnectTimer) return;
    clearTimeout(coop.reconnectTimer);
    coop.reconnectTimer = null;
  }

  function connectCoop(action, opts = {}) {
    const roomId = opts.roomId || new URLSearchParams(location.search).get("room") || coop.roomId;
    const name = opts.name || coopPlayerName(roomId);
    clearReconnectTimer();
    coop.leaving = false;
    const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProto}//${location.host}`);
    coop.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(
      action === "create"
        ? { type: "create", name,
            strength: getElo(), maiaReady: modelReady, unlockedOpponentCount: readSoloProgress() }
        : {
            type: "join",
            roomId,
            name,
            playerId: opts.playerId || coop.playerId || storedPlayerId(roomId),
            maiaReady: modelReady,
            unlockedOpponentCount: readSoloProgress(),
          }
    ));
    ws.onmessage = ({ data }) => handleCoopMsg(JSON.parse(data));
    ws.onclose   = () => {
      if (coop.ws !== ws) return;
      handleCoopDisconnect();
    };
    ws.onerror   = () => ws.close();
  }

  function handleCoopDisconnect() {
    coop.ws = null;
    if (coop.leaving || coop.phase === "off") {
      coop.leaving = false;
      return;
    }

    const roomId = coop.roomId || new URLSearchParams(location.search).get("room");
    const name = coopPlayerName(roomId);
    if (!roomId || !name) {
      leaveCoop();
      return;
    }

    if (coop.phase === "lobby") {
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
      lbFriendInvite.style.display = "none";
      cpRoomMeta.textContent = "Reconnecting…";
      cpStartBtn.disabled = true;
    } else if (coop.phase === "playing") {
      board?.disableMoveInput();
      setStatus("Reconnecting…", "thinking");
    }

    const delay = Math.min(1000 * 2 ** coop.reconnectAttempts, 8000);
    coop.reconnectAttempts += 1;
    coop.reconnectTimer = setTimeout(() => {
      connectCoop("join", {
        roomId,
        name,
        playerId: coop.playerId || storedPlayerId(roomId),
      });
    }, delay);
  }

  async function handleCoopMsg(msg) {
    if (msg.type === "error") {
      if (msg.code === "auth-required") {
        location.href = authInfo.loginUrl || `/auth/google?next=${encodeURIComponent(currentNextPath())}`;
        return;
      }
      if (msg.code === "waiting-for-maia") {
        showModelLoading("Preparing game...");
        alert(msg.message.replace("Waiting for Maia on:", "The game is still loading for:"));
        return;
      }
      alert(msg.message);
      showPlayView();
      return;
    }

    if (msg.type === "created") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.reconnectAttempts = 0;
      coopInviteState.sent.clear();
      rememberRoom(msg.roomId, coopPlayerName(msg.roomId), msg.playerId);
      setRoomUrl(msg.roomId);
      loadCoopInviteFriends();
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
      lbFriendInvite.style.display = "none";
      coop.phase = "lobby";
      return;
    }

    if (msg.type === "joined") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.reconnectAttempts = 0;
      rememberRoom(msg.roomId, coopPlayerName(msg.roomId), msg.playerId);
      setRoomUrl(msg.roomId);
      loadCoopInviteFriends();
      loadInviteNotifications();
      return;
    }

    if (msg.type === "room-state") {
      coop.roomId    = msg.roomId;
      coop.playerId  = msg.playerId;
      coop.players   = msg.players;
      coop.activeIdx = msg.activeIdx;
      coop.midTurn   = msg.midTurn;
      coop.fen       = msg.fen;
      coop.myIdx     = msg.myIdx;
      coop.strength  = msg.strength;
      coop.maxUnlockedOpponentCount = Math.max(readSoloProgress(), Number(msg.maxUnlockedOpponentCount || 1));
      coop.reconnectAttempts = 0;
      if (msg.strength) syncStrength(String(msg.strength));

      if (msg.phase === "lobby") {
        coop.phase = "lobby";
        if (setupMode === "coop" && lbSolo.style.display !== "none" && msg.myIdx === 0) {
          applyOpponentLocks();
          if (!coopInviteState.friends.length && !coopInviteState.loading) loadCoopInviteFriends();
          return;
        }
        lbMain.style.display = "none";
        lbSolo.style.display = "none";
        lbRoom.style.display = "flex";
        lbProfile.style.display = "none";
        lbFriends.style.display = "none";
        lbFriendInvite.style.display = "none";
        if (!coopInviteState.friends.length && !coopInviteState.loading) loadCoopInviteFriends();
        renderRoomLobby(msg.players, msg.myIdx);
        return;
      }

      if (msg.phase === "playing" || msg.phase === "over") {
        const wasInActiveGame = coop.phase === "playing" || coop.phase === "over";
        coop.phase = msg.phase;

        if (!wasInActiveGame) {
      chess.load(msg.fen);
      cpChips.innerHTML = "";
      showGame();
      board.setPosition(msg.fen, false);
      board.removeMarkers(LAST_MOVE);
      updateChessnutDiffLeds();
      updateGameScore();
          board.enableMoveInput(inputHandler);
          hideOutcomeBanner();
        }

        // Render chips
        cpChips.innerHTML = "";
        msg.players.forEach((p, i) => {
          const chip = document.createElement("span");
          chip.className = "chip"
            + (i === msg.activeIdx && !msg.midTurn ? " active" : "")
            + (i === msg.myIdx ? " me" : "");
          chip.textContent = p.name;
          cpChips.appendChild(chip);
        });
        if (msg.midTurn) {
          const bot = document.createElement("span");
          bot.className = "chip active";
          bot.textContent = "Maia";
          cpChips.appendChild(bot);
        }

        if (msg.fen !== chess.fen()) applyRemoteFen(msg.fen);

        if (msg.phase === "over") {
          checkGameOver();
          board.disableMoveInput();
        } else if (msg.activeIdx === msg.myIdx && !msg.midTurn) {
          hideOutcomeBanner();
          board.enableMoveInput(inputHandler);
          setCoopTurnStatus();
        } else {
          hideOutcomeBanner();
          board.disableMoveInput();
          setCoopTurnStatus();
        }
        maybeRunCoopBotTurn();
      }
    }
  }

  function maybeRunCoopBotTurn() {
    if (coop?.phase === "playing" && coop.activeIdx === coop.myIdx && coop.midTurn && modelReady && !botThinking)
      setTimeout(coopBotMove, 300);
  }

  async function coopBotMove() {
    if (!modelReady || botThinking) return;
    botThinking = true;
    try {
      setStatus("Thinking…", "thinking");
      const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
      const legalMask = buildLegalMask(workingFen, allMovesMaia3);

      const { logitsMove } = await runInference(tokens, coop.strength);
      const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesMaia3Reversed);
      const uci = sampleMove(moveProbs);

      commitBotMove(uci);
      publishCoopMove();
    } finally {
      botThinking = false;
    }
  }

  function leaveCoop() {
    clearReconnectTimer();
    coop.leaving = true;
    coop.ws?.close();
    coop.ws    = null;
    coop.phase = "off";
    setupMode = "solo";
    showLobby();
  }

  if (authInfo.user) {
    startPresenceHeartbeat();
    loadInviteNotifications();
    invitePollTimer = window.setInterval(loadInviteNotifications, 5000);
  }

  if (urlRoom) {
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
    } else {
      connectCoop("join", { roomId: urlRoom });
    }
  } else if (incomingFriendUsername) {
    await loadFriendInviteLanding();
  } else if (urlGame === "solo") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else restoreSoloGame();
  } else if (initialView === "profile") {
    showProfileView();
  } else if (initialView === "friends") {
    showFriendsView();
  } else if (initialView === "solo") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else showSoloSetup();
  } else if (initialView === "coop") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else connectCoop("create");
  } else if (authInfo.authEnabled && !authInfo.user) {
    promptSignIn();
  } else {
    restoreSoloGame();
  }
    })().catch((err) => {
      console.error(err);
    });
    return () => {
      disposed = true;
      if (invitePollTimer) window.clearInterval(invitePollTimer);
      if (outcomeBannerTimer) window.clearTimeout(outcomeBannerTimer);
      social?.stopPresenceHeartbeat();
      disconnectChessnutBoard();
    };
  }, []);

  return (
    <div className="app">
      <Lobby />
      <GameView />
      <FriendAddDialog />
    </div>
  );
}
