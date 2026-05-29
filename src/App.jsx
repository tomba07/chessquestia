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
import { SOLO_OPPONENTS } from "./soloOpponents.js";
import {
  opponentEmotionPortrait,
  opponentReactionLines,
  randomLine,
} from "./opponentReactions.js";

const HOME_GREETINGS = [
  "The board is set.",
  "Your next match awaits.",
  "Choose your next challenger.",
  "The next move is yours.",
  "A new duel begins.",
  "A suspicious board awaits.",
  "Another tiny villain waits.",
  "Your next rival is ready.",
  "The cellar league continues.",
  "One more board, one more mistake.",
  "Pick your opponent.",
  "A fresh position awaits.",
  "Step up to the board.",
  "Make the first move.",
  "The quest continues.",
];

function randomHomeGreeting() {
  return HOME_GREETINGS[Math.floor(Math.random() * HOME_GREETINGS.length)];
}

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
        <p>{randomHomeGreeting()}</p>
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

function AuthPanel() {
  return (
    <div id="lb-auth" className="lobby-section lobby-panel auth-panel" style={{ display: "none" }}>
      <div className="auth-copy">
        <div>Chessquestia</div>
        <strong>Sign in or sign up</strong>
        <span className="home-divider" aria-hidden="true"></span>
        <p>Save progress, unlock opponents, and play co-op with friends.</p>
      </div>
      <div className="auth-actions">
        <button id="auth-primary-btn" className="bot-continue-btn auth-primary-btn" type="button">
          <img src="/assets/icons/submit-icon.png" alt="" />
          <span>Continue with Google</span>
        </button>
        <button id="auth-demo-btn" className="sm-btn auth-demo-btn" type="button">
          <img src="/assets/bots/snib_talk.png" alt="" />
          <span>Try demo against Snib</span>
        </button>
      </div>
      <div id="auth-dev-login-card" className="dev-login-card auth-dev-login-card" style={{ display: "none" }}>
        <span>Dev login</span>
        <div id="auth-dev-login-options" className="dev-login-options"></div>
      </div>
    </div>
  );
}

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
      <div className="profile-setting-card">
        <label className="profile-toggle-row" htmlFor="profile-board-toggle">
          <span>
            <strong>Chessnut board</strong>
            <small>Show board connection controls</small>
          </span>
          <input id="profile-board-toggle" type="checkbox" />
        </label>
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
      <AuthPanel />
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
      <div id="victory-screen-flash" className="victory-screen-flash" aria-hidden="true"></div>
      <div className="game-board-frame">
        <div id="board"></div>
        <div id="victory-board-pulse" className="victory-board-pulse" aria-hidden="true">
        </div>
      </div>
      <div id="opponent-speech" className="opponent-speech" hidden aria-live="polite">
        <img id="opponent-speech-portrait" src="/assets/bots/snib_talk.png" alt="" />
        <div className="opponent-speech-bubble">
          <button id="opponent-speech-close" className="opponent-speech-close" type="button" aria-label="Close speech">×</button>
          <strong id="opponent-speech-name"></strong>
          <p id="opponent-speech-text"></p>
        </div>
      </div>
      <div id="cp-chips"></div>
    </div>
  );
}

