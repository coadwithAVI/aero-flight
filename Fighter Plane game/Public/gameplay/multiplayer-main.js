// ==========================================
// PATH: server.js
// ==========================================

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

// ==========================================================
// CONFIG
// ==========================================================
const PORT = process.env.PORT || 10000;

const SERVER_TICK_RATE = 20;             // ✅ Minecraft style 20 TPS
const TICK_INTERVAL_MS = 1000 / SERVER_TICK_RATE;

const MAX_PLAYERS_PER_ROOM = 8;

// Multiplayer rules
const MP_RULES = {
  RINGS_PER_LAP: 4,
  TOTAL_LAPS_TO_WIN: 2, // ✅ 2 laps win
  BULLET_DAMAGE: 5,
  RESPAWN_DELAY_MS: 3000,

  SCORE_RING: 100,
  SCORE_KILL: 10,

  BULLET_LIFETIME_MS: 2000
};

// ==========================================================
// PUBLIC FOLDER AUTO DETECT
// ==========================================================
let staticFolderName = "public";

if (fs.existsSync(path.join(__dirname, "Public"))) {
  staticFolderName = "Public";
  console.log("📂 Folder Found: 'Public' (Capital Case)");
} else if (fs.existsSync(path.join(__dirname, "public"))) {
  staticFolderName = "public";
  console.log("📂 Folder Found: 'public' (Lower Case)");
} else {
  console.error("❌ CRITICAL ERROR: No 'public/Public' folder found!");
}

const publicPath = path.join(__dirname, staticFolderName);

// Static serve
app.use(express.static(publicPath));

// Root route
app.get("/", (req, res) => {
  const indexPath = path.join(publicPath, "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send("Error: index.html not found!");
});

// ==========================================================
// SOCKET.IO SETUP
// ==========================================================
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"]
});

// ==========================================================
// HELPERS
// ==========================================================
function nowMs() {
  return Date.now();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Lobby code: 4 letters/digits
function makeRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ==========================================================
// ROOM STATE
// ==========================================================
/**
 * rooms = {
 *   CODE: {
 *     id,
 *     hostId,
 *     status: "lobby"|"playing"|"finished",
 *     seed,
 *     tick,
 *     createdAt,
 *     players: [],
 *     bullets: [],
 *     replayHostRoomId: null,   // replay logic
 *     replayGroupId: null       // group for replay join
 *   }
 * }
 */
const rooms = {};

/**
 * Replay groups:
 * groupId -> { hostRoomId, playersWanted:Set(socketId) }
 */
const replayGroups = {};

// ==========================================================
// PLAYER OBJECT
// ==========================================================
function createDefaultPlayer(socketId, name, isHost = false) {
  return {
    id: socketId,
    name: (name || "Pilot").substring(0, 14),

    isHost: !!isHost,

    // game state
    hp: 100,
    alive: true,
    respawnAt: 0,

    rings: 0,
    kills: 0,
    deaths: 0,
    score: 0,

    // transform
    p: { x: 0, y: 250, z: 0 },
    q: { x: 0, y: 0, z: 0, w: 1 },

    lastTransformAt: nowMs(),
    connected: true
  };
}

// ==========================================================
// SNAPSHOTS
// ==========================================================
function roomSnapshot(room) {
  return {
    t: "STATE",
    roomId: room.id,
    status: room.status,
    tick: room.tick,
    time: nowMs(),
    seed: room.seed,
    rules: MP_RULES,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      hp: p.hp,
      alive: p.alive,
      rings: p.rings,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      p: p.p,
      q: p.q
    })),
    bullets: room.bullets.map((b) => ({
      id: b.id,
      ownerId: b.ownerId,
      createdAt: b.createdAt,
      p: b.p,
      q: b.q
    }))
  };
}

function emitLobbyUpdate(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  io.to(roomId).emit("mp_lobby_update", {
    roomId,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      hp: p.hp,
      rings: p.rings,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score
    }))
  });
}

function computeWinner(room) {
  let best = null;

  for (const p of room.players) {
    if (!best) best = p;
    else {
      // primary rings, secondary score
      if (p.rings > best.rings) best = p;
      else if (p.rings === best.rings && p.score > best.score) best = p;
    }
  }

  return best ? best.name : "Pilot";
}

