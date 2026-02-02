// ==========================================================
// Multiplayer UI Controller (Extracted)
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
let __isGameRunning = false; // ✅ Prevents Lobby from popping up during game

// ✅ Victory/Defeat state
let __matchEnded = false;
let __winnerId = null;
let __endReason = "";

function showOnly(screen) {
  [screenJoin, screenLobby, screenEnd].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function setStatus(element, text, isError = false) {
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
    btnStart.disabled = false;
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
    btnStart.disabled = false;
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
    // client-side "replay" for now
    setStatus(endStatus, "Re-engaging systems...");
    setTimeout(() => window.location.reload(), 650);
    };
}

// ==========================================================
// ✅ Victory/Defeat Helpers
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

  endTitle.innerText = didWin ? "VICTORY" : "DEFEAT";
  endSub.innerText = didWin ? "Mission Successful" : "Mission Failed";

  showOnly(screenEnd);
  topHUD.classList.add("hidden");
  mpLobbyBG.style.display = "block";
  __isGameRunning = false;

  setStatus(endStatus, didWin ? ("✅ " + (_endReason || "You won")) : ("❌ " + (_endReason || "You lost")), !didWin);

  // Optional: stop game loop
  try {
    window.gameManager?.stop?.();
  } catch (e) {
    console.warn("game stop failed:", e);
  }
}

function _renderEndTable(snapshotPlayers = []) {
  // snapshotPlayers: array from server snapshot (msg.players)
  statsBody.innerHTML = "";

  const myId = window.mpClient?.clientId;

  // sort by score descending
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
// UI Bridge (Linked to Game Logic)
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
    btnStart.disabled = false;
    btnStart.innerText = "INITIATE LAUNCH";

    showOnly(screenJoin);
    topHUD.classList.add("hidden");
    mpLobbyBG.style.display = "block";
  },

  onLobbyUpdate(msg) {
    // ✅ CRITICAL FIX: Ignore lobby updates if game is running
    if (__isGameRunning) return;

    showOnly(screenLobby);
    topHUD.classList.remove("hidden");
    mpLobbyBG.style.display = "block";

    // Room code
    lobbyCode.innerText = msg.roomId || "----";

    // HUD updates
    hudRoom.innerText = "ROOM: " + (msg.roomId || "----");
    hudName.innerText = "PILOT: " + (msg.you?.name || inpName.value || "PILOT");
    hudInfo.innerText = "STATUS: LOBBY";

    // player list
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

    // host check
    const isHost = !!msg.you?.isHost;
    btnStart.style.display = isHost ? "block" : "none";

    setStatus(lobbyStatus, "Awaiting Launch Command.");
  },

  // ✅ called from mp-client on game start
  onGameStart(msg) {
    __isGameRunning = true;
    __matchEnded = false;
    __winnerId = null;

    // ✅ CRITICAL FIX: Explicitly hide all UI screens so canvas shows
    screenJoin.classList.add("hidden");
    screenLobby.classList.add("hidden");
    screenEnd.classList.add("hidden");

    topHUD.classList.remove("hidden");
    mpLobbyBG.style.display = "none";

    hudInfo.innerText = "STATUS: ENGAGED";
    setStatus(lobbyStatus, "Engaged.");
  },

  // ✅ server game over (if server supports)
  onGameOver(msg) {
    // msg: {winnerId, reason, players?}
    const winnerId = msg?.winnerId || null;
    const reason = msg?.reason || "Match ended";
    if (Array.isArray(msg?.players)) _renderEndTable(msg.players);
    _endMatch({ winnerId, reason });
  },

  // ✅ update end screen table anytime
  setEndStats(players) {
    if (!Array.isArray(players)) return;
    _renderEndTable(players);
  }
};

// ==========================================================
// ✅ EXTRA Victory/Defeat logic (Client side fallback)
// ==========================================================
// - If everyone leaves and you are last -> VICTORY
// - If your rings reach target -> VICTORY
window.mpVictory = {
  tryLastPlayerWinFromSnapshot(snapshot) {
    if (__matchEnded) return;
    if (!__isGameRunning) return;
    const players = snapshot?.players;

    if (!Array.isArray(players)) return;

    // only count active players
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

    // If server uses ring count in snapshot: p.rings
    // You can tweak target
    const ringTarget = snapshot?.ringTarget ?? 10;

    if ((me.rings ?? 0) >= ringTarget) {
      _renderEndTable(players);
      _endMatch({ winnerId: myId, reason: "Objective completed: Rings cleared" });
    }
  }
};

// Default view
showOnly(screenJoin);
