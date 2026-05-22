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
const { createHash, randomBytes, randomUUID } = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 5678;
const DATA_DIR = process.env.DATA_DIR || (process.env.ROOMS_FILE ? path.dirname(process.env.ROOMS_FILE) : __dirname);
const ROOMS_FILE = process.env.ROOMS_FILE || path.join(DATA_DIR, ".chessquestia-rooms.json");
const LEGACY_ROOMS_FILE = path.join(__dirname, ".local-chess-rooms.json");
const AUTH_FILE = process.env.AUTH_FILE || path.join(DATA_DIR, ".chessquestia-auth.json");
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "chessquestia.sqlite");
const app  = express();
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
const authEnabled = googleAuthEnabled || localAuthEnabled;
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
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL");
if (!columnExists("room_players", "unlocked_count")) {
  db.exec("ALTER TABLE room_players ADD COLUMN unlocked_count INTEGER NOT NULL DEFAULT 1");
}

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
const oauthStates = new Map();

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
  };
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
  };
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

function areFriends(userId, friendId) {
  const [firstId, secondId] = friendshipPair(userId, friendId);
  return !!db.prepare(`
    SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?
  `).get(firstId, secondId);
}

function roomHasUser(roomId, userId) {
  return !!db.prepare(`
    SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?
  `).get(roomId, userId);
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
  return userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
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
  return userFromRow(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
}

migrateAuthJson();
backfillUsernames();
cleanupExpiredSessions();

app.get("/api/me", (req, res) => {
  const next = encodeURIComponent(req.query.next || req.originalUrl || "/");
  res.json({
    authEnabled,
    user: publicUser(currentUser(req)),
    loginUrl: `${googleAuthEnabled ? "/auth/google" : "/auth/local"}?next=${next}`,
    localAuthEnabled,
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

app.patch("/api/me", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const username = normalizeUsername(req.body?.username);
  if (username.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, user.id);
  if (existing) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }

  db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, user.id);
  res.json({ user: publicUser(currentUser(req)) });
});

app.get("/api/friends/user/:username", (req, res) => {
  const username = normalizeUsername(req.params.username);
  if (!username) {
    res.status(400).json({ error: "Invalid friend link" });
    return;
  }

  const user = userFromRow(db.prepare("SELECT * FROM users WHERE username = ?").get(username));
  if (!user) {
    res.status(404).json({ error: "Invalid friend link" });
    return;
  }

  res.json({ user: publicUser(user) });
});

app.post("/api/friends/user/:username", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const username = normalizeUsername(req.params.username);
  if (!username) {
    res.status(400).json({ error: "Invalid friend link" });
    return;
  }

  const target = userFromRow(db.prepare("SELECT * FROM users WHERE username = ?").get(username));
  if (!target) {
    res.status(404).json({ error: "Invalid friend link" });
    return;
  }
  if (target.id === user.id) {
    res.status(400).json({ error: "This is your own friend link" });
    return;
  }

  const alreadyFriends = areFriends(user.id, target.id);
  inTransaction(() => {
    createFriendship(user.id, target.id);
    db.prepare(`
      UPDATE friend_requests
      SET status = 'accepted', responded_at = ?
      WHERE status = 'pending'
        AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
    `).run(Date.now(), user.id, target.id, target.id, user.id);
  });

  res.json({
    message: alreadyFriends
      ? `You are already friends with ${target.username || target.name || "that player"}`
      : `You are now friends with ${target.username || target.name || "that player"}`,
    friend: publicUser(target),
  });
});

app.get("/api/friends", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const friends = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.picture, f.created_at
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
    WHERE f.user_id = ? OR f.friend_id = ?
    ORDER BY LOWER(u.username)
  `).all(user.id, user.id, user.id).map(publicFriendUser);

  res.json({ friends });
});

app.get("/api/friends/requests", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const incoming = db.prepare(`
    SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.name, u.email, u.picture
    FROM friend_requests fr
    JOIN users u ON u.id = fr.requester_id
    WHERE fr.addressee_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id);

  const outgoing = db.prepare(`
    SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.name, u.email, u.picture
    FROM friend_requests fr
    JOIN users u ON u.id = fr.addressee_id
    WHERE fr.requester_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(user.id);

  res.json({ incoming, outgoing });
});

app.get("/api/friends/search", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const query = String(req.query.q || "").trim().toLowerCase();
  if (!query) {
    res.json({ users: [] });
    return;
  }

  const users = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.picture,
      CASE
        WHEN f.user_id IS NOT NULL THEN 'friend'
        WHEN outgoing.id IS NOT NULL THEN 'outgoing_pending'
        WHEN incoming.id IS NOT NULL THEN 'incoming_pending'
        ELSE 'none'
      END AS friendship_status
    FROM users u
    LEFT JOIN friendships f
      ON ((f.user_id = ? AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = ?))
    LEFT JOIN friend_requests outgoing
      ON outgoing.requester_id = ? AND outgoing.addressee_id = u.id AND outgoing.status = 'pending'
    LEFT JOIN friend_requests incoming
      ON incoming.requester_id = u.id AND incoming.addressee_id = ? AND incoming.status = 'pending'
    WHERE u.id != ?
      AND LOWER(u.username) LIKE ?
    ORDER BY LOWER(u.username)
    LIMIT 20
  `).all(user.id, user.id, user.id, user.id, user.id, `%${query}%`).map(publicFriendUser);

  res.json({ users });
});

