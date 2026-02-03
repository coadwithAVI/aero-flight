// ==========================================
// PATH: ui/mp-ui-manager.js (Fixed Audio)
// ==========================================

class MPUIManager {
    constructor(client, audio) {
        this.client = client;
        this.audio = audio; 

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

        this.inpName = document.getElementById('inpName');
        this.inpCode = document.getElementById('inpCode');

        this.lobbyCode = document.getElementById('lobbyCode');
        this.lobbyStatus = document.getElementById('lobbyStatus');
        this.playerList = document.getElementById('playerList');
        this.btnStart = document.getElementById('btnStart');

        this.statsBody = document.getElementById('statsBody');
        this.endTitle = document.getElementById('endTitle');
        this.endSub = document.getElementById('endSub');
        this.endStatus = document.getElementById('endStatus');

        this.respawnOverlay = document.getElementById('respawnOverlay');
        this.respawnTimer = document.getElementById('respawnTimer');

        this.bindEvents();

        // Lobby music is fine, but boost/static is removed
        if(this.audio) this.audio.playLobbyMusic();
    }

    sanitizeCode(v) {
        return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    }

    bindEvents() {
        if (this.inpCode) {
            this.inpCode.addEventListener("input", () => {
                this.inpCode.value = this.sanitizeCode(this.inpCode.value);
            });
        }

        document.getElementById('btnCreate').onclick = async () => {
            await this.unlockAudio();
            const name = this.inpName.value || "Pilot";
            this.client.createRoom(name);
        };

        document.getElementById('btnJoin').onclick = async () => {
            await this.unlockAudio();
            const name = this.inpName.value || "Pilot";
            const code = this.inpCode.value;
            if (!code) return alert("Please enter a Room Code");
            this.client.joinRoom(code, name);
        };

        document.getElementById('btnLeave').onclick = () => {
            this.client.leaveRoom();
            this.showScreen('join');
            if(this.audio) this.audio.playLobbyMusic();
        };

        if(this.btnStart) {
            this.btnStart.onclick = () => {
                this.client.startGame();
            };
        }

        const btnReplay = document.getElementById('btnReplay');
        if(btnReplay) btnReplay.onclick = () => window.location.reload();
        
        const btnEndBack = document.getElementById('btnEndBack');
        if(btnEndBack) btnEndBack.onclick = () => window.location.reload();
        
        const btnBack = document.getElementById('btnBack');
        if(btnBack) btnBack.onclick = () => window.location.href = '/'; 
    }

    async unlockAudio() {
        if (this.audio) {
            await this.audio.unlock();
            this.audio.playLobbyMusic();
        }
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(el => {
            if(el) el.classList.add('hidden');
        });
        if(this.hud) this.hud.classList.add('hidden');
        if(this.respawnOverlay) this.respawnOverlay.classList.add('hidden');

        if (screenName === 'join') {
            if(this.screens.join) this.screens.join.classList.remove('hidden');
            const bg = document.getElementById('mpLobbyBG');
            if(bg) bg.style.display = 'block';
        } 
        else if (screenName === 'lobby') {
            if(this.screens.lobby) this.screens.lobby.classList.remove('hidden');
        } 
        else if (screenName === 'game') {
            if(this.hud) this.hud.classList.remove('hidden');
            const bg = document.getElementById('mpLobbyBG');
            if(bg) bg.style.display = 'none';
        } 
        else if (screenName === 'end') {
            if(this.screens.end) this.screens.end.classList.remove('hidden');
            const bg = document.getElementById('mpLobbyBG');
            if(bg) bg.style.display = 'block';
        }
    }

    updateLobby(data) {
        if (data.status === 'lobby') this.showScreen('lobby');
        
        if(this.lobbyCode) this.lobbyCode.innerText = data.roomId;
        if(this.hudInfo.room) this.hudInfo.room.innerText = `ROOM: ${data.roomId}`;
        
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
            this.audio.playGameMusic();
            // ❌ REMOVED: this.audio.startBoost(); (Ye static sound kar rha tha)
        }
        if(this.hudInfo.status) this.hudInfo.status.innerText = "STATUS: ENGAGED";
    }

    showRespawn(seconds) {
        if (this.respawnOverlay) this.respawnOverlay.classList.remove("hidden");
        if (this.hud) this.hud.classList.add("hidden");
        if (this.respawnTimer) this.respawnTimer.innerText = seconds;
    }

    hideRespawn() {
        if (this.respawnOverlay) this.respawnOverlay.classList.add("hidden");
        if (this.hud) this.hud.classList.remove("hidden");
    }

    showGameOver(data) {
        this.showScreen('end');
        
        if(this.audio) {
            this.audio.stopMusic();
            this.audio.stopBoost();
        }

        const myId = this.client.playerId;
        const winnerId = data.winnerId;
        const isWin = (myId === winnerId);

        if (isWin) {
            if(this.endTitle) {
                this.endTitle.innerText = "MISSION ACCOMPLISHED";
                this.endTitle.style.color = "#00f3ff";
            }
            if(this.audio) this.audio.victory();
        } else {
            if(this.endTitle) {
                this.endTitle.innerText = "MISSION FAILED";
                this.endTitle.style.color = "#ff4444";
            }
            if(this.audio) this.audio.defeat();
        }

        if(this.endSub) this.endSub.innerText = `Winner: ${data.winner || "Unknown"} | ${data.reason}`;

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
    }
}

window.MPUIManager = MPUIManager;
