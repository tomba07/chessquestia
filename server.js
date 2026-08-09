#!/usr/bin/env node
/**
 * Local chess static file server with hot reload + WebSocket coop rooms.
 *
 * Setup:
 *   npm install
 *   node download_assets.js   # one-time: downloads model + ORT + move JSONs
 *   node server.js            # LAN play — share link uses your LAN IP
 *   node server.js --tunnel   # internet play — opens a public localtunnel URL
 */

const express  = require("express");
const chokidar = require("chokidar");
const path     = require("path");
const os       = require("os");
const fs       = require("fs");
const { WebSocketServer } = require("ws");
const { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { Chess } = require("chess.js");
const { registerSocialRoutes } = require("./server/domains/social");

const PORT = process.env.PORT || 5678;
const DATA_DIR = process.env.DATA_DIR || (process.env.ROOMS_FILE ? path.dirname(process.env.ROOMS_FILE) : __dirname);
const ROOMS_FILE = process.env.ROOMS_FILE || path.join(DATA_DIR, ".chessquestia-rooms.json");
const LEGACY_ROOMS_FILE = path.join(__dirname, ".local-chess-rooms.json");
const AUTH_FILE = process.env.AUTH_FILE || path.join(DATA_DIR, ".chessquestia-auth.json");
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "chessquestia.sqlite");
const app  = express();
const notificationSockets = new Map();
app.set("trust proxy", true);
app.use(express.json({ limit: "64kb" }));

// ── LAN IP ────────────────────────────────────────────────────────────────────

function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    const hit = ifaces.find(i => i.family === "IPv4" && !i.internal);
    if (hit) return hit.address;
  }
  return "127.0.0.1";
}

let publicBase = process.env.PUBLIC_BASE_URL || null; // also overridden by --tunnel
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const googleAuthEnabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const isDev = process.env.NODE_ENV !== "production";
const localAuthEnabled = process.env.LOCAL_AUTH === "1" || (isDev && process.env.LOCAL_AUTH !== "0");
const devTestingEnabled = process.env.DEV_TESTING === "1" || (isDev && process.env.DEV_TESTING !== "0");
const schoolAuthEnabled = process.env.SCHOOL_AUTH !== "0";
const authEnabled = googleAuthEnabled || localAuthEnabled || schoolAuthEnabled;
const configuredAdminEmails = new Set([
  "ditesch@gmail.com",
  "mirko.teschke@gmail.com",
  ...String(process.env.SCHOOL_ADMIN_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
]);
const DEV_LOGIN_USERS = [
  { key: "mirko", username: "mirko", name: "Mirko", email: "mirko@chessquestia.local" },
  { key: "lena", username: "lena", name: "Lena", email: "lena@chessquestia.local" },
  { key: "tom", username: "tom", name: "Tom", email: "tom@chessquestia.local" },
];

// ── SQLite persistence ────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_sub TEXT,
    username TEXT,
    email TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    picture TEXT,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    host_player_id TEXT NOT NULL,
    host_user_id TEXT,
    phase TEXT NOT NULL,
    fen TEXT NOT NULL,
    active_idx INTEGER NOT NULL,
    mid_turn INTEGER NOT NULL,
    strength INTEGER NOT NULL,
    started_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_players (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    maia_ready INTEGER NOT NULL DEFAULT 0,
    unlocked_count INTEGER NOT NULL DEFAULT 1,
    last_seen INTEGER NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (room_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON room_players(user_id);

  CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    user_id TEXT,
    previous_fen TEXT,
    fen TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_moves_room_id ON moves(room_id);

  CREATE TABLE IF NOT EXISTS friendships (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id < friend_id)
  );
  CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    responded_at INTEGER,
    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id != addressee_id)
  );
  CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_id ON friend_requests(requester_id);
  CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee_id ON friend_requests(addressee_id);

  CREATE TABLE IF NOT EXISTS room_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    responded_at INTEGER,
    UNIQUE(room_id, invitee_id),
    CHECK (inviter_id != invitee_id)
  );
  CREATE INDEX IF NOT EXISTS idx_room_invites_invitee_id ON room_invites(invitee_id);
  CREATE INDEX IF NOT EXISTS idx_room_invites_room_id ON room_invites(room_id);

  CREATE TABLE IF NOT EXISTS game_results (
    id TEXT PRIMARY KEY,
    dedupe_key TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL,
    result TEXT NOT NULL,
    room_id TEXT,
    opponent_strength INTEGER,
    opponent_key TEXT,
    player_count INTEGER NOT NULL DEFAULT 1,
    moves_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    final_fen TEXT,
    created_at INTEGER NOT NULL,
    finished_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_game_results_mode_result ON game_results(mode, result);
  CREATE INDEX IF NOT EXISTS idx_game_results_finished_at ON game_results(finished_at);
  CREATE INDEX IF NOT EXISTS idx_game_results_room_id ON game_results(room_id);

  CREATE TABLE IF NOT EXISTS game_result_players (
    game_result_id TEXT NOT NULL REFERENCES game_results(id) ON DELETE CASCADE,
    user_id TEXT,
    player_name TEXT NOT NULL,
    result TEXT NOT NULL,
    PRIMARY KEY (game_result_id, user_id, player_name)
  );
  CREATE INDEX IF NOT EXISTS idx_game_result_players_user_id ON game_result_players(user_id);

  CREATE TABLE IF NOT EXISTS user_progress (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    unlocked_count INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );
`);

function inTransaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(info => info.name === column);
}

if (!columnExists("users", "username")) {
  db.exec("ALTER TABLE users ADD COLUMN username TEXT");
}
if (!columnExists("users", "password_hash")) {
  db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
}
if (!columnExists("users", "is_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
}
if (!columnExists("users", "is_test_account")) {
  db.exec("ALTER TABLE users ADD COLUMN is_test_account INTEGER NOT NULL DEFAULT 0");
}
db.exec("UPDATE users SET name = username, is_admin = 0 WHERE is_test_account = 1");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL");
if (!columnExists("room_players", "unlocked_count")) {
  db.exec("ALTER TABLE room_players ADD COLUMN unlocked_count INTEGER NOT NULL DEFAULT 1");
}
if (!columnExists("rooms", "started_at")) {
  db.exec("ALTER TABLE rooms ADD COLUMN started_at INTEGER");
}
if (!columnExists("game_results", "duration_ms")) {
  db.exec("ALTER TABLE game_results ADD COLUMN duration_ms INTEGER");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_game_results_leaderboard ON game_results(opponent_key, result, duration_ms, moves_count)");

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

function normalizeUnlockedOpponentCount(count) {
  const parsed = parseInt(count, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(5, parsed));
}

const SEEDED_PROGRESS_BY_EMAIL = new Map([
  ["mirko.teschke@gmail.com", 3],
  ["majken.pluegge@gmail.com", 3],
]);

function soloProgressForUserId(userId) {
  if (!userId) return { unlockedOpponentCount: 1 };
  const row = db.prepare("SELECT unlocked_count FROM user_progress WHERE user_id = ?").get(userId);
  return { unlockedOpponentCount: normalizeUnlockedOpponentCount(row?.unlocked_count || 1) };
}

function setUserUnlockedOpponentCount(userId, unlockedCount) {
  if (!userId) return soloProgressForUserId(userId);
  const normalized = normalizeUnlockedOpponentCount(unlockedCount);
  db.prepare(`
    INSERT INTO user_progress (user_id, unlocked_count, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      unlocked_count = MAX(user_progress.unlocked_count, excluded.unlocked_count),
      updated_at = excluded.updated_at
  `).run(userId, normalized, Date.now());
  return soloProgressForUserId(userId);
}

function seededProgressForEmail(email) {
  return SEEDED_PROGRESS_BY_EMAIL.get(String(email || "").trim().toLowerCase()) || 1;
}

function applySeededUserProgress(user) {
  const seededCount = seededProgressForEmail(user?.email);
  if (seededCount > 1) setUserUnlockedOpponentCount(user.id, seededCount);
}

function grantSeededProgress() {
  const users = db.prepare("SELECT id, email FROM users WHERE email IS NOT NULL AND email != ''").all();
  for (const user of users) applySeededUserProgress(user);
}

function unlockedCountForUserAndClient(user, clientCount) {
  if (!user?.id) return normalizeUnlockedOpponentCount(clientCount);
  const current = soloProgressForUserId(user.id).unlockedOpponentCount;
  const merged = Math.max(current, normalizeUnlockedOpponentCount(clientCount));
  return setUserUnlockedOpponentCount(user.id, merged).unlockedOpponentCount;
}

function unlockedCountAfterVictory(opponentStrength) {
  const strength = parseInt(opponentStrength, 10);
  if (!Number.isFinite(strength)) return 1;
  if (strength <= 500) return 2;
  if (strength <= 700) return 3;
  if (strength <= 900) return 4;
  if (strength <= 1100) return 5;
  return 5;
}

function usernameSeed(profileOrUser) {
  const email = profileOrUser?.email || "";
  return normalizeUsername(email.split("@")[0] || profileOrUser?.name || "player") || "player";
}

function uniqueUsername(seed, existingUserId = null) {
  const base = normalizeUsername(seed) || "player";
  for (let i = 0; i < 1000; i += 1) {
    const candidate = i === 0 ? base : `${base.slice(0, Math.max(1, 20 - String(i).length - 1))}_${i}`;
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(candidate);
    if (!existing || existing.id === existingUserId) return candidate;
  }
  return `player_${randomBytes(4).toString("hex")}`;
}

// ── COOP/COEP headers ─────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy",   "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (process.argv.includes("--tunnel")) res.setHeader("bypass-tunnel-reminder", "true");
  next();
});

// ── Config endpoint ───────────────────────────────────────────────────────────

app.get("/config", (req, res) => {
  const requestBase = req.protocol + "://" + req.get("host");
  res.json({
    base: publicBase ?? requestBase,
    dev: process.env.NODE_ENV !== "production",
    authEnabled,
  });
});

// ── Auth/session persistence ─────────────────────────────────────────────────

const SESSION_COOKIE = "cq_session";
const OAUTH_STATE_COOKIE = "cq_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const PRESENCE_TTL_MS = 1000 * 45;
const oauthStates = new Map();
const presence = new Map();

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    providerSub: row.provider_sub,
    username: row.username,
    email: row.email,
    emailVerified: !!row.email_verified,
    name: row.name,
    picture: row.picture,
    passwordHash: row.password_hash,
    isAdmin: !!row.is_admin,
    isTestAccount: !!row.is_test_account,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function migrateAuthJson() {
  if (!fs.existsSync(AUTH_FILE)) return;
  const existingUsers = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  const existingSessions = db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count;
  if (existingUsers || existingSessions) return;

  try {
    const payload = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    inTransaction(() => {
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users
          (id, provider, provider_sub, username, email, email_verified, name, picture, created_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const user of Object.values(payload.users || {})) {
        const username = uniqueUsername(user.username || usernameSeed(user), user.id);
        insertUser.run(
          user.id,
          user.provider || "google",
          user.providerSub || user.provider_sub || "",
          username,
          user.email || "",
          user.emailVerified || user.email_verified ? 1 : 0,
          user.name || user.email || "Player",
          user.picture || "",
          user.createdAt || user.created_at || Date.now(),
          user.lastLoginAt || user.last_login_at || Date.now(),
        );
      }

      const insertSession = db.prepare(`
        INSERT OR IGNORE INTO sessions (hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const [hash, session] of Object.entries(payload.sessions || {})) {
        if (!session?.userId) continue;
        insertSession.run(
          hash,
          session.userId,
          session.createdAt || Date.now(),
          session.expiresAt || 0,
        );
      }
    });
    console.log("Migrated auth JSON into SQLite");
  } catch (err) {
    console.warn(`Could not migrate auth JSON: ${err.message}`);
  }
}