app.post("/api/friends/requests", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const targetUserId = String(req.body?.userId || req.body?.user_id || "");
  if (!targetUserId) {
    res.status(400).json({ error: "Invalid user" });
    return;
  }
  if (targetUserId === user.id) {
    res.status(400).json({ error: "You cannot add yourself" });
    return;
  }

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetUserId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [firstId, secondId] = friendshipPair(user.id, targetUserId);
  const existingFriendship = db.prepare(`
    SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?
  `).get(firstId, secondId);
  if (existingFriendship) {
    res.status(400).json({ error: "You are already friends" });
    return;
  }

  const incoming = db.prepare(`
    SELECT id FROM friend_requests
    WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
  `).get(targetUserId, user.id);
  if (incoming) {
    res.status(409).json({ error: `${target.name || target.email} already sent you a request` });
    return;
  }

  db.prepare(`
    INSERT INTO friend_requests (requester_id, addressee_id, status, created_at, responded_at)
    VALUES (?, ?, 'pending', ?, NULL)
    ON CONFLICT(requester_id, addressee_id) DO UPDATE SET
      status = 'pending',
      created_at = excluded.created_at,
      responded_at = NULL
    WHERE friend_requests.status != 'pending'
  `).run(user.id, targetUserId, Date.now());

  res.json({ message: `Friend request sent to ${target.name || target.email}` });
});

app.post("/api/friends/requests/:id/accept", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId)) {
    res.status(400).json({ error: "Invalid friend request" });
    return;
  }

  const request = db.prepare(`
    SELECT fr.id, fr.requester_id, u.name, u.email
    FROM friend_requests fr
    JOIN users u ON u.id = fr.requester_id
    WHERE fr.id = ? AND fr.addressee_id = ? AND fr.status = 'pending'
  `).get(requestId, user.id);
  if (!request) {
    res.status(404).json({ error: "Friend request not found" });
    return;
  }

  inTransaction(() => {
    createFriendship(user.id, request.requester_id);
    db.prepare(`
      UPDATE friend_requests
      SET status = 'accepted', responded_at = ?
      WHERE id = ?
    `).run(Date.now(), requestId);
  });

  res.json({ message: `You are now friends with ${request.name || request.email}` });
});

app.post("/api/friends/requests/:id/decline", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId)) {
    res.status(400).json({ error: "Invalid friend request" });
    return;
  }

  const result = db.prepare(`
    UPDATE friend_requests
    SET status = 'declined', responded_at = ?
    WHERE id = ? AND addressee_id = ? AND status = 'pending'
  `).run(Date.now(), requestId, user.id);
  if (!result.changes) {
    res.status(404).json({ error: "Friend request not found" });
    return;
  }

  res.json({ message: "Friend request declined" });
});

