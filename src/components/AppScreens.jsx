import {
  ArrowLeft,
  Home,
  Swords,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { SOLO_OPPONENTS } from "../soloOpponents.js";

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
      <button id="nav-play" className="side-link active" type="button"><span className="nav-icon" aria-hidden="true"><Home /></span>Home</button>
      <button id="nav-profile" className="side-link" type="button"><span className="nav-icon" aria-hidden="true"><User /></span>Profile</button>
      <button id="nav-friends" className="side-link" type="button">
        <span className="nav-icon" aria-hidden="true"><Users /></span>Friends
        <span id="notification-badge" className="notification-badge" hidden>0</span>
      </button>
      <button id="nav-leaderboard" className="side-link" type="button" aria-label="Achievements">
        <span className="nav-icon" aria-hidden="true"><Trophy /></span>
        <span className="nav-label-desktop">Achievements</span>
        <span className="nav-label-mobile" aria-hidden="true">Goals</span>
      </button>
    </nav>
  );
}

function PlayPanel() {
  return (
    <div id="lb-main" className="lobby-section lobby-panel">
      <div className="home-copy">
        <div className="home-eyebrow">Welcome back</div>
        <strong id="welcome-name">Wanderer</strong>
        <p>{randomHomeGreeting()}</p>
      </div>
      <div className="mode-grid">
        <button id="play-solo-btn" className="mode-card" type="button">
          <span className="mode-card-art-wrap" aria-hidden="true">
            <img className="mode-card-art" src="/assets/misc/solo.png" alt="" />
          </span>
          <span className="mode-card-copy">
            <strong>Solo</strong>
            <span>Challenge AI opponents and sharpen your skills.</span>
          </span>
        </button>
        <button id="play-coop-btn" className="mode-card" type="button">
          <span className="mode-card-art-wrap" aria-hidden="true">
            <img className="mode-card-art" src="/assets/misc/coop.png" alt="" />
          </span>
          <span className="mode-card-copy">
            <strong>Co-op</strong>
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
          <span>Continue with Google</span>
        </button>
        <button id="auth-demo-btn" className="sm-btn auth-demo-btn" type="button">
          <img src="/assets/bots/snib/talk.png" alt="" />
          <span>Try demo against Snib</span>
        </button>
      </div>
      <form id="school-login-form" className="school-login-card" hidden>
        <strong>Chess club login</strong>
        <div className="school-login-fields">
          <input id="school-login-username" name="username" placeholder="Username" autoCapitalize="none" autoComplete="username" required />
          <input id="school-login-password" name="password" type="password" placeholder="Password" autoComplete="current-password" required />
        </div>
        <div id="school-login-message" className="school-account-message" role="status" aria-live="polite"></div>
        <button id="school-login-submit" className="sm-btn primary-mini" type="submit">Sign in</button>
      </form>
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
        <span
          key={index}
          className={index < rank ? "filled" : ""}
          aria-hidden="true"
        ></span>
      ))}
    </span>
  );
}

function SinglePlayerSetup() {
  return (
    <div id="lb-solo" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <button id="solo-back-btn" className="bot-back-btn" type="button" aria-label="Back">
        <ArrowLeft aria-hidden="true" />
      </button>
      <div className="bot-select-head">
        <h2 id="bot-select-title">Choose your opponent</h2>
        <span className="home-divider" aria-hidden="true"></span>
        <p id="bot-select-hint" className="bot-select-hint" hidden></p>
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
            data-unlocked-src={`/assets/bots/${opponent.theme}/talk.png`}
            aria-pressed="false"
            aria-disabled={index > 0 ? "true" : "false"}
            disabled={index > 0}
          >
            <span className="opponent-card-art-wrap" aria-hidden="true">
              <img
                className="opponent-card-art"
                src={`/assets/bots/${opponent.theme}/talk.png`}
                alt=""
              />
            </span>
            <span className="opponent-card-copy">
              <strong>{opponent.name}</strong>
              <OpponentRank rank={opponent.rank} />
            </span>
            <span className="opponent-locked-copy">Locked</span>
          </button>
        ))}
      </div>
      <button id="solo-start-btn" className="bot-continue-btn" type="button" disabled>
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
          <button id="friend-add-close" className="friend-add-close" type="button" aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>
        <label className="friend-search-box" htmlFor="friend-search">
          <span>Search username</span>
          <input id="friend-search" placeholder="Search username" autoComplete="off" autoCapitalize="none" />
        </label>
        <div id="friend-add-message" className="friend-message" role="status" aria-live="polite"></div>
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
      <section id="school-admin-card" className="school-admin-card" hidden>
        <div className="school-admin-heading">
          <div>
            <strong>Chess club accounts</strong>
            <span>Create and manage player logins.</span>
          </div>
        </div>
        <form id="school-account-create" className="school-account-create">
          <input id="school-account-username" placeholder="Account name" minLength="3" maxLength="20" autoCapitalize="none" autoComplete="off" required />
          <input id="school-account-password" type="password" placeholder="Password" autoComplete="new-password" required />
          <button id="school-account-create-submit" className="sm-btn primary-mini" type="submit">Create account</button>
        </form>
        <div id="school-account-message" className="school-account-message" role="status" aria-live="polite"></div>
        <div id="school-account-list" className="school-account-list"></div>
      </section>
      <div id="dev-login-card" className="dev-login-card" style={{ display: "none" }}>
        <span>Dev login</span>
        <div id="dev-login-options" className="dev-login-options"></div>
      </div>
    </div>
  );
}

