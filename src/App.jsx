import { useEffect } from "react";
import { Chessboard, COLOR, INPUT_EVENT_TYPE } from "cm-chessboard";
import { Markers } from "cm-chessboard/src/extensions/markers/Markers.js";
import { Chess } from "chess.js";

function SideMenu() {
  return (
    <nav className="side-menu" aria-label="Main navigation">
      <div className="side-brand">Chessquestia</div>
      <button id="nav-play" className="side-link active" type="button"><img className="nav-icon" src="/assets/icons/solo_icon.png" alt="" />Home</button>
      <button id="nav-profile" className="side-link" type="button"><img className="nav-icon" src="/assets/icons/profile-icon.png" alt="" />Profile</button>
      <button id="nav-friends" className="side-link" type="button"><img className="nav-icon" src="/assets/icons/friends-icon.png" alt="" />Friends</button>
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
        <button id="play-coop-btn" className="mode-card disabled" type="button" disabled aria-disabled="true">
          <img src="/assets/buttons/coop_button.png" alt="" />
          <span className="mode-card-copy">
            <strong><img className="mode-title-icon" src="/assets/icons/coop-icon.png" alt="" />Co-op</strong>
            <span>Coming soon....</span>
          </span>
        </button>
      </div>
    </div>
  );
}

const SOLO_OPPONENTS = [
  { name: "Snib the Candle Goblin", elo: 500, card: "snib_card.png", rank: 1, tone: "easy", theme: "imp" },
  { name: "Muckroot the Bog Imp", elo: 600, card: "muckroot_card.png", rank: 2, tone: "easy", theme: "imp" },
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
        <h2>Choose your opponent</h2>
        <span className="home-divider" aria-hidden="true"></span>
      </div>
      <input type="hidden" id="strength-slider" defaultValue="1500" />
      <span id="strength-val" className="sr-only">1500</span>
      <div className="opponent-grid" aria-label="Choose your opponent">
        {SOLO_OPPONENTS.map((opponent) => (
          <button
            key={opponent.elo}
            className="opponent-card"
            type="button"
            data-opponent-strength={opponent.elo}
            data-opponent-theme={opponent.theme}
            aria-pressed="false"
          >
            <img className="opponent-card-art" src={`/assets/cards/${opponent.card}`} alt="" />
            <span className="opponent-card-copy">
              <strong>{opponent.name}</strong>
              <OpponentRank rank={opponent.rank} />
            </span>
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
        <div className="panel-kicker">Players</div>
      </div>
      <div className="friend-tools">
        <input id="friend-search" placeholder="Search username" autoComplete="off" autoCapitalize="none" />
      </div>
      <div id="friend-message" className="friend-message"></div>
      <div id="friend-requests" className="friend-section"></div>
      <div id="friend-results" className="friend-section"></div>
      <div id="friend-list" className="friend-section"></div>
    </div>
  );
}

function ProfilePanel() {
  return (
    <div id="lb-profile" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Profile</div>
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
    </div>
  );
}

function CoopNamePanel() {
  return (
    <div id="lb-connect" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title" id="cp-flow-title">Create game</div>
        <div className="panel-kicker" id="cp-flow-kicker">New room</div>
      </div>
      <input id="cp-name" placeholder="Your name" maxLength="20" autoComplete="off" />
      <div className="lb-btns">
        <button id="cp-connect-btn" className="lb-btn primary" type="button">Create Game</button>
        <button id="lb-back-btn" className="lb-btn" type="button">Back</button>
      </div>
    </div>
  );
}

function CoopRoomPanel() {
  return (
    <div id="lb-room" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Waiting room</div>
        <div className="panel-kicker" id="cp-room-meta">Lobby</div>
      </div>
      <div className="cp-link-row">
        <span id="cp-link"></span>
        <button id="cp-copy" className="sm-btn" type="button">Copy link</button>
      </div>
      <div className="lobby-settings" id="cp-strength-settings">
        <label>
          <span>Bot strength</span>
          <span id="connect-strength-val">1500</span>
        </label>
        <input type="range" id="connect-strength-slider" min="400" max="2800" step="50" defaultValue="1500" />
      </div>
      <div id="cp-player-list"></div>
      <div className="lb-btns room-actions">
        <button id="cp-start" className="lb-btn primary" style={{ display: "none" }} type="button">Start Game</button>
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
      <PlayPanel />
      <SinglePlayerSetup />
      <ProfilePanel />
      <FriendsPanel />
      <CoopNamePanel />
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
    (async () => {
      if (disposed) return;
const LAST_MOVE = { class: "last-move", slice: "markerSquare" };
  const CDN       = "/cm-chessboard/assets/";

  const strengthSlider = document.getElementById("strength-slider");
  const strengthVal    = document.getElementById("strength-val");
  const connectStrengthSlider = document.getElementById("connect-strength-slider");
  const connectStrengthVal = document.getElementById("connect-strength-val");
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
  function syncStrength(value) {
    strengthSlider.value = value;
    connectStrengthSlider.value = value;
    strengthVal.textContent = value;
    connectStrengthVal.textContent = value;
  }
  strengthSlider.oninput = () => syncStrength(strengthSlider.value);
  connectStrengthSlider.oninput = () => {
    syncStrength(connectStrengthSlider.value);
    if (coop?.phase === "lobby" && coop.myIdx === 0)
      coop.ws?.send(JSON.stringify({ type: "strength", strength: getElo() }));
  };
  const getElo = () => parseInt(strengthSlider.value);

  // ── Load move mappings ────────────────────────────────────────────────────

  const [allMovesMaia3, allMovesMaia3Reversed] = await Promise.all([
    fetch("/data/all_moves_maia3.json").then(r => r.json()),
    fetch("/data/all_moves_maia3_reversed.json").then(r => r.json()),
  ]);

  // ── Board encoding (ported from CSSLab tensor.ts) ─────────────────────────

  const PIECE_TYPES = "PNBRQKpnbrqk";

  function mirrorSquare(sq) { return sq[0] + (9 - parseInt(sq[1])); }

  function mirrorMove(uci) {
    return mirrorSquare(uci.slice(0, 2)) + mirrorSquare(uci.slice(2, 4)) + uci.slice(4);
  }

  function mirrorFEN(fen) {
    const [pos, , castling, ep, hm, fm] = fen.split(" ");
    const flip = { K: "k", Q: "q", k: "K", q: "Q" };
    const mirroredPos = pos.split("/").reverse()
      .map(r => r.replace(/[A-Za-z]/g, c => /[A-Z]/.test(c) ? c.toLowerCase() : c.toUpperCase()))
      .join("/");
    const mirroredCastling = castling === "-" ? "-" : castling.replace(/[KQkq]/g, c => flip[c]);
    return `${mirroredPos} w ${mirroredCastling} ${ep !== "-" ? mirrorSquare(ep) : "-"} ${hm} ${fm}`;
  }

  function boardToTokens(fen) {
    const tensor = new Float32Array(64 * 12);
    fen.split(" ")[0].split("/").forEach((row, rank) => {
      let file = 0;
      for (const c of row) {
        const n = parseInt(c);
        if (isNaN(n)) {
          const pi = PIECE_TYPES.indexOf(c);
          if (pi >= 0) tensor[((7 - rank) * 8 + file) * 12 + pi] = 1;
          file++;
        } else file += n;
      }
    });
    return tensor;
  }

  function buildLegalMask(workingFen) {
    const mask = new Float32Array(4352);
    for (const m of new Chess(workingFen).moves({ verbose: true })) {
      const idx = allMovesMaia3[m.from + m.to + (m.promotion || "")];
      if (idx !== undefined) mask[idx] = 1;
    }
    return mask;
  }

  function decodeMoves(logitsMove, legalMask, isBlack) {
    const legalIdx = Array.from(legalMask.keys()).filter(i => legalMask[i] > 0);
    const logits   = legalIdx.map(i => logitsMove[i]);
    const max      = Math.max(...logits);
    const exps     = logits.map(l => Math.exp(l - max));
    const sum      = exps.reduce((a, b) => a + b, 0);
    return Object.fromEntries(legalIdx.map((idx, j) => {
      let move = allMovesMaia3Reversed[String(idx)];
      if (isBlack) move = mirrorMove(move);
      return [move, exps[j] / sum];
    }));
  }

  function sampleMove(probs) {
    const moves = Object.keys(probs), weights = Object.values(probs);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < moves.length; i++) { r -= weights[i]; if (r <= 0) return moves[i]; }
    return moves[moves.length - 1];
  }

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
      coop.ws.send(JSON.stringify({ type: "maia-status", ready: modelReady }));
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
  const cpChips   = document.getElementById("cp-chips");
  const STORAGE_PREFIX = "chessquestia";
  const LEGACY_STORAGE_PREFIX = "local-chess";
  const storageKey = (suffix) => `${STORAGE_PREFIX}.${suffix}`;
  const legacyStorageKey = (suffix) => `${LEGACY_STORAGE_PREFIX}.${suffix}`;
  const SOLO_GAME_KEY = storageKey("solo-game");
  const LEGACY_SOLO_GAME_KEY = legacyStorageKey("solo-game");
  let board       = null;
  let botThinking = false;
  let soloActive  = false;
  let selectedOpponentTheme = "imp";

  function setStatus(text, cls = "") {
    statusEl.textContent = text;
    statusEl.className   = cls;
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

  function opponentThemeForStrength(value) {
    return parseInt(value, 10) <= 1000 ? "imp" : "witch";
  }

  function setGameOpponentTheme(value = getElo(), theme = selectedOpponentTheme) {
    gameEl.dataset.opponent = theme || opponentThemeForStrength(value);
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
    if (location.search.includes("room="))
      history.replaceState(null, "", location.pathname);
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
    hideModelLoading();
    showGame();
    board.setPosition(chess.fen());
    board.removeMarkers(LAST_MOVE);
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
      setStatus(chess.turn() === "w" ? "Black wins — Checkmate!" : "White wins — Checkmate!", "over");
      board.disableMoveInput();
      return true;
    }
    if (chess.isDraw()) {
      const reason = chess.isStalemate() ? "Stalemate"
        : chess.isInsufficientMaterial() ? "Insufficient material" : "Draw";
      setStatus(reason, "over");
      board.disableMoveInput();
      return true;
    }
    return false;
  }

  async function botMove() {
    if (chess.isGameOver() || !modelReady || botThinking) return;
    botThinking = true;
    setStatus("Thinking…", "thinking");

    const fen        = chess.fen();
    const isBlack    = fen.split(" ")[1] === "b";
    const elo        = getElo();
    const workingFen = isBlack ? mirrorFEN(fen) : fen;
    const tokens     = boardToTokens(workingFen);
    const legalMask  = buildLegalMask(workingFen);

    const { logitsMove } = await runInference(tokens, elo);
    const moveProbs = decodeMoves(logitsMove, legalMask, isBlack);
    const uci       = sampleMove(moveProbs);

    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
    board.setPosition(chess.fen());
    board.removeMarkers(LAST_MOVE);
    board.addMarker(LAST_MOVE, uci.slice(0, 2));
    board.addMarker(LAST_MOVE, uci.slice(2, 4));
    updateGameScore();

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
        try {
          chess.move({ from: event.squareFrom, to: event.squareTo, promotion: "q" });
          board.removeMarkers(LAST_MOVE);
          board.setPosition(chess.fen());
          updateGameScore();
          if (coop.phase === "playing") {
            coop.ws?.send(JSON.stringify({ type: "move", fen: chess.fen(), gameOver: chess.isGameOver() }));
            if (!chess.isGameOver()) { board.disableMoveInput(); setTimeout(coopBotMove, 300); }
          } else {
            saveSoloGame();
            if (!checkGameOver()) setTimeout(botMove, 300);
          }
          return true;
        } catch { return false; }
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
  const lbConnect    = document.getElementById("lb-connect");
  const lbRoom       = document.getElementById("lb-room");
  const lbProfile    = document.getElementById("lb-profile");
  const lbFriends    = document.getElementById("lb-friends");
  const cpNameInput  = document.getElementById("cp-name");
  const cpConnectBtn = document.getElementById("cp-connect-btn");
  const lbBackBtn    = document.getElementById("lb-back-btn");
  const cpLinkEl     = document.getElementById("cp-link");
  const cpCopyBtn    = document.getElementById("cp-copy");
  const cpPlayerList = document.getElementById("cp-player-list");
  const cpStartBtn   = document.getElementById("cp-start");
  const cpLeaveBtn   = document.getElementById("cp-leave");
  const cpFlowTitle  = document.getElementById("cp-flow-title");
  const cpFlowKicker = document.getElementById("cp-flow-kicker");
  const cpRoomMeta   = document.getElementById("cp-room-meta");
  const cpStrengthSettings = document.getElementById("cp-strength-settings");
  const backBtn      = document.getElementById("back-btn");
  const authBar      = document.getElementById("auth-bar");
  const authLabel    = document.getElementById("auth-label");
  const authBtn      = document.getElementById("auth-btn");
  const navPlay      = document.getElementById("nav-play");
  const navProfile   = document.getElementById("nav-profile");
  const navFriends   = document.getElementById("nav-friends");
  const welcomeName  = document.getElementById("welcome-name");
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

  function setNavActive(target) {
    navPlay.classList.toggle("active", target === "play");
    navProfile.classList.toggle("active", target === "profile");
    navFriends.classList.toggle("active", target === "friends");
  }

  const friendState = {
    loaded: false,
    loading: false,
    searching: false,
    searchQuery: "",
    friends: [],
    incoming: [],
    outgoing: [],
    results: [],
    error: "",
    busyKey: "",
  };
  let friendSearchTimer = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[ch]));
  }

  function friendName(person) {
    return person?.username || person?.name || person?.email || "Player";
  }

  function friendMeta(person) {
    return person?.name || person?.email || "Chessquestia player";
  }

  function friendAvatar(person) {
    const name = friendName(person);
    if (person?.picture) return `<img src="${escapeHtml(person.picture)}" alt="">`;
    return `<span>${escapeHtml(name.charAt(0).toUpperCase() || "P")}</span>`;
  }

  function friendRow(person, meta, actionHtml = "") {
    return `
      <article class="friend-card">
        <div class="friend-avatar">${friendAvatar(person)}</div>
        <div class="friend-card-body">
          <strong>${escapeHtml(friendName(person))}</strong>
          <span>${escapeHtml(meta || friendMeta(person))}</span>
        </div>
        ${actionHtml}
      </article>
    `;
  }

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

  function renderFriends() {
    friendMessage.textContent = friendState.error;
    friendMessage.className = `friend-message${friendState.error ? " visible" : ""}`;

    if (authInfo.authEnabled && !authInfo.user) {
      friendSearch.disabled = true;
      profileUsername.disabled = true;
      usernameSaveBtn.disabled = true;
      friendRequestsEl.innerHTML = "";
      friendResultsEl.innerHTML = "";
      friendListEl.innerHTML = `
        <div class="empty-state friend-empty">
          <div>
            <strong>Sign in to add friends</strong>
            <span>Friends are connected to your Google account.</span>
          </div>
        </div>
      `;
      return;
    }

    friendSearch.disabled = false;
    profileUsername.disabled = false;
    usernameSaveBtn.disabled = false;
    if (document.activeElement !== profileUsername)
      profileUsername.value = authInfo.user?.username || "";
    usernameHelp.textContent = authInfo.user?.username
      ? `Other players can find you as ${authInfo.user.username}.`
      : "Choose a username so other players can find you.";

    const incomingHtml = friendState.incoming.map(request => friendRow(
      { name: request.name, email: request.email, picture: request.picture },
      "Wants to be friends",
      `<div class="friend-actions">
        <button class="sm-btn primary-mini" type="button" data-friend-action="accept" data-request-id="${request.id}" ${friendState.busyKey === `accept:${request.id}` ? "disabled" : ""}>Accept</button>
        <button class="sm-btn" type="button" data-friend-action="decline" data-request-id="${request.id}" ${friendState.busyKey === `decline:${request.id}` ? "disabled" : ""}>Decline</button>
      </div>`
    )).join("");
    const outgoingHtml = friendState.outgoing.map(request => friendRow(
      { name: request.name, email: request.email, picture: request.picture },
      "Request sent",
      `<span class="friend-status-label">Pending</span>`
    )).join("");
    friendRequestsEl.innerHTML = incomingHtml || outgoingHtml
      ? `<div class="friend-section-title">Requests</div>${incomingHtml}${outgoingHtml}`
      : "";

    if (friendState.searchQuery.trim()) {
      const resultHtml = friendState.results.map(user => {
        let action = "";
        if (user.friendshipStatus === "friend") action = `<span class="friend-status-label">Friend</span>`;
        else if (user.friendshipStatus === "outgoing_pending") action = `<span class="friend-status-label">Sent</span>`;
        else if (user.friendshipStatus === "incoming_pending") action = `<span class="friend-status-label">Request received</span>`;
        else action = `<button class="sm-btn primary-mini" type="button" data-friend-action="add" data-user-id="${escapeHtml(user.id)}" ${friendState.busyKey === `add:${user.id}` ? "disabled" : ""}>Add</button>`;
        return friendRow(user, friendMeta(user), action);
      }).join("");
      friendResultsEl.innerHTML = `
        <div class="friend-section-title">Search results</div>
        ${friendState.searching ? `<div class="empty-state friend-empty">Searching...</div>` : resultHtml || `<div class="empty-state friend-empty">No players found.</div>`}
      `;
    } else {
      friendResultsEl.innerHTML = "";
    }

    if (friendState.loading) {
      friendListEl.innerHTML = `<div class="empty-state friend-empty">Loading friends...</div>`;
      return;
    }

    const friendsHtml = friendState.friends.map(friend => friendRow(
      friend,
      friendMeta(friend),
      `<button class="sm-btn" type="button" data-friend-action="remove" data-user-id="${escapeHtml(friend.id)}" ${friendState.busyKey === `remove:${friend.id}` ? "disabled" : ""}>Remove</button>`
    )).join("");
    friendListEl.innerHTML = `
      <div class="friend-section-title">Friends</div>
      ${friendsHtml || `<div class="empty-state friend-empty"><div><strong>No friends yet</strong><span>Search for someone who has signed in once.</span></div></div>`}
    `;
  }

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
      authInfo.user = payload.user;
      usernameHelp.textContent = `Saved as ${payload.user.username}.`;
      renderFriends();
    } catch (err) {
      usernameHelp.textContent = err.message;
    } finally {
      usernameSaveBtn.disabled = false;
    }
  }

  async function loadFriends() {
    friendState.loading = true;
    friendState.error = "";
    renderFriends();

    try {
      const [friendsPayload, requestsPayload] = await Promise.all([
        apiJson("/api/friends"),
        apiJson("/api/friends/requests"),
      ]);
      friendState.friends = friendsPayload.friends || [];
      friendState.incoming = requestsPayload.incoming || [];
      friendState.outgoing = requestsPayload.outgoing || [];
      friendState.loaded = true;
    } catch (err) {
      friendState.error = err.message;
      friendState.friends = [];
      friendState.incoming = [];
      friendState.outgoing = [];
    } finally {
      friendState.loading = false;
      renderFriends();
    }
  }

  async function searchFriends() {
    const query = friendState.searchQuery.trim();
    if (!query) {
      friendState.results = [];
      friendState.searching = false;
      renderFriends();
      return;
    }

    friendState.searching = true;
    friendState.error = "";
    renderFriends();
    try {
      const payload = await apiJson(`/api/friends/search?q=${encodeURIComponent(query)}`);
      friendState.results = payload.users || [];
    } catch (err) {
      friendState.error = err.message;
      friendState.results = [];
    } finally {
      friendState.searching = false;
      renderFriends();
    }
  }

  async function runFriendAction(key, action) {
    friendState.busyKey = key;
    friendState.error = "";
    renderFriends();
    try {
      await action();
      await loadFriends();
      if (friendState.searchQuery.trim()) await searchFriends();
    } catch (err) {
      friendState.error = err.message;
      renderFriends();
    } finally {
      friendState.busyKey = "";
      renderFriends();
    }
  }

  function showPlayView() {
    setNavActive("play");
    if (!pendingSoloStart) hideModelLoading();
    lbMain.style.display = "flex";
    lbSolo.style.display = "none";
    lbConnect.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
  }

  function showSoloSetup() {
    setNavActive("play");
    clearOpponentSelection();
    lbMain.style.display = "none";
    lbSolo.style.display = "flex";
    lbConnect.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
  }

  function showCoopNameSetup() {
    setNavActive("play");
    hideModelLoading();
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbConnect.style.display = "flex";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
  }

  function showProfileView() {
    setNavActive("profile");
    hideModelLoading();
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbConnect.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "flex";
    lbFriends.style.display = "none";
    renderFriends();
  }

  function showFriendsView() {
    setNavActive("friends");
    hideModelLoading();
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbConnect.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "flex";
    if (!friendState.loaded && !friendState.loading) loadFriends();
    else renderFriends();
  }

  const urlRoom = new URLSearchParams(location.search).get("room");
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

  function setRoomUrl(roomId) {
    const target = `${location.pathname}?room=${roomId}`;
    if (location.search !== `?room=${roomId}`)
      history.replaceState(null, "", target);
  }

  const currentNextPath = () => location.pathname + location.search;
  let authInfo = { authEnabled: false, user: null, loginUrl: "/auth/google", logoutUrl: "/auth/logout" };

  async function loadAuth() {
    try {
      authInfo = await fetch(`/api/me?next=${encodeURIComponent(currentNextPath())}`).then(r => r.json());
    } catch {
      authInfo = { authEnabled: false, user: null, loginUrl: "/auth/google", logoutUrl: "/auth/logout" };
    }

    if (!authInfo.authEnabled) {
      authBar.style.display = "none";
      return;
    }

    authBar.style.display = "flex";
    if (authInfo.user) {
      authLabel.textContent = authInfo.user.name || authInfo.user.email || "Signed in";
      welcomeName.textContent = authInfo.user.username || authInfo.user.name || "Wanderer";
      authBtn.textContent = "Sign out";
      authBtn.onclick = () => { location.href = authInfo.logoutUrl; };
      if (!cpNameInput.value.trim())
        cpNameInput.value = authInfo.user.name || authInfo.user.email || "";
    } else {
      authLabel.textContent = "Sign in to save games";
      authBtn.textContent = "Sign in";
      authBtn.onclick = () => { location.href = authInfo.loginUrl; };
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbConnect.style.display = "none";
      lbRoom.style.display = "none";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
    }
  }

  async function renderInviteLink(roomId) {
    if (!roomId) return;
    if (cpLinkEl.textContent.endsWith(`?room=${roomId}`)) return;
    const cfg = await fetch("/config").then(r => r.json());
    cpLinkEl.textContent = `${cfg.base}/?room=${roomId}`;
  }

  await loadAuth();

  // Auto-show join flow if URL has ?room=
  if (urlRoom) {
    showCoopNameSetup();
    cpConnectBtn.textContent = "Join Game";
    cpFlowTitle.textContent = "Join game";
    cpFlowKicker.textContent = "Room link";
    cpNameInput.value = authInfo.user?.name || storedPlayerName(urlRoom);
  }

  navPlay.onclick = () => showPlayView();
  navProfile.onclick = () => {
    if (authInfo.authEnabled && !authInfo.user) {
      location.href = authInfo.loginUrl;
      return;
    }
    showProfileView();
  };
  navFriends.onclick = () => showFriendsView();
  friendSearch.addEventListener("input", () => {
    friendSearch.value = friendSearch.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 20);
    friendState.searchQuery = friendSearch.value;
    window.clearTimeout(friendSearchTimer);
    friendSearchTimer = window.setTimeout(searchFriends, 250);
    renderFriends();
  });
  profileUsername.addEventListener("input", () => {
    profileUsername.value = profileUsername.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 20);
  });
  profileUsername.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveUsername();
  });
  usernameSaveBtn.onclick = () => saveUsername();
  lbFriends.addEventListener("click", (event) => {
    const button = event.target.closest("[data-friend-action]");
    if (!button) return;
    const action = button.dataset.friendAction;
    const userId = button.dataset.userId;
    const requestId = button.dataset.requestId;
    if (action === "add" && userId) {
      runFriendAction(`add:${userId}`, () => apiJson("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }));
    } else if (action === "accept" && requestId) {
      runFriendAction(`accept:${requestId}`, () => apiJson(`/api/friends/requests/${requestId}/accept`, { method: "POST" }));
    } else if (action === "decline" && requestId) {
      runFriendAction(`decline:${requestId}`, () => apiJson(`/api/friends/requests/${requestId}/decline`, { method: "POST" }));
    } else if (action === "remove" && userId) {
      runFriendAction(`remove:${userId}`, () => apiJson(`/api/friends/${encodeURIComponent(userId)}`, { method: "DELETE" }));
    }
  });
  document.getElementById("play-solo-btn").onclick = () => showSoloSetup();
  opponentCards.forEach(card => {
    card.onclick = () => {
      syncStrength(card.dataset.opponentStrength);
      selectedOpponentTheme = card.dataset.opponentTheme || opponentThemeForStrength(card.dataset.opponentStrength);
      updateOpponentSelection(card.dataset.opponentStrength);
      soloStartBtn.disabled = false;
    };
  });
  clearOpponentSelection();
  soloStartBtn.onclick = () => startSoloGame();
  soloBackBtn.onclick = () => {
    pendingSoloStart = false;
    showPlayView();
  };

  document.getElementById("play-coop-btn").onclick = () => {
    return;
    if (authInfo.authEnabled && !authInfo.user) {
      location.href = authInfo.loginUrl;
      return;
    }
    showCoopNameSetup();
    cpConnectBtn.textContent = "Create Game";
    cpFlowTitle.textContent = "Create game";
    cpFlowKicker.textContent = "New room";
  };

  lbBackBtn.onclick = () => showPlayView();

  cpConnectBtn.onclick = () => connectCoop(urlRoom ? "join" : "create");

  cpNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") cpConnectBtn.click();
  });

  cpStartBtn.onclick = () => coop.ws?.send(JSON.stringify({ type: "start" }));
  cpLeaveBtn.onclick = () => leaveCoop();

  cpCopyBtn.onclick = () => {
    navigator.clipboard.writeText(cpLinkEl.textContent).then(() => {
      cpCopyBtn.textContent = "Copied!";
      setTimeout(() => { cpCopyBtn.textContent = "Copy link"; }, 1500);
    });
  };

  backBtn.onclick = () => {
    if (!confirmExitGame()) return;
    if (coop.phase !== "off") leaveCoop();
    else showLobby();
  };

  window.addEventListener("beforeunload", (event) => {
    if (!shouldWarnBeforeExitingGame()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // ── Coop mode ─────────────────────────────────────────────────────────────

  coop = {
    ws: null, roomId: null,
    playerId: null,
    myIdx: -1,
    phase: "off",
    players: [], activeIdx: 0, midTurn: false, fen: null,
    strength: 1500,
    leaving: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
  };

  function allPlayersReady(players) {
    return players.length > 0 && players.every(player => player.maiaReady);
  }

  function renderRoomLobby(players, myIdx) {
    cpPlayerList.innerHTML = "";
    players.forEach((player, i) => {
      const row = document.createElement("div");
      row.className = "player-row";

      const name = document.createElement("div");
      name.className = "player-name";
      name.textContent = player.name + (i === myIdx ? " (you)" : "");

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
    cpRoomMeta.textContent = `${players.length} player${players.length === 1 ? "" : "s"} · ${getElo()}`;
    cpStrengthSettings.style.display = "flex";
    connectStrengthSlider.disabled = !host || coop.phase !== "lobby";
    connectStrengthSlider.title = host ? "" : "Only the host can change bot strength.";
    cpStartBtn.style.display = host ? "inline" : "none";
    cpStartBtn.disabled = !ready;
    cpStartBtn.textContent = ready ? "Start Game" : "Preparing game...";
    cpStartBtn.title = ready ? "" : "The game is loading on all players' devices.";
    if (ready) hideModelLoading();
    else showModelLoading("Preparing game...");
  }

  function clearReconnectTimer() {
    if (!coop?.reconnectTimer) return;
    clearTimeout(coop.reconnectTimer);
    coop.reconnectTimer = null;
  }

  function connectCoop(action, opts = {}) {
    const roomId = opts.roomId || new URLSearchParams(location.search).get("room") || coop.roomId;
    const name = opts.name || cpNameInput.value.trim() || authInfo.user?.name || storedPlayerName(roomId);
    if (!name) { cpNameInput.focus(); return; }
    clearReconnectTimer();
    coop.leaving = false;
    const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProto}//${location.host}`);
    coop.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(
      action === "create"
        ? { type: "create", name,
            strength: getElo(), maiaReady: modelReady }
        : {
            type: "join",
            roomId,
            name,
            playerId: opts.playerId || coop.playerId || storedPlayerId(roomId),
            maiaReady: modelReady,
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
    const name = cpNameInput.value.trim() || authInfo.user?.name || storedPlayerName(roomId);
    if (!roomId || !name) {
      leaveCoop();
      return;
    }

    if (coop.phase === "lobby") {
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbConnect.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
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
      showCoopNameSetup();
      cpConnectBtn.textContent = new URLSearchParams(location.search).get("room") ? "Join Game" : "Create Game";
      alert(msg.message);
      return;
    }

    if (msg.type === "created") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.reconnectAttempts = 0;
      rememberRoom(msg.roomId, cpNameInput.value.trim() || authInfo.user?.name, msg.playerId);
      setRoomUrl(msg.roomId);
      renderInviteLink(msg.roomId);
      lbMain.style.display = "none";
      lbSolo.style.display = "none";
      lbConnect.style.display = "none";
      lbRoom.style.display = "flex";
      lbProfile.style.display = "none";
      lbFriends.style.display = "none";
      coop.phase = "lobby";
      return;
    }

    if (msg.type === "joined") {
      coop.roomId = msg.roomId;
      coop.playerId = msg.playerId;
      coop.reconnectAttempts = 0;
      rememberRoom(msg.roomId, cpNameInput.value.trim() || authInfo.user?.name || storedPlayerName(msg.roomId), msg.playerId);
      setRoomUrl(msg.roomId);
      renderInviteLink(msg.roomId);
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
      coop.reconnectAttempts = 0;
      if (msg.strength) syncStrength(String(msg.strength));
      renderInviteLink(msg.roomId);

      if (msg.phase === "lobby") {
        coop.phase = "lobby";
        lbMain.style.display = "none";
        lbSolo.style.display = "none";
        lbConnect.style.display = "none";
        lbRoom.style.display = "flex";
        lbProfile.style.display = "none";
        lbFriends.style.display = "none";
        renderRoomLobby(msg.players, msg.myIdx);
        return;
      }

      if (msg.phase === "playing" || msg.phase === "over") {
        if (coop.phase !== "playing" && coop.phase !== "over") {
          chess.load(msg.fen);
          cpChips.innerHTML = "";
          showGame();
          board.setPosition(msg.fen, false);
          board.removeMarkers(LAST_MOVE);
          updateGameScore();
          board.enableMoveInput(inputHandler);
        }
        coop.phase = msg.phase;

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

        if (msg.fen !== chess.fen()) {
          chess.load(msg.fen);
          board.setPosition(msg.fen);
          updateGameScore();
        }

        if (msg.phase === "over") {
          board.disableMoveInput();
        } else if (msg.activeIdx === msg.myIdx && !msg.midTurn) {
          board.enableMoveInput(inputHandler);
          setStatus(modelReady ? "Your turn" : "Preparing game...");
        } else {
          board.disableMoveInput();
          const who = msg.players[msg.activeIdx]?.name ?? "…";
          setStatus(msg.midTurn ? `${who}: bot thinking…` : `${who}'s turn`);
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
      const fen       = chess.fen();
      const isBlack   = fen.split(" ")[1] === "b";
      const elo       = coop.strength;
      const workFen   = isBlack ? mirrorFEN(fen) : fen;
      const tokens    = boardToTokens(workFen);
      const legalMask = buildLegalMask(workFen);

      const { logitsMove } = await runInference(tokens, elo);
      const moveProbs = decodeMoves(logitsMove, legalMask, isBlack);
      const uci = sampleMove(moveProbs);

      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
      board.setPosition(chess.fen());
      board.removeMarkers(LAST_MOVE);
      board.addMarker(LAST_MOVE, uci.slice(0, 2));
      board.addMarker(LAST_MOVE, uci.slice(2, 4));
      updateGameScore();

      coop.ws?.send(JSON.stringify({ type: "move", fen: chess.fen(), gameOver: chess.isGameOver() }));
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
    showLobby();
  }

  if (!urlRoom) restoreSoloGame();
    })().catch((err) => {
      console.error(err);
    });
    return () => { disposed = true; };
  }, []);

  return (
    <div className="app">
      <Lobby />
      <GameView />
    </div>
  );
}
