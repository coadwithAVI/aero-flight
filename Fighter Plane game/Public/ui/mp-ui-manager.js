// ==========================================
// PATH: ui/mp-ui-manager.js
// ==========================================

class MPUIManager {
    constructor(client, audio) {
        this.client = client;
        this.audio = audio; // ProceduralAudio instance connected here

        // --- DOM Elements ---
        this.screens = {
            join: document.getElementById('screenJoin'),
            lobby: document.getElementById('screenLobby'),
            end: document.getElementById('screenEnd')
        };

        this.hud = document.getElementById('topHUD');
        this.hudInfo = {
            room: document.getElementById('hudRoom'),
            name: document.getElementById('hudName'),
            status: document.getElementById('hudInfo')
        };

        // --- Inputs ---
        this.inpName = document.getElementById('inpName');
        this.inpCode = document.getElementById('inpCode');

        // --- Lobby Elements ---
        this.lobbyCode = document.getElementById('lobbyCode');
        this.lobbyStatus = document.getElementById('lobbyStatus');
        this.playerList = document.getElementById('playerList');
        this.btnStart = document.getElementById('btnStart');

        // --- End Screen Elements ---
        this.statsBody = document.getElementById('statsBody');
        this.endTitle = document.getElementById('endTitle');
        this.endSub = document.getElementById('endSub');
        this.endStatus = document.getElementById('endStatus');

        // --- Respawn Elements (Added from your old file) ---
        this.respawnOverlay = document.getElementById('respawnOverlay');
        this.respawnTimer = document.getElementById('respawnTimer');

        // --- Bind Buttons & Inputs ---
        this.bindEvents();

        // Start Lobby Music immediately (Browser handles mute policy)
        if(this.audio) this.audio.playLobbyMusic();
    }

    // ✅ UTILITY: Code Sanitizer (Taken from your old file)
    sanitizeCode(v) {
        return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    }

    bindEvents() {
        // Input Filter
        if (this.inpCode) {
            this.inpCode.addEventListener("input", () => {
                this.inpCode.value = this.sanitizeCode(this.inpCode.value);
            });
        }

        // CREATE ROOM
        document.getElementById('btnCreate').onclick = async () => {
            await this.unlockAudio(); // ✅ CLICK SE AUDIO UNLOCK HOGA
            const name = this.inpName.value || "Pilot";
            this.client.createRoom(name);
        };

        // JOIN ROOM
        document.getElementById('btnJoin').onclick = async () => {
            await this.unlockAudio(); // ✅ CLICK SE AUDIO UNLOCK HOGA
            const name = this.inpName.value || "Pilot";
            const code = this.inpCode.value;
            if (!code) return alert("Please enter a Room Code");
            this.client.joinRoom(code, name);
        };

        // LEAVE
        document.getElementById('btnLeave').onclick = () => {
            this.client.leaveRoom();
            this.showScreen('join');
            if(this.audio) this.audio.playLobbyMusic();
        };

        // START GAME (Host only)
        if(this.btnStart) {
            this.btnStart.onclick = () => {
                this.client.startGame();
            };
        }

        // REPLAY / BACK
        const btnReplay = document.getElementById('btnReplay');
        if(btnReplay) btnReplay.onclick = () => window.location.reload();
        
        const btnEndBack = document.getElementById('btnEndBack');
        if(btnEndBack) btnEndBack.onclick = () => window.location.reload();
        
        // ABORT (In Join Screen)
        const btnBack = document.getElementById('btnBack');
        if(btnBack) btnBack.onclick = () => window.location.href = '/'; 
    }

    // ✅ Helper to wake up audio context safely
    async unlockAudio() {
        if (this.audio) {
            await this.audio.unlock();
            this.audio.playLobbyMusic();
        }
    }

    // --- UI State Switching ---
    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(el => {
            if(el) el.classList.add('hidden');
        });
        if(this.hud) this.hud.classList.add('hidden');
        if(this.respawnOverlay) this.respawnOverlay.classList.add('hidden'); // Reset respawn UI