app.delete("/api/friends/:id", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const friendId = String(req.params.id || "");
  const [firstId, secondId] = friendshipPair(user.id, friendId);
  db.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?").run(firstId, secondId);
  res.json({ message: "Friend removed" });
});

app.get("/api/coop/invites", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const invites = db.prepare(`
    SELECT
      ri.id,
      ri.room_id,
      ri.created_at,
      rooms.phase,
      inviter.id AS inviter_id,
      inviter.username AS inviter_username,
      inviter.name AS inviter_name,
      inviter.email AS inviter_email,
      inviter.picture AS inviter_picture
    FROM room_invites ri
    JOIN rooms ON rooms.id = ri.room_id
    JOIN users inviter ON inviter.id = ri.inviter_id
    WHERE ri.invitee_id = ?
      AND ri.status = 'pending'
      AND rooms.phase = 'lobby'
    ORDER BY ri.created_at DESC
  `).all(user.id).map(row => ({
    id: row.id,
    roomId: row.room_id,
    createdAt: row.created_at,
    phase: row.phase,
    inviter: publicFriendUser({
      id: row.inviter_id,
      username: row.inviter_username,
      name: row.inviter_name,
      email: row.inviter_email,
      picture: row.inviter_picture,
      created_at: row.created_at,
    }),
  }));

  res.json({ invites });
});

app.post("/api/coop/invites", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const roomId = String(req.body?.roomId || req.body?.room_id || "").trim();
  const inviteeId = String(req.body?.userId || req.body?.inviteeId || req.body?.invitee_id || "").trim();
  if (!roomId || !inviteeId) {
    res.status(400).json({ error: "Invalid invite" });
    return;
  }
  if (inviteeId === user.id) {
    res.status(400).json({ error: "You are already in this room" });
    return;
  }

  const room = db.prepare("SELECT id, phase FROM rooms WHERE id = ?").get(roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  if (room.phase !== "lobby") {
    res.status(400).json({ error: "This game has already started" });
    return;
  }
  if (!roomHasUser(roomId, user.id)) {
    res.status(403).json({ error: "Join the room before inviting friends" });
    return;
  }

  const invitee = db.prepare("SELECT * FROM users WHERE id = ?").get(inviteeId);
  if (!invitee) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  if (!areFriends(user.id, inviteeId)) {
    res.status(403).json({ error: "You can only invite friends" });
    return;
  }
  if (roomHasUser(roomId, inviteeId)) {
    res.status(400).json({ error: `${invitee.username || invitee.name || "That player"} is already in this room` });
    return;
  }

  db.prepare(`
    INSERT INTO room_invites (room_id, inviter_id, invitee_id, status, created_at, responded_at)
    VALUES (?, ?, ?, 'pending', ?, NULL)
    ON CONFLICT(room_id, invitee_id) DO UPDATE SET
      inviter_id = excluded.inviter_id,
      status = 'pending',
      created_at = excluded.created_at,
      responded_at = NULL
  `).run(roomId, user.id, inviteeId, Date.now());

  res.json({ message: `Invite sent to ${invitee.username || invitee.name || invitee.email}` });
});

app.post("/api/coop/invites/:id/dismiss", (req, res) => {
  const user = requireApiUser(req, res);
  if (!user) return;

  const inviteId = Number(req.params.id);
  if (!Number.isInteger(inviteId)) {
    res.status(400).json({ error: "Invalid invite" });
    return;
  }

  const result = db.prepare(`
    UPDATE room_invites
    SET status = 'dismissed', responded_at = ?
    WHERE id = ? AND invitee_id = ? AND status = 'pending'
  `).run(Date.now(), inviteId, user.id);
  if (!result.changes) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  res.json({ message: "Invite dismissed" });
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
  if (!authEnabled) {
    next();
    return;
  }
  if (!["GET", "HEAD"].includes(req.method) || !["/", "/index.html"].includes(req.path)) {
    next();
    return;
  }
  if (currentUser(req)) {
    next();
    return;
  }
  const loginPath = googleAuthEnabled ? "/auth/google" : "/auth/local";
  res.redirect(`${loginPath}?next=${encodeURIComponent(safeNextPath(req.originalUrl || "/"))}`);
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
    createdAt: room.createdAt || Date.now(),
    updatedAt: room.updatedAt || Date.now(),
    moveHistory: room.moveHistory || [],
  };
}

