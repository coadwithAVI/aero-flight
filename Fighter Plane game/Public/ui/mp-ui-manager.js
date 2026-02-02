// ==========================================================
// Multiplayer UI Controller (FINAL)
// ==========================================================
const el = (id) => document.getElementById(id);

// Screens
const screenJoin = el("screenJoin");
const screenLobby = el("screenLobby");
const screenEnd = el("screenEnd");
const topHUD = el("topHUD");
const mpLobbyBG = el("mpLobbyBG");

// Inputs
const inpName = el("inpName");
const inpCode = el("inpCode");

// Status Texts
const joinStatus = el("joinStatus");
const lobbyStatus = el("lobbyStatus");
const endStatus = el("endStatus");

// Dynamic Elements
const lobbyCode = el("lobbyCode");
const playerList = el("playerList");
const hudRoom = el("hudRoom");
const hudName = el("hudName");
const hudInfo = el("hudInfo");
const endTitle = el("endTitle");
const endSub = el("endSub");
const statsBody = el("statsBody");

// ✅ NEW: Respawn Elements
const respawnOverlay = el("respawnOverlay");
const respawnTimer = el("respawnTimer");

// Buttons
const btnCreate = el("btnCreate");
const btnJoin = el("btnJoin");
const btnBack = el("btnBack");
const btnStart = el("btnStart");
const btnLeave = el("btnLeave");
const btnReplay = el("btnReplay");
const btnEndBack = el("btnEndBack");

// --- LOGIC FLAGS ---
let __startLocked = false;
let __isGameRunning = false;
let __matchEnded = false;
let __winnerId = null;
let __endReason = "";