        // Show specific
        if (screenName === 'join') {
            if(this.screens.join) this.screens.join.classList.remove('hidden');
            // Show BG orb effect if you have it
            const bg = document.getElementById('mpLobbyBG');
            if(bg) bg.style.display = 'block';
        } 
        else if (screenName === 'lobby') {
            if(this.screens.lobby) this.screens.lobby.classList.remove('hidden');
        } 
        else if (screenName === 'game') {
            if(this.hud) this.hud.classList.remove('hidden');
            // Hide BG orb effect for performance
            const bg = document.getElementById('mpLobbyBG');
            if(bg) bg.style.display = 'none';
        } 
        else if (screenName === 'end') {
            if(this.screens.end) this.screens.end.classList.remove('hidden');
            // Show BG orb effect again
            const bg = document.getElementById('mpLobbyBG');
            if(bg) bg.style.display = 'block';
        }
    }

    // --- Lobby Logic ---
    updateLobby(data) {
        if (data.status === 'lobby') this.showScreen('lobby');
        
        if(this.lobbyCode) this.lobbyCode.innerText = data.roomId;
        if(this.hudInfo.room) this.hudInfo.room.innerText = `ROOM: ${data.roomId}`;
        
        // Update Player List
        if(this.playerList) {
            this.playerList.innerHTML = '';
            data.players.forEach(p => {
                const div = document.createElement('div');
                div.className = 'pitem';
                div.innerHTML = `
                    <span>${p.name} ${p.id === data.you.id ? '(YOU)' : ''}</span>
                    ${p.isHost ? '<span class="tagHost">HOST</span>' : ''}
                `;
                this.playerList.appendChild(div);
            });
        }

        // Handle Start Button (Host only)
        if(this.btnStart) {
            if (data.you.isHost) {
                this.btnStart.disabled = false;
                this.btnStart.innerText = "INITIATE LAUNCH";
                if(this.lobbyStatus) this.lobbyStatus.innerText = "Waiting for your command...";
            } else {
                this.btnStart.disabled = true;
                this.btnStart.innerText = "WAITING FOR HOST";
                if(this.lobbyStatus) this.lobbyStatus.innerText = "Host is configuring mission...";
            }
        }
    }

    onGameStart() {
        this.showScreen('game');
        if(this.audio) {
            this.audio.playGameMusic(); // ✅ Action Music Starts
            this.audio.startBoost();    // Engine noise start
        }
        if(this.hudInfo.status) this.hudInfo.status.innerText = "STATUS: ENGAGED";
    }

    // ✅ RESPAWN LOGIC (Added from your old file)
    showRespawn(seconds) {
        if (this.respawnOverlay) this.respawnOverlay.classList.remove("hidden");
        if (this.hud) this.hud.classList.add("hidden"); // Hide HUD on death
        if (this.respawnTimer) this.respawnTimer.innerText = seconds;
    }

    hideRespawn() {
        if (this.respawnOverlay) this.respawnOverlay.classList.add("hidden");
        if (this.hud) this.hud.classList.remove("hidden"); // Show HUD on respawn
    }

    // ✅ VICTORY / GAME OVER SCREEN LOGIC (Fixed)
    showGameOver(data) {
        this.showScreen('end');
        
        // Stop Game Audio
        if(this.audio) {
            this.audio.stopMusic();
            this.audio.stopBoost();
        }

        const myId = this.client.playerId;
        const winnerId = data.winnerId;
        const isWin = (myId === winnerId);

        // 1. Set Title & Sound
        if (isWin) {
            if(this.endTitle) {
                this.endTitle.innerText = "MISSION ACCOMPLISHED";
                this.endTitle.style.color = "#00f3ff"; // Cyan
            }
            if(this.audio) this.audio.victory(); // ✅ Play Victory Sound
        } else {
            if(this.endTitle) {
                this.endTitle.innerText = "MISSION FAILED";
                this.endTitle.style.color = "#ff4444"; // Red
            }
            if(this.audio) this.audio.defeat(); // ✅ Play Defeat Sound
        }

        if(this.endSub) this.endSub.innerText = `Winner: ${data.winner || "Unknown"} | ${data.reason}`;

        // 2. Populate Table
        if(this.statsBody) {
            this.statsBody.innerHTML = "";
            const sorted = data.stats.sort((a,b) => b.score - a.score);

            sorted.forEach(p => {
                const row = document.createElement('tr');
                if(p.id === myId) row.style.background = "rgba(0, 243, 255, 0.1)";
                
                row.innerHTML = `
                    <td>${p.name} ${p.id === winnerId ? '🏆' : ''}</td>
                    <td>${p.kills}</td>
                    <td>-</td>
                    <td>${p.rings}</td>
                    <td>${p.score}</td>
                `;
                this.statsBody.appendChild(row);
            });
        }
        
        if(this.endStatus) this.endStatus.innerText = isWin ? "Great work, Pilot." : "Better luck next time.";
    }

    updateHUD(myData, roomStatus) {
        if (!myData) return;
        if(this.hudInfo.name) this.hudInfo.name.innerText = `PILOT: ${myData.name}`;
        // if(this.hudInfo.status) this.hudInfo.status.innerText = `STATUS: ${roomStatus}`;
    }
}

// Attach to window for main.js to use
window.MPUIManager = MPUIManager;
