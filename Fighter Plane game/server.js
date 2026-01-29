const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ✅ FIX: Path resolution ko handle karne ke liye absolute path use karein
// Agar aapke folder ka naam 'Public' hai toh niche 'Public' likhein, agar 'public' hai toh 'public'
const publicPath = path.resolve(__dirname, 'Public'); 

// Static files serve karein
app.use(express.static(publicPath));

// Default route for index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
        if (err) {
            console.error("Error: index.html dhoondne mein problem ho rahi hai!");
            console.error("Path searched:", path.join(publicPath, 'index.html'));
            res.status(404).send("Main menu file (index.html) not found in Public folder.");
        }
    });
});

// --- MULTIPLAYER LOGIC ---
const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create Room
    socket.on('mp_create_room', (data) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomId] = {
            host: socket.id,
            players: [{ id: socket.id, name: data.name, isHost: true }],
            gameStarted: false,
            seed: Math.floor(Math.random() * 100000)
        };
        socket.join(roomId);
        socket.emit('mp_room_created', { roomId, players: rooms[roomId].players, hostId: socket.id });
    });

    // Join Room
    socket.on('mp_join_room', (data) => {
        const room = rooms[data.roomId];
        if (room && !room.gameStarted) {
            room.players.push({ id: socket.id, name: data.name, isHost: false });
            socket.join(data.roomId);
            io.to(data.roomId).emit('mp_lobby_update', { roomId: data.roomId, players: room.players, hostId: room.host });
        } else {
            socket.emit('error', { message: "Room not found or already started" });
        }
    });

    // Start Game
    socket.on('mp_start_game', (data) => {
        const room = rooms[data.roomId];
        if (room && socket.id === room.host) {
            room.gameStarted = true;
            io.to(data.roomId).emit('mp_game_starting', { seed: data.seed || room.seed });
        }
    });

    // Movement Sync
    socket.on('playerMovement', (data) => {
        socket.to(data.roomId).emit('playerMoved', { ...data, playerId: socket.id });
    });

    // Shooting Sync
    socket.on('mp_player_fire', (data) => {
        socket.to(data.roomId).emit('mp_player_fire', { ...data, shooterId: socket.id });
    });

    // Ring Collection Sync
    socket.on('mp_ring_collected', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            // Find player and update score (simple server-side tracking)
            io.to(data.roomId).emit('mp_score_update', { playerId: socket.id, rings: 1 }); // Simplification for now
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Room clean-up logic here (optional but recommended)
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ Multiplayer server running on port: ${PORT}`);
    console.log(`📂 Serving static files from: ${publicPath}`);
});