function BotSplash() {
  return (
    <div id="bot-splash" className="bot-splash" hidden aria-hidden="true">
      <img id="bot-splash-art" className="bot-splash-art" src="/assets/splash/snib_splash.png" alt="" />
      <div className="bot-splash-panel">
        <div className="bot-splash-copy" role="dialog" aria-modal="true" aria-labelledby="bot-splash-name">
          <img id="bot-splash-banner" className="bot-splash-banner" src="/assets/splash/splash_banner.png" alt="" />
          <div className="bot-splash-content">
            <h2 id="bot-splash-name">Snib the Candle Goblin</h2>
            <span className="bot-splash-divider" aria-hidden="true"></span>
            <p id="bot-splash-text"></p>
            <span className="bot-splash-divider" aria-hidden="true"></span>
            <div id="bot-splash-strength" className="bot-splash-strength" aria-label="Opponent strength"></div>
          </div>
        </div>
        <button id="bot-splash-start" className="bot-continue-btn bot-splash-start" type="button">
          <img src="/assets/icons/submit-icon.png" alt="" />
          <span>Start game</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    let disposed = false;
    let invitePollTimer = null;
    let outcomeBannerTimer = null;
    let opponentSpeechTimer = null;
    let opponentSpeechWordTimer = null;
    let opponentSpeechAnimationFrame = null;
    let opponentSpeechHideTimer = null;
    let opponentSpeechDelayTimer = null;
    let victoryBoardPulseTimer = null;
    (async () => {
      if (disposed) return;
const LAST_MOVE = { class: "last-move", slice: "markerSquare" };
const CHECK_MARKER = { class: "king-check", slice: "markerSquare" };
const VICTORY_MARKER = { class: "victory-mate", slice: "markerSquare" };
const DEFEAT_MARKER = { class: "defeat-mate", slice: "markerSquare" };
const DRAW_MARKER = { class: "draw-result", slice: "markerSquare" };
  const BOT_MOVE_DELAY_MS = { min: 650, max: 1250 };
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
        const demoStart = pendingSoloStartDemo;
        pendingSoloStart = false;
        pendingSoloStartDemo = false;
        startSoloGameWithSplash({ demo: demoStart });
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
  const victoryBoardPulseEl = document.getElementById("victory-board-pulse");
  const victoryScreenFlashEl = document.getElementById("victory-screen-flash");
  const gameBoardFrameEl = document.querySelector(".game-board-frame");
  const botSplashEl = document.getElementById("bot-splash");
  const botSplashArt = document.getElementById("bot-splash-art");
  const botSplashBanner = document.getElementById("bot-splash-banner");
  const botSplashName = document.getElementById("bot-splash-name");
  const botSplashText = document.getElementById("bot-splash-text");
  const botSplashStrength = document.getElementById("bot-splash-strength");
  const botSplashStart = document.getElementById("bot-splash-start");
  const cpChips   = document.getElementById("cp-chips");
  const boardDevicePanel = document.getElementById("board-device-panel");
  const boardConnectBtn = document.getElementById("board-connect-btn");
  const boardConnectLabel = document.getElementById("board-connect-label");
  const boardDisconnectBtn = document.getElementById("board-disconnect-btn");
  const boardDeviceStatus = document.getElementById("board-device-status");
  const opponentSpeechEl = document.getElementById("opponent-speech");
  const opponentSpeechPortrait = document.getElementById("opponent-speech-portrait");
  const opponentSpeechName = document.getElementById("opponent-speech-name");
  const opponentSpeechText = document.getElementById("opponent-speech-text");
  const opponentSpeechClose = document.getElementById("opponent-speech-close");
  const STORAGE_PREFIX = "chessquestia";
  const LEGACY_STORAGE_PREFIX = "local-chess";
  const storageKey = (suffix) => `${STORAGE_PREFIX}.${suffix}`;
  const legacyStorageKey = (suffix) => `${LEGACY_STORAGE_PREFIX}.${suffix}`;
  const SOLO_GAME_KEY = storageKey("solo-game");
  const LEGACY_SOLO_GAME_KEY = legacyStorageKey("solo-game");
  const SOLO_PROGRESS_KEY = storageKey("solo-progress");
  const BOARD_DEVICE_VISIBLE_KEY = storageKey("board-device-visible");
  let board       = null;
  let botThinking = false;
  let coopBotTimer = null;
  let soloActive  = false;
  let soloGameId = null;
  let soloDemoActive = false;
  let setupMode = "solo";
  let opponentSelectionReadonly = false;
  let selectedOpponentTheme = "snib";
  let selectedOpponentIndex = 0;
  let unlockedOpponentCount = 1;
  let serverUnlockedOpponentCount = 1;
  const START_FEN_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  let botSplashResolve = null;
  let botSplashBeforeFade = null;
  let botSplashAutoTimer = null;
  let botSplashMode = null;
  let soloStartInProgress = false;
  let pendingSoloStartDemo = false;
  let botTurnsSinceOpponentMessage = 0;
  let nextThinkingReactionAfterTurns = 3 + Math.floor(Math.random() * 3);
  const recordedSoloGameIds = new Set();
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
    boardDevicePanel.hidden = !shouldShowBoardDevicePanel();
    boardConnectBtn.disabled = chessnut.connecting;
    boardDisconnectBtn.hidden = !chessnut.connected && !chessnut.connecting;
    boardConnectLabel.textContent = chessnut.connected
      ? "Board connected"
      : chessnut.connecting ? "Connecting..." : "Connect board";
  }

  function boardDeviceSettingEnabled() {
    return localStorage.getItem(BOARD_DEVICE_VISIBLE_KEY) === "1";
  }

  function shouldShowBoardDevicePanel() {
    return boardDeviceSettingEnabled()
      && !window.matchMedia?.("(max-width: 860px)")?.matches;
  }

  function renderBoardDeviceSetting() {
    if (profileBoardToggle) profileBoardToggle.checked = boardDeviceSettingEnabled();
    updateBoardDeviceUi();
  }

  function setBoardDeviceSetting(enabled) {
    if (enabled) localStorage.setItem(BOARD_DEVICE_VISIBLE_KEY, "1");
    else localStorage.removeItem(BOARD_DEVICE_VISIBLE_KEY);
    renderBoardDeviceSetting();
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
    updateCheckMarker();
    updateChessnutDiffLeds();
  }

  function clearVictoryBoardPulse() {
    if (victoryBoardPulseTimer) window.clearTimeout(victoryBoardPulseTimer);
    victoryBoardPulseTimer = null;
    victoryBoardPulseEl.classList.remove("active", "victory", "defeat", "draw");
    victoryBoardPulseEl.innerHTML = "";
    victoryScreenFlashEl.classList.remove("active", "victory", "defeat", "draw");
    board?.removeMarkers(VICTORY_MARKER);
    board?.removeMarkers(DEFEAT_MARKER);
    board?.removeMarkers(DRAW_MARKER);
  }

  function squareToBoardIndex(square) {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1], 10);
    return {
      file,
      rankIndex: 8 - rank,
    };
  }

  function findKingSquare(color) {
    const position = chess.board();
    for (let rankIndex = 0; rankIndex < position.length; rankIndex += 1) {
      for (let fileIndex = 0; fileIndex < position[rankIndex].length; fileIndex += 1) {
        const piece = position[rankIndex][fileIndex];
        if (piece?.type === "k" && piece.color === color) {
          return `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
        }
      }
    }
    return null;
  }

  function isCurrentSideInCheck() {
    if (typeof chess.isCheck === "function") return chess.isCheck();
    if (typeof chess.inCheck === "function") return chess.inCheck();
    return false;
  }

  function updateCheckMarker() {
    board.removeMarkers(CHECK_MARKER);
    if (!isCurrentSideInCheck()) return;
    const kingSquare = findKingSquare(chess.turn());
    if (kingSquare) board.addMarker(CHECK_MARKER, kingSquare);
  }

  function lastMoveSquares() {
    const history = chess.history({ verbose: true });
    const move = history[history.length - 1];
    return move ? [move.from, move.to] : [];
  }

  function showVictoryBoardPulse(square, outcome = "victory") {
    clearVictoryBoardPulse();
    const origin = square ? squareToBoardIndex(square) : { file: 3.5, rankIndex: 3.5 };
    const highlightedSquares = [...new Set([square, ...lastMoveSquares()].filter(Boolean))];
    const marker = outcome === "draw" ? DRAW_MARKER
      : outcome === "defeat" ? DEFEAT_MARKER : VICTORY_MARKER;
    highlightedSquares.forEach(highlightSquare => board.addMarker(marker, highlightSquare));

    victoryScreenFlashEl.classList.remove("active", "victory", "defeat", "draw");
    void victoryScreenFlashEl.offsetWidth;
    victoryScreenFlashEl.classList.add(outcome, "active");

    const cells = [];
    for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
      for (let file = 0; file < 8; file += 1) {
        const cell = document.createElement("span");
        cell.className = "victory-spread-cell";
        const distance = Math.abs(file - origin.file) + Math.abs(rankIndex - origin.rankIndex);
        cell.style.setProperty("--cell-file", file);
        cell.style.setProperty("--cell-rank", rankIndex);
        cell.style.setProperty("--spread-delay", `${Math.min(distance * 34, 360)}ms`);
        cells.push(cell);
      }
    }
    victoryBoardPulseEl.replaceChildren(...cells);
    void victoryBoardPulseEl.offsetWidth;
    victoryBoardPulseEl.classList.add(outcome, "active");
  }

  function showVictoryBoardPulseAfterDelay(square, delay = 280, outcome = "victory") {
    clearVictoryBoardPulse();
    victoryBoardPulseTimer = window.setTimeout(() => {
      victoryBoardPulseTimer = null;
      showVictoryBoardPulse(square, outcome);
    }, delay);
  }

  function syncBoardAfterMove(move) {
    board.setPosition(chess.fen(), true);
    markLastMove(move.from, move.to);
    updateGameScore();
  }

  function enableBoardMoveInput() {
    board.disableMoveInput();
    board.enableMoveInput(inputHandler);
    gameBoardFrameEl.classList.remove("not-your-turn");
  }

  function disableBoardMoveInput() {
    board?.disableMoveInput();
    gameBoardFrameEl.classList.add("not-your-turn");
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
    board.setPosition(fen, true);
    if (incomingMove) markLastMove(incomingMove.from, incomingMove.to);
    else {
      updateCheckMarker();
      updateChessnutDiffLeds();
    }
    updateGameScore();
  }

  function nextBotMoveDelay() {
    const { min, max } = BOT_MOVE_DELAY_MS;
    return Math.round(min + Math.random() * (max - min));
  }

  function thinkingMoveDelay() {
    return Math.round(1300 + Math.random() * 1100);
  }

  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function isMyCoopBotTurn() {
    return coop?.phase === "playing"
      && coop.activeIdx === coop.myIdx
      && coop.midTurn
      && modelReady
      && !chess.isGameOver();
  }

  function clearCoopBotTimer() {
    if (!coopBotTimer) return;
    clearTimeout(coopBotTimer);
    coopBotTimer = null;
  }

  function scheduleCoopBotMove() {
    if (!isMyCoopBotTurn() || botThinking || coopBotTimer) return;
    coopBotTimer = setTimeout(() => {
      coopBotTimer = null;
      coopBotMove();
    }, nextBotMoveDelay());
  }

  function applyPlayerMove(from, to, promotion = "q") {
    if (!canAcceptPlayerMove()) return false;
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) return false;
      syncBoardAfterMove(move);
      if (coop?.phase === "playing") {
        publishCoopMove();
        if (checkGameOver()) return true;
        showPlayerMoveReaction(move);
        disableBoardMoveInput();
      } else {
        saveSoloGame();
        if (!checkGameOver()) {
          showPlayerMoveReaction(move);
          disableBoardMoveInput();
          setTimeout(botMove, nextBotMoveDelay());
        }
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
    clearVictoryBoardPulse();
  }

  function showOutcomeBanner(outcome) {
    const outcomeTitles = { victory: "Victory", defeat: "Defeat", draw: "Draw" };
    outcomeOverlayEl.className = "game-outcome-overlay visible";
    outcomeOverlayEl.setAttribute("aria-hidden", "false");
    outcomeBannerEl.className = `game-outcome-banner ${outcome}`;
    outcomeTitleEl.textContent = outcomeTitles[outcome] || "";
    outcomeBannerEl.setAttribute("aria-label", outcomeTitleEl.textContent);
  }

  function showOutcomeBannerAfterDelay(outcome, delay = 1000) {
    if (outcomeBannerTimer) window.clearTimeout(outcomeBannerTimer);
    outcomeOverlayEl.className = "game-outcome-overlay";
    outcomeOverlayEl.setAttribute("aria-hidden", "true");
    outcomeBannerEl.className = "game-outcome-banner";
    outcomeTitleEl.textContent = "";
    outcomeBannerEl.removeAttribute("aria-label");
    outcomeBannerTimer = window.setTimeout(() => {
      outcomeBannerTimer = null;
      showOutcomeBanner(outcome);
    }, delay);
  }

  function opponentThemeForStrength(value) {
    return opponentForStrength(value)?.theme || "snib";
  }

  function setGameOpponentTheme(value = getElo(), theme = selectedOpponentTheme) {
    const legacyThemes = { imp: "snib", witch: "vexi" };
    const nextTheme = theme || opponentThemeForStrength(value);
    gameEl.dataset.opponent = legacyThemes[nextTheme] || nextTheme;
  }

  function currentOpponent() {
    return opponentForStrength(getElo()) || SOLO_OPPONENTS[selectedOpponentIndex] || SOLO_OPPONENTS[0];
  }

  function isMobileSplashViewport() {
    return window.matchMedia?.("(max-width: 860px), (orientation: portrait)")?.matches;
  }

  function splashImageForOpponent(opponent, mobile = isMobileSplashViewport()) {
    return `/assets/splash/${mobile ? "mobile/" : ""}${opponent?.theme || "snib"}_splash.png`;
  }

  function splashBannerImage(mobile = isMobileSplashViewport()) {
    return mobile ? "/assets/splash/mobile/splash_banner_mobile.png" : "/assets/splash/splash_banner.png";
  }

  function renderBotSplashStrength(rank = 1) {
    botSplashStrength.innerHTML = "";
    Array.from({ length: 5 }, (_, index) => {
      const icon = document.createElement("img");
      icon.src = "/assets/splash/splash_strength_icon.png";
      icon.alt = "";
      icon.className = index < rank ? "filled" : "";
      botSplashStrength.appendChild(icon);
    });
  }

  function isStartingCoopPosition(fen) {
    return String(fen || "").split(" ")[0] === START_FEN_POSITION;
  }

  function shouldAutoStartCoopSplash(msg) {
    return msg.phase === "playing"
      && msg.activeIdx === msg.myIdx
      && !msg.midTurn
      && !isStartingCoopPosition(msg.fen);
  }

  function clearBotSplashAutoTimer() {
    if (botSplashAutoTimer) window.clearTimeout(botSplashAutoTimer);
    botSplashAutoTimer = null;
  }

  function scheduleBotSplashAutoStart() {
    clearBotSplashAutoTimer();
    botSplashAutoTimer = window.setTimeout(() => {
      botSplashAutoTimer = null;
      hideBotSplash();
    }, 500);
  }

  function hideBotSplash() {
    if (!botSplashResolve) return;
    clearBotSplashAutoTimer();
    const beforeFade = botSplashBeforeFade;
    botSplashBeforeFade = null;
    botSplashMode = null;
    beforeFade?.();
    const resolve = botSplashResolve;
    botSplashResolve = null;
    botSplashEl.classList.remove("visible", "auto-start");
    botSplashEl.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      botSplashEl.hidden = true;
      resolve();
    }, 280);
  }

  function showBotSplash(opponent = currentOpponent(), { beforeFade = null, mode = "solo", autoStart = false } = {}) {
    return new Promise(resolve => {
      if (!opponent || !botSplashEl) {
        beforeFade?.();
        resolve();
        return;
      }
      if (botSplashResolve) {
        const pendingBeforeFade = botSplashBeforeFade;
        botSplashBeforeFade = null;
        botSplashResolve();
        pendingBeforeFade?.();
        botSplashResolve = null;
      }
      clearBotSplashAutoTimer();
      botSplashBeforeFade = beforeFade;
      botSplashMode = mode;
      const mobileSplash = isMobileSplashViewport();
      botSplashArt.src = splashImageForOpponent(opponent, mobileSplash);
      botSplashBanner.src = splashBannerImage(mobileSplash);
      botSplashName.textContent = opponent.name;
      botSplashText.textContent = opponent.splashText || opponent.concept || "";
      renderBotSplashStrength(opponent.rank);
      botSplashEl.classList.toggle("auto-start", autoStart);
      botSplashStart.hidden = false;
      botSplashResolve = resolve;
      botSplashEl.hidden = false;
      botSplashEl.setAttribute("aria-hidden", "false");
      botSplashEl.getBoundingClientRect();
      botSplashEl.classList.add("visible");
      if (autoStart) scheduleBotSplashAutoStart();
      else botSplashStart.focus({ preventScroll: true });
    });
  }

  function maybeAutoStartCoopSplash(msg) {
    if (botSplashMode !== "coop" || !botSplashResolve || !shouldAutoStartCoopSplash(msg)) return;
    botSplashEl.classList.add("auto-start");
    scheduleBotSplashAutoStart();
  }

  function clearOpponentSpeechTimers() {
    if (opponentSpeechTimer) window.clearTimeout(opponentSpeechTimer);
    if (opponentSpeechWordTimer) window.clearInterval(opponentSpeechWordTimer);
    if (opponentSpeechAnimationFrame) window.cancelAnimationFrame(opponentSpeechAnimationFrame);
    if (opponentSpeechHideTimer) window.clearTimeout(opponentSpeechHideTimer);
    if (opponentSpeechDelayTimer) window.clearTimeout(opponentSpeechDelayTimer);
    opponentSpeechTimer = null;
    opponentSpeechWordTimer = null;
    opponentSpeechAnimationFrame = null;
    opponentSpeechHideTimer = null;
    opponentSpeechDelayTimer = null;
  }

  function hideOpponentSpeech() {
    clearOpponentSpeechTimers();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (opponentSpeechEl.hidden || reduceMotion) {
      opponentSpeechEl.hidden = true;
      opponentSpeechEl.classList.remove("visible");
      opponentSpeechEl.classList.remove("foreground");
      return;
    }
    opponentSpeechEl.classList.remove("visible");
    opponentSpeechHideTimer = window.setTimeout(() => {
      opponentSpeechHideTimer = null;
      opponentSpeechEl.hidden = true;
      opponentSpeechEl.classList.remove("foreground");
    }, 480);
  }

  function revealOpponentSpeechText(text, wordDelay = 82) {
    if (opponentSpeechWordTimer) window.clearInterval(opponentSpeechWordTimer);
    opponentSpeechWordTimer = null;
    const fullText = String(text || "");
    const words = fullText.trim().split(/\s+/).filter(Boolean);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!words.length || reduceMotion) {
      opponentSpeechText.textContent = fullText;
      return 0;
    }
    let index = 0;
    opponentSpeechText.textContent = "";
    opponentSpeechWordTimer = window.setInterval(() => {
      index += 1;
      opponentSpeechText.textContent = words.slice(0, index).join(" ");
      if (index >= words.length) {
        window.clearInterval(opponentSpeechWordTimer);
        opponentSpeechWordTimer = null;
      }
    }, wordDelay);
    return words.length * wordDelay;
  }

  function showOpponentSpeech({
    name,
    text,
    portrait = "/assets/bots/snib_talk.png",
    duration = 5600,
    foreground = false,
    sticky = true,
  }) {
    clearOpponentSpeechTimers();
    opponentSpeechPortrait.src = portrait;
    opponentSpeechName.textContent = name;
    opponentSpeechText.textContent = "";
    opponentSpeechEl.classList.remove("visible");
    opponentSpeechEl.classList.toggle("foreground", foreground);
    opponentSpeechEl.hidden = false;
    opponentSpeechAnimationFrame = window.requestAnimationFrame(() => {
      opponentSpeechAnimationFrame = null;
      opponentSpeechEl.classList.add("visible");
    });
    const revealDuration = revealOpponentSpeechText(text);
    if (!sticky) {
      opponentSpeechTimer = window.setTimeout(hideOpponentSpeech, Math.max(duration, revealDuration + 2400));
    }
  }

  function resetThinkingReactionCadence() {
    botTurnsSinceOpponentMessage = 0;
    nextThinkingReactionAfterTurns = 3 + Math.floor(Math.random() * 3);
  }

  function showOpponentReaction(emotion, {
    reaction = emotion,
    lines = null,
    duration = 2600,
    chance = 1,
    allowInterrupt = true,
    foreground = false,
    sticky = true,
  } = {}) {
    if (Math.random() > chance) return false;
    if (!allowInterrupt && !opponentSpeechEl.hidden) return false;
    const opponent = currentOpponent();
    const reactionLines = lines || opponentReactionLines(opponent, reaction);
    showOpponentSpeech({
      name: opponent.name,
      portrait: opponentEmotionPortrait(opponent, emotion),
      text: randomLine(reactionLines),
      duration,
      foreground,
      sticky,
    });
    resetThinkingReactionCadence();
    return true;
  }

  function showOpponentThinkingReaction() {
    botTurnsSinceOpponentMessage += 1;
    if (botTurnsSinceOpponentMessage < nextThinkingReactionAfterTurns) return false;
    return showOpponentReaction("thinking", {
      duration: 2400,
      allowInterrupt: true,
      sticky: false,
    });
  }

  function showEndgameOpponentReaction(playerWon, delay = 1900) {
    if (opponentSpeechDelayTimer) window.clearTimeout(opponentSpeechDelayTimer);
    opponentSpeechDelayTimer = window.setTimeout(() => {
      opponentSpeechDelayTimer = null;
      showOpponentReaction(playerWon ? "sad" : "win", {
        reaction: playerWon ? "playerVictory" : "botVictory",
        foreground: true,
        sticky: true,
      });
    }, delay);
  }

  function showPlayerMoveReaction(move) {
    if (isCurrentSideInCheck()) {
      showOpponentReaction("surprised", {
        reaction: "playerCheck",
        duration: 2400,
      });
    } else if (move?.captured) {
      showOpponentReaction(Math.random() < 0.55 ? "surprised" : "angry", {
        reaction: "playerCapture",
        duration: 2500,
      });
    }
  }

  function showBotMoveReaction(move) {
    if (isCurrentSideInCheck()) {
      showOpponentReaction("laughing", {
        reaction: "botCheck",
        duration: 2400,
        chance: 0.7,
      });
    } else if (move?.captured) {
      showOpponentReaction("laughing", {
        reaction: "botCapture",
        duration: 2500,
      });
    }
  }

  function showGameStartSpeech() {
    const selectedOpponent = currentOpponent();
    const lines = selectedOpponent?.introLines || [];
    if (!selectedOpponent || !lines.length) {
      hideOpponentSpeech();
      return;
    }
    showOpponentSpeech({
      name: selectedOpponent.name,
      portrait: `/assets/bots/${selectedOpponent.talkPortrait || "snib_talk.png"}`,
      text: lines[Math.floor(Math.random() * lines.length)],
    });
    resetThinkingReactionCadence();
  }

  function readLocalSoloProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(SOLO_PROGRESS_KEY) || "{}");
      const unlocked = Number(saved.unlocked || 1);
      return Math.min(SOLO_OPPONENTS.length, Math.max(1, unlocked));
    } catch {
      return 1;
    }
  }

  function writeLocalSoloProgress(unlocked) {
    localStorage.setItem(SOLO_PROGRESS_KEY, JSON.stringify({
      unlocked: Math.min(SOLO_OPPONENTS.length, Math.max(1, Number(unlocked) || 1)),
      updatedAt: Date.now(),
    }));
  }

  function readSoloProgress() {
    return Math.max(readLocalSoloProgress(), serverUnlockedOpponentCount);
  }

  function updateServerSoloProgress(unlocked) {
    if (!authInfo.user) return;
    const unlockedOpponentCount = Math.min(SOLO_OPPONENTS.length, Math.max(1, Number(unlocked) || 1));
    fetch("/api/solo-progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlockedOpponentCount }),
    })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const serverUnlocked = Number(payload?.soloProgress?.unlockedOpponentCount || 1);
        serverUnlockedOpponentCount = Math.max(serverUnlockedOpponentCount, Math.min(SOLO_OPPONENTS.length, Math.max(1, serverUnlocked)));
        if (serverUnlockedOpponentCount > readLocalSoloProgress())
          writeLocalSoloProgress(serverUnlockedOpponentCount);
        applyOpponentLocks();
        syncMaiaStatus();
      })
      .catch(() => {})
  }

  function saveSoloProgress() {
    writeLocalSoloProgress(unlockedOpponentCount);
    updateServerSoloProgress(unlockedOpponentCount);
  }

  function syncSoloProgressFromAuth() {
    serverUnlockedOpponentCount = Math.min(
      SOLO_OPPONENTS.length,
      Math.max(1, Number(authInfo.soloProgress?.unlockedOpponentCount || 1)),
    );
    const localUnlocked = readLocalSoloProgress();
    if (authInfo.user && localUnlocked > serverUnlockedOpponentCount) {
      serverUnlockedOpponentCount = localUnlocked;
      updateServerSoloProgress(localUnlocked);
    } else if (serverUnlockedOpponentCount > localUnlocked) {
      writeLocalSoloProgress(serverUnlockedOpponentCount);
    }
  }

  function applyOpponentLocks() {
    unlockedOpponentCount = setupMode === "coop"
      ? Math.max(readSoloProgress(), coop?.maxUnlockedOpponentCount || 1)
      : readSoloProgress();
    opponentCards.forEach((card, index) => {
      const unlocked = index < unlockedOpponentCount;
      const disabled = !unlocked || opponentSelectionReadonly;
      const art = card.querySelector(".opponent-card-art");
      card.disabled = disabled;
      card.classList.toggle("locked", !unlocked);
      card.classList.toggle("readonly", unlocked && opponentSelectionReadonly);
      card.setAttribute("aria-disabled", disabled ? "true" : "false");
      if (art) art.src = unlocked ? card.dataset.unlockedSrc : "/assets/cards/locked_card.png";
    });
  }

  function unlockNextOpponent() {
    if (soloDemoActive) return false;
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
        style: {
          pieces: { file: CDN + "pieces/staunty.svg" },
          animationDuration: 220,
        },
        extensions: [{ class: Markers }],
      });
    }
    clearVictoryBoardPulse();
  }

  function showLobby() {
    gameEl.style.display  = "none";
    hideOpponentSpeech();
    lobbyEl.style.display = "";
    if (soloActive) clearSoloGame();
    if (authInfo.authEnabled && !authInfo.user) showAuthView();
    else showPlayView();
    if (authInfo.user && (location.search.includes("room=") || location.pathname !== "/"))
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
    if (!soloActive || soloDemoActive || coop.phase !== "off") return;
    localStorage.setItem(SOLO_GAME_KEY, JSON.stringify({
      gameId: soloGameId,
      fen: chess.fen(),
      strength: getElo(),
      opponentTheme: selectedOpponentTheme,
      opponentIndex: selectedOpponentIndex,
      savedAt: Date.now(),
    }));
  }

  function clearSoloGame() {
    soloActive = false;
    soloGameId = null;
    soloDemoActive = false;
    localStorage.removeItem(SOLO_GAME_KEY);
    localStorage.removeItem(LEGACY_SOLO_GAME_KEY);
  }

  function createSoloGameId() {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function recordSoloGameResult(result) {
    if (!soloActive || soloDemoActive || coop?.phase !== "off") return;
    soloGameId = soloGameId || createSoloGameId();
    if (recordedSoloGameIds.has(soloGameId)) return;
    recordedSoloGameIds.add(soloGameId);
    const opponent = currentOpponent();
    fetch("/api/game-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        mode: "solo",
        result,
        gameId: soloGameId,
        opponentStrength: getElo(),
        opponentKey: opponent?.theme || null,
        movesCount: chess.history().length,
        finalFen: chess.fen(),
      }),
    }).catch(() => {});
  }

  function beginSoloGame({ showIntro = true, demo = false } = {}) {
    chess.reset();
    soloActive = true;
    soloDemoActive = demo;
    soloGameId = createSoloGameId();
    cpChips.innerHTML = "";
    hideOutcomeBanner();
    hideModelLoading();
    if (demo) setDemoGameUrl();
    else setSoloGameUrl();
    showGame();
    board.setPosition(chess.fen());
    board.removeMarkers(LAST_MOVE);
    board.removeMarkers(CHECK_MARKER);
    chessnut.lastPlacement = "";
    chessnut.lastOrientedPlacement = "";
    updateGameScore();
    enableBoardMoveInput();
    botThinking = false;
    resetThinkingReactionCadence();
    setStatus("Your turn");
    if (showIntro) showGameStartSpeech();
    saveSoloGame();
  }

  async function startSoloGameWithSplash({ demo = false } = {}) {
    if (soloStartInProgress) return;
    soloStartInProgress = true;
    try {
      await showBotSplash(currentOpponent(), {
        mode: "solo",
        beforeFade: () => beginSoloGame({ showIntro: false, demo }),
      });
      showGameStartSpeech();
    } finally {
      soloStartInProgress = false;
    }
  }

  function startSoloGame({ demo = false } = {}) {
    if (!demo && soloStartBtn.disabled) return;
    if (!modelReady) {
      pendingSoloStart = true;
      pendingSoloStartDemo = demo;
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }

    startSoloGameWithSplash({ demo });
  }

  function startSelectedGame() {
    if (setupMode === "coop") {
      startCoopWithSelectedBot();
      return;
    }
    startSoloGame();
  }

  function selectDemoOpponent() {
    const opponent = SOLO_OPPONENTS[0];
    syncStrength(String(opponent.elo));
    selectedOpponentIndex = 0;
    selectedOpponentTheme = opponent.theme;
    updateOpponentSelection(String(opponent.elo));
  }

  function startDemoGame() {
    setupMode = "solo";
    selectDemoOpponent();
    setDemoGameUrl();
    startSoloGame({ demo: true });
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
      soloGameId = state.gameId || createSoloGameId();
      if (state.strength) syncStrength(String(state.strength));
      selectedOpponentIndex = Number(state.opponentIndex || 0);
      selectedOpponentTheme = state.opponentTheme || opponentThemeForStrength(state.strength || getElo());
      cpChips.innerHTML = "";
      showGame();
      board.setPosition(chess.fen(), false);
      board.removeMarkers(LAST_MOVE);
      updateCheckMarker();
      updateGameScore();
      botThinking = false;
      if (checkGameOver()) return;
      if (chess.turn() === "w") {
        enableBoardMoveInput();
        setStatus(modelReady ? "Your turn" : "Preparing game...");
      } else {
        disableBoardMoveInput();
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
      recordSoloGameResult(playerWon ? "victory" : "defeat");
      const canUnlockProgress = soloActive || coop?.phase === "playing" || coop?.phase === "over";
      const unlockedNext = playerWon && canUnlockProgress && unlockNextOpponent();
      const defeatedKingSquare = findKingSquare(playerWon ? "b" : "w");
      showVictoryBoardPulseAfterDelay(defeatedKingSquare, 120, playerWon ? "victory" : "defeat");
      showOutcomeBannerAfterDelay(playerWon ? "victory" : "defeat", 2200);
      showEndgameOpponentReaction(playerWon, 2050);
      setStatus(unlockedNext ? "New opponent unlocked." : "Checkmate", "over");
      disableBoardMoveInput();
      return true;
    }
    if (chess.isDraw()) {
      const reason = chess.isStalemate() ? "Stalemate"
        : chess.isInsufficientMaterial() ? "Insufficient material" : "Draw";
      recordSoloGameResult("draw");
      const drawOrigin = lastMoveSquares().at(-1);
      showVictoryBoardPulseAfterDelay(drawOrigin, 120, "draw");
      showOutcomeBannerAfterDelay("draw", 1900);
      setStatus(reason, "over");
      disableBoardMoveInput();
      return true;
    }
    hideOutcomeBanner();
    return false;
  }

  async function botMove() {
    if (chess.isGameOver() || !modelReady || botThinking) return;
    botThinking = true;
    setStatus("Thinking…", "thinking");
    const showedThinkingReaction = showOpponentThinkingReaction();
    if (showedThinkingReaction) {
      await wait(thinkingMoveDelay());
      if (chess.isGameOver() || !soloActive || coop?.phase !== "off" || gameEl.style.display === "none") {
        botThinking = false;
        return;
      }
    }

    const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
    const legalMask = buildLegalMask(workingFen, allMovesMaia3);

    const { logitsMove } = await runInference(tokens, getElo());
    const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesMaia3Reversed);
    const uci = sampleMove(moveProbs);

    const move = commitBotMove(uci);

    botThinking = false;
    saveSoloGame();
    if (!checkGameOver()) {
      showBotMoveReaction(move);
      enableBoardMoveInput();
      setStatus("Your turn");
    }
  }

  function maybeRunSoloBotTurn() {
    if (soloActive && coop?.phase === "off" && gameEl.style.display !== "none"
      && chess.turn() === "b" && modelReady && !botThinking && !chess.isGameOver())
      setTimeout(botMove, nextBotMoveDelay());
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

  function requestPortraitOrientation() {
    screen.orientation?.lock?.("portrait").catch(() => {});
  }

  requestPortraitOrientation();
  window.addEventListener("orientationchange", requestPortraitOrientation);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (["localhost", "127.0.0.1"].includes(location.hostname))
    new EventSource("/dev-reload").onmessage = (e) => { if (e.data === "reload") location.reload(); };

  // ── Lobby UI ──────────────────────────────────────────────────────────────

  const lbMain       = document.getElementById("lb-main");
  const lbAuth       = document.getElementById("lb-auth");
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
  const authPrimaryBtn = document.getElementById("auth-primary-btn");
  const authDemoBtn = document.getElementById("auth-demo-btn");
  const authDevLoginCard = document.getElementById("auth-dev-login-card");
  const authDevLoginOptions = document.getElementById("auth-dev-login-options");
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
  const profileBoardToggle = document.getElementById("profile-board-toggle");
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
  const demoGame = searchParams.get("demo");

  function setNavActive(target) {
    navPlay.classList.toggle("active", target === "play");
    navProfile.classList.toggle("active", target === "profile");
    navFriends.classList.toggle("active", target === "friends");
  }

  function setAuthLayout(active) {
    lobbyEl.classList.toggle("auth-mode", active);
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

  function setDemoGameUrl() {
    if (location.search.includes("room=")) return;
    const target = "/?demo=snib";
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
    setAuthLayout(false);
    setViewUrl("play");
    setNavActive("play");
    closeAddFriendDialog({ render: false });
    if (!pendingSoloStart) hideModelLoading();
    lbAuth.style.display = "none";
    lbMain.style.display = "flex";
    lbSolo.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbFriendInvite.style.display = "none";
    renderInviteNotification();
  }

  function showBotSelection(mode = "solo", { readonly = false } = {}) {
    setAuthLayout(false);
    setViewUrl(mode);
    setupMode = mode;
    opponentSelectionReadonly = readonly;
    closeAddFriendDialog({ render: false });
    setNavActive("play");
    lbSolo.classList.toggle("readonly", readonly);
    applyOpponentLocks();
    if (readonly) updateOpponentSelection(getElo());
    else clearOpponentSelection();
    botSelectTitle.textContent = readonly ? "Opponent selected" : "Choose your opponent";
    soloStartBtn.querySelector("span").textContent = readonly
      ? "Waiting for host"
      : mode === "coop" ? "Start" : "Continue";
    if (readonly) soloStartBtn.disabled = true;
    lbAuth.style.display = "none";
    lbMain.style.display = "none";
    lbSolo.style.display = "flex";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbFriendInvite.style.display = "none";
    renderInviteNotification();
  }

  function setAuthViewUrl() {
    if (location.search.includes("room=")) return;
    const next = searchParams.get("next");
    const target = next ? `/?auth=login&next=${encodeURIComponent(next)}` : "/?auth=login";
    if (`${location.pathname}${location.search}` !== target)
      history.replaceState(null, "", target);
  }

  function showAuthView() {
    setAuthLayout(true);
    setAuthViewUrl();
    setNavActive("");
    closeAddFriendDialog({ render: false });
    if (!pendingSoloStart) hideModelLoading();
    lbAuth.style.display = "flex";
    lbMain.style.display = "none";
    lbSolo.style.display = "none";
    lbRoom.style.display = "none";
    lbProfile.style.display = "none";
    lbFriends.style.display = "none";
    lbFriendInvite.style.display = "none";
    renderInviteNotification();
  }

  function showSoloSetup() {
    showBotSelection("solo");
  }

  function showCoopBotSelection({ readonly = false } = {}) {
    showBotSelection("coop", { readonly });
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
  function nextAfterAuth() {
    const next = searchParams.get("next");
    if (next?.startsWith("/")) return next;
    return searchParams.get("auth") === "login" ? "/" : currentNextPath();
  }
  let authInfo = {
    authEnabled: false,
    user: null,
    soloProgress: { unlockedOpponentCount: 1 },
    loginUrl: "/auth/google",
    logoutUrl: "/auth/logout",
  };

  function renderDevLogin() {
    const users = authInfo.devLoginUsers || [];
    const canShow = authInfo.localAuthEnabled && !authInfo.user && users.length > 0;
    const loginButtons = canShow
      ? users.map(user => `
        <button class="sm-btn primary-mini" type="button" data-dev-login-url="${escapeHtml(user.loginUrl)}">
          ${escapeHtml(user.name)}
        </button>
      `).join("")
      : "";
    devLoginCard.style.display = canShow ? "flex" : "none";
    authDevLoginCard.style.display = canShow ? "flex" : "none";
    devLoginOptions.innerHTML = loginButtons;
    authDevLoginOptions.innerHTML = loginButtons;
  }

  async function loadAuth() {
    try {
      authInfo = await fetch(`/api/me?next=${encodeURIComponent(nextAfterAuth())}`).then(r => r.json());
    } catch {
      authInfo = {
        authEnabled: false,
        user: null,
        soloProgress: { unlockedOpponentCount: 1 },
        loginUrl: "/auth/google",
        logoutUrl: "/auth/logout",
      };
    }
    syncSoloProgressFromAuth();

    if (!authInfo.authEnabled) {
      authBar.style.display = "none";
      profileAccountCard.style.display = "none";
      authDevLoginCard.style.display = "none";
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
      authPrimaryBtn.onclick = () => { location.href = authInfo.loginUrl; };
      profileAuthBtn.textContent = "Sign in";
      profileAuthBtn.onclick = () => { location.href = authInfo.loginUrl; };
    }
  }

  await loadAuth();

  function promptSignIn() {
    showAuthView();
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
      lbAuth,
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

  navPlay.onclick = () => {
    if (authInfo.authEnabled && !authInfo.user) showAuthView();
    else showPlayView();
  };
  devLoginOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dev-login-url]");
    if (!button) return;
    location.href = button.dataset.devLoginUrl;
  });
  authDevLoginOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dev-login-url]");
    if (!button) return;
    location.href = button.dataset.devLoginUrl;
  });
  authDemoBtn.onclick = () => startDemoGame();
  document.getElementById("play-solo-btn").onclick = () => {
    if (authInfo.authEnabled && !authInfo.user) {
      promptSignIn();
      return;
    }
    showSoloSetup();
  };
  opponentCards.forEach(card => {
    card.onclick = () => {
      if (opponentSelectionReadonly || card.disabled || card.classList.contains("locked")) return;
      syncStrength(card.dataset.opponentStrength);
      selectedOpponentIndex = Number(card.dataset.opponentIndex || 0);
      selectedOpponentTheme = card.dataset.opponentTheme || opponentThemeForStrength(card.dataset.opponentStrength);
      updateOpponentSelection(card.dataset.opponentStrength);
      soloStartBtn.disabled = false;
      if (setupMode === "coop" && coop?.phase === "lobby" && coop.myIdx === 0)
        coop.ws?.send(JSON.stringify({ type: "strength", strength: getElo() }));
    };
  });
  applyOpponentLocks();
  clearOpponentSelection();
  soloStartBtn.onclick = () => startSelectedGame();
  soloBackBtn.onclick = () => {
    pendingSoloStart = false;
    pendingSoloStartDemo = false;
    if (setupMode === "coop" && coop.phase === "lobby") {
      opponentSelectionReadonly = false;
      lbSolo.classList.remove("readonly");
      if (coop.myIdx === 0) coop.ws?.send(JSON.stringify({ type: "selecting-opponent", selecting: false }));
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

  cpStartBtn.onclick = () => enterCoopBotSelection();
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
  profileBoardToggle.onchange = () => setBoardDeviceSetting(profileBoardToggle.checked);
  window.matchMedia?.("(max-width: 860px)")?.addEventListener?.("change", renderBoardDeviceSetting);
  opponentSpeechClose.onclick = () => hideOpponentSpeech();
  if (!navigator.bluetooth) setBoardDeviceStatus("Chrome or Edge required", "warning");
  renderBoardDeviceSetting();

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
  botSplashStart.onclick = () => hideBotSplash();

  // ── Coop mode ─────────────────────────────────────────────────────────────

  coop = {
    ws: null, roomId: null,
    playerId: null,
    myIdx: -1,
    phase: "off",
    players: [], activeIdx: 0, midTurn: false, fen: null,
    maxUnlockedOpponentCount: 1,
    strength: 1500,
    selectingOpponent: false,
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
    if (opponentSelectionReadonly || soloStartBtn.disabled || coop.phase !== "lobby" || coop.myIdx !== 0) return;
    if (!modelReady) {
      showModelLoading("Preparing game...");
      requestModelDownload();
      return;
    }
    coop.ws?.send(JSON.stringify({ type: "strength", strength: getElo() }));
    coop.ws?.send(JSON.stringify({ type: "start" }));
  }

  function enterCoopBotSelection() {
    if (coop.phase !== "lobby") return;
    const isHost = coop.myIdx === 0;
    if (isHost) coop.ws?.send(JSON.stringify({ type: "selecting-opponent", selecting: true }));
    showCoopBotSelection({ readonly: !isHost });
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
    const canOpenSelection = ready && hasCoopPartner && (host || coop.selectingOpponent);
    cpRoomMeta.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;
    cpStartBtn.style.display = "inline";
    cpStartBtn.disabled = !canOpenSelection;
    cpStartBtn.textContent = host
      ? ready && hasCoopPartner ? "Continue" : "Waiting..."
      : coop.selectingOpponent ? "View opponent" : "Waiting for host";
    cpStartBtn.title = !hasCoopPartner
      ? "Invite at least one friend before choosing an opponent."
      : ready ? host || coop.selectingOpponent ? "" : "The host chooses the opponent." : "The game is loading on all players' devices.";
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
      disableBoardMoveInput();
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
      coop.selectingOpponent = !!msg.selectingOpponent;
      coop.maxUnlockedOpponentCount = Math.max(readSoloProgress(), Number(msg.maxUnlockedOpponentCount || 1));
      coop.reconnectAttempts = 0;
      if (msg.strength) {
        syncStrength(String(msg.strength));
        if (setupMode === "coop" && lbSolo.style.display !== "none")
          updateOpponentSelection(String(msg.strength));
      }

      if (msg.phase === "lobby") {
        coop.phase = "lobby";
        if (!msg.selectingOpponent && setupMode === "coop" && lbSolo.style.display !== "none") {
          opponentSelectionReadonly = false;
          lbSolo.classList.remove("readonly");
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
        if (msg.selectingOpponent && lbSolo.style.display === "none") {
          showCoopBotSelection({ readonly: msg.myIdx !== 0 });
          if (!coopInviteState.friends.length && !coopInviteState.loading) loadCoopInviteFriends();
          return;
        }
        if (setupMode === "coop" && lbSolo.style.display !== "none") {
          opponentSelectionReadonly = msg.myIdx !== 0;
          lbSolo.classList.toggle("readonly", opponentSelectionReadonly);
          applyOpponentLocks();
          if (opponentSelectionReadonly) {
            updateOpponentSelection(String(msg.strength || getElo()));
            soloStartBtn.disabled = true;
          }
          if (!coopInviteState.friends.length && !coopInviteState.loading) loadCoopInviteFriends();
          return;
        }
        lbMain.style.display = "none";
        lbSolo.style.display = "none";
        lbRoom.style.display = "flex";
        opponentSelectionReadonly = false;
        lbSolo.classList.remove("readonly");
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
          updateCheckMarker();
          updateChessnutDiffLeds();
          updateGameScore();
          enableBoardMoveInput();
          hideOutcomeBanner();
          if (msg.phase === "playing") {
            showBotSplash(currentOpponent(), {
              mode: "coop",
              autoStart: shouldAutoStartCoopSplash(msg),
            }).then(() => {
              if (coop?.roomId === msg.roomId && coop?.phase === "playing") showGameStartSpeech();
            });
          }
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
          disableBoardMoveInput();
        } else if (msg.activeIdx === msg.myIdx && !msg.midTurn) {
          hideOutcomeBanner();
          enableBoardMoveInput();
          setCoopTurnStatus();
        } else {
          hideOutcomeBanner();
          disableBoardMoveInput();
          setCoopTurnStatus();
        }
        maybeAutoStartCoopSplash(msg);
        maybeRunCoopBotTurn();
      }
    }
  }

  function maybeRunCoopBotTurn() {
    if (!isMyCoopBotTurn()) {
      clearCoopBotTimer();
      return;
    }
    scheduleCoopBotMove();
  }

  async function coopBotMove() {
    if (!isMyCoopBotTurn() || botThinking) return;
    const roomId = coop.roomId;
    const fenBeforeThinking = chess.fen();
    botThinking = true;
    try {
      setStatus("Thinking…", "thinking");
      const showedThinkingReaction = showOpponentThinkingReaction();
      if (showedThinkingReaction) {
        await wait(thinkingMoveDelay());
        if (!isMyCoopBotTurn() || coop.roomId !== roomId || chess.fen() !== fenBeforeThinking) return;
      }
      const { isBlack, workingFen, tokens } = prepareMaiaPosition(chess.fen());
      const legalMask = buildLegalMask(workingFen, allMovesMaia3);

      const { logitsMove } = await runInference(tokens, coop.strength);
      if (!isMyCoopBotTurn() || coop.roomId !== roomId || chess.fen() !== fenBeforeThinking) return;

      const moveProbs = decodeMoves(logitsMove, legalMask, isBlack, allMovesMaia3Reversed);
      const uci = sampleMove(moveProbs);

      const move = commitBotMove(uci);
      if (!move) return;
      publishCoopMove();
      if (!checkGameOver()) showBotMoveReaction(move);
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
  } else if (demoGame === "snib") {
    startDemoGame();
  } else if (urlGame === "solo") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else restoreSoloGame();
  } else if (initialView === "profile") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else showProfileView();
  } else if (initialView === "friends") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else showFriendsView();
  } else if (initialView === "solo") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else showSoloSetup();
  } else if (initialView === "coop") {
    if (authInfo.authEnabled && !authInfo.user) promptSignIn();
    else connectCoop("create");
  } else if (authInfo.authEnabled && !authInfo.user) {
    showAuthView();
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
      clearBotSplashAutoTimer();
      window.removeEventListener("orientationchange", requestPortraitOrientation);
      clearOpponentSpeechTimers();
      social?.stopPresenceHeartbeat();
      disconnectChessnutBoard();
    };
  }, []);

  return (
    <>
      <div className="app">
        <Lobby />
        <GameView />
        <BotSplash />
        <FriendAddDialog />
      </div>
      <div className="orientation-lock" role="status" aria-live="polite">
        <div>Rotate back to portrait</div>
      </div>
    </>
  );
}
