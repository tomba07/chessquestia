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
const { WebSocketServer } = require("ws");
const { randomUUID }      = require("crypto");

const PORT = process.env.PORT || 5678;
const app  = express();

// ── LAN IP ────────────────────────────────────────────────────────────────────

function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    const hit = ifaces.find(i => i.family === "IPv4" && !i.internal);
    if (hit) return hit.address;
  }
  return "127.0.0.1";
}

let publicBase = process.env.RENDER_EXTERNAL_URL || null; // also overridden by --tunnel

// ── COOP/COEP headers ─────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy",   "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("bypass-tunnel-reminder",       "true");
  next();
});

// ── Config endpoint ───────────────────────────────────────────────────────────

app.get("/config", (req, res) => {
  res.json({ base: publicBase ?? `http://${getLanIp()}:${PORT}` });
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

/*
  Room shape:
  {
    id:         string,
    hostWsId:   string,
    players:    Map<wsId, { name, ws }>,
    order:      wsId[],          // round-robin order (insertion order)
    phase:      'lobby'|'playing'|'over',
    fen:        string,
    activeIdx:  number,          // index into order[]
    botTurn:    boolean,
  }
*/

function broadcast(room, buildMsg) {
  room.order.forEach((wsId, idx) => {
    const p = room.players.get(wsId);
    if (!p || p.ws.readyState !== 1) return;
    p.ws.send(JSON.stringify(buildMsg(wsId, idx)));
  });
}

function roomState(room, myWsId, myIdx) {
  return {
    type: "room-state",
    roomId:    room.id,
    phase:     room.phase,
    players:   room.order.map(id => ({ name: room.players.get(id).name })),
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

wss.on("connection", (ws) => {
  const wsId = randomUUID();
  let currentRoomId = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case "create": {
        const roomId = randomUUID().slice(0, 8);
        const room = {
          id: roomId, hostWsId: wsId,
          players: new Map([[wsId, { name: msg.name, ws }]]),
          order: [wsId],
          phase: "lobby",
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          activeIdx: 0, midTurn: false,
          strength: msg.strength || 1500,
        };
        rooms.set(roomId, room);
        currentRoomId = roomId;
        ws.send(JSON.stringify({ type: "created", roomId }));
        break;
      }

      case "join": {
        const room = rooms.get(msg.roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
          return;
        }
        if (room.phase !== "lobby") {
          ws.send(JSON.stringify({ type: "error", message: "Game already started" }));
          return;
        }
        room.players.set(wsId, { name: msg.name, ws });
        room.order.push(wsId);
        currentRoomId = msg.roomId;
        broadcastRoom(room);
        break;
      }

      case "start": {
        const room = rooms.get(currentRoomId);
        if (!room || room.hostWsId !== wsId || room.phase !== "lobby") return;
        room.phase = "playing";
        broadcastRoom(room);
        break;
      }

      case "move": {
        const room = rooms.get(currentRoomId);
        if (!room || room.phase !== "playing") return;
        room.fen = msg.fen;
        if (msg.gameOver) {
          room.phase = "over";
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
        broadcastRoom(room);
        break;
      }
    }
  });

  ws.on("close", () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.players.delete(wsId);
    room.order = room.order.filter(id => id !== wsId);

    if (room.order.length === 0) {
      rooms.delete(currentRoomId);
      return;
    }
    // transfer host if needed
    if (room.hostWsId === wsId) room.hostWsId = room.order[0];
    // clamp activeIdx
    if (room.activeIdx >= room.order.length) room.activeIdx = 0;
    broadcastRoom(room);
  });
});