function backfillUsernames() {
  const users = db.prepare("SELECT id, name, email FROM users WHERE username IS NULL OR username = ''").all();
  if (!users.length) return;
  inTransaction(() => {
    const update = db.prepare("UPDATE users SET username = ? WHERE id = ?");
    for (const user of users) {
      update.run(uniqueUsername(usernameSeed(user), user.id), user.id);
    }
  });
}

function cleanupExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "")
    .split(";")
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .map(cookie => {
      const eq = cookie.indexOf("=");
      if (eq === -1) return [cookie, ""];
      return [cookie.slice(0, eq), decodeURIComponent(cookie.slice(eq + 1))];
    }));
}

function cookieHeader(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

function clearCookieHeader(name) {
  return cookieHeader(name, "", { maxAge: 0 });
}

function isSecureRequest(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

function externalBase(req) {
  return publicBase || `${req.protocol}://${req.get("host")}`;
}

function safeNextPath(next) {
  const wanted = String(next || "/");
  if (!wanted.startsWith("/") || wanted.startsWith("//")) return "/";
  return wanted;
}

function sessionHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    picture: user.picture,
    isAdmin: isAdminUser(user),
    isTestAccount: !!user.isTestAccount,
  };
}

function isAdminUser(user) {
  if (!user) return false;
  if (user.isTestAccount) return false;
  if (user.isAdmin) return true;
  if (user.id === "local:mirko") return true;
  return configuredAdminEmails.has(String(user.email || "").trim().toLowerCase());
}

function requireAdminUser(req, res) {
  const user = requireApiUser(req, res);
  if (!user) return null;
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Administrator access required" });
    return null;
  }
  return user;
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, 64);
  return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

function verifyPassword(password, encoded) {
  const [scheme, saltText, hashText] = String(encoded || "").split(":");
  if (scheme !== "scrypt" || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, "base64url");
    const actual = scryptSync(String(password), Buffer.from(saltText, "base64url"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function validateManagedAccountInput(payload, { passwordRequired = false } = {}) {
  const username = normalizeUsername(payload?.username);
  const password = String(payload?.password || "");
  if (username.length < 3) throw new Error("Username must be at least 3 characters.");
  if (passwordRequired && !password)
    throw new Error("Password is required.");
  return { username, password };
}

function publicFriendUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    picture: row.picture,
    createdAt: row.created_at,
    friendshipStatus: row.friendship_status,
    presence: presenceForUser(row.id),
  };
}

function touchPresence(userId) {
  if (!userId) return;
  presence.set(userId, { lastSeen: Date.now() });
}

function presenceForUser(userId) {
  for (const room of rooms.values()) {
    if (!["lobby", "playing"].includes(room.phase)) continue;
    const player = [...room.players.values()].find(candidate => (
      candidate.userId === userId
      && candidate.connected
      && candidate.ws?.readyState === 1
    ));
    if (!player) continue;
    return {
      state: room.phase === "lobby" ? "in_lobby" : "in_game",
      label: room.phase === "lobby" ? "In lobby" : "In game",
      roomId: room.id,
    };
  }

  const seen = presence.get(userId)?.lastSeen || 0;
  if (Date.now() - seen <= PRESENCE_TTL_MS) {
    return { state: "online", label: "Online", roomId: null };
  }

  return { state: "offline", label: "Offline", roomId: null };
}

function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  return userFromRow(db.prepare(`
    SELECT u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.hash = ? AND s.expires_at > ?
  `).get(sessionHash(token), Date.now()));
}

