// ==========================================
// PATH: server.js
// ==========================================

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

// ----------------------------------------------------------
// ✅ CONFIG
// ----------------------------------------------------------
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

// Render / Hosting friendly
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"]
});

// ----------------------------------------------------------
// ✅ SMART PUBLIC FOLDER DETECTION
// ----------------------------------------------------------
let staticFolderName = "public";

if (fs.existsSync(path.join(__dirname, "Public"))) {
  staticFolderName = "Public";
  console.log("📂 Folder Found: 'Public' (Capital Case)");
} else if (fs.existsSync(path.join(__dirname, "public"))) {
  staticFolderName = "public";
  console.log("📂 Folder Found: 'public' (Lower Case)");
} else {
  console.error("❌ CRITICAL: Na 'public' folder mila, na 'Public'!");
}

const publicPath = path.join(__dirname, staticFolderName);

// Serve static
app.use(express.static(publicPath));

// Root route
app.get("/", (req, res) => {
  const indexPath = path.join(publicPath, "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send("❌ index.html not found in Public/public folder.");
});

// Health check (optional)
app.get("/health", (req, res) => res.json({ ok: true }));

// ----------------------------------------------------------
// ✅ HELPERS
// ----------------------------------------------------------
function nowMs() {
  return Date.now();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function makeRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ----------------------------------------------------------
// ✅ GAME CONFIG (Server safe defaults)
// ----------------------------------------------------------
const SERVER_CONFIG = {
  SERVER_TICK_RATE: 20,

  // race config
  RINGS_PER_LAP: 4,
  TOTAL_LAPS_TO_WIN: 2, // 2 lap win condition
  TOTAL_RINGS_TO_WIN: 4 * 2, // 8 rings

  // scoring
  SCORE_RING: 100,
  SCORE_KILL: 10,

  // bullets (MP)
  BULLET_DAMAGE: 5,
  BULLET_LIFETIME_MS: 2000
};

// ----------------------------------------------------------
// ✅ MULTIPLAYER STATE
// ----------------------------------------------------------
const MAX_PLAYERS_PER_ROOM = 8;
const rooms = {}; // roomId -> room

function createDefaultPlayer(socketId, name, isHost) {
  return {
    id: socketId,
    name: (name || "Pilot").substring(0, 12),
    isHost: !!isHost,

    // stats
    hp: 100,
    kills: 0,
    score: 0,
    rings: 0,

    // transform
    p: { x: 0, y: 250, z: 0 },
    q: { x: 0, y: 0, z: 0, w: 1 },

    // alive state
    alive: true,
    respawnAt: 0,

    // timing
    connected: true,
    lastSeenAt: nowMs()
  };
}

function makeRoom() {
  return {
    id: makeRoomId(),
    hostId: null,
    status: "lobby", // lobby | playing | finished
    seed: Math.floor(Math.random() * 100000),

    // tick
    tick: 0,
    createdAt: nowMs(),

    // gameplay objects
    players: [],
    bullets: [] // {id,ownerId,createdAt,p,q}
  };
}

function getRoom(roomIdRaw) {
  const roomId = String(roomIdRaw || "").toUpperCase();
  return rooms[roomId];
}

// ----------------------------------------------------------
// ✅ GAME OVER HELPERS (ADDED)
// ----------------------------------------------------------
function emitGameOver(room, winnerPlayer, reason) {
  if (!room) return;
  if (room.status === "finished") return;

  room.status = "finished";

  io.to(room.id).emit("mp_game_over", {
    winnerId: winnerPlayer?.id || null,
    winner: winnerPlayer?.name || null,
    reason: reason || "Match ended",
    stats: room.players.map(pp => ({
      id: pp.id,
      name: pp.name,
      rings: pp.rings,
      kills: pp.kills,
      score: pp.score
    }))
  });

  emitLobbyUpdate(room.id);
}

function checkLastPlayerWin(room, reason) {
  if (!room) return;
  if (room.status !== "playing") return;

  // if only 1 player remains => winner
  if (room.players.length === 1) {
    const winner = room.players[0];
    emitGameOver(room, winner, reason || "All other players left");
  }
}

// ----------------------------------------------------------
// ✅ LOBBY UPDATE (FIXED FINAL)
// ----------------------------------------------------------
function emitLobbyUpdate(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // send per-player so client can get "you"
  for (const p of room.players) {
    io.to(p.id).emit("mp_lobby_update", {
      roomId,
      hostId: room.hostId,
      status: room.status,

      // ✅ CRITICAL: helps client show Launch button
      you: {
        id: p.id,
        name: p.name,
        isHost: room.hostId === p.id
      },

      players: room.players.map(pp => ({
        id: pp.id,
        name: pp.name,
        isHost: pp.id === room.hostId, // ensure correct host flag
        hp: pp.hp,
        rings: pp.rings,
        kills: pp.kills,
        score: pp.score,
        alive: pp.alive
      }))
    });
  }
}

function roomSnapshot(room) {
  return {
    roomId: room.id,
    status: room.status,
    seed: room.seed,
    tick: room.tick,
    time: nowMs(),
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      hp: p.hp,
      rings: p.rings,
      kills: p.kills,
      score: p.score,
      alive: p.alive,
      p: p.p,
      q: p.q
    })),
    bullets: room.bullets
  };
}

