// server.js (FINAL MULTIPLAYER SERVER - Socket.IO + Rooms)
// ----------------------------------------------
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// serve static files (index.html in /public)
app.use(express.static(path.join(__dirname, "public")));

server.listen(PORT, () => {
  console.log("✅ Multiplayer server running on http://localhost:" + PORT);
});

// ------------------------------
// ROOM STATE STORAGE
// rooms = Map(roomId => { players: Map(socketId => playerState) })
// playerState: {id,name,x,y,z, rotation:{x,y,z}, health, boost, ts}
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
    id,
    name,
    x: 0, y: 400, z: 800,
    rotation: { x: 0, y: 0, z: 0 },
    health: 100,
    boost: 100,
    rings: 0,
    ts: Date.now()
  };
}

io.on("connection", (socket) => {
  console.log("🟢 connected:", socket.id);

  socket.on("joinRoom", ({ room, name }) => {
    room = sanitizeRoom(room);
    name = sanitizeName(name);

    // leave previous room if any
    if (socket.data.room) {
      socket.leave(socket.data.room);
    }

    socket.data.room = room;
    socket.data.name = name;

    socket.join(room);

    const r = getRoom(room);

    // create player in room
    const player = defaultPlayerState(socket.id, name);
    r.players.set(socket.id, player);

    // send currentPlayers to this socket
    const playersObj = {};
    r.players.forEach((p, id) => { playersObj[id] = p; });

    socket.emit("currentPlayers", playersObj);

    // broadcast newPlayer in room
    socket.to(room).emit("newPlayer", { id: socket.id, player });

    console.log(`✅ ${socket.id} joined room=${room} name=${name}`);
  });

  // movement update
  socket.on("playerMovement", (data) => {
    const room = socket.data.room;
    if (!room) return;

    const r = getRoom(room);
    const p = r.players.get(socket.id);
    if (!p) return;

    // validate numeric
    if (typeof data?.x !== "number") return;
    if (typeof data?.y !== "number") return;
    if (typeof data?.z !== "number") return;

    p.x = data.x;
    p.y = data.y;
    p.z = data.z;

    if (data.rotation && typeof data.rotation === "object") {
      p.rotation = {
        x: Number(data.rotation.x) || 0,
        y: Number(data.rotation.y) || 0,
        z: Number(data.rotation.z) || 0
      };
    }

    if (typeof data.health === "number") p.health = data.health;
    if (typeof data.boost === "number") p.boost = data.boost;
    if (typeof data.rings === "number") p.rings = data.rings;

    p.ts = Date.now();

    // broadcast to others in room
    socket.to(room).emit("playerMoved", {
      id: socket.id,
      x: p.x, y: p.y, z: p.z,
      rotation: p.rotation,
      health: p.health,
      boost: p.boost,
      rings: p.rings
    });
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    console.log("🔴 disconnected:", socket.id, "room=", room);

    if (room && rooms.has(room)) {
      const r = rooms.get(room);
      r.players.delete(socket.id);

      // notify others
      socket.to(room).emit("playerDisconnected", socket.id);

      // cleanup empty room
      if (r.players.size === 0) {
        rooms.delete(room);
      }
    }
  });
});