function saveSerializedRoomToDb(room) {
  inTransaction(() => {
    db.prepare(`
      INSERT INTO rooms
        (id, host_player_id, host_user_id, phase, fen, active_idx, mid_turn, strength, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        host_player_id = excluded.host_player_id,
        host_user_id = excluded.host_user_id,
        phase = excluded.phase,
        fen = excluded.fen,
        active_idx = excluded.active_idx,
        mid_turn = excluded.mid_turn,
        strength = excluded.strength,
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
      name: player.name,
      connected: !!player.connected,
      maiaReady: !!player.maiaReady,
      signedIn: !!player.userId,
      unlockedCount: normalizeUnlockedOpponentCount(player.unlockedCount),
    };
  });
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
    myIdx,
  };
}

function broadcastRoom(room) {
  broadcast(room, (wsId, idx) => roomState(room, wsId, idx));
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
        const playerId = randomUUID();
        const name = user?.username || user?.name || msg.name || "Player";
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
            unlockedCount: normalizeUnlockedOpponentCount(msg.unlockedOpponentCount),
            lastSeen: Date.now(),
          }]]),
          order: [playerId],
          phase: "lobby",
          fen: INITIAL_FEN,
          activeIdx: 0, midTurn: false,
          strength: msg.strength || 1500,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          moveHistory: [],
        };
        rooms.set(roomId, room);
        currentRoomId = roomId;
        currentPlayerId = playerId;
        persistRooms();
        ws.send(JSON.stringify({ type: "created", roomId, playerId }));
        broadcastRoom(room);
        break;
      }

      case "join": {
        if (authEnabled && !user) {
          ws.send(JSON.stringify({ type: "error", code: "auth-required", message: "Sign in to join co-op." }));
          return;
        }
        const room = rooms.get(msg.roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }
        const playerIdByToken = msg.playerId && room.players.has(msg.playerId) ? msg.playerId : null;
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
        room.players.set(playerId, {
          id: playerId,
          userId: user?.id || existing?.userId || null,
          name: user?.username || user?.name || msg.name || existing?.name || "Player",
          ws,
          connected: true,
          maiaReady: !!msg.maiaReady,
          unlockedCount: normalizeUnlockedOpponentCount(msg.unlockedOpponentCount || existing?.unlockedCount),
          lastSeen: Date.now(),
        });
        if (!room.order.includes(playerId)) room.order.push(playerId);
        if (user?.id) {
          db.prepare(`
            UPDATE room_invites
            SET status = 'accepted', responded_at = ?
            WHERE room_id = ? AND invitee_id = ? AND status = 'pending'
          `).run(Date.now(), room.id, user.id);
        }
        currentRoomId = msg.roomId;
        currentPlayerId = playerId;
        persistRooms();
        ws.send(JSON.stringify({ type: "joined", roomId: room.id, playerId }));
        broadcastRoom(room);
        break;
      }

      case "maia-status": {
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const player = room.players.get(currentPlayerId);
        if (!player) return;
        const maiaReady = !!msg.ready;
        const unlockedCount = normalizeUnlockedOpponentCount(msg.unlockedOpponentCount || player.unlockedCount);
        if (player.maiaReady === maiaReady && player.unlockedCount === unlockedCount) return;
        player.maiaReady = maiaReady;
        player.unlockedCount = unlockedCount;
        player.lastSeen = Date.now();
        room.updatedAt = Date.now();
        persistRooms();
        broadcastRoom(room);
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

      case "start": {
        const room = rooms.get(currentRoomId);
        if (!room || room.hostPlayerId !== currentPlayerId || room.phase !== "lobby") return;
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
        room.updatedAt = Date.now();
        persistRooms();
        broadcastRoom(room);
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
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(currentPlayerId);
    if (!player || player.ws !== ws) return;

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