function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  db.prepare(`
    INSERT INTO sessions (hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionHash(token), userId, Date.now(), Date.now() + SESSION_TTL_MS);
  return token;
}

function requireApiUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return null;
  }
  touchPresence(user.id);
  return user;
}

function friendshipPair(userId, friendId) {
  return userId < friendId ? [userId, friendId] : [friendId, userId];
}

function createFriendship(userId, friendId) {
  const [firstId, secondId] = friendshipPair(userId, friendId);
  db.prepare(`
    INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at)
    VALUES (?, ?, ?)
  `).run(firstId, secondId, Date.now());
}

function createManagedFriendship(userId, friendId) {
  if (!userId || !friendId || userId === friendId) return;
  createFriendship(userId, friendId);
  db.prepare(`
    DELETE FROM friend_requests
    WHERE (requester_id = ? AND addressee_id = ?)
       OR (requester_id = ? AND addressee_id = ?)
  `).run(userId, friendId, friendId, userId);
}

function syncManagedAccountFriendships(adminId) {
  const managedUserIds = db.prepare(`
    SELECT id FROM users
    WHERE is_test_account = 1
    ORDER BY id
  `).all().map(row => row.id);

  inTransaction(() => {
    for (let index = 0; index < managedUserIds.length; index += 1) {
      const userId = managedUserIds[index];
      createManagedFriendship(adminId, userId);
      for (let friendIndex = index + 1; friendIndex < managedUserIds.length; friendIndex += 1)
        createManagedFriendship(userId, managedUserIds[friendIndex]);
    }
  });
}

function areFriends(userId, friendId) {
  const [firstId, secondId] = friendshipPair(userId, friendId);
  return !!db.prepare(`
    SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?
  `).get(firstId, secondId);
}

function roomHasUser(roomId, userId) {
  const room = rooms.get(roomId);
  if (room) {
    return [...room.players.values()].some(player => (
      player.userId === userId
      && player.connected
      && player.ws?.readyState === 1
    ));
  }
  return !!db.prepare(`
    SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?
  `).get(roomId, userId);
}

function opponentKeyForStrength(strength) {
  const value = parseInt(strength, 10);
  if (value <= 500) return "snib";
  if (value <= 700) return "muckroot";
  if (value <= 900) return "gribble";
  if (value <= 1100) return "vexi";
  if (value <= 1300) return "drogar";
  return null;
}

function normalizeGameResult(result) {
  return ["victory", "defeat", "draw"].includes(result) ? result : null;
}

function gameResultFromFen(fen) {
  try {
    const game = new Chess();
    game.load(fen);
    if (game.isCheckmate()) return game.turn() === "b" ? "victory" : "defeat";
    if (game.isDraw()) return "draw";
  } catch {
    return null;
  }
  return null;
}

function notifyUser(userId) {
  if (!userId) return;
  const sockets = notificationSockets.get(userId);
  if (!sockets) return;
  const message = JSON.stringify({ type: "notifications-changed" });
  for (const socket of sockets) {
    if (socket.readyState === 1) socket.send(message);
  }
}

function cancelPendingRoomInvites(roomId) {
  const invitees = db.prepare(`
    SELECT DISTINCT invitee_id
    FROM room_invites
    WHERE room_id = ? AND status = 'pending'
  `).all(roomId).map(row => row.invitee_id);
  if (!invitees.length) return;
  db.prepare(`
    UPDATE room_invites
    SET status = 'cancelled', responded_at = ?
    WHERE room_id = ? AND status = 'pending'
  `).run(Date.now(), roomId);
  for (const inviteeId of invitees) notifyUser(inviteeId);
}

function invitePreviousRoomPlayers(room, inviterUserId, players) {
  if (!room?.id || !inviterUserId || !players?.length) return;
  const now = Date.now();
  const invite = db.prepare(`
    INSERT INTO room_invites (room_id, inviter_id, invitee_id, status, created_at, responded_at)
    VALUES (?, ?, ?, 'pending', ?, NULL)
    ON CONFLICT(room_id, invitee_id) DO UPDATE SET
      inviter_id = excluded.inviter_id,
      status = 'pending',
      created_at = excluded.created_at,
      responded_at = NULL
  `);
  const inviteeIds = [...new Set(players
    .map(player => player?.userId)
    .filter(userId => userId && userId !== inviterUserId))];
  for (const inviteeId of inviteeIds) {
    invite.run(room.id, inviterUserId, inviteeId, now);
    notifyUser(inviteeId);
  }
}

function closeLobbyRoom(room, message = "The room was closed.") {
  if (!room) return;
  cancelPendingRoomInvites(room.id);
  broadcast(room, () => ({ type: "room-closed", message }));
  rooms.delete(room.id);
  inTransaction(() => {
    db.prepare("DELETE FROM rooms WHERE id = ?").run(room.id);
  });
}

function recordGameResult({
  dedupeKey,
  mode,
  result,
  roomId = null,
  opponentStrength = null,
  opponentKey = null,
  playerCount = 1,
  movesCount = 0,
  durationMs = null,
  finalFen = null,
  players = [],
  finishedAt = Date.now(),
}) {
  const normalizedResult = normalizeGameResult(result);
  if (!dedupeKey || !["solo", "coop"].includes(mode) || !normalizedResult) return null;

  const existing = db.prepare("SELECT id FROM game_results WHERE dedupe_key = ?").get(dedupeKey);
  if (existing) return existing.id;

  const id = randomUUID();
  inTransaction(() => {
    db.prepare(`
      INSERT INTO game_results
        (id, dedupe_key, mode, result, room_id, opponent_strength, opponent_key, player_count, moves_count, duration_ms, final_fen, created_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dedupeKey,
      mode,
      normalizedResult,
      roomId,
      opponentStrength == null ? null : parseInt(opponentStrength, 10),
      opponentKey || opponentKeyForStrength(opponentStrength),
      Math.max(1, parseInt(playerCount, 10) || 1),
      Math.max(0, parseInt(movesCount, 10) || 0),
      durationMs == null ? null : Math.max(0, parseInt(durationMs, 10) || 0),
      finalFen,
      Date.now(),
      finishedAt,
    );

    const insertPlayer = db.prepare(`
      INSERT INTO game_result_players (game_result_id, user_id, player_name, result)
      VALUES (?, ?, ?, ?)
    `);
    const seen = new Set();
    for (const player of players) {
      const userId = player.userId || null;
      const playerName = String(player.name || "Player").slice(0, 80);
      const key = `${userId || ""}:${playerName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      insertPlayer.run(id, userId, playerName, normalizedResult);
      if (userId && normalizedResult === "victory")
        setUserUnlockedOpponentCount(userId, unlockedCountAfterVictory(opponentStrength));
    }
  });
  return id;
}

function leaderboardRankForUser({ userId, opponentKey, metric }) {
  const isFastest = metric === "fastest";
  const metricFilter = isFastest
    ? "gr.duration_ms IS NOT NULL AND gr.duration_ms > 0"
    : "gr.moves_count > 0";
  const windowOrder = isFastest
    ? "gr.duration_ms ASC, gr.moves_count ASC"
    : "gr.moves_count ASC, COALESCE(gr.duration_ms, 9223372036854775807) ASC";
  const resultOrder = isFastest
    ? "duration_ms ASC, moves_count ASC"
    : "moves_count ASC, COALESCE(duration_ms, 9223372036854775807) ASC";
  const rows = db.prepare(`
    WITH personal_bests AS (
      SELECT
        grp.user_id,
        gr.mode,
        gr.moves_count,
        gr.duration_ms,
        gr.finished_at,
        ROW_NUMBER() OVER (
          PARTITION BY grp.user_id
          ORDER BY ${windowOrder}, gr.finished_at ASC
        ) AS personal_rank
      FROM game_results gr
      JOIN game_result_players grp ON grp.game_result_id = gr.id
      WHERE gr.result = 'victory'
        AND gr.opponent_key = ?
        AND grp.user_id IS NOT NULL
        AND gr.moves_count >= 4
        AND gr.dedupe_key NOT LIKE '%:debug-%'
        AND gr.dedupe_key NOT LIKE '%:test-%'
        AND ${metricFilter}
    )
    SELECT user_id, mode, moves_count, duration_ms, finished_at
    FROM personal_bests
    WHERE personal_rank = 1
    ORDER BY ${resultOrder}, finished_at ASC
  `).all(opponentKey);
  const index = rows.findIndex(row => row.user_id === userId);
  if (index < 0) return null;
  return {
    rank: index + 1,
    mode: rows[index].mode,
    movesCount: rows[index].moves_count,
    durationMs: rows[index].duration_ms,
  };
}

function gameResultHighscoreSummary(gameResultId, userId) {
  if (!gameResultId || !userId) return null;
  const row = db.prepare(`
    SELECT gr.id, gr.opponent_key, gr.result, gr.moves_count, gr.duration_ms, gr.dedupe_key
    FROM game_results gr
    JOIN game_result_players grp ON grp.game_result_id = gr.id
    WHERE gr.id = ? AND grp.user_id = ?
  `).get(gameResultId, userId);
  if (
    !row
    || row.result !== "victory"
    || !row.opponent_key
    || row.moves_count < 4
    || String(row.dedupe_key || "").includes(":debug-")
    || String(row.dedupe_key || "").includes(":test-")
  ) {
    return null;
  }

  const previousFastest = row.duration_ms > 0 ? db.prepare(`
    SELECT MIN(gr.duration_ms) AS value
    FROM game_results gr
    JOIN game_result_players grp ON grp.game_result_id = gr.id
    WHERE grp.user_id = ?
      AND gr.id != ?
      AND gr.result = 'victory'
      AND gr.opponent_key = ?
      AND gr.duration_ms IS NOT NULL
      AND gr.duration_ms > 0
      AND gr.moves_count >= 4
      AND gr.dedupe_key NOT LIKE '%:debug-%'
      AND gr.dedupe_key NOT LIKE '%:test-%'
  `).get(userId, row.id, row.opponent_key)?.value : null;
  const previousFewestMoves = row.moves_count > 0 ? db.prepare(`
    SELECT MIN(gr.moves_count) AS value
    FROM game_results gr
    JOIN game_result_players grp ON grp.game_result_id = gr.id
    WHERE grp.user_id = ?
      AND gr.id != ?
      AND gr.result = 'victory'
      AND gr.opponent_key = ?
      AND gr.moves_count > 0
      AND gr.moves_count >= 4
      AND gr.dedupe_key NOT LIKE '%:debug-%'
      AND gr.dedupe_key NOT LIKE '%:test-%'
  `).get(userId, row.id, row.opponent_key)?.value : null;

  return {
    opponentKey: row.opponent_key,
    fastest: row.duration_ms > 0 ? {
      valueMs: row.duration_ms,
      previousValueMs: previousFastest ?? null,
      isPersonalBest: previousFastest == null || row.duration_ms < previousFastest,
      rank: leaderboardRankForUser({ userId, opponentKey: row.opponent_key, metric: "fastest" })?.rank || null,
    } : null,
    fewestMoves: row.moves_count > 0 ? {
      value: row.moves_count,
      previousValue: previousFewestMoves ?? null,
      isPersonalBest: previousFewestMoves == null || row.moves_count < previousFewestMoves,
      rank: leaderboardRankForUser({ userId, opponentKey: row.opponent_key, metric: "fewestMoves" })?.rank || null,
    } : null,
  };
}

function upsertGoogleUser(profile) {
  const userId = `google:${profile.sub}`;
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const username = existing?.username || uniqueUsername(usernameSeed(profile), userId);
  db.prepare(`
    INSERT INTO users
      (id, provider, provider_sub, username, email, email_verified, name, picture, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      email_verified = excluded.email_verified,
      name = excluded.name,
      picture = excluded.picture,
      last_login_at = excluded.last_login_at
  `).run(
    userId,
    "google",
    profile.sub,
    username,
    profile.email || existing?.email || "",
    profile.email_verified ? 1 : 0,
    profile.name || profile.given_name || existing?.name || profile.email || "Player",
    profile.picture || existing?.picture || "",
    existing?.created_at || Date.now(),
    Date.now(),
  );
  const user = userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
  applySeededUserProgress(user);
  return user;
}

function devLoginUser(key) {
  return DEV_LOGIN_USERS.find(user => user.key === key) || DEV_LOGIN_USERS[0];
}

function upsertLocalUser(key = "mirko") {
  const devUser = devLoginUser(key);
  const userId = `local:${devUser.key}`;
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const username = existing?.username || uniqueUsername(devUser.username, userId);
  db.prepare(`
    INSERT INTO users
      (id, provider, provider_sub, username, email, email_verified, name, picture, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_login_at = excluded.last_login_at
  `).run(
    userId,
    "local",
    devUser.key,
    username,
    existing?.email || devUser.email,
    1,
    existing?.name || devUser.name,
    existing?.picture || "",
    existing?.created_at || Date.now(),
    Date.now(),
  );
  const user = userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
  applySeededUserProgress(user);
  return user;
}

migrateAuthJson();
backfillUsernames();
grantSeededProgress();
cleanupExpiredSessions();

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  touchPresence(user?.id);
  const next = encodeURIComponent(req.query.next || req.originalUrl || "/");
  const loginUrl = googleAuthEnabled
    ? `/auth/google?next=${next}`
    : localAuthEnabled
      ? `/auth/local?next=${next}`
      : `/?auth=login&next=${next}`;
  res.json({
    authEnabled,
    user: publicUser(user),
    soloProgress: user ? soloProgressForUserId(user.id) : { unlockedOpponentCount: 1 },
    loginUrl,
    googleAuthEnabled,
    localAuthEnabled,
    devTestingEnabled,
    schoolAuthEnabled,
    devLoginUsers: localAuthEnabled
      ? DEV_LOGIN_USERS.map(user => ({
          key: user.key,
          name: user.name,
          username: user.username,
          loginUrl: `/auth/local?user=${encodeURIComponent(user.key)}&next=${next}`,
        }))
      : [],
    logoutUrl: `/auth/logout?next=${next}`,
  });
});

app.post("/api/auth/school-login", (req, res) => {
  if (!schoolAuthEnabled) {
    res.status(404).json({ error: "School sign-in is not enabled." });
    return;
  }
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const row = db.prepare(`
    SELECT * FROM users
    WHERE username = ? AND password_hash IS NOT NULL
  `).get(username);
  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), row.id);
  const user = userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(row.id));
  const sessionToken = createSession(user.id);
  res.setHeader("Set-Cookie", cookieHeader(SESSION_COOKIE, sessionToken, {
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: isSecureRequest(req),
  }));
  res.json({
    user: publicUser(user),
    next: safeNextPath(req.body?.next || "/"),
  });
});

app.get("/api/admin/test-users", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) return;
  syncManagedAccountFriendships(admin.id);
  const users = db.prepare(`
    SELECT * FROM users
    WHERE is_test_account = 1
    ORDER BY username COLLATE NOCASE
  `).all().map(row => publicUser(userFromRow(row)));
  res.json({ users });
});

app.post("/api/admin/test-users", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) return;
  try {
    const account = validateManagedAccountInput(req.body, { passwordRequired: true });
    const id = `school:${randomUUID()}`;
    const now = Date.now();
    inTransaction(() => {
      db.prepare(`
        INSERT INTO users
          (id, provider, provider_sub, username, email, email_verified, name, picture,
           password_hash, is_admin, is_test_account, created_at, last_login_at)
        VALUES (?, 'school', ?, ?, '', 0, ?, '', ?, ?, 1, ?, ?)
      `).run(
        id,
        id.slice("school:".length),
        account.username,
        account.username,
        hashPassword(account.password),
        0,
        now,
        now,
      );
    });
    syncManagedAccountFriendships(admin.id);
    const user = userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
    res.status(201).json({ user: publicUser(user), message: `${account.username} created.` });
  } catch (err) {
    const duplicate = String(err.message || "").includes("UNIQUE constraint failed");
    res.status(duplicate ? 409 : 400).json({
      error: duplicate ? "That username is already in use." : err.message,
    });
  }
});

app.patch("/api/admin/test-users/:id", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) return;
  const id = String(req.params.id || "");
  const existing = db.prepare("SELECT * FROM users WHERE id = ? AND is_test_account = 1").get(id);
  if (!existing) {
    res.status(404).json({ error: "Managed account not found." });
    return;
  }
  try {
    const account = validateManagedAccountInput({
      username: req.body?.username ?? existing.username,
      password: req.body?.password || "",
    });
    const passwordHash = account.password ? hashPassword(account.password) : existing.password_hash;
    db.prepare(`
      UPDATE users
      SET username = ?, name = ?, password_hash = ?, is_admin = ?
      WHERE id = ? AND is_test_account = 1
    `).run(account.username, account.username, passwordHash, 0, id);
    const user = userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
    res.json({ user: publicUser(user), message: `${account.username} updated.` });
  } catch (err) {
    const duplicate = String(err.message || "").includes("UNIQUE constraint failed");
    res.status(duplicate ? 409 : 400).json({
      error: duplicate ? "That username is already in use." : err.message,
    });
  }
});

app.delete("/api/admin/test-users/:id", (req, res) => {
  const admin = requireAdminUser(req, res);
  if (!admin) return;
  const id = String(req.params.id || "");
  if (id === admin.id) {
    res.status(400).json({ error: "You cannot delete the account you are using." });
    return;
  }
  const result = db.prepare("DELETE FROM users WHERE id = ? AND is_test_account = 1").run(id);
  if (!result.changes) {
    res.status(404).json({ error: "Managed account not found." });
    return;
  }
  res.json({ message: "Account deleted." });
});

app.patch("/api/solo-progress", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;
  const unlockedCount = req.body?.unlockedOpponentCount ?? req.body?.unlocked;
  res.json({ soloProgress: setUserUnlockedOpponentCount(user.id, unlockedCount) });
});

app.post("/api/game-results", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const mode = "solo";
  const result = normalizeGameResult(req.body?.result);
  const gameId = String(req.body?.gameId || req.body?.game_id || "").trim();
  if (!result || !gameId) {
    res.status(400).json({ error: "Invalid game result" });
    return;
  }

  const opponentStrength = parseInt(req.body?.opponentStrength || req.body?.opponent_strength, 10) || null;
  const finalFen = String(req.body?.finalFen || req.body?.final_fen || "");
  const fenResult = finalFen ? gameResultFromFen(finalFen) : null;
  const normalizedResult = fenResult || result;
  const id = recordGameResult({
    dedupeKey: `${mode}:${user.id}:${gameId}`,
    mode,
    result: normalizedResult,
    roomId: req.body?.roomId || req.body?.room_id || null,
    opponentStrength,
    opponentKey: req.body?.opponentKey || req.body?.opponent_key || opponentKeyForStrength(opponentStrength),
    playerCount: 1,
    movesCount: parseInt(req.body?.movesCount || req.body?.moves_count, 10) || 0,
    durationMs: parseInt(req.body?.durationMs || req.body?.duration_ms, 10) || null,
    finalFen: finalFen || null,
    players: [{ userId: user.id, name: user.username || user.name || "Player" }],
  });

  res.json({
    id,
    result: normalizedResult,
    highscore: gameResultHighscoreSummary(id, user.id),
  });
});

app.get("/api/game-results/stats", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const mine = db.prepare(`
    SELECT gr.mode, grp.result, COUNT(*) AS count
    FROM game_result_players grp
    JOIN game_results gr ON gr.id = grp.game_result_id
    WHERE grp.user_id = ?
    GROUP BY gr.mode, grp.result
    ORDER BY gr.mode, grp.result
  `).all(user.id);

  const totals = db.prepare(`
    SELECT mode, result, COUNT(*) AS count
    FROM game_results
    GROUP BY mode, result
    ORDER BY mode, result
  `).all();

  res.json({ mine, totals });
});

app.get("/api/leaderboards", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const opponentKey = String(req.query.opponent || "snib").trim().toLowerCase();
  if (!["snib", "muckroot", "gribble", "vexi", "drogar"].includes(opponentKey)) {
    res.status(400).json({ error: "Unknown opponent" });
    return;
  }

  const leaderboardRows = (metric, metricFilter, windowOrder, resultOrder) => db.prepare(`
    WITH personal_bests AS (
      SELECT
        grp.user_id,
        COALESCE(NULLIF(u.username, ''), NULLIF(u.name, ''), grp.player_name) AS player_name,
        gr.mode,
        gr.moves_count,
        gr.duration_ms,
        gr.finished_at,
        ROW_NUMBER() OVER (
          PARTITION BY grp.user_id
          ORDER BY ${windowOrder}, gr.finished_at ASC
        ) AS personal_rank
      FROM game_results gr
      JOIN game_result_players grp ON grp.game_result_id = gr.id
      LEFT JOIN users u ON u.id = grp.user_id
      WHERE gr.result = 'victory'
        AND gr.opponent_key = ?
        AND grp.user_id IS NOT NULL
        AND gr.moves_count >= 4
        AND gr.dedupe_key NOT LIKE '%:debug-%'
        AND gr.dedupe_key NOT LIKE '%:test-%'
        AND ${metricFilter}
    )
    SELECT user_id, player_name, mode, moves_count, duration_ms, finished_at
    FROM personal_bests
    WHERE personal_rank = 1
    ORDER BY ${resultOrder}, finished_at ASC
    LIMIT 10
  `).all(opponentKey).map((row, index) => ({
    rank: index + 1,
    playerName: row.player_name,
    mode: row.mode,
    movesCount: row.moves_count,
    durationMs: row.duration_ms,
    finishedAt: row.finished_at,
    isCurrentUser: row.user_id === user.id,
    metric,
  }));

  res.json({
    opponentKey,
    fastest: leaderboardRows(
      "fastest",
      "gr.duration_ms IS NOT NULL AND gr.duration_ms > 0",
      "gr.duration_ms ASC, gr.moves_count ASC",
      "duration_ms ASC, moves_count ASC",
    ),
    fewestMoves: leaderboardRows(
      "fewestMoves",
      "gr.moves_count > 0",
      "gr.moves_count ASC, COALESCE(gr.duration_ms, 9223372036854775807) ASC",
      "moves_count ASC, COALESCE(duration_ms, 9223372036854775807) ASC",
    ),
  });
});

registerSocialRoutes(app, {
  areFriends,
  createFriendship,
  db,
  friendshipPair,
  inTransaction,
  normalizeUsername,
  notifyUser,
  presenceForUser,
  publicFriendUser,
  publicUser,
  requireApiUser,
  roomHasUser,
});

app.get("/auth/google", (req, res) => {
  if (!googleAuthEnabled) {
    res.status(503).send("Google sign-in is not configured.");
    return;
  }
  const next = safeNextPath(req.query.next || "/");
  const state = randomBytes(24).toString("base64url");
  oauthStates.set(state, { next, expiresAt: Date.now() + OAUTH_STATE_TTL_MS });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${externalBase(req)}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.setHeader("Set-Cookie", cookieHeader(OAUTH_STATE_COOKIE, state, {
    maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
    secure: isSecureRequest(req),
  }));
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    if (!googleAuthEnabled) throw new Error("Google sign-in is not configured.");
    const state = String(req.query.state || "");
    const cookies = parseCookies(req);
    const saved = oauthStates.get(state);
    oauthStates.delete(state);
    if (!state || cookies[OAUTH_STATE_COOKIE] !== state || !saved || saved.expiresAt <= Date.now())
      throw new Error("Invalid or expired OAuth state.");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(req.query.code || ""),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${externalBase(req)}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const tokenPayload = await tokenRes.json();

    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json();
    if (!profile.sub) throw new Error("Google profile did not include a subject.");

    const user = upsertGoogleUser(profile);
    const sessionToken = createSession(user.id);
    res.setHeader("Set-Cookie", [
      clearCookieHeader(OAUTH_STATE_COOKIE),
      cookieHeader(SESSION_COOKIE, sessionToken, {
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
        secure: isSecureRequest(req),
      }),
    ]);
    res.redirect(saved.next);
  } catch (err) {
    console.warn(`Google auth failed: ${err.message}`);
    res.setHeader("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE));
    res.redirect("/?auth=error");
  }
});

app.get("/auth/local", (req, res) => {
  if (!localAuthEnabled) {
    res.status(404).send("Local sign-in is not enabled.");
    return;
  }
  const user = upsertLocalUser(String(req.query.user || ""));
  const sessionToken = createSession(user.id);
  res.setHeader("Set-Cookie", cookieHeader(SESSION_COOKIE, sessionToken, {
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: isSecureRequest(req),
  }));
  res.redirect(safeNextPath(req.query.next || "/"));
});

app.get("/auth/logout", (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    db.prepare("DELETE FROM sessions WHERE hash = ?").run(sessionHash(token));
  }
  res.setHeader("Set-Cookie", clearCookieHeader(SESSION_COOKIE));
  res.redirect(safeNextPath(req.query.next || "/"));
});

app.use((req, res, next) => {
  if (!authEnabled || localAuthEnabled) {
    next();
    return;
  }
  if (!["GET", "HEAD"].includes(req.method) || !["/", "/index.html"].includes(req.path)) {
    next();
    return;
  }
  const appShellRequest = ["/", "/index.html"].includes(req.path);
  const publicAuth = appShellRequest && req.query.auth === "login";
  const publicDemo = appShellRequest && req.query.demo === "snib";
  if (publicAuth || publicDemo) {
    next();
    return;
  }
  if (currentUser(req)) {
    next();
    return;
  }
  res.redirect(`/?auth=login&next=${encodeURIComponent(safeNextPath(req.originalUrl || "/"))}`);
});

// ── Hot reload (SSE, dev only) ────────────────────────────────────────────────

if (process.env.NODE_ENV !== "production") {
  const reloadClients = new Set();

  app.get("/dev-reload", (req, res) => {
    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.flushHeaders();
    res.write("data: connected\n\n");
    reloadClients.add(res);
    req.on("close", () => reloadClients.delete(res));
  });

  chokidar.watch(".", {
    ignored: /(^|[/\\])(\.|node_modules|venv|maia2_models|maia3|ort|data)/,
    ignoreInitial: true,
    depth: 0,
  }).on("change", (filePath) => {
    if (/\.(html|js|css|json)$/.test(filePath)) {
      console.log(`changed: ${filePath} — reloading`);
      reloadClients.forEach(res => res.write("data: reload\n\n"));
    }
  });
}

// ── Static files / React frontend ─────────────────────────────────────────────

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(__dirname, "dist");
const IS_PRODUCTION = process.env.NODE_ENV === "production";

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/avatar", async (req, res) => {
  try {
    const url = new URL(String(req.query.url || ""));
    const allowedHost = url.hostname === "googleusercontent.com"
      || url.hostname.endsWith(".googleusercontent.com");
    if (url.protocol !== "https:" || !allowedHost) {
      res.status(400).send("Invalid avatar URL");
      return;
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "Chessquestia/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    const finalUrl = new URL(response.url);
    const allowedFinalHost = finalUrl.hostname === "googleusercontent.com"
      || finalUrl.hostname.endsWith(".googleusercontent.com");
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !allowedFinalHost || !contentType.startsWith("image/") || contentLength > 5_000_000) {
      res.status(404).send("Avatar unavailable");
      return;
    }

    const image = Buffer.from(await response.arrayBuffer());
    if (image.length > 5_000_000) {
      res.status(404).send("Avatar unavailable");
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type(contentType).send(image);
  } catch {
    res.status(404).send("Avatar unavailable");
  }
});
app.use("/data", express.static(path.join(ROOT_DIR, "data")));
app.use("/maia3", express.static(path.join(ROOT_DIR, "maia3")));
app.use("/ort", express.static(path.join(ROOT_DIR, "ort")));
for (const asset of ["manifest.json", "sw.js", "maia-worker.js"]) {
  app.get(`/${asset}`, (req, res) => res.sendFile(path.join(ROOT_DIR, asset)));
}

async function configureFrontend() {
  if (IS_PRODUCTION) {
    app.use(express.static(DIST_DIR));
    app.get("*", (req, res, next) => {
      if (!["GET", "HEAD"].includes(req.method)) {
        next();
        return;
      }
      res.sendFile(path.join(DIST_DIR, "index.html"));
    });
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    root: ROOT_DIR,
    appType: "spa",
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
}

// ── HTTP server ───────────────────────────────────────────────────────────────

let httpServer = null;
let wss = null;

async function startServer() {
  await configureFrontend();
  httpServer = app.listen(PORT, "0.0.0.0", () => {
    const base = publicBase ?? `http://${getLanIp()}:${PORT}`;
    console.log(`Listening on port ${PORT}  (${base})`);
  });

  if (process.argv.includes("--tunnel")) {
    require("localtunnel")({ port: PORT }).then(t => {
      publicBase = t.url;
      console.log(`Public URL: ${t.url}`);
      t.on("close", () => { publicBase = null; console.log("Tunnel closed"); });
    }).catch(err => console.error("Tunnel error:", err.message));
  }

  wss = new WebSocketServer({ server: httpServer });
  attachWebSocketHandlers();
}

