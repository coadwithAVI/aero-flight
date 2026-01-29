const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const fs = require('fs');

// --- PATH CONFIGURATION ---
// Keeps your existing folder structure
const publicPath = path.join(__dirname, 'Public');

// --- SERVER SETUP ---
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    const filePath = path.join(publicPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send("<h1>Error 404: Index File Not Found</h1>");
    }
});

// --- GAME STATE ---
let rooms = {}; 
const RINGS_PER_LAP = 10;       // Must match client config
const KIT_RESPAWN_TIME = 30000; // 30 Seconds

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. CREATE ROOM
    socket.on('mp_create_room', ({ name }) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        rooms[roomId] = { 
            hostId: socket.id, 
            players: [],
            // Initialize 3 active repair kits
            kits: [true, true, true],
            status: 'lobby'
        };

        // Add Host with initial score (rings: 0)
        const playerObj = { id: socket.id, name: name, isHost: true, rings: 0 };
        rooms[roomId].players.push(playerObj);
        
        socket.join(roomId);
        socket.emit('mp_room_created', { roomId, players: rooms[roomId].players, hostId: socket.id });
    });

    // 2. JOIN ROOM
    socket.on('mp_join_room', ({ roomId, name }) => {
        roomId = (roomId || "").toUpperCase();
        const room = rooms[roomId];
        
        if (room && room.status === 'lobby') {
            // Add Player with initial score (rings: 0)
            const playerObj = { id: socket.id, name: name, isHost: false, rings: 0 };
            room.players.push(playerObj);
            
            socket.join(roomId);
            
            // Notify joiner
            socket.emit('mp_room_joined', { roomId, players: room.players, hostId: room.hostId });
            
            // Send current players to the new joiner
            let currentPlayersObj = {};
            room.players.forEach(p => {
                if(p.id !== socket.id) currentPlayersObj[p.id] = { playerId: p.id, ...p };
            });
            socket.emit('currentPlayers', currentPlayersObj);

            // Notify others
            socket.to(roomId).emit('newPlayer', { playerId: socket.id, name: name });
            io.to(roomId).emit('mp_lobby_update', { roomId, players: room.players, hostId: room.hostId });
        } else {
            socket.emit('mp_error', 'Room not found or game started!');
        }
    });

    // 3. START GAME (With Seed)
    socket.on('mp_start_game', ({ roomId, seed }) => {
        if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
            rooms[roomId].status = 'playing';
            // Pass the random seed to everyone so world generation is identical
            io.to(roomId).emit('mp_game_starting', { seed });
        }
    });

    // 4. MOVEMENT SYNC (With Timestamp)
    socket.on('playerMovement', (movementData) => {
        const { roomId } = movementData;
        if (roomId) {
            // Add Server Timestamp (ts) for smooth interpolation on client
            socket.to(roomId).emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y,
                z: movementData.z,
                quaternion: movementData.quaternion,
                rotX: movementData.rotX,
                rotZ: movementData.rotZ,
                ts: Date.now() // <--- Critical for Fix H
            });
        }
    });

    // 5. BULLET SYNC
    socket.on('mp_player_fire', (data) => {
        // Relay bullet event to everyone else in the room
        if (data.roomId) {
            socket.to(data.roomId).emit('mp_player_fire', data);
        }
    });

    // 6. SERVER-AUTHORITATIVE KIT CLAIM
    socket.on('mp_claim_kit', ({ roomId, kitIndex }) => {
        const room = rooms[roomId];
        // Validate room and kit index
        if (!room || kitIndex < 0 || kitIndex >= room.kits.length) return;

        // Only allow claim if kit is currently active (true)
        if (room.kits[kitIndex]) {
            room.kits[kitIndex] = false; // Mark inactive
            
            // Tell everyone kit is gone (and who got it)
            io.to(roomId).emit('mp_kit_collected', { 
                kitIndex, 
                collectorId: socket.id 
            });

            // Schedule respawn after 30 seconds
            setTimeout(() => {
                // Check if room still exists before emitting
                if (rooms[roomId]) {
                    rooms[roomId].kits[kitIndex] = true; // Reactivate
                    io.to(roomId).emit('mp_kit_restored', { kitIndex });
                }
            }, KIT_RESPAWN_TIME);
        }
    });

    // 7. SERVER-AUTHORITATIVE SCORE & WIN LOGIC
    socket.on('mp_claim_ring', ({ roomId, ringIndex }) => {
        const room = rooms[roomId];
        if (!room) return;

        // Find the player in the room
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            // Validate sequence: Is this the correct next ring?
            const expectedIndex = player.rings % RINGS_PER_LAP;
            
            if (ringIndex === expectedIndex) {
                player.rings++; // Increment score on server
                
                // Broadcast verified score to update leaderboards
                io.to(roomId).emit('mp_score_update', { 
                    playerId: socket.id, 
                    rings: player.rings,
                    nextRingIndex: player.rings % RINGS_PER_LAP
                });

                // Check Win Condition (First to 10 rings)
                if (player.rings >= 10) { 
                    io.to(roomId).emit('mp_game_over', { 
                        winnerName: player.name, 
                        winnerId: socket.id 
                    });
                }
            }
        }
    });

    // 8. DISCONNECT
    const handleDisconnect = () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                // Remove player
                room.players.splice(playerIndex, 1);
                io.to(roomId).emit('playerDisconnected', socket.id);
                
                // If room empty, delete it
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    // If Host left, assign new host
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
                break;
            }
        }
    };

    socket.on('mp_leave_room', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ SERVER RUNNING ON PORT: ${PORT}`);
});