function DevTestingPanel() {
  return (
    <div id="lb-dev-testing" className="lobby-section lobby-panel dev-testing-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Dev testing</div>
        <span className="home-divider" aria-hidden="true"></span>
        <div className="panel-kicker">Scenarios</div>
      </div>
      <section id="dev-testing-card" className="dev-testing-card" hidden>
        <div className="dev-testing-heading">
          <strong>Focused checks</strong>
          <span>Trigger UI states without playing through them.</span>
        </div>
        <div className="dev-testing-actions">
          <button id="dev-test-victory-highscore" className="sm-btn primary-mini" type="button" data-dev-test-scenario="victoryHighscore">
            Victory: both highscores
          </button>
          <button className="sm-btn primary-mini" type="button" data-dev-test-scenario="victoryMovesHighscore">
            Victory: moves highscore
          </button>
          <button className="sm-btn primary-mini" type="button" data-dev-test-scenario="victoryTimeHighscore">
            Victory: time highscore
          </button>
          <button className="sm-btn primary-mini" type="button" data-dev-test-scenario="victoryUnlock">
            Victory: unlock enemy
          </button>
        </div>
        <div id="dev-testing-message" className="school-account-message" role="status" aria-live="polite"></div>
      </section>
    </div>
  );
}

function LeaderboardPanel() {
  return (
    <div id="lb-leaderboard" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <div className="panel-head">
        <div className="panel-title">Achievements</div>
        <span className="home-divider" aria-hidden="true"></span>
        <div className="panel-kicker">Progress and rankings</div>
      </div>
      <section id="achievements-stats-card" className="profile-stats-card achievements-stats-card" aria-live="polite">
        <div className="profile-stats-heading">
          <strong>Your progress</strong>
          <span>Victories and defeated opponents.</span>
        </div>
        <div className="profile-stat-grid">
          <div className="profile-stat-tile">
            <Trophy aria-hidden="true" />
            <span>Total games won</span>
            <strong id="achievements-total-wins">...</strong>
          </div>
          <div className="profile-stat-tile">
            <Swords aria-hidden="true" />
            <span>Opponents defeated</span>
            <strong id="achievements-defeated-count">...</strong>
          </div>
        </div>
      </section>
      <section className="leaderboard-rankings-card">
        <div className="leaderboard-rankings-head">
          <strong>Rankings</strong>
        </div>
        <div id="leaderboard-opponents" className="leaderboard-opponents"></div>
        <div id="leaderboard-metric" className="leaderboard-metric" aria-label="Leaderboard metric">
          <button className="active" type="button" data-leaderboard-metric="fastest" aria-pressed="true">
            Fastest
          </button>
          <button type="button" data-leaderboard-metric="fewestMoves" aria-pressed="false">
            Fewest moves
          </button>
        </div>
        <div id="leaderboard-list" className="leaderboard-list"></div>
      </section>
    </div>
  );
}