// ── WebSocket room management ─────────────────────────────────────────────────

const rooms = new Map(); // roomId → Room
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/*
  Room shape:
  {
    id:         string,
    hostPlayerId: string,
    hostUserId: string | null,
    players:      Map<playerId, { id, userId, name, ws, connected, maiaReady, lastSeen }>,
    order:        playerId[],    // round-robin order (insertion order)
    phase:      'lobby'|'playing'|'over',
    fen:        string,
    activeIdx:  number,          // index into order[]
    botTurn:    boolean,
  }
*/

function serializeRoom(room) {
  return {
    id: room.id,
    hostPlayerId: room.hostPlayerId,
    players: room.order.map(id => {
      const player = room.players.get(id);
      return {
        id,
        userId: player.userId || null,
        name: player.name,
        maiaReady: !!player.maiaReady,
        unlockedCount: normalizeUnlockedOpponentCount(player.unlockedCount),
        lastSeen: player.lastSeen || Date.now(),
      };
    }),
    order: room.order,
    phase: room.phase,
    fen: room.fen,
    activeIdx: room.activeIdx,
    midTurn: room.midTurn,
    strength: room.strength,
    hostUserId: room.hostUserId || null,
    startedAt: room.startedAt || null,
    createdAt: room.createdAt || Date.now(),
    updatedAt: room.updatedAt || Date.now(),
    moveHistory: room.moveHistory || [],
  };
}