function showOnly(screen) {
  [screenJoin, screenLobby, screenEnd].forEach(s => s.classList.add("hidden"));
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

// Input Listeners
if (inpCode) {
    inpCode.addEventListener("input", () => {
        inpCode.value = sanitizeCode(inpCode.value);
    });
}

// Button Actions
if (btnBack) btnBack.onclick = () => window.location.href = "./index.html";
if (btnEndBack) btnEndBack.onclick = () => window.location.href = "./index.html";

if (btnCreate) {
    btnCreate.onclick = () => {
        const name = (inpName.value || "Pilot").trim();
        if (!window.mpClient) return setStatus(joinStatus, "Connection Module Offline", true);

        __startLocked = false;
        if(btnStart) btnStart.disabled = false;
        setStatus(joinStatus, "Initializing Lobby.");
        window.mpClient.createRoom(name);
    };
}

if (btnJoin) {
    btnJoin.onclick = () => {
        const name = (inpName.value || "Pilot").trim();
        const code = sanitizeCode(inpCode.value);

        if (!code || code.length !== 4) return setStatus(joinStatus, "Invalid Access Code", true);
        if (!window.mpClient) return setStatus(joinStatus, "Connection Module Offline", true);

        __startLocked = false;
        if(btnStart) btnStart.disabled = false;
        setStatus(joinStatus, "Connecting to Squad.");
        window.mpClient.joinRoom(code, name);
    };
}

if (btnLeave) {
    btnLeave.onclick = () => {
        window.location.reload();
    };
}

if (btnStart) {
    btnStart.onclick = () => {
        if (__startLocked) return;
        if (!window.mpClient?.roomId) return;

        __startLocked = true;
        btnStart.disabled = true;
        btnStart.innerText = "LAUNCHING.";
        
        console.log("🚀 INITIATING LAUNCH SEQUENCE", window.mpClient.roomId);
        window.mpClient.startGame();
        setStatus(lobbyStatus, "Launch Sequence Initiated.");
    };
}

if (btnReplay) {
    btnReplay.onclick = () => {
        setStatus(endStatus, "Re-engaging systems...");
        setTimeout(() => window.location.reload(), 650);
    };
}

// ==========================================================
// Helpers
// ==========================================================
function _safeText(v, fallback = "-") {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function _endMatch({ winnerId, reason }) {
  if (__matchEnded) return;
  __matchEnded = true;
  __winnerId = winnerId || null;
  __endReason = reason || "";

  // Inform HUD
  const myId = window.mpClient?.clientId;
  const didWin = !!(__winnerId && myId && (__winnerId === myId));

  if (endTitle) endTitle.innerText = didWin ? "VICTORY" : "DEFEAT";
  if (endSub) endSub.innerText = didWin ? "Mission Successful" : "Mission Failed";

  showOnly(screenEnd);
  if(topHUD) topHUD.classList.add("hidden");
  if(mpLobbyBG) mpLobbyBG.style.display = "block";
  __isGameRunning = false;

  setStatus(endStatus, didWin ? ("✅ " + (_endReason || "You won")) : ("❌ " + (_endReason || "You lost")), !didWin);

  try {
    window.gameManager?.stop?.();
  } catch (e) {
    console.warn("game stop failed:", e);
  }
}

function _renderEndTable(snapshotPlayers = []) {
  if(!statsBody) return;
  statsBody.innerHTML = "";

  const myId = window.mpClient?.clientId;
  const list = [...snapshotPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const p of list) {
    const tr = document.createElement("tr");

    const name = p.name || p.id || "Pilot";
    const kills = p.kills ?? 0;
    const deaths = p.deaths ?? 0;
    const rings = p.rings ?? 0;
    const score = p.score ?? 0;

    tr.innerHTML = `
      <td>${_safeText(name)} ${p.id === __winnerId ? "🏆" : ""} ${p.id === myId ? "(YOU)" : ""}</td>
      <td>${_safeText(kills, 0)}</td>
      <td>${_safeText(deaths, 0)}</td>
      <td>${_safeText(rings, 0)}</td>
      <td>${_safeText(score, 0)}</td>
    `;
    statsBody.appendChild(tr);
  }
}

// ==========================================================
// ✅ UI Bridge (Linked to Game Logic)
// ==========================================================
window.mpUIBridge = {
  // 1. Connection
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
    if(btnStart) {
        btnStart.disabled = false;
        btnStart.innerText = "INITIATE LAUNCH";
    }

    showOnly(screenJoin);
    if(topHUD) topHUD.classList.add("hidden");
    if(mpLobbyBG) mpLobbyBG.style.display = "block";
  },

  // 2. Lobby
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
          div.innerHTML = `
            <span>${p.name || "Pilot"}</span>
            ${p.isHost ? `<span class="tagHost">HOST</span>` : ``}
          `;
          playerList.appendChild(div);
        }
    }

    const isHost = !!msg.you?.isHost;
    if(btnStart) btnStart.style.display = isHost ? "block" : "none";
    setStatus(lobbyStatus, "Awaiting Launch Command.");
  },

  // 3. Game Start
  onGameStart(msg) {
    __isGameRunning = true;
    __matchEnded = false;
    __winnerId = null;

    screenJoin.classList.add("hidden");
    screenLobby.classList.add("hidden");
    screenEnd.classList.add("hidden");
    
    // ✅ Ensure overlay hidden on start
    if(respawnOverlay) respawnOverlay.classList.add("hidden");

    if(topHUD) topHUD.classList.remove("hidden");
    if(mpLobbyBG) mpLobbyBG.style.display = "none";

    if(hudInfo) hudInfo.innerText = "STATUS: ENGAGED";
    setStatus(lobbyStatus, "Engaged.");
  },

  // 4. Game Over
  onGameOver(msg) {
    const winnerId = msg?.winnerId || null;
    const reason = msg?.reason || "Match ended";
    if (Array.isArray(msg?.players)) _renderEndTable(msg.players);
    _endMatch({ winnerId, reason });
  },

  setEndStats(players) {
    if (!Array.isArray(players)) return;
    _renderEndTable(players);
  },

  // ✅ 5. RESPAWN UI CONTROLS (Called from multiplayer-main.js)
  showRespawn(seconds) {
    if (respawnOverlay) respawnOverlay.classList.remove("hidden");
    if (topHUD) topHUD.classList.add("hidden"); // Hide HUD during death
    if (respawnTimer) respawnTimer.innerText = seconds;
  },

  hideRespawn() {
    if (respawnOverlay) respawnOverlay.classList.add("hidden");
    if (topHUD) topHUD.classList.remove("hidden"); // Show HUD again
  }
};

// ==========================================================
// Extra: Client Side Win Check Fallback
// ==========================================================
window.mpVictory = {
  tryLastPlayerWinFromSnapshot(snapshot) {
    if (__matchEnded) return;
    if (!__isGameRunning) return;
    const players = snapshot?.players;
    if (!Array.isArray(players)) return;

    const alive = players.filter(p => p && p.id);
    if (alive.length === 1) {
      _renderEndTable(alive);
      _endMatch({ winnerId: alive[0].id, reason: "All other pilots disconnected" });
    }
  },

  tryRingWinFromSnapshot(snapshot) {
    if (__matchEnded) return;
    if (!__isGameRunning) return;

    const myId = window.mpClient?.clientId;
    if (!myId) return;

    const players = snapshot?.players;
    if (!Array.isArray(players)) return;

    const me = players.find(p => p?.id === myId);
    if (!me) return;

    const ringTarget = snapshot?.ringTarget ?? 10;
    if ((me.rings ?? 0) >= ringTarget) {
      _renderEndTable(players);
      _endMatch({ winnerId: myId, reason: "Objective completed: Rings cleared" });
    }
  }
};

// Default view
showOnly(screenJoin);