// ----------------------------------------------------------
// ✅ SERVER TICK LOOP (20 TPS like Minecraft)
// ----------------------------------------------------------
const TICK_INTERVAL_MS = 1000 / SERVER_CONFIG.SERVER_TICK_RATE;

setInterval(() => {
  const t = nowMs();

  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (!room) continue;

    if (room.status !== "playing") continue;

    room.tick++;

    // cleanup bullets
    room.bullets = room.bullets.filter(b => (t - b.createdAt) < SERVER_CONFIG.BULLET_LIFETIME_MS);

    // respawns
    for (const p of room.players) {
      if (!p) continue;

      // respawn
      if (!p.alive && p.respawnAt && t >= p.respawnAt) {
        p.alive = true;
        p.hp = 100;
        p.respawnAt = 0;

        // NOTE: rings do NOT reset, score stays
        // position reset
        p.p = { x: 0, y: 250, z: 0 };
        p.q = { x: 0, y: 0, z: 0, w: 1 };

        io.to(room.id).emit("mp_event", {
          t: "EVENT",
          type: "RESPAWN",
          id: p.id,
          p: p.p,
          q: p.q
        });
      }
    }

    // broadcast world snapshot
    io.to(roomId).emit("mp_state", roomSnapshot(room));
  }
}, TICK_INTERVAL_MS);