function saveSerializedRoomToDb(room) {
  inTransaction(() => {
    db.prepare(`
      INSERT INTO rooms
        (id, host_player_id, host_user_id, phase, fen, active_idx, mid_turn, strength, started_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        host_player_id = excluded.host_player_id,
        host_user_id = excluded.host_user_id,
        phase = excluded.phase,
        fen = excluded.fen,
        active_idx = excluded.active_idx,
        mid_turn = excluded.mid_turn,
        strength = excluded.strength,
        started_at = excluded.started_at,
        updated_at = excluded.updated_at
    `).run(
      room.id,
      room.hostPlayerId,
      room.hostUserId || null,
      room.phase || "lobby",
      room.fen || INITIAL_FEN,
      room.activeIdx || 0,
      room.midTurn ? 1 : 0,
      room.strength || 1500,
      room.startedAt || null,
      room.createdAt || Date.now(),
      room.updatedAt || Date.now(),
    );

    db.prepare("DELETE FROM room_players WHERE room_id = ?").run(room.id);
    const insertPlayer = db.prepare(`
      INSERT INTO room_players
        (room_id, id, user_id, name, maia_ready, unlocked_count, last_seen, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const playersById = new Map((room.players || []).map(player => [player.id, player]));
    const orderedIds = (room.order || room.players?.map(player => player.id) || []).filter(id => playersById.has(id));
    orderedIds.forEach((id, position) => {
      const player = playersById.get(id);
      insertPlayer.run(
        room.id,
        player.id,
        player.userId || null,
        player.name || "Player",
        player.maiaReady ? 1 : 0,
        normalizeUnlockedOpponentCount(player.unlockedCount),
        player.lastSeen || Date.now(),
        position,
      );
    });

    db.prepare("DELETE FROM moves WHERE room_id = ?").run(room.id);
    const insertMove = db.prepare(`
      INSERT INTO moves (room_id, player_id, user_id, previous_fen, fen, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const move of room.moveHistory || []) {
      insertMove.run(
        room.id,
        move.playerId || "",
        move.userId || null,
        move.previousFen || null,
        move.fen,
        move.at || move.createdAt || Date.now(),
      );
    }
  });
}

function persistRooms() {
  for (const room of rooms.values())
    saveSerializedRoomToDb(serializeRoom(room));
}

function migrateRoomsJson() {
  const existingRooms = db.prepare("SELECT COUNT(*) AS count FROM rooms").get().count;
  if (existingRooms) return;

  const roomsFile = fs.existsSync(ROOMS_FILE) ? ROOMS_FILE : LEGACY_ROOMS_FILE;
  if (!fs.existsSync(roomsFile)) return;
  try {
    const payload = JSON.parse(fs.readFileSync(roomsFile, "utf8"));
    for (const savedRoom of payload.rooms || [])
      saveSerializedRoomToDb(savedRoom);
    console.log(`Migrated ${(payload.rooms || []).length} room(s) from JSON into SQLite`);
  } catch (err) {
    console.warn(`Could not migrate room JSON: ${err.message}`);
  }
}

function loadRooms() {
  migrateRoomsJson();
  try {
    const savedRooms = db.prepare("SELECT * FROM rooms ORDER BY updated_at DESC").all();
    for (const savedRoom of savedRooms) {
      const savedPlayers = db.prepare("SELECT * FROM room_players WHERE room_id = ? ORDER BY position").all(savedRoom.id);
      const savedMoves = db.prepare("SELECT * FROM moves WHERE room_id = ? ORDER BY id").all(savedRoom.id);
      const players = new Map();
      for (const savedPlayer of savedPlayers) {
        players.set(savedPlayer.id, {
          id: savedPlayer.id,
          userId: savedPlayer.user_id || null,
          name: savedPlayer.name,
          ws: null,
          connected: false,
          maiaReady: !!savedPlayer.maia_ready,
          unlockedCount: normalizeUnlockedOpponentCount(savedPlayer.unlocked_count),
          lastSeen: savedPlayer.last_seen || Date.now(),
        });
      }
      rooms.set(savedRoom.id, {
        id: savedRoom.id,
        hostPlayerId: savedRoom.host_player_id,
        hostUserId: savedRoom.host_user_id || null,
        players,
        order: savedPlayers.map(player => player.id).filter(id => players.has(id)),
        phase: savedRoom.phase || "lobby",
        fen: savedRoom.fen || INITIAL_FEN,
        activeIdx: savedRoom.active_idx || 0,
        midTurn: !!savedRoom.mid_turn,
        strength: savedRoom.strength || 1500,
        selectingOpponent: false,
        startedAt: savedRoom.started_at || null,
        createdAt: savedRoom.created_at || Date.now(),
        updatedAt: savedRoom.updated_at || Date.now(),
        moveHistory: savedMoves.map(move => ({
          playerId: move.player_id,
          userId: move.user_id || null,
          previousFen: move.previous_fen || null,
          fen: move.fen,
          at: move.created_at,
        })),
      });
    }
    console.log(`Loaded ${rooms.size} saved room(s)`);
  } catch (err) {
    console.warn(`Could not load rooms from SQLite: ${err.message}`);
  }
}

loadRooms();

function broadcast(room, buildMsg) {
  room.order.forEach((playerId, idx) => {
    const p = room.players.get(playerId);
    if (!p?.connected || p.ws?.readyState !== 1) return;
    p.ws.send(JSON.stringify(buildMsg(playerId, idx)));
  });
}

function roomState(room, myPlayerId, myIdx) {
  const players = room.order.map(id => {
    const player = room.players.get(id);
    return {
      userId: player.userId || null,
      name: player.name,
      connected: !!player.connected,
      maiaReady: !!player.maiaReady,
      signedIn: !!player.userId,
      unlockedCount: normalizeUnlockedOpponentCount(player.unlockedCount),
    };
  });
  const moveHistory = room.moveHistory || [];
  const startedAt = room.startedAt || moveHistory[0]?.at || room.createdAt || Date.now();
  return {
    type: "room-state",
    roomId:    room.id,
    playerId:  myPlayerId,
    phase:     room.phase,
    players,
    maxUnlockedOpponentCount: players.reduce((max, player) => Math.max(max, player.unlockedCount || 1), 1),
    activeIdx: room.activeIdx,
    midTurn:   room.midTurn,
    fen:       room.fen,
    strength:  room.strength,
    selectingOpponent: !!room.selectingOpponent,
    startedAt,
    moveCount: moveHistory.length,
    myIdx,
  };
}

function roomSession(room, user, playerId = null) {
  const playerIdByToken = (() => {
    if (!playerId || !room.players.has(playerId)) return null;
    const tokenPlayer = room.players.get(playerId);
    if (user?.id && tokenPlayer?.userId && tokenPlayer.userId !== user.id) return null;
    return playerId;
  })();
  const playerIdByUser = findPlayerIdByUser(room, user?.id);
  const myPlayerId = playerIdByUser || playerIdByToken || null;
  const myIdx = myPlayerId ? room.order.indexOf(myPlayerId) : -1;
  const state = roomState(room, myPlayerId, myIdx);
  const connectedPlayers = state.players.filter(player => player.connected);
  return {
    ...state,
    myPlayerId,
    myRole: myIdx === 0 ? "host" : myIdx > 0 ? "guest" : "visitor",
    isMember: myIdx >= 0,
    canJoin: room.phase === "lobby" || myIdx >= 0,
    canStart: myIdx === 0 && room.phase === "lobby" && connectedPlayers.length >= 2,
    canSelectOpponent: myIdx === 0 && room.phase === "lobby",
  };
}

app.get("/api/coop/rooms/:roomId/session", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const roomId = String(req.params.roomId || "").trim();
  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const session = roomSession(room, user, String(req.query.playerId || ""));
  if (!session.canJoin) {
    res.status(403).json({ error: "This game has already started." });
    return;
  }

  res.json({ session });
});

