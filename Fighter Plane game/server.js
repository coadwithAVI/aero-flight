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
// Ye logic check karega ki folder 'public' hai ya 'Public'
let staticFolderName = 'public'; // Default fallback

// Check if 'Public' (Capital) exists
if (fs.existsSync(path.join(__dirname, 'Public'))) {
    staticFolderName = 'Public';
    console.log("📂 Folder Found: 'Public' (Capital Case)");
} 
// Check if 'public' (Lower) exists
else if (fs.existsSync(path.join(__dirname, 'public'))) {
    staticFolderName = 'public';
    console.log("📂 Folder Found: 'public' (Lower Case)");
} else {
    console.error("❌ CRITICAL ERROR: Na 'public' folder mila, na 'Public'!");
}

const publicPath = path.join(__dirname, staticFolderName);

// --- ⚙️ LOAD CONFIG SAFELY ---
let Cfg = {};
try {
    // Try loading config from the detected folder
    Cfg = require(`./${staticFolderName}/game-config.js`);
    console.log("✅ Game Config Loaded Successfully");
} catch (e) {
    console.warn("⚠️ Config load failed (Using Defaults). Reason:", e.message);
    Cfg = { RINGS_PER_LAP: 4, TOTAL_RINGS_WIN: 8 };
}

// --- 🚀 SETUP SERVER ---
const io = new Server(server, {
    cors: { origin: "*" }, 
    transports: ['websocket', 'polling']
});

// Serve Static Files (Auto-detected folder)
app.use(express.static(publicPath));

// Route for root
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Error: index.html not found! Check folder structure.");
    }
});

// --- 💾 GAME STATE ---
let rooms = {}; 

io.on('connection', (socket) => {
    console.log(`[CONNECT] User: ${socket.id}`);

    socket.on('mp_create_room', ({ name }) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomId] = { 
            id: roomId,
            hostId: socket.id, 
            players: [],
            status: 'lobby',
            seed: Math.floor(Math.random() * 100000) 
        };
        const player = { id: socket.id, name: (name || "Player").substring(0, 12), isHost: true, rings: 0 };
        rooms[roomId].players.push(player);
        socket.join(roomId);
        socket.emit('mp_room_created', { roomId, players: rooms[roomId].players, isHost: true });
    });

    socket.on('mp_join_room', ({ roomId, name }) => {
        const rId = (roomId || "").toUpperCase();
        const room = rooms[rId];
        if (room && room.status === 'lobby') {
            const player = { id: socket.id, name: (name || "Wingman").substring(0, 12), isHost: false, rings: 0 };
            room.players.push(player);
            socket.join(rId);
            socket.emit('mp_room_joined', { roomId: rId, players: room.players, hostId: room.hostId, seed: room.seed });
            socket.to(rId).emit('mp_lobby_update', { players: room.players });
        } else {
            socket.emit('mp_error', { msg: "Room not found or game started." });
        }
    });

    socket.on('mp_start_game', ({ roomId }) => {
        const rId = (roomId || "").toUpperCase();
        const room = rooms[rId];
        if (room && room.hostId === socket.id) {
            room.status = 'playing';
            room.players.forEach(p => p.rings = 0);
            io.to(rId).emit('mp_game_start', { seed: room.seed });
        }
    });

    socket.on('playerMovement', (data) => {
        if (data.roomId) socket.to(data.roomId).emit('playerMoved', { id: socket.id, ...data });
    });

    socket.on('mp_claim_ring', ({ roomId, ringIndex }) => {
        const rId = (roomId || "").toUpperCase();
        const room = rooms[rId];
        // Use loaded config or defaults
        const RINGS_PER_LAP = (Cfg.SKY_CONFIG ? Cfg.SKY_CONFIG.RINGS_PER_LAP : Cfg.RINGS_PER_LAP) || 4;
        const TOTAL_RINGS_WIN = (Cfg.SKY_CONFIG ? Cfg.SKY_CONFIG.TOTAL_RINGS_WIN : Cfg.TOTAL_RINGS_WIN) || 8;

        if (room && room.status === 'playing') {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                const expectedIndex = player.rings % RINGS_PER_LAP;
                if (ringIndex === expectedIndex) {
                    player.rings++;
                    io.to(rId).emit('mp_score_update', { id: socket.id, rings: player.rings });
                    if (player.rings >= TOTAL_RINGS_WIN) {
                        room.status = 'finished';
                        io.to(rId).emit('mp_game_over', { winner: player.name });
                    }
                }
            }
        }
    });

    socket.on('disconnect', () => {
        for (const rId in rooms) {
            const room = rooms[rId];
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx !== -1) {
                room.players.splice(idx, 1);
                if (room.players.length === 0) delete rooms[rId];
                else {
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        room.players[0].isHost = true;
                    }
                    io.to(rId).emit('mp_lobby_update', { players: room.players, hostId: room.hostId });
                    io.to(rId).emit('playerDisconnected', socket.id);
                }
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ Server Running on Port: ${PORT}`);
    console.log(`📂 Auto-detected Public Folder: '${staticFolderName}'`);
});
