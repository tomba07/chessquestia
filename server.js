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

const PORT = process.env.PORT || 5678;
const app  = express();
app.set("trust proxy", true);

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
const authEnabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

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

const AUTH_FILE = process.env.AUTH_FILE || path.join(__dirname, ".chessquestia-auth.json");
const SESSION_COOKIE = "cq_session";
const OAUTH_STATE_COOKIE = "cq_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const oauthStates = new Map();

let authStore = {
  version: 1,
  users: {},
  sessions: {},
};

function loadAuthStore() {
  if (!fs.existsSync(AUTH_FILE)) return;
  try {
    const payload = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    authStore = {
      version: 1,
      users: payload.users || {},
      sessions: payload.sessions || {},
    };
  } catch (err) {
    console.warn(`Could not load auth store: ${err.message}`);
  }
}

function persistAuthStore() {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  const tmpFile = `${AUTH_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(authStore, null, 2));
  fs.renameSync(tmpFile, AUTH_FILE);
}

function cleanupExpiredSessions() {
  const now = Date.now();
  let changed = false;
  for (const [hash, session] of Object.entries(authStore.sessions)) {
    if (!session?.expiresAt || session.expiresAt <= now) {
      delete authStore.sessions[hash];
      changed = true;
    }
  }
  if (changed) persistAuthStore();
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
    name: user.name,
    email: user.email,
    picture: user.picture,
  };
}

function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = authStore.sessions[sessionHash(token)];
  if (!session || session.expiresAt <= Date.now()) return null;
  return authStore.users[session.userId] || null;
}

function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  authStore.sessions[sessionHash(token)] = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  persistAuthStore();
  return token;
}

function upsertGoogleUser(profile) {
  const userId = `google:${profile.sub}`;
  const existing = authStore.users[userId] || {};
  authStore.users[userId] = {
    ...existing,
    id: userId,
    provider: "google",
    providerSub: profile.sub,
    email: profile.email || existing.email || "",
    emailVerified: !!profile.email_verified,
    name: profile.name || profile.given_name || existing.name || profile.email || "Player",
    picture: profile.picture || existing.picture || "",
    createdAt: existing.createdAt || Date.now(),
    lastLoginAt: Date.now(),
  };
  persistAuthStore();
  return authStore.users[userId];
}

loadAuthStore();
cleanupExpiredSessions();

app.get("/api/me", (req, res) => {
  const next = encodeURIComponent(req.query.next || req.originalUrl || "/");
  res.json({
    authEnabled,
    user: publicUser(currentUser(req)),
    loginUrl: `/auth/google?next=${next}`,
    logoutUrl: `/auth/logout?next=${next}`,
  });
});

app.get("/auth/google", (req, res) => {
  if (!authEnabled) {
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
    if (!authEnabled) throw new Error("Google sign-in is not configured.");
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

app.get("/auth/logout", (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    delete authStore.sessions[sessionHash(token)];
    persistAuthStore();
  }
  res.setHeader("Set-Cookie", clearCookieHeader(SESSION_COOKIE));
  res.redirect(safeNextPath(req.query.next || "/"));
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

// ── Static files ──────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname)));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── HTTP server ───────────────────────────────────────────────────────────────

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  const base = publicBase ?? `http://${getLanIp()}:${PORT}`;
  console.log(`Listening on port ${PORT}  (${base})`);
});

// ── Tunnel (optional) ─────────────────────────────────────────────────────────

if (process.argv.includes("--tunnel")) {
  require("localtunnel")({ port: PORT }).then(t => {
    publicBase = t.url;
    console.log(`Public URL: ${t.url}`);
    t.on("close", () => { publicBase = null; console.log("Tunnel closed"); });
  }).catch(err => console.error("Tunnel error:", err.message));
}

// ── WebSocket room management ─────────────────────────────────────────────────

const wss   = new WebSocketServer({ server: httpServer });
const rooms = new Map(); // roomId → Room
const ROOMS_FILE = process.env.ROOMS_FILE || path.join(__dirname, ".chessquestia-rooms.json");
const LEGACY_ROOMS_FILE = path.join(__dirname, ".local-chess-rooms.json");
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

function persistRooms() {
  const payload = {
    version: 1,
    rooms: [...rooms.values()].map(serializeRoom),
  };
  fs.mkdirSync(path.dirname(ROOMS_FILE), { recursive: true });
  const tmpFile = `${ROOMS_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2));
  fs.renameSync(tmpFile, ROOMS_FILE);
}

function loadRooms() {
  const roomsFile = fs.existsSync(ROOMS_FILE) ? ROOMS_FILE : LEGACY_ROOMS_FILE;
  if (!fs.existsSync(roomsFile)) return;
  try {
    const payload = JSON.parse(fs.readFileSync(roomsFile, "utf8"));
    for (const savedRoom of payload.rooms || []) {
      const players = new Map();
      for (const savedPlayer of savedRoom.players || []) {
        players.set(savedPlayer.id, {
          id: savedPlayer.id,
          userId: savedPlayer.userId || null,
          name: savedPlayer.name,
          ws: null,
          connected: false,
          maiaReady: false,
          lastSeen: savedPlayer.lastSeen || Date.now(),
        });
      }
      rooms.set(savedRoom.id, {
        id: savedRoom.id,
        hostPlayerId: savedRoom.hostPlayerId,
        hostUserId: savedRoom.hostUserId || null,
        players,
        order: (savedRoom.order || []).filter(id => players.has(id)),
        phase: savedRoom.phase || "lobby",
        fen: savedRoom.fen || INITIAL_FEN,
        activeIdx: savedRoom.activeIdx || 0,
        midTurn: !!savedRoom.midTurn,
        strength: savedRoom.strength || 1500,
        createdAt: savedRoom.createdAt || Date.now(),
        updatedAt: savedRoom.updatedAt || Date.now(),
        moveHistory: Array.isArray(savedRoom.moveHistory) ? savedRoom.moveHistory : [],
      });
    }
    console.log(`Loaded ${rooms.size} saved room(s)`);
    if (roomsFile === LEGACY_ROOMS_FILE) persistRooms();
  } catch (err) {
    console.warn(`Could not load saved rooms: ${err.message}`);
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
  return {
    type: "room-state",
    roomId:    room.id,
    playerId:  myPlayerId,
    phase:     room.phase,
    players:   room.order.map(id => {
      const player = room.players.get(id);
      return { name: player.name, connected: !!player.connected, maiaReady: !!player.maiaReady, signedIn: !!player.userId };
    }),
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
          ws.send(JSON.stringify({ type: "error", code: "auth-required", message: "Sign in with Google to play coop." }));
          return;
        }
        const roomId = randomUUID().slice(0, 8);
        const playerId = randomUUID();
        const name = user?.name || msg.name || "Player";
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
          ws.send(JSON.stringify({ type: "error", code: "auth-required", message: "Sign in with Google to join coop." }));
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
          name: user?.name || msg.name || existing?.name || "Player",
          ws,
          connected: true,
          maiaReady: !!msg.maiaReady,
          lastSeen: Date.now(),
        });
        if (!room.order.includes(playerId)) room.order.push(playerId);
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
        if (player.maiaReady === maiaReady) return;
        player.maiaReady = maiaReady;
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
            message: `Waiting for Maia on: ${waitingFor.join(", ")}`,
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
