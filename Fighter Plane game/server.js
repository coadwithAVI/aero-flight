const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Folder ki saari files (index.html, game-manager.js etc) serve karo
app.use(express.static(__dirname));

// Game State
// rooms = { "ROOMCODE": { hostId: "socketid", players: [] } }
let rooms = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. CREATE ROOM
    socket.on('mp_create_room', ({ name }) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase(); // e.g., "A1B2"
        
        rooms[roomId] = {
            hostId: socket.id,
            players: []
        };

        const playerObj = { id: socket.id, name: name, isHost: true };
        rooms[roomId].players.push(playerObj);

        socket.join(roomId);

        // Client ko batao room ban gaya
        socket.emit('mp_room_created', { 
            roomId, 
            players: rooms[roomId].players, 
            hostId: socket.id 
        });
        
        // Initial setup for game syncing
        socket.emit('currentPlayers', {}); 
    });

    // 2. JOIN ROOM
    socket.on('mp_join_room', ({ roomId, name }) => {
        roomId = roomId.toUpperCase(); // Case insensitive
        const room = rooms[roomId];

        if (room) {
            const playerObj = { id: socket.id, name: name, isHost: false };
            room.players.push(playerObj);
            socket.join(roomId);

            // Joining player ko batao success
            socket.emit('mp_room_joined', {
                roomId,
                players: room.players,
                hostId: room.hostId
            });

            // Baaki sabko batao naya banda aaya (Lobby Update)
            io.to(roomId).emit('mp_lobby_update', {
                roomId,
                players: room.players,
                hostId: room.hostId
            });

            // GAMEPLAY SYNC:
            // 1. Send existing players to NEW player
            let currentPlayersObj = {};
            room.players.forEach(p => {
                if(p.id !== socket.id) currentPlayersObj[p.id] = { playerId: p.id, ...p };
            });
            socket.emit('currentPlayers', currentPlayersObj);

            // 2. Send NEW player to everyone else
            socket.to(roomId).emit('newPlayer', { playerId: socket.id, name: name });

        } else {
            socket.emit('mp_error', 'Room not found!');
        }
    });

    // 3. START GAME
    socket.on('mp_start_game', ({ roomId }) => {
        if (rooms[roomId] && rooms[roomId].hostId === socket.id) {
            io.to(roomId).emit('mp_game_starting');
        }
    });

    // 4. MOVEMENT SYNC (Sabse Important)
    socket.on('playerMovement', (movementData) => {
        // Data format: { roomId, x, y, z, quaternion: {x,y,z,w} }
        const { roomId } = movementData;
        if (roomId) {
            // Is player ka data baaki sabko bhejo (except sender)
            socket.to(roomId).emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y,
                z: movementData.z,
                quaternion: movementData.quaternion,
                rotation: movementData.rotation // fallback
            });
        }
    });

    // 5. LEAVE / DISCONNECT
    const handleDisconnect = () => {
        // Find which room the player was in
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);

            if (playerIndex !== -1) {
                // Remove player
                room.players.splice(playerIndex, 1);
                
                // Notify others to remove mesh
                io.to(roomId).emit('playerDisconnected', socket.id);

                if (room.players.length === 0) {
                    // Room empty, delete it
                    delete rooms[roomId];
                } else {
                    // Update Lobby
                    // Agar Host chala gaya, assign new host (optional, abhi bas first player banega)
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
                break; // Player found and handled
            }
        }
    };

    socket.on('mp_leave_room', handleDisconnect);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        handleDisconnect();
    });
});

server.listen(3000, () => {
    console.log('✅ SERVER RUNNING ON: http://localhost:3000');
});
