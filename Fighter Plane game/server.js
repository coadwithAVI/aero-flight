const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path'); // Added path module

// 1. Static Files Serve Karo (Current Directory se)
app.use(express.static(__dirname));

// 2. Explicit Root Route (Fix for Cannot GET /)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game State
let rooms = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. CREATE ROOM
    socket.on('mp_create_room', ({ name }) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        rooms[roomId] = {
            hostId: socket.id,
            players: []
        };

        const playerObj = { id: socket.id, name: name, isHost: true };
        rooms[roomId].players.push(playerObj);

        socket.join(roomId);

        socket.emit('mp_room_created', { 
            roomId, 
            players: rooms[roomId].players, 
            hostId: socket.id 
        });
        
        socket.emit('currentPlayers', {}); 
    });

    // 2. JOIN ROOM
    socket.on('mp_join_room', ({ roomId, name }) => {
        roomId = roomId.toUpperCase();
        const room = rooms[roomId];

        if (room) {
            const playerObj = { id: socket.id, name: name, isHost: false };
            room.players.push(playerObj);
            socket.join(roomId);

            socket.emit('mp_room_joined', {
                roomId,
                players: room.players,
                hostId: room.hostId
            });

            io.to(roomId).emit('mp_lobby_update', {
                roomId,
                players: room.players,
                hostId: room.hostId
            });

            let currentPlayersObj = {};
            room.players.forEach(p => {
                if(p.id !== socket.id) currentPlayersObj[p.id] = { playerId: p.id, ...p };
            });
            socket.emit('currentPlayers', currentPlayersObj);

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

    // 4. MOVEMENT SYNC
    socket.on('playerMovement', (movementData) => {
        const { roomId } = movementData;
        if (roomId) {
            socket.to(roomId).emit('playerMoved', {
                playerId: socket.id,
                x: movementData.x,
                y: movementData.y,
                z: movementData.z,
                quaternion: movementData.quaternion,
                rotation: movementData.rotation
            });
        }
    });

    // 5. DISCONNECT
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
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        handleDisconnect();
    });
});

server.listen(3000, () => {
    console.log('✅ SERVER RUNNING ON: http://localhost:3000');
});