function broadcastRoom(room) {
  broadcast(room, (wsId, idx) => roomState(room, wsId, idx));
}

function sendRoomState(room, playerId) {
  const player = room.players.get(playerId);
  const myIdx = room.order.indexOf(playerId);
  if (!player?.connected || player.ws?.readyState !== 1 || myIdx < 0) return;
  player.ws.send(JSON.stringify(roomState(room, playerId, myIdx)));
}

function removeLobbyPlayer(room, playerId) {
  if (!room || room.phase !== "lobby" || room.hostPlayerId === playerId) return false;
  const player = room.players.get(playerId);
  if (!player) return false;
  room.players.delete(playerId);
  room.order = room.order.filter(id => id !== playerId);
  if (room.activeIdx >= room.order.length) room.activeIdx = 0;
  room.updatedAt = Date.now();
  persistRooms();
  broadcastRoom(room);
  return true;
}

function normalizePlayerName(name) {
  return String(name || "").trim().toLowerCase();
}

function findPlayerIdByName(room, name) {
  const wanted = normalizePlayerName(name);
  if (!wanted) return null;
  return room.order.find(id => normalizePlayerName(room.players.get(id)?.name) === wanted) || null;
}

function findPlayerIdByUser(room, userId) {
  if (!userId) return null;
  return room.order.find(id => room.players.get(id)?.userId === userId) || null;
}