function computeStats(room) {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    rings: p.rings,
    kills: p.kills,
    deaths: p.deaths,
    score: p.score
  }));
}

// ==========================================================
// ROOM CREATE/DELETE
// ==========================================================
function makeRoom() {
  // ensure unique
  let id = makeRoomId();
  while (rooms[id]) id = makeRoomId();

  return {
    id,
    hostId: null,
    status: "lobby",
    seed: Math.floor(Math.random() * 100000),

    tick: 0,
    createdAt: nowMs(),

    players: [],
    bullets: [],

    replayGroupId: null
  };
}

function deleteRoom(roomId) {
  if (!rooms[roomId]) return;
  delete rooms[roomId];
  console.log(`[ROOM] Deleted room ${roomId}`);
}

// ==========================================================
// GAME OVER
// ==========================================================
function endGame(room, winnerName = null) {
  if (!room) return;
  room.status = "finished";

  const winner = winnerName || computeWinner(room);
  const stats = computeStats(room);

  io.to(room.id).emit("mp_game_over", {
    winner,
    stats
  });

  console.log(`[ROOM] ${room.id} finished. Winner: ${winner}`);
}

// ==========================================================
// TICK LOOP
// ==========================================================
setInterval(() => {
  const t = nowMs();

  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (!room) continue;

    if (room.status !== "playing") continue;

    room.tick++;

    // bullets cleanup
    room.bullets = room.bullets.filter((b) => (t - b.createdAt) < MP_RULES.BULLET_LIFETIME_MS);

    // respawn check
    for (const p of room.players) {
      if (!p.alive && p.respawnAt > 0 && t >= p.respawnAt) {
        p.hp = 100;
        p.alive = true;
        p.respawnAt = 0;

        io.to(room.id).emit("mp_event", {
          t: "EVENT",
          type: "RESPAWN",
          id: p.id
        });

        io.to(p.id).emit("mp_damage", { victimId: p.id, hp: p.hp });

        console.log(`[RESPAWN] ${p.name} in room ${room.id}`);
      }
    }

    // broadcast snapshot
    io.to(roomId).emit("mp_state", roomSnapshot(room));
  }
}, TICK_INTERVAL_MS);

