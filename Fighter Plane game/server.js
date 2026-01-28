const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow requests from anywhere

const server = http.createServer(app);

// Socket.io Setup with CORS enabled for Render
const io = new Server(server, {
    cors: {
        origin: "*", // Kisi bhi website (tumhare game) ko connect hone do
        methods: ["GET", "POST"]
    }
});

// Store Game State
const players = {}; // Format: { socketId: { id, name, room, x, y, z, ... } }
const rooms = {};   // Format: { roomId: { hostId: socketId, isPlaying: boolean } }

io.on('connection', (socket) => {
    console.log(`✅ New Connection: ${socket.id}`);

    // --- 1. JOIN ROOM LOGIC ---
    socket.on('joinRoom', ({ room, name }) => {
        try {
            // Basic Validation
            if (!room || !name) return;

            const roomCode = room.trim().toUpperCase(); // Force Uppercase
            
            // Join the socket channel
            socket.join(roomCode);

            // Determine if Host (First player in room is Host)
            let isHost = false;
            if (!rooms[roomCode]) {
                rooms[roomCode] = { hostId: socket.id, isPlaying: false };
                isHost = true;
                console.log(`🏠 Room Created: ${roomCode} by ${name}`);
            }

            // Create Player Object
            players[socket.id] = {
                id: socket.id,
                name: name,
                room: roomCode,
                isHost: isHost,
                x: 0, 
                y: 400, // Default Height
                z: 0,
                quaternion: { x: 0, y: 0, z: 0, w: 1 }
            };

            // Get list of players ONLY in this room
            const roomPlayers = {};
            Object.values(players).forEach(p => {
                if (p.room === roomCode) {
                    roomPlayers[p.id] = p;
                }
            });

            // 1. Send FULL LIST to the new joiner
            socket.emit('currentPlayers', roomPlayers);

            // 2. Notify OTHERS in room about new joiner
            socket.to(roomCode).emit('newPlayer', {
                id: socket.id,
                player: players[socket.id]
            });

            console.log(`➕ ${name} joined ${roomCode} (Total: ${Object.keys(roomPlayers).length})`);

        } catch (error) {
            console.error("Join Error:", error);
        }
    });

    // --- 2. PLAYER MOVEMENT SYNC ---
    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        
        // Validation: Player must exist and be in the room sent by client
        if (player && movementData.room === player.room) {
            // Update Server State
            player.x = movementData.x;
            player.y = movementData.y;
            player.z = movementData.z;
            player.quaternion = movementData.quaternion;

            // Broadcast to everyone else in THAT ROOM
            socket.to(player.room).emit('playerMoved', {
                id: socket.id,
                x: player.x,
                y: player.y,
                z: player.z,
                quaternion: player.quaternion
            });
        }
    });

    // --- 3. START GAME (Host Only) ---
    socket.on('startGame', ({ room }) => {
        const roomCode = room ? room.trim().toUpperCase() : null;
        
        // Security: Check if room exists and sender is the Host
        if (roomCode && rooms[roomCode] && rooms[roomCode].hostId === socket.id) {
            rooms[roomCode].isPlaying = true;
            console.log(`🚀 Game Started in Room: ${roomCode}`);
            
            // Blast "gameStarted" event to everyone in room
            io.to(roomCode).emit('gameStarted');
        } else {
            console.log(`⚠️ Start denied. ${socket.id} is not host of ${roomCode}`);
        }
    });

    // --- 4. LEAVE / DISCONNECT LOGIC ---
    const handleDisconnect = () => {
        const player = players[socket.id];
        
        if (player) {
            const roomCode = player.room;
            console.log(`❌ ${player.name} left ${roomCode}`);

            // Remove from player list
            delete players[socket.id];

            // Notify others in the room
            io.to(roomCode).emit('playerDisconnected', socket.id);

            // Handle Room Host Migration or Cleanup
            if (rooms[roomCode]) {
                // If Host left
                if (rooms[roomCode].hostId === socket.id) {
                    // Find another player in that room to make host
                    const remainingIds = Object.keys(players).filter(id => players[id].room === roomCode);
                    
                    if (remainingIds.length > 0) {
                        // Make the next guy host
                        const newHostId = remainingIds[0];
                        rooms[roomCode].hostId = newHostId;
                        players[newHostId].isHost = true;
                        // Optional: Notify users of new host (Client needs logic for this, skipping for now to keep simple)
                    } else {
                        // Room is empty, delete it
                        delete rooms[roomCode];
                        console.log(`🗑️ Room ${roomCode} deleted (Empty)`);
                    }
                }
            }
        }
    };

    socket.on('leaveRoom', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
});

// Render dynamic port or 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
