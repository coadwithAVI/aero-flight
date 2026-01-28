const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path'); // ✅ NEW: Path module add kiya

const app = express();
app.use(cors()); 

// ✅ FIX: Ab server 'public' folder se files dhundega
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// ✅ FIX: Root URL par ab Game (index.html) khulega
app.get('/', (req, res) => {
    // Agar index.html public folder me hai to wo dikhao
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store Game State
const players = {}; 
const rooms = {};   

io.on('connection', (socket) => {
    console.log(`✅ New Connection: ${socket.id}`);

    // --- 1. JOIN ROOM LOGIC ---
    socket.on('joinRoom', ({ room, name }) => {
        try {
            if (!room || !name) return;
            const roomCode = room.trim().toUpperCase(); 
            socket.join(roomCode);

            let isHost = false;
            if (!rooms[roomCode]) {
                rooms[roomCode] = { hostId: socket.id, isPlaying: false };
                isHost = true;
                console.log(`🏠 Room Created: ${roomCode} by ${name}`);
            }

            players[socket.id] = {
                id: socket.id,
                name: name,
                room: roomCode,
                isHost: isHost,
                x: 0, y: 400, z: 0,
                quaternion: { x: 0, y: 0, z: 0, w: 1 }
            };

            const roomPlayers = {};
            Object.values(players).forEach(p => {
                if (p.room === roomCode) roomPlayers[p.id] = p;
            });

            socket.emit('currentPlayers', roomPlayers);
            socket.to(roomCode).emit('newPlayer', { id: socket.id, player: players[socket.id] });
            console.log(`➕ ${name} joined ${roomCode}`);

        } catch (error) {
            console.error("Join Error:", error);
        }
    });

    // --- 2. PLAYER MOVEMENT SYNC ---
    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        if (player && movementData.room === player.room) {
            player.x = movementData.x;
            player.y = movementData.y;
            player.z = movementData.z;
            player.quaternion = movementData.quaternion;

            socket.to(player.room).emit('playerMoved', {
                id: socket.id,
                x: player.x,
                y: player.y,
                z: player.z,
                quaternion: player.quaternion
            });
        }
    });

    // --- 3. START GAME ---
    socket.on('startGame', ({ room }) => {
        const roomCode = room ? room.trim().toUpperCase() : null;
        if (roomCode && rooms[roomCode] && rooms[roomCode].hostId === socket.id) {
            rooms[roomCode].isPlaying = true;
            io.to(roomCode).emit('gameStarted');
        }
    });

    // --- 4. LEAVE LOGIC ---
    const handleDisconnect = () => {
        const player = players[socket.id];
        if (player) {
            const roomCode = player.room;
            delete players[socket.id];
            io.to(roomCode).emit('playerDisconnected', socket.id);

            if (rooms[roomCode] && rooms[roomCode].hostId === socket.id) {
                const remainingIds = Object.keys(players).filter(id => players[id].room === roomCode);
                if (remainingIds.length > 0) {
                    rooms[roomCode].hostId = remainingIds[0];
                    players[remainingIds[0]].isHost = true;
                } else {
                    delete rooms[roomCode];
                }
            }
        }
    };

    socket.on('leaveRoom', ({ room }) => {
        if (room) socket.leave(room);
        handleDisconnect();
    });
    
    socket.on('disconnect', handleDisconnect);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
