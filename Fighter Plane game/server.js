// server.js (FINAL MULTIPLAYER SERVER - Render Ready)
// ---------------------------------------------------
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// ✅ Render uses process.env.PORT
const PORT = process.env.PORT || 10000;

// ✅ PUBLIC folder path
const PUBLIC_DIR = path.join(__dirname, "public");

// ✅ Serve static files
app.use(express.static(PUBLIC_DIR));

// ✅ IMPORTANT: Fix "Cannot GET /"
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Optional: Health check endpoint (useful on Render)
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ------------------------------
// ROOM STATE STORAGE
// rooms = Map(roomId => { players: Map(socketId => playerState) })
// ------------------------------
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { players: new Map() });
  }
  return rooms.get(roomId);
}

function sanitizeRoom(room) {
  room = String(room || "room1").trim();
  if (!room) room = "room1";
  return room.slice(0, 20);
}

function sanitizeName(name) {
  name = String(name || "PLAYER").trim();
  if (!name) name = "PLAYER";
  return name.slice(0, 16);
}

function defaultPlayerState(id, name) {
  return {
    playerId: id, // ✅ IMPORTANT: client uses playerId
    name,
    x: 0,
    y: 400,
    z: 800,

    // ✅ both supported
    rotation: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },

    health: 100,
    boost: 100,
    rings: 0,
    ts: Date.now(),
  };
}

io.on("connection", (socket) => {
  console.log("🟢 connected:", socket.id);

  // ✅ Your lobby system uses mp_create_room/mp_join_room events
  // So we add those along with joinRoom for compatibility
  function joinRoomInternal(roomId, name, isHostFlag = false) {
    roomId = sanitizeRoom(roomId);
    name = sanitizeName(name);

    if (socket.data.roomId) socket.leave(socket.data.roomId);

    socket.data.roomId = roomId;
    socket.data.name = name;

    socket.join(roomId);

    const room = getRoom(roomId);

    // create player
    const player = defaultPlayerState(socket.id, name);
    player.isHost = isHostFlag;

    room.players.set(socket.id, player);

    // send current players to this socket
    const playersObj = {};
    room.players.forEach((p, id) => (playersObj[id] = p));
    socket.emit("currentPlayers", playersObj);

    // broadcast new player
    socket.to(roomId).emit("newPlayer", player);

    // broadcast lobby update (optional)
    const playersList = [];
    room.players.forEach((p) => {
      playersList.push({ name: p.name, isHost: !!p.isHost });
    });

    io.to(roomId).emit("mp_lobby_update", {
      roomId,
      hostId: getHostId(room),
      players: playersList,
    });

    console.log(`✅ ${socket.id} joined room=${roomId} name=${name}`);
  }

  function getHostId(room) {
    let hostId = null;
    room.players.forEach((p, id) => {
      if (p.isHost && !hostId) hostId = id;
    });
    // fallback: first player becomes host
    if (!hostId) hostId = room.players.keys().next().value || null;
    return hostId;
  }

  // ------------------------------
  // ✅ Compatibility 1: OLD event
  // ------------------------------
  socket.on("joinRoom", ({ room, name }) => {
    joinRoomInternal(room || "room1", name || "PLAYER", false);
  });

  // ------------------------------
  // ✅ Multiplayer Lobby Events (your frontend uses these)
  // ------------------------------
  socket.on("mp_create_room", ({ name }) => {
    const roomId = Math.random().toString(36).slice(2, 6);
    joinRoomInternal(roomId, name, true);

    const room = getRoom(roomId);
    const hostId = getHostId(room);

    const players = [];
    room.players.forEach((p) => players.push({ name: p.name, isHost: !!p.isHost }));

    socket.emit("mp_room_created", { roomId, players, hostId });
  });

  socket.on("mp_join_room", ({ roomId, name }) => {
    if (!roomId) return socket.emit("mp_error", "Room code missing");

    joinRoomInternal(roomId, name, false);

    const room = getRoom(roomId);
    const hostId = getHostId(room);

    const players = [];
    room.players.forEach((p) => players.push({ name: p.name, isHost: !!p.isHost }));

    socket.emit("mp_room_joined", { roomId, players, hostId });
  });

  socket.on("mp_leave_room", ({ roomId }) => {
    const rid = socket.data.roomId;
    if (!rid) return;

    socket.leave(rid);
    const room = rooms.get(rid);

    if (room) {
      room.players.delete(socket.id);
      socket.to(rid).emit("playerDisconnected", socket.id);

      if (room.players.size === 0) rooms.delete(rid);
      else {
        // fix host if host left
        const hostId = getHostId(room);
        const players = [];
        room.players.forEach((p) => players.push({ name: p.name, isHost: !!p.isHost }));
        io.to(rid).emit("mp_lobby_update", { roomId: rid, players, hostId });
      }
    }

    socket.data.roomId = null;
    socket.data.name = null;
  });

  socket.on("mp_start_game", ({ roomId }) => {
    const rid = socket.data.roomId;
    if (!rid || rid !== roomId) return;

    // only host can start
    const room = getRoom(rid);
    const hostId = getHostId(room);
    if (socket.id !== hostId) return;

    io.to(rid).emit("mp_game_starting");
  });

  // ------------------------------
  // ✅ Movement update
  // ------------------------------
  socket.on("playerMovement", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    const p = room.players.get(socket.id);
    if (!p) return;

    if (typeof data?.x !== "number") return;
    if (typeof data?.y !== "number") return;
    if (typeof data?.z !== "number") return;

    p.x = data.x;
    p.y = data.y;
    p.z = data.z;

    // ✅ allow quaternion sync (your frontend uses quaternion)
    if (data.quaternion && typeof data.quaternion === "object") {
      p.quaternion = {
        x: Number(data.quaternion.x) || 0,
        y: Number(data.quaternion.y) || 0,
        z: Number(data.quaternion.z) || 0,
        w: Number(data.quaternion.w) || 1,
      };
    }

    // ✅ allow rotation sync fallback
    if (data.rotation && typeof data.rotation === "object") {
      p.rotation = {
        x: Number(data.rotation.x) || 0,
        y: Number(data.rotation.y) || 0,
        z: Number(data.rotation.z) || 0,
      };
    }

    if (typeof data.health === "number") p.health = data.health;
    if (typeof data.boost === "number") p.boost = data.boost;
    if (typeof data.rings === "number") p.rings = data.rings;

    p.ts = Date.now();

    // ✅ send in format frontend expects
    socket.to(roomId).emit("playerMoved", {
      playerId: socket.id, // ✅ client expects playerId
      x: p.x,
      y: p.y,
      z: p.z,
      quaternion: p.quaternion, // ✅ preferred
      rotation: p.rotation,     // ✅ fallback
      health: p.health,
      boost: p.boost,
      rings: p.rings,
      name: p.name,
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    console.log("🔴 disconnected:", socket.id, "room=", roomId);

    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);

    socket.to(roomId).emit("playerDisconnected", socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomId);
    } else {
      // host update if needed
      const hostId = getHostId(room);
      const players = [];
      room.players.forEach((p) => players.push({ name: p.name, isHost: !!p.isHost }));
      io.to(roomId).emit("mp_lobby_update", { roomId, players, hostId });
    }
  });
});

server.listen(PORT, () => {
  console.log("✅ Multiplayer server running on port:", PORT);
});
