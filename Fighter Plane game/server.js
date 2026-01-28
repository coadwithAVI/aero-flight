const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// "public" folder se game serve karo
app.use(express.static(path.join(__dirname, 'public')));

// Players ka data store karne ke liye
let players = {};

io.on('connection', (socket) => {
    console.log('New Pilot Connected: ' + socket.id);

    // Naye player ko list me add karo
    players[socket.id] = {
        x: 0,
        y: 400,
        z: 800,
        rotation: { x: 0, y: 0, z: 0 }
    };

    // Current players ka data naye player ko bhejo
    socket.emit('currentPlayers', players);

    // Baaki sabko batao ki naya player aaya hai
    socket.broadcast.emit('newPlayer', { 
        id: socket.id, 
        player: players[socket.id] 
    });

    // Jab player move kare (Data receive karo aur sabko bhejo)
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            
            // Update bhejo
            socket.broadcast.emit('playerMoved', { 
                id: socket.id, 
                ...players[socket.id] 
            });
        }
    });

    // Jab player disconnect ho
    socket.on('disconnect', () => {
        console.log('Pilot Disconnected: ' + socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Render dynamic port use karta hai, isliye process.env.PORT zaroori hai
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server flying on port ${PORT}`);
});
```

#### File 3: `public/index.html` (Tumhara Game)
1.  Apne `game.html` ko `public` folder ke andar move karo.
2.  Uska naam badal kar **`index.html`** kar do.
3.  **Bohot Zaroori:** Tumhe game code me wo changes karne honge jo maine pichle message me bataye the (AI enemies hata kar Socket logic lagana).

**Short Cheat Sheet (Index.html changes):**
* Header me: `<script src="/socket.io/socket.io.js"></script>` add karo.
* Script start me: `const socket = io();`
* `enemies` array ko `otherPlayers` object se replace karo.
* `animate()` loop me `socket.emit('playerMovement', ...)` daalo.

---

### 🚀 Step 3: GitHub par Upload Karna

Render seedha tumhare computer se files nahi utha sakta. Tumhe code ko **GitHub** par dalna hoga.

1.  **GitHub.com** par jao aur account banao (agar nahi hai).
2.  **New Repository** create karo (naam rakho: `aero-flight`).
3.  Apne computer par `aero-flight-game` folder me jao.
4.  (Agar Git installed hai) Terminal me ye commands chalao:
    ```bash
    git init
    git add .
    git commit -m "First flight"
    git branch -M main
    git remote add origin https://github.com/TUMHARA_USERNAME/aero-flight.git
    git push -u origin main