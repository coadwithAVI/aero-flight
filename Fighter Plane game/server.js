const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const path = require('path');

// --- 🛠️ CONFIGURATION ---
// Render.com dynamic port use karta hai. Hardcode mat karna.
const PORT = process.env.PORT || 10000;

// Shared Config ko import karte hain taaki rules same rahein
// (Ensure game-config.js has module.exports as written in previous step)
const Cfg = require('./public/game-config.js');

// --- 🚀 SETUP SERVER & CORS ---
const io = new Server(server, {
    cors: { origin: "*" }, // Allow all connections (Dev/Prod friendly)
    transports: ['websocket', 'polling'] // Connection stability ke liye
});

// Serve Static Files (IMPORTANT: Folder name MUST be 'public' in lowercase)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Route for root
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// --- 💾 GAME STATE ---
let rooms = {}; 

io.on('connection', (socket) => {
    console.log(`[CONNECT] User: ${socket.id}`);

    // --- 1. ROOM MANAGEMENT ---
    
    socket.on('mp_create_room', ({ name }) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        rooms[roomId] = { 
            id: roomId,
            hostId: socket.id, 
            players: [],
            status: 'lobby',
            // CRITICAL: Server generates the map seed!
            seed: Math.floor(Math.random() * 100000) 
        };

        const player = { id: socket.id, name: name.substring(0, 12), isHost: true, rings: 0 };
        rooms[roomId].players.push(player);
        
        socket.join(roomId);
        socket.emit('mp_room_created', { roomId, players: rooms[roomId].players, isHost: true });
        console.log(`[ROOM] Created ${roomId} by ${name}`);
    });

    socket.on('mp_join_room', ({ roomId, name }) => {
        const rId = (roomId || "").toUpperCase();
        const room = rooms[rId];
        
        if (room && room.status === 'lobby') {
            const player = { id: socket.id, name: name.substring(0, 12), isHost: false, rings: 0 };
            room.players.push(player);
            
            socket.join(rId);
            
            // Send room info AND the Seed to the new player
            socket.emit('mp_room_joined', { 
                roomId: rId, 
                players: room.players, 
                hostId: room.hostId,
                seed: room.seed // Sync Map
            });
            
            // Notify others
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
            // Reset scores
            room.players.forEach(p => p.rings = 0);
            
            // Broadcast Start with SEED ensures everyone generates same terrain
            io.to(rId).emit('mp_game_start', { seed: room.seed });
            console.log(`[GAME] Started in ${rId}`);
        }
    });

    // --- 2. GAMEPLAY SYNC (Optimized) ---

    socket.on('playerMovement', (data) => {
        // Relay movement to others in the room, exclude sender
        // Pass through timestamp (ts) for interpolation
        if (data.roomId) {
            socket.to(data.roomId).emit('playerMoved', {
                id: socket.id,
                ...data
            });
        }
    });

    socket.on('mp_shoot', (data) => {
        if (data.roomId) {
            socket.to(data.roomId).emit('mp_remote_shoot', {
                ownerId: socket.id,
                pos: data.pos,
                quat: data.quat,
                vel: data.vel
            });
        }
    });

    // --- 3. SCORING (Server Authority) ---

    socket.on('mp_claim_ring', ({ roomId, ringIndex }) => {
        const rId = (roomId || "").toUpperCase();
        const room = rooms[rId];

        if (room && room.status === 'playing') {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                // LOGIC: Check sequence. Player cannot skip rings.
                const expectedIndex = player.rings % Cfg.RINGS_PER_LAP;
                
                if (ringIndex === expectedIndex) {
                    player.rings++;
                    
                    // Broadcast update
                    io.to(rId).emit('mp_score_update', { 
                        id: socket.id, 
                        rings: player.rings 
                    });

                    // Win Condition
                    if (player.rings >= Cfg.TOTAL_RINGS_WIN) {
                        room.status = 'finished';
                        io.to(rId).emit('mp_game_over', { winner: player.name });
                    }
                }
            }
        }
    });

    // --- 4. CLEANUP (Memory Leak Prevention) ---

    socket.on('disconnect', () => {
        // Find which room the player was in
        for (const rId in rooms) {
            const room = rooms[rId];
            const idx = room.players.findIndex(p => p.id === socket.id);
            
            if (idx !== -1) {
                room.players.splice(idx, 1);
                
                if (room.players.length === 0) {
                    // Empty room? Delete it immediately to free memory
                    delete rooms[rId];
                    console.log(`[ROOM] Deleted ${rId} (Empty)`);
                } else {
                    // Host left? Assign new host
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        room.players[0].isHost = true;
                    }
                    io.to(rId).emit('mp_lobby_update', { 
                        players: room.players, 
                        hostId: room.hostId 
                    });
                    io.to(rId).emit('playerDisconnected', socket.id);
                }
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ Server Running on Port: ${PORT}`);
    console.log(`📂 Serving files from: ${publicPath}`);
});
