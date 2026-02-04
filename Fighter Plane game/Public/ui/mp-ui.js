// ==========================================
// PATH: ui/mp-ui.js
// ==========================================

// Legacy class stub to prevent errors
class MPUI { constructor() {} }
window.MPUI = MPUI;

// ==========================================================
// Multiplayer UI Controller (FINAL)
// ==========================================================

// ✅ Run only after HTML is ready
document.addEventListener("DOMContentLoaded", () => {
    
    console.log("🎮 UI Controller Loaded");

    const el = (id) => document.getElementById(id);

    // Screens
    const screenJoin = el("screenJoin");
    const screenLobby = el("screenLobby");
    const screenEnd = el("screenEnd");
    
    // Backgrounds & HUD
    const mpLobbyBG = el("mpLobbyBG");
    const topHUD = el("topHUD");
    const respawnOverlay = el("respawnOverlay");
    const respawnTimer = el("respawnTimer");

    // Inputs & Status
    const inpName = el("inpName");
    const inpCode = el("inpCode");
    const joinStatus = el("joinStatus");
    const lobbyStatus = el("lobbyStatus");
    const endStatus = el("endStatus");
    const lobbyCode = el("lobbyCode");
    const playerList = el("playerList");

    // HUD Elements
    const hudRoom = el("hudRoom");
    const hudName = el("hudName");
    const hudInfo = el("hudInfo");

    // End Screen Elements
    const endTitle = el("endTitle");
    const endSub = el("endSub");
    const statsBody = el("statsBody");

    // Buttons
    const btnCreate = el("btnCreate");
    const btnJoin = el("btnJoin");
    const btnBack = el("btnBack");
    const btnStart = el("btnStart");
    const btnLeave = el("btnLeave");
    const btnReplay = el("btnReplay");
    const btnEndBack = el("btnEndBack");

    // State
    let __startLocked = false;
    let __isGameRunning = false;
    let __matchEnded = false;
    let __winnerId = null;

    // --- Helpers ---
    function unlockAudio() {
        if (window.game && window.game.sfx) window.game.sfx.init();
        if (window.game && window.game.procAudio) {
            window.game.procAudio.unlock();
            if (!__isGameRunning) window.game.procAudio.playLobbyMusic();
        }
    }

    function showOnly(screen) {
        [screenJoin, screenLobby, screenEnd].forEach(s => s?.classList.add("hidden"));
        if (screen) screen.classList.remove("hidden");
    }

    function setStatus(element, text, isError = false) {
        if (!element) return;
        element.innerText = text || "";
        element.style.color = isError ? "#ff4444" : "#00f3ff";
    }

    function sanitizeCode(v) { 
        return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); 
    }

    function _safeText(v, fallback = "-") { 
        return (v === undefined || v === null) ? fallback : String(v); 
    }

    // --- EVENT LISTENERS ---

    // Input Code Formatting
    if (inpCode) {
        inpCode.addEventListener("input", () => { inpCode.value = sanitizeCode(inpCode.value); });
    }

    // Abort / Back Buttons
    if (btnBack) {
        btnBack.onclick = () => { window.location.href = "./index.html"; };
    }
    if (btnEndBack) {
        btnEndBack.onclick = () => { window.location.href = "./index.html"; };
    }

    // Create Room
    if (btnCreate) {
        btnCreate.onclick = () => {
            unlockAudio();
            const name = (inpName.value || "Pilot").trim();
            
            if (!window.mpClient) return setStatus(joinStatus, "Connection System Offline", true);

            // Connect if not connected
            if (!window.mpClient.isConnected()) {
                window.mpClient.connect();
                setStatus(joinStatus, "Connecting...", false);
                // Wait slightly for connection
                setTimeout(() => {
                    if(window.mpClient.isConnected()) window.mpClient.createRoom(name);
                    else setStatus(joinStatus, "Server Unreachable", true);
                }, 800);
                return;
            }

            localStorage.setItem("SP_MP_NAME", name);
            window.mpClient.playerName = name;
            __startLocked = false;
            if(btnStart) btnStart.disabled = false;
            setStatus(joinStatus, "Initializing Lobby...");
            window.mpClient.createRoom(name);
        };
    }

    // Join Room
    if (btnJoin) {
        btnJoin.onclick = () => {
            unlockAudio();
            const name = (inpName.value || "Pilot").trim();
            const code = sanitizeCode(inpCode.value);
            if (!code || code.length !== 4) return setStatus(joinStatus, "Invalid Code", true);
            
            if (!window.mpClient) return setStatus(joinStatus, "System Offline", true);
            
            if (!window.mpClient.isConnected()) {
                window.mpClient.connect();
                setStatus(joinStatus, "Connecting...", false);
                setTimeout(() => {
                    if(window.mpClient.isConnected()) window.mpClient.joinRoom(code, name);
                    else setStatus(joinStatus, "Server Unreachable", true);
                }, 800);
                return;
            }

            localStorage.setItem("SP_MP_NAME", name);
            window.mpClient.playerName = name;
            __startLocked = false;
            if(btnStart) btnStart.disabled = false;
            setStatus(joinStatus, "Joining Squad...");
            window.mpClient.joinRoom(code, name);
        };
    }

    // Leave
    if (btnLeave) {
        btnLeave.onclick = () => window.location.reload();
    }

    // Start Game
    if (btnStart) {
        btnStart.onclick = () => {
            unlockAudio();
            if (__startLocked) return;
            if (!window.mpClient?.roomId) return;
            __startLocked = true;
            btnStart.disabled = true;
            btnStart.innerText = "LAUNCHING...";
            window.mpClient.startGame();
            setStatus(lobbyStatus, "Launch Sequence Initiated.");
        };
    }

    // Replay
    if (btnReplay) {
        btnReplay.onclick = () => {
            setStatus(endStatus, "Re-engaging...");
            setTimeout(() => window.location.reload(), 500);
        };
    }

    // --- LOGIC FUNCTIONS ---

    function _endMatch({ winnerId, reason }) {
        if (__matchEnded) return;
        __matchEnded = true;
        __winnerId = winnerId || null;
        __isGameRunning = false;
        
        if (window.game) {
            window.game.isPaused = true; 
            window.game.isRunning = false;
            // Handle Audio
            if (window.game.procAudio) {
                window.game.procAudio.stopMusic();
                const myId = window.mpClient?.playerId;
                if (myId && winnerId === myId) window.game.procAudio.victory();
                else window.game.procAudio.defeat();
            }
        }

        const myId = window.mpClient?.playerId;
        const didWin = !!(__winnerId && myId && (__winnerId === myId));

        if (endTitle) endTitle.innerText = didWin ? "VICTORY" : "DEFEAT";
        if (endSub) endSub.innerText = didWin ? "Mission Successful" : "Mission Failed";

        showOnly(screenEnd);
        if(topHUD) topHUD.classList.add("hidden");
        if(mpLobbyBG) mpLobbyBG.style.display = "block";

        setStatus(endStatus, didWin ? ("✅ " + (reason || "You won")) : ("❌ " + (reason || "You lost")), !didWin);
    }

    function _renderEndTable(snapshotPlayers = []) {
        if(!statsBody) return;
        statsBody.innerHTML = "";
        const myId = window.mpClient?.playerId;
        const list = [...snapshotPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        
        for (const p of list) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
            <td>${_safeText(p.name || p.id || "Pilot")} ${p.id === __winnerId ? "🏆" : ""} ${p.id === myId ? "(YOU)" : ""}</td>
            <td>${_safeText(p.kills ?? 0, 0)}</td>
            <td>${_safeText(p.deaths ?? 0, 0)}</td>
            <td>${_safeText(p.rings ?? 0, 0)}</td>
            <td>${_safeText(p.score ?? 0, 0)}</td>
            `;
            statsBody.appendChild(tr);
        }
    }

    // ==========================================================
    // UI BRIDGE (Connected to Main Game)
    // ==========================================================
    window.mpUIBridge = {
        onConnected() {
            setStatus(joinStatus, "✅ Uplink Established.");
            __isGameRunning = false;
        },

        onDisconnected(reason) {
            setStatus(joinStatus, "❌ Disconnected: " + reason, true);
            __startLocked = false;
            __isGameRunning = false;
            if(btnStart) { btnStart.disabled = false; btnStart.innerText = "INITIATE LAUNCH"; }
            showOnly(screenJoin);
            if(topHUD) topHUD.classList.add("hidden");
            if(mpLobbyBG) mpLobbyBG.style.display = "block";
        },

        onLobbyUpdate(msg) {
            if (__isGameRunning) return;
            showOnly(screenLobby);
            
            if(topHUD) topHUD.classList.remove("hidden");
            if(mpLobbyBG) mpLobbyBG.style.display = "block";
            
            if(lobbyCode) lobbyCode.innerText = msg.roomId || "----";
            if(hudRoom) hudRoom.innerText = "ROOM: " + (msg.roomId || "----");
            if(hudName) hudName.innerText = "PILOT: " + (msg.you?.name || inpName.value || "PILOT");
            if(hudInfo) hudInfo.innerText = "STATUS: LOBBY";
            
            if(playerList) {
                playerList.innerHTML = "";
                const players = msg.players || [];
                for (const p of players) {
                    const div = document.createElement("div");
                    div.className = "pitem";
                    div.innerHTML = `<span>${p.name || "Pilot"}</span>${p.isHost ? `<span class="tagHost">HOST</span>` : ``}`;
                    playerList.appendChild(div);
                }
            }

            const isHost = !!msg.you?.isHost;
            if(btnStart) {
                btnStart.style.display = isHost ? "block" : "none";
                if(isHost) btnStart.disabled = false; 
            }
            setStatus(lobbyStatus, isHost ? "Launch when ready." : "Waiting for Host...");
        },

        onGameStart(msg) {
            __isGameRunning = true;
            __matchEnded = false;
            __winnerId = null;

            screenJoin?.classList.add("hidden");
            screenLobby?.classList.add("hidden");
            screenEnd?.classList.add("hidden");
            if(respawnOverlay) respawnOverlay.classList.add("hidden");
            
            if(topHUD) topHUD.classList.remove("hidden");
            if(mpLobbyBG) mpLobbyBG.style.display = "none";
            if(hudInfo) hudInfo.innerText = "STATUS: COMBAT";

            // ✅ CRITICAL: Fix Controls by blurring inputs
            if(inpName) inpName.blur();
            if(inpCode) inpCode.blur();
            window.focus();

            setStatus(lobbyStatus, "Game Started.");
        },

        onGameOver(msg) {
            const winnerId = msg?.winnerId || null;
            const reason = msg?.reason || "Game Over";
            if (Array.isArray(msg?.players)) _renderEndTable(msg.players);
            _endMatch({ winnerId, reason });
        },

        showRespawn(seconds) {
            if (respawnOverlay) respawnOverlay.classList.remove("hidden");
            if (topHUD) topHUD.classList.add("hidden");
            if (respawnTimer) respawnTimer.innerText = seconds;
        },

        hideRespawn() {
            if (respawnOverlay) respawnOverlay.classList.add("hidden");
            if (topHUD) topHUD.classList.remove("hidden");
        }
    };

    // Initial
    showOnly(screenJoin);
    if (localStorage.getItem("SP_MP_NAME") && inpName) {
        inpName.value = localStorage.getItem("SP_MP_NAME");
    }
});