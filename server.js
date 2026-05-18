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
const { randomUUID }      = require("crypto");

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
  });
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

/*
  Room shape:
  {
    id:         string,
    hostPlayerId: string,
    players:      Map<playerId, { id, name, ws, connected, maiaReady, lastSeen }>,
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
        players,
        order: (savedRoom.order || []).filter(id => players.has(id)),
        phase: savedRoom.phase || "lobby",
        fen: savedRoom.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        activeIdx: savedRoom.activeIdx || 0,
        midTurn: !!savedRoom.midTurn,
        strength: savedRoom.strength || 1500,
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
      return { name: player.name, connected: !!player.connected, maiaReady: !!player.maiaReady };
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

wss.on("connection", (ws) => {
  let currentPlayerId = null;
  let currentRoomId = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case "create": {
        const roomId = randomUUID().slice(0, 8);
        const playerId = randomUUID();
        const room = {
          id: roomId,
          hostPlayerId: playerId,
          players: new Map([[playerId, {
            id: playerId,
            name: msg.name,
            ws,
            connected: true,
            maiaReady: !!msg.maiaReady,
            lastSeen: Date.now(),
          }]]),
          order: [playerId],
          phase: "lobby",
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          activeIdx: 0, midTurn: false,
          strength: msg.strength || 1500,
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
        const room = rooms.get(msg.roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }
        const playerIdByToken = msg.playerId && room.players.has(msg.playerId) ? msg.playerId : null;
        const playerIdByName = findPlayerIdByName(room, msg.name);
        const returningPlayerId = playerIdByToken || playerIdByName;
        const returningPlayer = returningPlayerId ? room.players.get(returningPlayerId) : null;
        if (room.phase !== "lobby" && !returningPlayer) {
          ws.send(JSON.stringify({ type: "error", message: "Game already started" }));
          return;
        }
        if (returningPlayer?.connected && !playerIdByToken) {
          ws.send(JSON.stringify({ type: "error", message: "That player is already connected" }));
          return;
        }
        const playerId = returningPlayerId || randomUUID();
        const existing = room.players.get(playerId);
        if (existing?.ws?.readyState === 1 && existing.ws !== ws)
          existing.ws.close(1000, "Reconnected");
        room.players.set(playerId, {
          id: playerId,
          name: msg.name || existing?.name || "Player",
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
        persistRooms();
        broadcastRoom(room);
        break;
      }

      case "move": {
        const room = rooms.get(currentRoomId);
        if (!room || room.phase !== "playing") return;
        if (room.order[room.activeIdx] !== currentPlayerId) return;
        room.fen = msg.fen;
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
    persistRooms();
    broadcastRoom(room);
  });
});
