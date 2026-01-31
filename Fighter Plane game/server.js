// ==========================================
// PATH: server.js
// ==========================================

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');

// --- 🛠️ CONFIGURATION ---
const PORT = process.env.PORT || 10000;

// --- 🔍 SMART FOLDER DETECTION ---
let staticFolderName = 'public';

if (fs.existsSync(path.join(__dirname, 'Public'))) {
    staticFolderName = 'Public';
    console.log("📂 Folder Found: 'Public' (Capital Case)");
} else if (fs.existsSync(path.join(__dirname, 'public'))) {
    staticFolderName = 'public';
    console.log("📂 Folder Found: 'public' (Lower Case)");
} else {
    console.error("❌ CRITICAL ERROR: Na 'public' folder mila, na 'Public'!");
}

const publicPath = path.join(__dirname, staticFolderName);

// --- ⚙️ LOAD CONFIG SAFELY ---
let Cfg = {};
try {
    // NOTE: In browser, game-config.js is not a Node module.
    // So require may fail. We fallback safely.
    Cfg = require(`./${staticFolderName}/game-config.js`);
    console.log("✅ Game Config Loaded Successfully");
} catch (e) {
    console.warn("⚠️ Config load failed (Using Defaults). Reason:", e.message);
    Cfg = { RINGS_PER_LAP: 4, TOTAL_RINGS_WIN: 8 };
}

// --- 🚀 SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

// Serve Static Files
app.use(express.static(publicPath));

// Root route
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send("Error: index.html not found! Check folder structure.");
});


// ==========================================================
// ✅ MULTIPLAYER SERVER (Authoritative Rooms + Tick Broadcast)
// ==========================================================

const SERVER_TICK_RATE = 20;              // 20 updates/sec
const TICK_INTERVAL_MS = 1000 / SERVER_TICK_RATE;

const MAX_PLAYERS_PER_ROOM = 8;

// World state per room
let rooms = {};  // roomId -> room object


function makeRoomId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function nowMs() {
    return Date.now();
}

function createDefaultPlayer(socketId, name, isHost) {
    return {
        id: socketId,
        name: (name || "Pilot").substring(0, 12),
        isHost: !!isHost,

        // gameplay
        hp: 100,
        score: 0,
        rings: 0,

        // authoritative position
        p: { x: 0, y: 250, z: 0 },
        q: { x: 0, y: 0, z: 0, w: 1 },

        // last input
        input: {
            pitch: 0,
            roll: 0,
            yaw: 0,
            boost: false,
            brake: false,
            fire: false
        },

        // timing
        lastInputAt: nowMs(),
        connected: true
    };
}

function getRoomConfig() {
    const RINGS_PER_LAP = (Cfg.SKY_CONFIG ? Cfg.SKY_CONFIG.RINGS_PER_LAP : Cfg.RINGS_PER_LAP) || 4;
    const TOTAL_RINGS_WIN = (Cfg.SKY_CONFIG ? Cfg.SKY_CONFIG.TOTAL_RINGS_WIN : Cfg.TOTAL_RINGS_WIN) || 8;
    return { RINGS_PER_LAP, TOTAL_RINGS_WIN };
}

function makeRoom() {
    const roomId = makeRoomId();
    return {
        id: roomId,
        hostId: null,
        status: "lobby", // lobby | playing | finished
        seed: Math.floor(Math.random() * 100000),

        // server tick
        tick: 0,
        lastTickAt: nowMs(),

        // gameplay objects
        players: [],

        // optional server bullets
        bullets: []
    };
}

function roomSnapshot(room) {
    return {
        t: "STATE",
        roomId: room.id,
        status: room.status,
        tick: room.tick,
        time: nowMs(),
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            hp: p.hp,
            score: p.score,
            rings: p.rings,
            p: p.p,
            q: p.q
        })),
        bullets: room.bullets
    };
}

function emitLobbyUpdate(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit("mp_lobby_update", {
        roomId,
        hostId: room.hostId,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            rings: p.rings,
            hp: p.hp,
            score: p.score
        }))
    });
}


// ==========================================================
// ✅ TICK LOOP (authoritative server simulation)
// ==========================================================

setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (!room) continue;

        if (room.status !== "playing") continue;

        room.tick++;

        // Basic authoritative update:
        // Server currently only TRUSTS client positions via events,
        // but you can replace this with true physics later.

        // Cleanup bullets (optional)
        const t = nowMs();
        room.bullets = room.bullets.filter(b => (t - b.createdAt) < 2000);

        // Broadcast world snapshot
        io.to(roomId).emit("mp_state", roomSnapshot(room));
    }
}, TICK_INTERVAL_MS);


// ==========================================================
// ✅ SOCKET.IO EVENTS
// ==========================================================

