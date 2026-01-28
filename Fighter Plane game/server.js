const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------
// 1. SMART FILE FINDER (ENOENT Error Fix)
// ---------------------------------------------------------
// ✅ FIX: 'Public' ka 'P' bada kar diya hai (Folder name ke hisaab se)
const publicDir = path.join(__dirname, 'Public');
const rootDir = __dirname;
let finalPath = rootDir;

// Debugging ke liye print karwaya
console.log("Checking Public folder at:", publicDir);

if (fs.existsSync(path.join(publicDir, 'index.html'))) {
    console.log("📂 File found in 'Public' folder.");
    finalPath = publicDir;
} else if (fs.existsSync(path.join(rootDir, 'index.html'))) {
    console.log("📂 File found in root folder.");
    finalPath = rootDir;
} else {
    console.log("⚠️ WARNING: index.html nahi mili! Please check file name.");
}

// Files serve karo
app.use(express.static(finalPath));

// Route handle karo
app.get("/", (req, res) => {
    const fileLoc = path.join(finalPath, "index.html");
    if (fs.existsSync(fileLoc)) {
        res.sendFile(fileLoc);
    } else {
        res.send("<h1>Error: index.html file nahi mili. GitHub check karo.</h1>");
    }
});

// ---------------------------------------------------------
// 2. SIMPLE GAME LOGIC (Taaki game turant chale)
// ---------------------------------------------------------
let players = {};

io.on('connection', (socket) => {
    console.log('🟢 New Pilot Connected: ' + socket.id);

    // Naye player ko default position do
    players[socket.id] = {
        x: 0, y: 400, z: 800,
        rotation: { x: 0, y: 0, z: 0 }
    };

    // Naye player ko purane players dikhao
    socket.emit('currentPlayers', players);

    // Baaki sabko batao ki naya player aaya hai
    socket.broadcast.emit('newPlayer', { 
        id: socket.id, 
        player: players[socket.id] 
    });

    // Jab player move kare
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            // Server par data update karo
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            
            // Turant sabko bhejo (No Rooms/Lobby logic needed)
            socket.broadcast.emit('playerMoved', { 
                id: socket.id, 
                ...players[socket.id] 
            });
        }
    });

    // Jab player disconnect ho
    socket.on('disconnect', () => {
        console.log('🔴 Pilot Disconnected: ' + socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Port setup (Render ke liye zaroori)
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ Server flying on port ${PORT}`);
});