// ==========================================================
// SOCKET EVENTS
// ==========================================================
io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  socket.emit("mp_welcome", { id: socket.id });

  // ----------------------------------
  // CREATE ROOM
  // ----------------------------------
  socket.on("mp_create_room", ({ name }) => {
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
      seed: room.seed,
      rules: MP_RULES
    });

    emitLobbyUpdate(room.id);

    console.log(`[ROOM] Created ${room.id} by ${socket.id}`);
  });

  // ----------------------------------
  // JOIN ROOM
  // ----------------------------------
  socket.on("mp_join_room", ({ roomId, name }) => {
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
      seed: room.seed,
      rules: MP_RULES
    });

    emitLobbyUpdate(rId);

    console.log(`[ROOM] ${socket.id} joined ${rId}`);
  });

  // ----------------------------------
  // LEAVE ROOM (manual)
  // ----------------------------------
  socket.on("mp_leave_room", ({ roomId }) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];
    if (!room) return;

    // remove player
    const idx = room.players.findIndex((p) => p.id === socket.id);
    if (idx === -1) return;

    const wasHost = room.hostId === socket.id;

    room.players.splice(idx, 1);
    socket.leave(rId);

    io.to(rId).emit("mp_event", { t: "EVENT", type: "PLAYER_LEFT", id: socket.id });
    emitLobbyUpdate(rId);

    // host migration
    if (wasHost && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players.forEach((p) => (p.isHost = false));
      room.players[0].isHost = true;

      emitLobbyUpdate(rId);
    }

    // empty room delete
    if (room.players.length === 0) deleteRoom(rId);

    console.log(`[ROOM] ${socket.id} left ${rId}`);
  });

  // ----------------------------------
  // START GAME (host only)
  // ----------------------------------
  socket.on("mp_start_game", ({ roomId }) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];
    if (!room) return;

    if (room.hostId !== socket.id) return;
    if (room.status !== "lobby") return;

    room.status = "playing";
    room.tick = 0;

    // reset HP/alive only (rings+score stays if re-start in same lobby? Here new game start => keep scoreboard? You want persistent? We'll keep rings reset only at game start)
    room.players.forEach((p) => {
      p.hp = 100;
      p.alive = true;
      p.respawnAt = 0;
      p.rings = 0;
      p.kills = 0;
      p.deaths = 0;
      p.score = 0;
    });

    io.to(rId).emit("mp_game_start", {
      seed: room.seed,
      tickRate: SERVER_TICK_RATE,
      rules: MP_RULES
    });

    emitLobbyUpdate(rId);

    console.log(`[ROOM] ${rId} started by host ${socket.id}`);
  });

  // ----------------------------------
  // TRANSFORM (semi-authoritative)
  // ----------------------------------
  socket.on("mp_transform", (data) => {
    if (!data || !data.roomId) return;

    const rId = String(data.roomId).toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const p = room.players.find((pp) => pp.id === socket.id);
    if (!p) return;
    if (!p.alive) return;

    const pos = data.p;
    const quat = data.q;

    if (pos && typeof pos.x === "number") {
      // clamp safe bounds
      p.p = {
        x: clamp(pos.x, -100000, 100000),
        y: clamp(pos.y, 0, 5000),
        z: clamp(pos.z, -100000, 100000)
      };
      p.lastTransformAt = nowMs();
    }

    if (quat && typeof quat.w === "number") {
      p.q = quat;
    }
  });

  // ----------------------------------
  // FIRE (authoritative bullet list)
  // ----------------------------------
  socket.on("mp_fire", (data) => {
    if (!data || !data.roomId) return;

    const rId = String(data.roomId).toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const shooter = room.players.find((p) => p.id === socket.id);
    if (!shooter || !shooter.alive) return;

    const bulletId = Math.random().toString(36).substring(2, 10);

    const p = data.p || shooter.p;
    const q = data.q || shooter.q;

    room.bullets.push({
      id: bulletId,
      ownerId: socket.id,
      createdAt: nowMs(),
      p: {
        x: clamp(p.x, -100000, 100000),
        y: clamp(p.y, 0, 5000),
        z: clamp(p.z, -100000, 100000)
      },
      q
    });

    // broadcast fire event for SFX
    io.to(rId).emit("mp_event", { t: "EVENT", type: "FIRE", ownerId: socket.id });
  });

  // ----------------------------------
  // HIT REPORT (client -> server)
  // Server decides damage & kill
  // ----------------------------------
  socket.on("mp_hit", (data) => {
    if (!data || !data.roomId) return;

    const rId = String(data.roomId).toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const attackerId = data.attackerId;
    const victimId = data.victimId;

    if (!attackerId || !victimId) return;
    if (attackerId !== socket.id) return; // anti spoof
    if (attackerId === victimId) return;

    const attacker = room.players.find((p) => p.id === attackerId);
    const victim = room.players.find((p) => p.id === victimId);
    if (!attacker || !victim) return;

    if (!attacker.alive) return;
    if (!victim.alive) return;

    const damage = MP_RULES.BULLET_DAMAGE;

    victim.hp -= damage;

    // send updated hp to victim immediately
    io.to(victim.id).emit("mp_damage", { victimId: victim.id, hp: victim.hp });

    // kill?
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = nowMs() + MP_RULES.RESPAWN_DELAY_MS;

      attacker.kills++;
      attacker.score += MP_RULES.SCORE_KILL;

      io.to(rId).emit("mp_event", {
        t: "EVENT",
        type: "KILL",
        attackerId: attacker.id,
        victimId: victim.id
      });

      // broadcast updated stats quickly
      io.to(rId).emit("mp_score_update", {
        id: attacker.id,
        rings: attacker.rings,
        kills: attacker.kills,
        deaths: attacker.deaths,
        score: attacker.score
      });
      io.to(rId).emit("mp_score_update", {
        id: victim.id,
        rings: victim.rings,
        kills: victim.kills,
        deaths: victim.deaths,
        score: victim.score
      });

      console.log(`[KILL] ${attacker.name} killed ${victim.name} in room ${rId}`);
    }
  });

  // ----------------------------------
  // RING CLAIM (sequential)
  // ----------------------------------
  socket.on("mp_claim_ring", ({ roomId, ringIndex }) => {
    const rId = String(roomId || "").toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== "playing") return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || !player.alive) return;

    // sequential: expected ring = player.rings
    const expectedIndex = player.rings;
    if (ringIndex !== expectedIndex) return;

    player.rings++;
    player.score += MP_RULES.SCORE_RING;

    io.to(rId).emit("mp_score_update", {
      id: player.id,
      rings: player.rings,
      kills: player.kills,
      deaths: player.deaths,
      score: player.score
    });

    // win?
    const totalRingsToWin = MP_RULES.RINGS_PER_LAP * MP_RULES.TOTAL_LAPS_TO_WIN;
    if (player.rings >= totalRingsToWin) {
      endGame(room, player.name);
    }
  });

  // ----------------------------------
  // REPLAY REQUEST
  // First player creates new room -> others auto join
  // ----------------------------------
  socket.on("mp_replay", ({ roomId }) => {
    const rId = String(roomId || "").toUpperCase();
    const oldRoom = rooms[rId];
    if (!oldRoom) return;

    // create group id if not exists
    if (!oldRoom.replayGroupId) {
      oldRoom.replayGroupId = Math.random().toString(36).substring(2, 9);
      replayGroups[oldRoom.replayGroupId] = {
        hostRoomId: null,
        playersWanted: new Set()
      };
    }

    const group = replayGroups[oldRoom.replayGroupId];
    if (!group) return;

    group.playersWanted.add(socket.id);

    // if host room already exists -> force join
    if (group.hostRoomId) {
      socket.emit("mp_replay_join", { roomId: group.hostRoomId });
      return;
    }

    // first replay caller becomes host creator
    // create new room instantly
    const newRoom = makeRoom();
    newRoom.hostId = socket.id;

    const oldPlayer = oldRoom.players.find((p) => p.id === socket.id);
    const playerName = oldPlayer?.name || "Pilot";

    const newPlayer = createDefaultPlayer(socket.id, playerName, true);
    newRoom.players.push(newPlayer);

    rooms[newRoom.id] = newRoom;
    socket.join(newRoom.id);

    group.hostRoomId = newRoom.id;

    socket.emit("mp_room_created", {
      roomId: newRoom.id,
      players: newRoom.players,
      isHost: true,
      hostId: newRoom.hostId,
      seed: newRoom.seed,
      rules: MP_RULES
    });

    emitLobbyUpdate(newRoom.id);

    // tell other replay players to join this room
    for (const pid of group.playersWanted.values()) {
      if (pid === socket.id) continue;
      io.to(pid).emit("mp_replay_join", { roomId: newRoom.id });
    }

    console.log(`[REPLAY] New lobby ${newRoom.id} created by ${socket.id}`);
  });

  // ----------------------------------
  // DISCONNECT
  // ----------------------------------
  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] ${socket.id}`);

    // remove from any room
    for (const rId in rooms) {
      const room = rooms[rId];
      if (!room) continue;

      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      const wasHost = room.hostId === socket.id;

      room.players.splice(idx, 1);

      io.to(rId).emit("playerDisconnected", socket.id);
      io.to(rId).emit("mp_event", { t: "EVENT", type: "PLAYER_LEFT", id: socket.id });

      // delete empty rooms
      if (room.players.length === 0) {
        deleteRoom(rId);
        break;
      }

      // host migration
      if (wasHost) {
        room.hostId = room.players[0].id;
        room.players.forEach((p) => (p.isHost = false));
        room.players[0].isHost = true;

        emitLobbyUpdate(rId);
      } else {
        emitLobbyUpdate(rId);
      }

      break;
    }
  });
});

// ==========================================================
// START SERVER
// ==========================================================
server.listen(PORT, () => {
  console.log(`✅ Server Running on Port: ${PORT}`);
  console.log(`📂 Public Folder: '${staticFolderName}'`);
});
