const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: { origin: "*" } 
});
const path = require('path');
const fs = require('fs');

/**
 * SKY PILOT - UPDATED SERVER
 * FIX: Ring validation logic and timestamp passthrough for interpolation.
 */

// --- PATH CONFIGURATION ---
const publicPath = path.resolve(__dirname, 'Public');

// --- SERVER SETUP ---
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    const filePath = path.join(publicPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        console.error("CRITICAL ERROR: index.html not found at:", filePath);
        res.status(404).send(`<h1>Error 404: Main Menu Not Found</h1><p>Path: ${filePath}</p>`);
    }
});

// --- GAME STATE ---
let rooms = {}; 
const KIT_RESPAWN_TIME = 30000;
// ✅ FIX: Separate constants for lap logic vs win logic
const RINGS_PER_LAP = 12;
const TOTAL_RINGS_TO_WIN = 12; 

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // 1. CREATE ROOM
    socket.on('mp_create_room', ({ name }) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        rooms[roomId] = { 
            hostId: socket.id, 
            players: [],
            kits: [true, true, true],
            status: 'lobby',
            seed: Math.floor(Math.random() * 100000)
        };

        const playerObj = { id: socket.id, name: name || "Player", isHost: true, rings: 0 };
        rooms[roomId].players.push(playerObj);
        
        socket.join(roomId);
        socket.emit('mp_room_created', { roomId, players: rooms[roomId].players, hostId: socket.id });
    });

    // 2. JOIN ROOM
    socket.on('mp_join_room', ({ roomId, name }) => {
        const cleanRoomId = (roomId || "").toUpperCase();
        const room = rooms[cleanRoomId];
        
        if (room && room.status === 'lobby') {
            // ✅ FIX: Prevent duplicate joins
            if(room.players.some(p => p.id === socket.id)) return;

            const playerObj = { id: socket.id, name: name || "Player", isHost: false, rings: 0 };
            room.players.push(playerObj);
            
            socket.join(cleanRoomId);
            socket.emit('mp_room_joined', { roomId: cleanRoomId, players: room.players, hostId: room.hostId });
            
            // Send existing players to the newcomer
            let currentPlayersObj = {};
            room.players.forEach(p => {
                if(p.id !== socket.id) {
                    currentPlayersObj[p.id] = {
                        playerId: p.id,
                        name: p.name,
                        rings: p.rings,
                        x: 0, y: 400, z: 0 
                    };
                }
            });
            socket.emit('currentPlayers', currentPlayersObj);

            // Notify others about the new player
            socket.to(cleanRoomId).emit('newPlayer', { 
                playerId: socket.id, 
                name: name || "Player",
                rings: 0,
                x: 0, y: 400, z: 0
            });
            
            io.to(cleanRoomId).emit('mp_lobby_update', { roomId: cleanRoomId, players: room.players, hostId: room.hostId });
        } else {
            socket.emit('mp_error', 'Room not found or game already started!');
        }
    });

    // 3. START GAME
    socket.on('mp_start_game', ({ roomId, seed }) => {
        // ✅ Fix 1: Sanitize roomId casing
        const cleanRoomId = (roomId || "").toUpperCase();
        const room = rooms[cleanRoomId];
        
        if (room && room.hostId === socket.id) {
            // ✅ FIX: Prevent restarting if already playing or finished
            if (room.status !== 'lobby') return;

            room.status = 'playing';
            
            // ✅ Reset player stats if room reused
            room.players.forEach(p => p.rings = 0);
            
            // ✅ Reset kits state on restart
            room.kits = room.kits.map(() => true);

            io.to(cleanRoomId).emit('mp_game_starting', { seed: seed || room.seed });
        }
    });

    // 4. MOVEMENT SYNC
    socket.on('playerMovement', (movementData) => {
        // ✅ Fix 1: Sanitize roomId casing for movement
        const cleanRoomId = (movementData.roomId || "").toUpperCase();
        
        // ✅ Fix 3: Ensure room exists and is playing
        if (cleanRoomId && rooms[cleanRoomId] && rooms[cleanRoomId].status === 'playing') {
            // Relay to everyone else in the room
            socket.to(cleanRoomId).emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y,
                z: movementData.z,
                quaternion: movementData.quaternion,
                rotX: movementData.rotX,
                rotZ: movementData.rotZ,
                // Prioritize client timestamp for interpolation, fallback to server time
                ts: movementData.ts || Date.now()
            });
        }
    });

    // 5. BULLET SYNC
    socket.on('mp_player_fire', (data) => {
        const cleanRoomId = (data.roomId || "").toUpperCase();
        // ✅ Fix 3: Ensure room exists and is playing
        if (cleanRoomId && rooms[cleanRoomId] && rooms[cleanRoomId].status === 'playing') {
            // ✅ Fix A: Ensure data.roomId matches the casing used for socket.to()
            data.roomId = cleanRoomId;
            socket.to(cleanRoomId).emit('mp_player_fire', data);
        }
    });

    // 6. KIT CLAIM
    socket.on('mp_claim_kit', ({ roomId, kitIndex }) => {
        const cleanRoomId = (roomId || "").toUpperCase();
        const room = rooms[cleanRoomId];
        
        // ✅ Fix 3: Ensure room exists and is playing
        if (!room || room.status !== 'playing') return;

        // ✅ Fix 2: Validate kitIndex
        if (typeof kitIndex !== "number" || kitIndex < 0 || kitIndex >= room.kits.length) return;

        if (room.kits[kitIndex] === true) {
            room.kits[kitIndex] = false;
            io.to(cleanRoomId).emit('mp_kit_collected', { kitIndex, collectorId: socket.id });

            setTimeout(() => {
                if (rooms[cleanRoomId]) {
                    rooms[cleanRoomId].kits[kitIndex] = true;
                    io.to(cleanRoomId).emit('mp_kit_restored', { kitIndex });
                }
            }, KIT_RESPAWN_TIME);
        }
    });

    // 7. SCORE & WIN LOGIC (Updated for ringIndex validation)
    socket.on('mp_claim_ring', ({ roomId, ringIndex }) => {
        const cleanRoomId = (roomId || "").toUpperCase();
        const room = rooms[cleanRoomId];
        if (!room) return;

        // ✅ FIX: Don't allow updates if game is finished
        if (room.status !== "playing") return;

        // ✅ FIX: Validate ringIndex type safety
        if (typeof ringIndex !== "number") return;

        const player = room.players.find(p => p.id === socket.id);
        
        // ✅ Safety check: If player not found (rare), ignore
        if (!player) return;

        // ✅ FIX: Validate against lap rings, not total win rings
        const expectedIndex = player.rings % RINGS_PER_LAP;
        
        // Allow if client sends index matching our expectation (strict check for anti-cheat)
        if (ringIndex === expectedIndex) {
            player.rings++;
            
            io.to(cleanRoomId).emit('mp_score_update', { 
                playerId: socket.id, 
                rings: player.rings,
                nextRingIndex: player.rings % RINGS_PER_LAP
            });

            // Win condition
            if (player.rings >= TOTAL_RINGS_TO_WIN) { 
                io.to(cleanRoomId).emit('mp_game_over', { winnerName: player.name, winnerId: socket.id });
                room.status = 'finished';
            }
        } else {
            // ✅ Feedback for invalid ring (silent reject instead of alert to prevent lag)
            socket.emit("mp_ring_reject", { expectedIndex });
        }
    });

    // 8. DISCONNECT / LEAVE HANDLER (Refactored for efficiency)
    const handleDisconnect = (targetRoomId = null) => {
        // ✅ Fix B: If a specific roomId is provided, check only that room (optimization).
        // Otherwise, check all rooms (fallback for disconnect).
        const roomsToSearch = targetRoomId ? [targetRoomId] : Object.keys(rooms);

        for (const roomId of roomsToSearch) {
            const room = rooms[roomId];
            if (!room) continue;

            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                // ✅ Fix 2: Proper socket leave on disconnect/leave
                socket.leave(roomId);
                
                io.to(roomId).emit('playerDisconnected', socket.id);
                
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        room.players[0].isHost = true;
                    }
                    io.to(roomId).emit('mp_lobby_update', { 
                        roomId, 
                        players: room.players, 
                        hostId: room.hostId 
                    });
                }
                break; // Found the player, stop searching
            }
        }
    };

    socket.on('mp_leave_room', (payload) => {
        // ✅ Fix: Handle both {roomId} object or direct string payload safely
        const roomId = (payload && payload.roomId) ? payload.roomId : payload;
        handleDisconnect(roomId ? String(roomId).toUpperCase() : null);
    });
    
    socket.on('disconnect', () => {
        handleDisconnect(); // Search all rooms since we don't know where the player was
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ SERVER RUNNING ON PORT: ${PORT}`);
    console.log(`📂 SERVING FROM: ${publicPath}`);
});
