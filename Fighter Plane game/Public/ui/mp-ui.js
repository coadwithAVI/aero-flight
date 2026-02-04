// ==========================================
// PATH: ui/mp-ui.js
// ==========================================

// Class definition for internal logic (if needed)
class MPUI {
  constructor() {
    // Legacy support logic kept empty to avoid errors
  }
}
window.MPUI = MPUI;

// ==========================================================
// Multiplayer UI Controller (FINAL FIXED)
// ==========================================================

// Isko DOMContentLoaded ke andar dala taaki buttons load hone ke baad hi code chale
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

    // --- State Flags ---
    let __startLocked = false;
    let __isGameRunning = false;
    let __matchEnded = false;
    let __winnerId = null;
    let __endReason = "";

    // --- Helper Functions ---
    
    function unlockAudio() {
        if (window.game && window.game.sfx) window.game.sfx.init();
        if (window.game && window.game.procAudio) {
            window.game.procAudio.unlock();
            // Agar game nahi chal raha, toh lobby music bajao
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

    // --- BUTTON EVENT LISTENERS (Ab ye pakka kaam karenge) ---

    // 1. INPUT SANITIZATION
    if (inpCode) {
        inpCode.addEventListener("input", () => { 
            inpCode.value = sanitizeCode(inpCode.value); 
        });
    }

    // 2. ABORT MISSION (Back to Index)
    if (btnBack) {
        btnBack.onclick = () => {
            console.log("⬅ Aborting Mission...");
            window.location.href = "./index.html";
        };
    }

    if (btnEndBack) {
        btnEndBack.onclick = () => {
            window.location.href = "./index.html";
        };
    }

    // 3. CREATE SQUAD
    if (btnCreate) {
        btnCreate.onclick = () => {
            unlockAudio();
            const name = (inpName.value || "Pilot").trim();
            
            // Check if Client is ready
            if (!window.mpClient) {
                return setStatus(joinStatus, "Connection System Loading...", true);
            }
            if (!window.mpClient.isConnected()) {
                // Try connecting manually if not connected
                window.mpClient.connect();
                setStatus(joinStatus, "Connecting to Server...", false);
                setTimeout(() => window.mpClient.createRoom(name), 1000);
                return;
            }

            // Save Name
            localStorage.setItem("SP_MP_NAME", name);
            window.mpClient.playerName = name;

            __startLocked = false;
            if(btnStart) btnStart.disabled = false;
            setStatus(joinStatus, "Initializing Lobby...");
            window.mpClient.createRoom(name);
        };
    }

    // 4. JOIN SQUAD
    if (btnJoin) {
        btnJoin.onclick = () => {
            unlockAudio();
            const name = (inpName.value || "Pilot").trim();
            const code = sanitizeCode(inpCode.value);

            if (!code || code.length !== 4) return setStatus(joinStatus, "Invalid Access Code", true);
            
            if (!window.mpClient) return setStatus(joinStatus, "System Offline", true);
            
            // Save Name
            localStorage.setItem("SP_MP_NAME", name);
            window.mpClient.playerName = name;

            __startLocked = false;
            if(btnStart) btnStart.disabled = false;
            setStatus(joinStatus, "Connecting to Squad...");
            window.mpClient.joinRoom(code, name);
        };
    }

    // 5. LEAVE LOBBY
    if (btnLeave) {
        btnLeave.onclick = () => window.location.reload();
    }

    // 6. START GAME
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

    // 7. REPLAY
    if (btnReplay) {
        btnReplay.onclick = () => {
            setStatus(endStatus, "Re-engaging systems...");
            setTimeout(() => window.location.reload(), 500);
        };
    }

    // --- GAME LOGIC HELPERS ---

    function _endMatch({ winnerId, reason }) {
        if (__matchEnded) return;
        __matchEnded = true;
        __winnerId = winnerId || null;
        __endReason = reason || "";
        __isGameRunning = false;
        
        // Pause Game Loop
        if (window.game) {
            window.game.isPaused = true; 
            window.game.isRunning = false;
        }

        // Audio Handling
        if (window.game && window.game.procAudio) {
            window.game.procAudio.stopMusic();
            const myId = window.mpClient?.socket?.id;
            const didWin = !!(__winnerId && myId && (__winnerId === myId));
            if (didWin) window.game.procAudio.victory();
            else window.game.procAudio.defeat();
        }

        const myId = window.mpClient?.socket?.id;
        const didWin = !!(__winnerId && myId && (__winnerId === myId));

        if (endTitle) endTitle.innerText = didWin ? "VICTORY" : "DEFEAT";
        if (endSub) endSub.innerText = didWin ? "Mission Successful" : "Mission Failed";

        showOnly(screenEnd);
        
        // Hide HUD / Show BG
        if(topHUD) topHUD.classList.add("hidden");
        if(mpLobbyBG) mpLobbyBG.style.display = "block";

        setStatus(endStatus, didWin ? ("✅ " + (_endReason || "You won")) : ("❌ " + (_endReason || "You lost")), !didWin);
    }

    function _renderEndTable(snapshotPlayers = []) {
        if(!statsBody) return;
        statsBody.innerHTML = "";
        const myId = window.mpClient?.socket?.id;
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
    // UI BRIDGE (Connected to multiplayer-main.js)
    // ==========================================================
    window.mpUIBridge = {
        
        onConnected() {
            setStatus(joinStatus, "✅ Uplink Established. Ready.");
            __isGameRunning = false;
            __matchEnded = false;
            __winnerId = null;
        },

        onDisconnected(reason) {
            setStatus(joinStatus, "❌ Uplink Lost: " + reason, true);
            __startLocked = false;
            __isGameRunning = false;
            __matchEnded = false;
            if(btnStart) { btnStart.disabled = false; btnStart.innerText = "INITIATE LAUNCH"; }
            showOnly(screenJoin);
            
            if(topHUD) topHUD.classList.add("hidden");
            if(mpLobbyBG) mpLobbyBG.style.display = "block";
        },

        onLobbyUpdate(msg) {
            if (__isGameRunning) return;
            
            showOnly(screenLobby);
            
            // HUD & BG
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
            setStatus(lobbyStatus, isHost ? "You are Squad Leader. Launch when ready." : "Awaiting Launch Command.");
        },

        onGameStart(msg) {
            __isGameRunning = true;
            __matchEnded = false;
            __winnerId = null;

            // Hide Menus
            screenJoin?.classList.add("hidden");
            screenLobby?.classList.add("hidden");
            screenEnd?.classList.add("hidden");
            if(respawnOverlay) respawnOverlay.classList.add("hidden");
            
            // Show HUD / Hide BG
            if(topHUD) topHUD.classList.remove("hidden");
            if(mpLobbyBG) mpLobbyBG.style.display = "none";
            if(hudInfo) hudInfo.innerText = "STATUS: ENGAGED";

            // ✅ CRITICAL FIX: CONTROLS NOT WORKING (Input Focus Issue)
            // Name input se focus hatana padega taaki 'W,A,S,D' game me kaam kare
            if(inpName) inpName.blur();
            if(inpCode) inpCode.blur();
            window.focus(); // Browser window ko wapis focus karo

            setStatus(lobbyStatus, "Engaged.");
        },

        onGameOver(msg) {
            const winnerId = msg?.winnerId || null;
            const reason = msg?.reason || "Match ended";
            if (Array.isArray(msg?.players)) _renderEndTable(msg.players);
            _endMatch({ winnerId, reason });
        },

        setEndStats(players) { if (Array.isArray(players)) _renderEndTable(players); },

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

    // Initial State
    showOnly(screenJoin);
    
    // Auto-fill name if available
    const savedName = localStorage.getItem("SP_MP_NAME");
    if (savedName && inpName) inpName.value = savedName;

});
