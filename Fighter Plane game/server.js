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

// --- PATH CONFIGURATION ---
const publicPath = path.resolve(__dirname, 'Public');

// --- SERVER SETUP ---
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    const filePath = path.join(publicPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send(`<h1>Error 404: Main Menu Not Found</h1><p>Path: ${filePath}</p>`);
    }
});

// --- GAME STATE ---
let rooms = {}; 
const KIT_RESPAWN_TIME = 30000;
// Note: RINGS_PER_LAP server logic mein mostly win condition ke liye use hota hai
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
        if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
            rooms[roomId].status = 'playing';
            io.to(roomId).emit('mp_game_starting', { seed: seed || rooms[roomId].seed });
        }
    });

    // 4. MOVEMENT SYNC
    socket.on('playerMovement', (movementData) => {
        const { roomId } = movementData;
        if (roomId && rooms[roomId]) {
            socket.to(roomId).emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y,
                z: movementData.z,
                quaternion: movementData.quaternion,
                rotX: movementData.rotX,
                rotZ: movementData.rotZ,
                ts: Date.now()
            });
        }
    });

    // 5. BULLET SYNC
    socket.on('mp_player_fire', (data) => {
        if (data.roomId) {
            socket.to(data.roomId).emit('mp_player_fire', data);
        }
    });

    // 6. KIT CLAIM
    socket.on('mp_claim_kit', ({ roomId, kitIndex }) => {
        const room = rooms[roomId];
        if (room && room.kits[kitIndex] === true) {
            room.kits[kitIndex] = false;
            io.to(roomId).emit('mp_kit_collected', { kitIndex, collectorId: socket.id });

            setTimeout(() => {
                if (rooms[roomId]) {
                    rooms[roomId].kits[kitIndex] = true;
                    io.to(roomId).emit('mp_kit_restored', { kitIndex });
                }
            }, KIT_RESPAWN_TIME);
        }
    });

    // 7. SCORE & WIN LOGIC (FIXED EVENT NAME)
    socket.on('mp_claim_ring', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.rings++;
            // Calculate next ring index assuming 12 rings per lap logic or purely sequential
            // Using 12 as global standard now
            const nextRingIndex = player.rings % 12; 

            io.to(roomId).emit('mp_score_update', { 
                playerId: socket.id, 
                rings: player.rings,
                nextRingIndex: nextRingIndex
            });

            // Win condition (Total rings 12)
            if (player.rings >= TOTAL_RINGS_TO_WIN) { 
                io.to(roomId).emit('mp_game_over', { winnerName: player.name, winnerId: socket.id });
                room.status = 'finished';
            }
        }
    });

    // 8. DISCONNECT HANDLER
    const handleDisconnect = () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
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
                break;
            }
        }
    };

    socket.on('mp_leave_room', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ SERVER RUNNING ON PORT: ${PORT}`);
    console.log(`📂 SERVING FROM: ${publicPath}`);
});