function CoopRoomPanel() {
  return (
    <div id="lb-room" className="lobby-section lobby-panel" style={{ display: "none" }}>
      <button id="cp-leave" className="bot-back-btn" type="button" aria-label="Back">
        <ArrowLeft aria-hidden="true" />
      </button>
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

export function NotificationNotice() {
  return (
    <div id="coop-invite-notice" className="coop-invite-notice notification-notice" style={{ display: "none" }} role="status" aria-live="polite">
      <div>
        <strong id="coop-invite-title">Notification</strong>
        <span id="coop-invite-text"></span>
      </div>
      <div className="friend-actions">
        <button id="coop-invite-join" className="sm-btn primary-mini" type="button">View</button>
        <button id="coop-invite-dismiss" className="sm-btn" type="button">Later</button>
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
      <AuthPanel />
      <PlayPanel />
      <SinglePlayerSetup />
      <ProfilePanel />
      <FriendsPanel />
      <LeaderboardPanel />
      <DevTestingPanel />
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
        <ArrowLeft aria-hidden="true" />
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
          <section id="game-outcome-results" className="game-outcome-results" hidden>
            <div className="outcome-result-row">
              <span className="outcome-result-label">Moves</span>
              <div className="outcome-result-value">
                <span className="outcome-result-icon" aria-hidden="true">M</span>
                <strong id="game-outcome-moves">0</strong>
              </div>
              <div id="game-outcome-moves-best" className="outcome-result-best" hidden></div>
            </div>
            <div className="outcome-result-row">
              <span className="outcome-result-label">Time</span>
              <div className="outcome-result-value">
                <span className="outcome-result-icon" aria-hidden="true">T</span>
                <strong id="game-outcome-time">0:00</strong>
              </div>
              <div id="game-outcome-time-best" className="outcome-result-best" hidden></div>
            </div>
          </section>
          <section id="game-outcome-unlock" className="game-outcome-unlock" hidden>
            <div className="outcome-unlock-copy">
              <span className="outcome-unlock-title">New enemy unlocked!</span>
              <strong id="game-outcome-unlock-name"></strong>
              <img id="game-outcome-unlock-card" className="outcome-unlock-card" src="/assets/bots/snib/talk.png" alt="" />
              <button id="game-outcome-challenge" className="outcome-challenge-btn" type="button">
                Challenge Now
              </button>
            </div>
          </section>
          <button id="game-outcome-continue" className="bot-continue-btn game-outcome-continue" type="button">
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
      <div id="promotion-choice" className="promotion-choice" hidden aria-label="Choose promotion piece">
        <button type="button" data-promotion="q" aria-label="Promote to queen">
          <svg viewBox="0 0 40 40" aria-hidden="true"><use href="/cm-chessboard/assets/pieces/staunty.svg#wq" /></svg>
        </button>
        <button type="button" data-promotion="r" aria-label="Promote to rook">
          <svg viewBox="0 0 40 40" aria-hidden="true"><use href="/cm-chessboard/assets/pieces/staunty.svg#wr" /></svg>
        </button>
        <button type="button" data-promotion="b" aria-label="Promote to bishop">
          <svg viewBox="0 0 40 40" aria-hidden="true"><use href="/cm-chessboard/assets/pieces/staunty.svg#wb" /></svg>
        </button>
        <button type="button" data-promotion="n" aria-label="Promote to knight">
          <svg viewBox="0 0 40 40" aria-hidden="true"><use href="/cm-chessboard/assets/pieces/staunty.svg#wn" /></svg>
        </button>
      </div>
      <div id="opponent-speech" className="opponent-speech" hidden aria-live="polite">
        <img id="opponent-speech-portrait" src="/assets/bots/snib/talk.png" alt="" />
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

function DevTestingButton() {
  return (
    <button id="dev-testing-fab" className="dev-testing-fab" type="button" hidden>
      Dev
    </button>
  );
}

function BotSplash() {
  return (
    <div id="bot-splash" className="bot-splash" hidden aria-hidden="true">
      <img id="bot-splash-art" className="bot-splash-art" src="/assets/backgrounds/snib_splash.png" alt="" />
      <div className="bot-splash-panel">
        <div className="bot-splash-copy" role="dialog" aria-modal="true" aria-labelledby="bot-splash-name">
          <div id="bot-splash-banner" className="bot-splash-banner" aria-hidden="true"></div>
          <div className="bot-splash-content">
            <h2 id="bot-splash-name">Snib the Candle Goblin</h2>
            <span className="bot-splash-divider" aria-hidden="true"></span>
            <p id="bot-splash-text"></p>
            <span className="bot-splash-divider" aria-hidden="true"></span>
            <div id="bot-splash-strength" className="bot-splash-strength" aria-label="Opponent strength"></div>
          </div>
        </div>
        <button id="bot-splash-start" className="bot-continue-btn bot-splash-start" type="button">
          <span>Start game</span>
        </button>
      </div>
    </div>
  );
}

export {
  AuthPanel,
  BotSplash,
  DevTestingButton,
  DevTestingPanel,
  FriendAddDialog,
  FriendInvitePanel,
  FriendsPanel,
  GameView,
  Lobby,
  ModelLoading,
  OpponentRank,
  PlayPanel,
  ProfilePanel,
  CoopRoomPanel,
  SideMenu,
  SinglePlayerSetup,
};
