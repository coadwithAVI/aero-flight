const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path'); 
const fs = require('fs');

const app = express();
app.use(cors()); 

// ---------------------------------------------------------
// 1. SMART FILE FINDER (Auto-Detect Folder)
// ---------------------------------------------------------
console.log("📂 Current Server Directory:", __dirname);

// List of possible places where 'index.html' might be hiding
const potentialPaths = [
    path.join(__dirname, 'public'),   // standard lowercase
    path.join(__dirname, 'Public'),   // Capitalized
    path.join(__dirname, 'client'),   // common name
    __dirname                         // Maybe it's in the root?
];

let publicPath = null;

// Find the first path that actually contains 'index.html'
for (const tryPath of potentialPaths) {
    const checkFile = path.join(tryPath, 'index.html');
    if (fs.existsSync(checkFile)) {
        publicPath = tryPath;
        console.log(`✅ FOUND GAME AT: ${publicPath}`);
        break;
    }
}

// Setup Express to serve the game
if (publicPath) {
    app.use(express.static(publicPath));
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(publicPath, 'index.html'));
    });
} else {
    // If game still not found, show Debug Info on screen
    console.error("❌ CRITICAL: index.html nowhere to be found.");
    
    app.get('/', (req, res) => {
        let fileList = "Unable to list files";
        try { fileList = JSON.stringify(fs.readdirSync(__dirname)); } catch(e){}

        res.send(`
            <div style="font-family: monospace; padding: 20px; background: #333; color: #fff;">
                <h1>⚠️ Error: Game Not Found</h1>
                <p>Server is running, but I can't find <b>index.html</b>.</p>
                <hr>
                <h3>I looked in these places:</h3>
                <ul>${potentialPaths.map(p => `<li>${p}</li>`).join('')}</ul>
                <hr>
                <h3>Files actually present in root (${__dirname}):</h3>
                <p>${fileList}</p>
                <hr>
                <p><b>Solution:</b> Ensure you uploaded a folder named 'public' containing 'index.html' to GitHub.</p>
            </div>
        `);
    });
}

const server = http.createServer(app);

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
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