// ----------------------------------------------------------
// ✅ SOCKET.IO EVENTS
// ----------------------------------------------------------
io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  socket.emit("mp_welcome", { id: socket.id });

  // ============================
  // Create Room
  // ============================
  socket.on("mp_create_room", ({ name } = {}) => {
    const room = makeRoom();
    room.hostId = socket.id;

    const player = createDefaultPlayer(socket.id, name, true);
    room.players.push(player);

    rooms[room.id] = room;
    socket.join(room.id);

    socket.emit("mp_room_created", {
      roomId: room.id,
      players: room.players,
      isHost: true,
      hostId: room.hostId,
      seed: room.seed
    });

    emitLobbyUpdate(room.id);

    console.log(`[ROOM] Created ${room.id} by ${socket.id}`);
  });

  // ============================
  // Join Room
  // ============================
  socket.on("mp_join_room", ({ roomId, name } = {}) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];

    if (!room) {
      socket.emit("mp_error", { msg: "Room not found." });
      return;
    }
    if (room.status !== "lobby") {
      socket.emit("mp_error", { msg: "Game already started." });
      return;
    }
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      socket.emit("mp_error", { msg: "Room full." });
      return;
    }

    const player = createDefaultPlayer(socket.id, name, false);
    room.players.push(player);

    socket.join(rId);

    socket.emit("mp_room_joined", {
      roomId: rId,
      players: room.players,
      hostId: room.hostId,
      seed: room.seed
    });

    emitLobbyUpdate(rId);

    console.log(`[ROOM] ${socket.id} joined ${rId}`);
  });

  // ============================
  // Leave Room (optional)
  // ============================
  socket.on("mp_leave_room", ({ roomId } = {}) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];
    if (!room) return;

    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    const wasHost = room.hostId === socket.id;
    room.players.splice(idx, 1);

    socket.leave(rId);

    if (room.players.length === 0) {
      delete rooms[rId];
      console.log(`[ROOM] Deleted empty room ${rId}`);
      return;
    }

    // host migration
    if (wasHost) {
      room.hostId = room.players[0].id;
      room.players.forEach(p => (p.isHost = false));
      room.players[0].isHost = true;
    }

    emitLobbyUpdate(rId);
    io.to(rId).emit("playerDisconnected", socket.id);

    // check win
    checkLastPlayerWin(room, "All other players left");

    console.log(`[ROOM] ${socket.id} left ${rId}`);
  });

  // ============================
  // Host Start Game
  // ============================
  socket.on("mp_start_game", ({ roomId } = {}) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];
    if (!room) return;

    if (room.hostId !== socket.id) return;

    room.status = "playing";
    room.tick = 0;

    // reset hp alive; keep score/rings
    room.players.forEach(p => {
      p.hp = 100;
      p.alive = true;
      p.respawnAt = 0;

      // gameplay start fresh
      p.rings = 0;
      p.kills = 0;
      p.score = 0;
    });

    io.to(rId).emit("mp_game_start", {
      seed: room.seed,
      tickRate: SERVER_CONFIG.SERVER_TICK_RATE,
      ringsPerLap: SERVER_CONFIG.RINGS_PER_LAP,
      totalRingsToWin: SERVER_CONFIG.TOTAL_RINGS_TO_WIN
    });

    emitLobbyUpdate(rId);

    console.log(`[ROOM] ${rId} started by host ${socket.id}`);
  });

  // ============================
  // Client Transform (semi-auth)
  // ============================
  socket.on("mp_transform", (data) => {
    if (!data || !data.roomId) return;

    const rId = String(data.roomId).toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!player.alive) return;

    const p = data.p;
    const q = data.q;

    if (p && typeof p.x === "number") {
      player.p = {
        x: clamp(p.x, -100000, 100000),
        y: clamp(p.y, 0, 5000),
        z: clamp(p.z, -100000, 100000)
      };
    }

    if (q && typeof q.w === "number") {
      player.q = q;
    }

    player.lastSeenAt = nowMs();
  });

  // ============================
  // Fire (authoritative bullet spawn)
  // ============================
  socket.on("mp_fire", (data) => {
    if (!data || !data.roomId) return;

    const rId = String(data.roomId).toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const shooter = room.players.find(p => p.id === socket.id);
    if (!shooter || !shooter.alive) return;

    const bulletId = Math.random().toString(36).substring(2, 10);

    room.bullets.push({
      id: bulletId,
      ownerId: socket.id,
      createdAt: nowMs(),
      p: data.p || shooter.p,
      q: data.q || shooter.q
    });

    io.to(rId).emit("mp_event", {
      t: "EVENT",
      type: "FIRE",
      ownerId: socket.id
    });
  });

  // ============================
  // ✅ FIX: Generic Event Relay
  // Iske bina mp_event nahi pahunchta
  // ============================
  socket.on("mp_event", (data) => {
    if (!data || !data.roomId) return;
    
    const rId = String(data.roomId).toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    // Direct relay to everyone in room
    io.to(rId).emit("mp_event", data);
  });

  // ============================
  // Hit report (Server Validated + Broadcast)
  // ============================
  socket.on("mp_hit", ({ roomId, targetId, bulletId } = {}) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const attacker = room.players.find(p => p.id === socket.id);
    const target = room.players.find(p => p.id === targetId);

    if (!attacker || !target) return;
    if (!attacker.alive || !target.alive) return;
    if (attacker.id === target.id) return;

    // Optional: validate bullet exists & belongs to attacker
    if (bulletId) {
      const b = room.bullets.find(bb => bb.id === bulletId);
      if (!b) return; // bullet invalid/expired
      if (b.ownerId !== attacker.id) return; // not your bullet
    }

    // apply damage
    target.hp -= SERVER_CONFIG.BULLET_DAMAGE;
    
    // ✅ ALSO SEND BACK EVENT (Safety backup)
    io.to(rId).emit("mp_event", {
        t: "EVENT",
        type: "DAMAGE",
        targetId: target.id,
        attackerId: attacker.id,
        damage: SERVER_CONFIG.BULLET_DAMAGE
    });

    // death
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      target.respawnAt = nowMs() + 3000; // 3s delay

      attacker.kills += 1;
      attacker.score += SERVER_CONFIG.SCORE_KILL;

      io.to(rId).emit("mp_event", {
        t: "EVENT",
        type: "KILL",
        killerId: attacker.id,
        killerName: attacker.name,
        victimId: target.id,
        victimName: target.name
      });
    }

    // Broadcast score update
    io.to(rId).emit("mp_score_update", {
      id: attacker.id,
      kills: attacker.kills,
      score: attacker.score
    });
  });

  // ============================
  // Rings claim (sequential)
  // ============================
  socket.on("mp_claim_ring", ({ roomId, ringIndex } = {}) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const p = room.players.find(pp => pp.id === socket.id);
    if (!p || !p.alive) return;

    const expectedIndex = p.rings % SERVER_CONFIG.RINGS_PER_LAP;
    if (ringIndex !== expectedIndex) return;

    p.rings += 1;
    p.score += SERVER_CONFIG.SCORE_RING;

    io.to(rId).emit("mp_score_update", {
      id: p.id,
      rings: p.rings,
      score: p.score
    });

    // win condition
    if (p.rings >= SERVER_CONFIG.TOTAL_RINGS_TO_WIN) {
      emitGameOver(room, p, "Objective completed: Rings cleared");
    }
  });

  // ============================
  // Disconnect
  // ============================
  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] ${socket.id}`);

    for (const rId in rooms) {
      const room = rooms[rId];
      if (!room) continue;

      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;

      const wasHost = room.hostId === socket.id;

      room.players.splice(idx, 1);

      if (room.players.length === 0) {
        delete rooms[rId];
        console.log(`[ROOM] Deleted empty room ${rId}`);
        break;
      }

      // host migration
      if (wasHost) {
        room.hostId = room.players[0].id;
        room.players.forEach(p => (p.isHost = false));
        room.players[0].isHost = true;
      }

      emitLobbyUpdate(rId);
      io.to(rId).emit("playerDisconnected", socket.id);

      // check win
      checkLastPlayerWin(room, "All other players disconnected");

      break;
    }
  });
});

// ----------------------------------------------------------
// ✅ START SERVER
// ----------------------------------------------------------
server.listen(PORT, () => {
  console.log(`✅ Server Running on Port: ${PORT}`);
  console.log(`📂 Auto-detected Public Folder: '${staticFolderName}'`);
});