io.on('connection', (socket) => {
    console.log(`[CONNECT] User: ${socket.id}`);

    socket.emit("mp_welcome", { id: socket.id });

    // ----------------------------
    // Create Room
    // ----------------------------
    socket.on('mp_create_room', ({ name }) => {
        const room = makeRoom();
        room.hostId = socket.id;

        const player = createDefaultPlayer(socket.id, name, true);
        room.players.push(player);

        rooms[room.id] = room;

        socket.join(room.id);

        socket.emit('mp_room_created', {
            roomId: room.id,
            players: room.players,
            isHost: true,
            hostId: room.hostId,
            seed: room.seed
        });

        console.log(`[ROOM] Created ${room.id} by ${socket.id}`);
    });

    // ----------------------------
    // Join Room
    // ----------------------------
    socket.on('mp_join_room', ({ roomId, name }) => {
        const rId = String(roomId || "").toUpperCase();
        const room = rooms[rId];

        if (!room) {
            socket.emit('mp_error', { msg: "Room not found." });
            return;
        }
        if (room.status !== "lobby") {
            socket.emit('mp_error', { msg: "Game already started." });
            return;
        }
        if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
            socket.emit('mp_error', { msg: "Room full." });
            return;
        }

        const player = createDefaultPlayer(socket.id, name, false);
        room.players.push(player);

        socket.join(rId);

        socket.emit('mp_room_joined', {
            roomId: rId,
            players: room.players,
            hostId: room.hostId,
            seed: room.seed
        });

        emitLobbyUpdate(rId);

        console.log(`[ROOM] ${socket.id} joined ${rId}`);
    });

    // ----------------------------
    // Start Game (host only)
    // ----------------------------
    socket.on('mp_start_game', ({ roomId }) => {
        const rId = String(roomId || "").toUpperCase();
        const room = rooms[rId];
        if (!room) return;

        if (room.hostId !== socket.id) return;

        room.status = 'playing';
        room.players.forEach(p => {
            p.rings = 0;
            p.hp = 100;
            p.score = 0;
        });

        io.to(rId).emit('mp_game_start', {
            seed: room.seed,
            tickRate: SERVER_TICK_RATE
        });

        console.log(`[ROOM] ${rId} started by host ${socket.id}`);
    });

    // ----------------------------
    // Player Transform Sync (from client)
    // The client should send:
    // { roomId, p:{x,y,z}, q:{x,y,z,w} }
    // ----------------------------
    socket.on('mp_transform', (data) => {
        if (!data || !data.roomId) return;

        const rId = String(data.roomId).toUpperCase();
        const room = rooms[rId];
        if (!room || room.status !== "playing") return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const p = data.p;
        const q = data.q;

        // minimal validation (anti teleport)
        if (p && typeof p.x === "number") {
            // clamp altitude & world bounds
            player.p = {
                x: clamp(p.x, -100000, 100000),
                y: clamp(p.y, 0, 5000),
                z: clamp(p.z, -100000, 100000)
            };
        }

        if (q && typeof q.w === "number") {
            player.q = q;
        }
    });

    // ----------------------------
    // Input Sync (Optional)
    // { roomId, input:{pitch,roll,yaw,boost,brake,fire} }
    // ----------------------------
    socket.on('mp_input', (data) => {
        if (!data || !data.roomId) return;

        const rId = String(data.roomId).toUpperCase();
        const room = rooms[rId];
        if (!room || room.status !== "playing") return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        player.input = data.input || player.input;
        player.lastInputAt = nowMs();
    });

    // ----------------------------
    // Fire (server spawns bullet in authoritative list)
    // { roomId, p:{x,y,z}, q:{x,y,z,w} }
    // ----------------------------
    socket.on('mp_fire', (data) => {
        if (!data || !data.roomId) return;

        const rId = String(data.roomId).toUpperCase();
        const room = rooms[rId];
        if (!room || room.status !== "playing") return;

        // store bullet in room state
        const bulletId = Math.random().toString(36).substring(2, 10);
        room.bullets.push({
            id: bulletId,
            ownerId: socket.id,
            createdAt: nowMs(),
            p: data.p || { x: 0, y: 0, z: 0 },
            q: data.q || { x: 0, y: 0, z: 0, w: 1 }
        });

        // small event for SFX
        io.to(rId).emit("mp_event", { t: "EVENT", type: "FIRE", ownerId: socket.id });
    });

    // ----------------------------
    // Rings claim (race logic)
    // ----------------------------
    socket.on('mp_claim_ring', ({ roomId, ringIndex }) => {
        const rId = String(roomId || "").toUpperCase();
        const room = rooms[rId];
        if (!room || room.status !== "playing") return;

        const { RINGS_PER_LAP, TOTAL_RINGS_WIN } = getRoomConfig();

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const expectedIndex = player.rings % RINGS_PER_LAP;
        if (ringIndex !== expectedIndex) return;

        player.rings++;

        io.to(rId).emit('mp_score_update', { id: socket.id, rings: player.rings });

        if (player.rings >= TOTAL_RINGS_WIN) {
            room.status = "finished";
            io.to(rId).emit('mp_game_over', { winner: player.name });
        }
    });

    // ----------------------------
    // Disconnect handler
    // ----------------------------
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] ${socket.id}`);

        for (const rId in rooms) {
            const room = rooms[rId];
            const idx = room.players.findIndex(p => p.id === socket.id);

            if (idx !== -1) {
                const wasHost = room.hostId === socket.id;

                room.players.splice(idx, 1);

                // empty room delete
                if (room.players.length === 0) {
                    delete rooms[rId];
                    console.log(`[ROOM] Deleted empty room ${rId}`);
                    break;
                }

                // host migration
                if (wasHost) {
                    room.hostId = room.players[0].id;
                    room.players.forEach(p => p.isHost = false);
                    room.players[0].isHost = true;
                }

                emitLobbyUpdate(rId);
                io.to(rId).emit('playerDisconnected', socket.id);

                break;
            }
        }
    });
});


// ==========================================================
// ✅ START
// ==========================================================

server.listen(PORT, () => {
    console.log(`✅ Server Running on Port: ${PORT}`);
    console.log(`📂 Auto-detected Public Folder: '${staticFolderName}'`);
});