function attachWebSocketHandlers() {
  wss.on("connection", (ws, req) => {
  const user = currentUser(req);
  touchPresence(user?.id);
  if (user?.id) {
    const sockets = notificationSockets.get(user.id) || new Set();
    sockets.add(ws);
    notificationSockets.set(user.id, sockets);
  }
  let currentPlayerId = null;
  let currentRoomId = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case "create": {
        if (authEnabled && !user) {
          ws.send(JSON.stringify({ type: "error", code: "auth-required", message: "Sign in to play co-op." }));
          return;
        }
        const roomId = randomUUID().slice(0, 8);
        touchPresence(user?.id);
        const playerId = randomUUID();
        const name = user?.username || user?.name || msg.name || "Player";
        const unlockedCount = unlockedCountForUserAndClient(user, msg.unlockedOpponentCount);
        const room = {
          id: roomId,
          hostPlayerId: playerId,
          hostUserId: user?.id || null,
          players: new Map([[playerId, {
            id: playerId,
            userId: user?.id || null,
            name,
            ws,
            connected: true,
            maiaReady: !!msg.maiaReady,
            unlockedCount,
            lastSeen: Date.now(),
          }]]),
          order: [playerId],
          phase: "lobby",
          fen: INITIAL_FEN,
          activeIdx: 0, midTurn: false,
          strength: msg.strength || 1500,
          selectingOpponent: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          moveHistory: [],
        };
        rooms.set(roomId, room);
        currentRoomId = roomId;
        currentPlayerId = playerId;
        persistRooms();
        ws.send(JSON.stringify({ type: "created", roomId, playerId }));
        sendRoomState(room, playerId);
        broadcastRoom(room);
        break;
      }

      case "join": {
        if (authEnabled && !user) {
          ws.send(JSON.stringify({ type: "error", code: "auth-required", message: "Sign in to join co-op." }));
          return;
        }
        const room = rooms.get(msg.roomId);
        touchPresence(user?.id);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }
        const playerIdByToken = (() => {
          if (!msg.playerId || !room.players.has(msg.playerId)) return null;
          const tokenPlayer = room.players.get(msg.playerId);
          if (user?.id && tokenPlayer?.userId && tokenPlayer.userId !== user.id) return null;
          if (!user?.id && tokenPlayer?.name && normalizePlayerName(tokenPlayer.name) !== normalizePlayerName(msg.name)) return null;
          return msg.playerId;
        })();
        const playerIdByUser = findPlayerIdByUser(room, user?.id);
        const playerIdByName = findPlayerIdByName(room, msg.name);
        const returningPlayerId = playerIdByToken || playerIdByUser || playerIdByName;
        const returningPlayer = returningPlayerId ? room.players.get(returningPlayerId) : null;
        if (room.phase !== "lobby" && !returningPlayer) {
          ws.send(JSON.stringify({ type: "error", message: "Game already started" }));
          return;
        }
        if (returningPlayer?.connected && !(playerIdByToken || playerIdByUser)) {
          ws.send(JSON.stringify({ type: "error", message: "That player is already connected" }));
          return;
        }
        const playerId = returningPlayerId || randomUUID();
        const existing = room.players.get(playerId);
        if (existing?.ws?.readyState === 1 && existing.ws !== ws)
          existing.ws.close(1000, "Reconnected");
        const unlockedCount = unlockedCountForUserAndClient(user, msg.unlockedOpponentCount || existing?.unlockedCount);
        room.players.set(playerId, {
          id: playerId,
          userId: user?.id || existing?.userId || null,
          name: user?.username || user?.name || msg.name || existing?.name || "Player",
          ws,
          connected: true,
          maiaReady: !!msg.maiaReady,
          unlockedCount,
          lastSeen: Date.now(),
        });
        if (!room.order.includes(playerId)) room.order.push(playerId);
        const acceptedInvite = user?.id ? db.prepare(`
          SELECT inviter_id
          FROM room_invites
          WHERE room_id = ? AND invitee_id = ? AND status = 'pending'
        `).get(room.id, user.id) : null;
        if (user?.id) {
          const acceptResult = db.prepare(`
            UPDATE room_invites
            SET status = 'accepted', responded_at = ?
            WHERE room_id = ? AND invitee_id = ? AND status = 'pending'
          `).run(Date.now(), room.id, user.id);
          if (acceptResult.changes) notifyUser(acceptedInvite?.inviter_id);
        }
        currentRoomId = msg.roomId;
        currentPlayerId = playerId;
        persistRooms();
        ws.send(JSON.stringify({ type: "joined", roomId: room.id, playerId }));
        sendRoomState(room, playerId);
        broadcastRoom(room);
        break;
      }

      case "maia-status": {
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const player = room.players.get(currentPlayerId);
        if (!player) return;
        const maiaReady = !!msg.ready;
        const unlockedCount = unlockedCountForUserAndClient(user, msg.unlockedOpponentCount || player.unlockedCount);
        if (player.maiaReady === maiaReady && player.unlockedCount === unlockedCount) return;
        player.maiaReady = maiaReady;
        player.unlockedCount = unlockedCount;
        player.lastSeen = Date.now();
        room.updatedAt = Date.now();
        persistRooms();
        broadcastRoom(room);
        break;
      }

      case "sync": {
        const room = rooms.get(currentRoomId);
        if (!room || !currentPlayerId) return;
        sendRoomState(room, currentPlayerId);
        break;
      }

      case "strength": {
        const room = rooms.get(currentRoomId);
        if (!room || room.hostPlayerId !== currentPlayerId || room.phase !== "lobby") return;
        const strength = Math.max(400, Math.min(2800, parseInt(msg.strength, 10) || 1500));
        if (room.strength === strength) return;
        room.strength = strength;
        room.updatedAt = Date.now();
        persistRooms();
        broadcastRoom(room);
        break;
      }

      case "selecting-opponent": {
        const room = rooms.get(currentRoomId);
        if (!room || room.hostPlayerId !== currentPlayerId || room.phase !== "lobby") return;
        room.selectingOpponent = !!msg.selecting;
        room.updatedAt = Date.now();
        broadcastRoom(room);
        break;
      }

      case "start": {
        const room = rooms.get(currentRoomId);
        if (!room || room.hostPlayerId !== currentPlayerId || room.phase !== "lobby") return;
        const connectedPlayers = room.order
          .map(id => room.players.get(id))
          .filter(player => player?.connected);
        if (connectedPlayers.length < 2) {
          ws.send(JSON.stringify({
            type: "error",
            code: "coop-partner-required",
            message: "Invite at least one friend before starting a co-op game.",
          }));
          broadcastRoom(room);
          return;
        }
        const waitingFor = room.order
          .map(id => room.players.get(id))
          .filter(player => player && !player.maiaReady)
          .map(player => player.name);
        if (waitingFor.length) {
          ws.send(JSON.stringify({
            type: "error",
            code: "waiting-for-maia",
            message: `The game is still loading for: ${waitingFor.join(", ")}`,
          }));
          broadcastRoom(room);
          return;
        }
        room.phase = "playing";
        room.selectingOpponent = false;
        room.startedAt = Date.now();
        room.updatedAt = Date.now();
        persistRooms();
        broadcastRoom(room);
        break;
      }

      case "reopen-lobby": {
        const room = rooms.get(currentRoomId);
        if (!room || room.hostPlayerId !== currentPlayerId || room.phase !== "over") return;
        const previousPlayers = room.order
          .map(id => room.players.get(id))
          .filter(Boolean);
        const disconnectedPlayers = previousPlayers.filter(player => !player.connected);
        for (const player of disconnectedPlayers) room.players.delete(player.id);
        room.order = room.order.filter(id => room.players.has(id));
        if (!room.order.includes(room.hostPlayerId)) room.order.unshift(room.hostPlayerId);
        room.phase = "lobby";
        room.selectingOpponent = false;
        room.fen = INITIAL_FEN;
        room.activeIdx = 0;
        room.midTurn = false;
        room.startedAt = null;
        room.updatedAt = Date.now();
        room.moveHistory = [];
        persistRooms();
        invitePreviousRoomPlayers(room, room.hostUserId, disconnectedPlayers);
        broadcastRoom(room);
        break;
      }

      case "leave": {
        const room = rooms.get(currentRoomId);
        if (!room) return;
        if (room.phase === "lobby" && room.hostPlayerId === currentPlayerId) {
          closeLobbyRoom(room, "The room host left.");
          currentRoomId = null;
          currentPlayerId = null;
          return;
        }
        if (removeLobbyPlayer(room, currentPlayerId)) {
          currentRoomId = null;
          currentPlayerId = null;
          return;
        }
        const player = room.players.get(currentPlayerId);
        if (player) {
          player.connected = false;
          player.maiaReady = false;
          player.ws = null;
          player.lastSeen = Date.now();
          room.updatedAt = Date.now();
          persistRooms();
          broadcastRoom(room);
        }
        currentRoomId = null;
        currentPlayerId = null;
        break;
      }

      case "move": {
        const room = rooms.get(currentRoomId);
        if (!room || room.phase !== "playing") return;
        if (room.order[room.activeIdx] !== currentPlayerId) return;
        const before = room.fen;
        room.fen = msg.fen;
        room.updatedAt = Date.now();
        room.moveHistory = room.moveHistory || [];
        room.moveHistory.push({
          playerId: currentPlayerId,
          userId: room.players.get(currentPlayerId)?.userId || null,
          fen: msg.fen,
          previousFen: before,
          at: Date.now(),
        });
        if (msg.gameOver) {
          room.phase = "over";
          const result = gameResultFromFen(room.fen);
          if (result) {
            recordGameResult({
              dedupeKey: `coop:${room.id}`,
              mode: "coop",
              result,
              roomId: room.id,
              opponentStrength: room.strength,
              opponentKey: opponentKeyForStrength(room.strength),
              playerCount: room.order.length,
              movesCount: room.moveHistory.length,
              durationMs: room.startedAt ? Math.max(0, Date.now() - room.startedAt) : null,
              finalFen: room.fen,
              players: room.order
                .map(id => room.players.get(id))
                .filter(Boolean)
                .map(player => ({
                  userId: player.userId || null,
                  name: player.name || "Player",
                })),
            });
          }
          persistRooms();
          broadcastRoom(room);
          return;
        }
        if (room.midTurn) {
          // bot move received — advance to next player
          room.midTurn   = false;
          room.activeIdx = (room.activeIdx + 1) % room.order.length;
        } else {
          // human move — active player now runs bot locally
          room.midTurn = true;
        }
        persistRooms();
        broadcastRoom(room);
        break;
      }
    }
  });

  ws.on("close", () => {
    if (user?.id) {
      const sockets = notificationSockets.get(user.id);
      sockets?.delete(ws);
      if (!sockets?.size) notificationSockets.delete(user.id);
    }
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(currentPlayerId);
    if (!player || player.ws !== ws) return;

    if (removeLobbyPlayer(room, currentPlayerId)) return;

    player.connected = false;
    player.maiaReady = false;
    player.ws = null;
    player.lastSeen = Date.now();
    if (room.activeIdx >= room.order.length) room.activeIdx = 0;
    room.updatedAt = Date.now();
    persistRooms();
    broadcastRoom(room);
  });
  });
}

startServer().catch(err => {
  console.error(err);
  process.exit(1);
});
