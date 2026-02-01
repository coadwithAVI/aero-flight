// ==========================================
// PATH: ui/mp-ui.js
// ==========================================

/**
 * MPUI (FINAL - Lobby + Menu + End Screen)
 *
 * Screens:
 * ✅ Main menu: Name + Create + Code + Join
 * ✅ Lobby: Room code + player list + host badge + start/leave
 * ✅ HUD small text
 * ✅ End screen: stats + replay/back
 *
 * This UI does NOT start game directly.
 * Multiplayer-main.js will control GameManager start.
 */

class MPUI {
  constructor() {
    this.injectStyles();
    this.createDOM();

    // state
    this.currentScreen = "menu"; // menu | lobby | end
    this.roomId = null;
    this.isHost = false;

    // callbacks hooks
    this.onCreate = null;
    this.onJoin = null;
    this.onLeave = null;
    this.onStart = null;
    this.onReplay = null;
    this.onBackToMenu = null;

    // default screen
    this.showMenu();
  }

  // ==========================================================
  // Styles
  // ==========================================================
  injectStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
      :root{
        --mp-cyan:#00f3ff;
        --mp-blue:#0066ff;
        --mp-bg: rgba(5, 12, 20, 0.82);
        --mp-card: rgba(10, 25, 40, 0.65);
        --mp-border: rgba(0, 243, 255, 0.18);
        --mp-white: rgba(255,255,255,0.92);
      }

      .mp-overlay{
        position: fixed;
        inset:0;
        z-index: 3000;
        display:flex;
        align-items:center;
        justify-content:center;
        background: radial-gradient(circle at center, rgba(10,35,55,0.55) 0%, rgba(0,0,0,0.95) 75%);
        font-family: Arial, Helvetica, sans-serif;
      }

      .mp-card{
        width: min(560px, 92vw);
        border: 1px solid var(--mp-border);
        background: var(--mp-card);
        backdrop-filter: blur(12px);
        box-shadow: 0 0 60px rgba(0,0,0,0.55);
        border-radius: 18px;
        padding: 22px 22px;
        color: var(--mp-white);
      }

      .mp-title{
        margin: 0;
        font-size: 34px;
        letter-spacing: 2px;
        font-weight: 900;
        text-transform: uppercase;
        color: #fff;
        text-shadow: 0 0 16px rgba(0,243,255,0.25);
      }
      .mp-sub{
        margin-top: 6px;
        opacity: 0.8;
        font-size: 13px;
        letter-spacing: 1px;
      }

      .mp-row{
        margin-top: 14px;
        display:flex;
        gap: 10px;
        align-items:center;
      }

      .mp-input{
        flex: 1;
        padding: 12px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(0,0,0,0.35);
        color: #fff;
        outline: none;
        font-size: 14px;
      }
      .mp-input:focus{
        border-color: rgba(0,243,255,0.55);
        box-shadow: 0 0 0 3px rgba(0,243,255,0.12);
      }

      .mp-btn{
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08);
        color: #fff;
        cursor:pointer;
        font-weight: 800;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        transition: transform 0.15s ease, opacity 0.15s ease, background 0.2s;
        user-select:none;
      }
      .mp-btn:hover{ transform: translateY(-2px); opacity: 0.96; }
      .mp-btn:active{ transform: translateY(0px); opacity: 0.9; }

      .mp-btn.primary{
        background: rgba(0,243,255,0.14);
        border-color: rgba(0,243,255,0.65);
        color: var(--mp-cyan);
      }
      .mp-btn.primary:hover{
        background: rgba(0,243,255,0.30);
        box-shadow: 0 0 18px rgba(0,243,255,0.22);
      }

      .mp-btn.danger{
        background: rgba(255,0,60,0.16);
        border-color: rgba(255,0,60,0.40);
        color: rgba(255,220,230,0.95);
      }
      .mp-btn.danger:hover{
        box-shadow: 0 0 18px rgba(255,0,60,0.20);
      }

      .mp-split{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 14px;
      }
      @media (max-width:560px){
        .mp-split{ grid-template-columns: 1fr; }
      }

      .mp-section{
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }

      .mp-roomcode{
        font-family: Consolas, monospace;
        font-size: 26px;
        font-weight: 900;
        letter-spacing: 4px;
        color: var(--mp-cyan);
        text-shadow: 0 0 12px rgba(0,243,255,0.25);
      }

      .mp-players{
        margin-top: 10px;
        display:flex;
        flex-direction:column;
        gap: 8px;
      }
      .mp-player{
        display:flex;
        justify-content:space-between;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(0,0,0,0.25);
        border: 1px solid rgba(255,255,255,0.08);
        font-size: 14px;
      }
      .mp-badge{
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1px;
        padding: 4px 9px;
        border-radius: 999px;
        border: 1px solid rgba(0,243,255,0.25);
        background: rgba(0,243,255,0.10);
        color: var(--mp-cyan);
        text-transform: uppercase;
      }

      .mp-msg{
        margin-top: 10px;
        font-size: 13px;
        opacity: 0.85;
      }

      .mp-error{
        margin-top: 12px;
        font-size: 13px;
        color: rgba(255,140,140,0.95);
        font-weight: 700;
      }

      /* Small HUD */
      .mp-hud{
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 200;
        font-family: Consolas, monospace;
        font-size: 13px;
        color: rgba(255,255,255,0.8);
        background: rgba(0,0,0,0.35);
        border: 1px solid rgba(255,255,255,0.10);
        padding: 10px 12px;
        border-radius: 12px;
        pointer-events: none;
        display:none;
      }
    `;
    document.head.appendChild(style);
  }

  // ==========================================================
  // DOM
  // ==========================================================
  createDOM() {
    // overlay container
    this.overlay = document.createElement("div");
    this.overlay.className = "mp-overlay";

    this.card = document.createElement("div");
    this.card.className = "mp-card";
    this.overlay.appendChild(this.card);
    document.body.appendChild(this.overlay);

    // HUD
    this.hud = document.createElement("div");
    this.hud.className = "mp-hud";
    this.hud.innerHTML = `MP: <span id="mpHudRoom">----</span> • You: <span id="mpHudName">Pilot</span>`;
    document.body.appendChild(this.hud);

    this.hudRoom = this.hud.querySelector("#mpHudRoom");
    this.hudName = this.hud.querySelector("#mpHudName");

    // build screens
    this._renderMenu();
  }

  // ==========================================================
  // Screen Renders
  // ==========================================================
  _renderMenu() {
    this.card.innerHTML = `
      <h1 class="mp-title">MULTIPLAYER</h1>
      <div class="mp-sub">Join lobby with a 4-char code OR create your own room.</div>

      <div class="mp-section">
        <div class="mp-sub" style="margin-bottom:8px;">PLAYER NAME</div>
        <input id="mpName" class="mp-input" placeholder="Enter IGN (max 12 chars)" maxlength="12" />
      </div>

      <div class="mp-split">
        <button id="mpCreate" class="mp-btn primary">Create Lobby</button>
        <button id="mpBack" class="mp-btn">Back</button>
      </div>

      <div class="mp-section">
        <div class="mp-sub" style="margin-bottom:8px;">JOIN WITH CODE</div>
        <div class="mp-row">
          <input id="mpCode" class="mp-input" placeholder="ROOM CODE (e.g. A9bZ)" maxlength="4" />
          <button id="mpJoin" class="mp-btn primary">Join</button>
        </div>
      </div>

      <div class="mp-error" id="mpErr" style="display:none;"></div>
      <div class="mp-msg">Tip: Host can start game once players are ready.</div>
    `;

    this.nameInput = this.card.querySelector("#mpName");
    this.codeInput = this.card.querySelector("#mpCode");
    this.errBox = this.card.querySelector("#mpErr");

    const createBtn = this.card.querySelector("#mpCreate");
    const joinBtn = this.card.querySelector("#mpJoin");
    const backBtn = this.card.querySelector("#mpBack");

    // defaults
    const cachedName = localStorage.getItem("SP_MP_NAME") || "Pilot";
    this.nameInput.value = cachedName;

    // events
    createBtn.onclick = () => {
      const name = this._readName();
      if (!name) return this.showError("Enter valid name.");
      localStorage.setItem("SP_MP_NAME", name);
      if (typeof this.onCreate === "function") this.onCreate(name);
    };

    joinBtn.onclick = () => {
      const name = this._readName();
      const code = this._readCode();
      if (!name) return this.showError("Enter valid name.");
      if (!code) return this.showError("Enter valid room code (4 chars).");
      localStorage.setItem("SP_MP_NAME", name);
      if (typeof this.onJoin === "function") this.onJoin(code, name);
    };

    backBtn.onclick = () => {
      if (typeof this.onBackToMenu === "function") this.onBackToMenu();
      else window.location.href = "./index.html";
    };
  }

  _renderLobby(roomId) {
    this.card.innerHTML = `
      <h1 class="mp-title">LOBBY</h1>
      <div class="mp-sub">Room Code</div>
      <div class="mp-roomcode" id="mpRoomCode">${roomId}</div>

      <div class="mp-section">
        <div class="mp-sub" style="margin-bottom:8px;">PLAYERS</div>
        <div id="mpPlayers" class="mp-players"></div>
      </div>

      <div class="mp-split">
        <button id="mpLeave" class="mp-btn danger">Leave</button>
        <button id="mpStart" class="mp-btn primary">Start</button>
      </div>

      <div class="mp-error" id="mpErr" style="display:none;"></div>
      <div class="mp-msg" id="mpLobbyMsg">Waiting for host...</div>
    `;

    this.playersBox = this.card.querySelector("#mpPlayers");
    this.errBox = this.card.querySelector("#mpErr");

    this.leaveBtn = this.card.querySelector("#mpLeave");
    this.startBtn = this.card.querySelector("#mpStart");
    this.lobbyMsg = this.card.querySelector("#mpLobbyMsg");

    this.leaveBtn.onclick = () => {
      if (typeof this.onLeave === "function") this.onLeave();
    };

    this.startBtn.onclick = () => {
      if (!this.isHost) return;
      if (typeof this.onStart === "function") this.onStart();
    };

    this._refreshLobbyButtons();
  }

  _renderEnd(stats = {}) {
    const winner = stats.winner || "Unknown";
    const rows = Array.isArray(stats.rows) ? stats.rows : [];

    this.card.innerHTML = `
      <h1 class="mp-title">MATCH RESULT</h1>
      <div class="mp-sub">Winner:</div>
      <div class="mp-roomcode" style="letter-spacing:1px;font-size:22px">${winner}</div>

      <div class="mp-section">
        <div class="mp-sub" style="margin-bottom:8px;">STATS</div>
        <div id="mpStats" class="mp-players"></div>
      </div>

      <div class="mp-split">
        <button id="mpReplay" class="mp-btn primary">Replay</button>
        <button id="mpBack" class="mp-btn">Back To Menu</button>
      </div>
    `;

    const statsBox = this.card.querySelector("#mpStats");
    statsBox.innerHTML = rows.map(r => {
      const name = r.name ?? "Pilot";
      const rings = r.rings ?? 0;
      const kills = r.kills ?? 0;
      const score = r.score ?? 0;
      return `
        <div class="mp-player">
          <div><b>${name}</b></div>
          <div style="opacity:0.9;font-family:Consolas,monospace;">
            R:${rings} • K:${kills} • S:${score}
          </div>
        </div>
      `;
    }).join("");

    this.card.querySelector("#mpReplay").onclick = () => {
      if (typeof this.onReplay === "function") this.onReplay();
    };

    this.card.querySelector("#mpBack").onclick = () => {
      if (typeof this.onBackToMenu === "function") this.onBackToMenu();
      else window.location.href = "./index.html";
    };
  }

  // ==========================================================
  // Public Screen Controls
  // ==========================================================
  showMenu() {
    this.currentScreen = "menu";
    this.roomId = null;
    this.isHost = false;

    this.overlay.style.display = "flex";
    this.hud.style.display = "none";

    this._renderMenu();
    this.clearError();
  }

  showLobby(roomId, isHost = false) {
    this.currentScreen = "lobby";
    this.roomId = roomId;
    this.isHost = !!isHost;

    this.overlay.style.display = "flex";
    this.hud.style.display = "block";

    this._renderLobby(roomId);
    this._refreshLobbyButtons();
    this.clearError();
  }

  hideOverlayShowHUD() {
    // when game starts
    this.overlay.style.display = "none";
    this.hud.style.display = "block";
  }

  showEnd(stats = {}) {
    this.currentScreen = "end";
    this.overlay.style.display = "flex";
    this.hud.style.display = "none";
    this._renderEnd(stats);
  }

  setHUD(name, roomId) {
    if (this.hudName) this.hudName.innerText = name || "Pilot";
    if (this.hudRoom) this.hudRoom.innerText = roomId || "----";
  }

  updateLobby(players = [], hostId = null, myId = null) {
    if (this.currentScreen !== "lobby") return;
    if (!this.playersBox) return;

    this.isHost = !!(myId && hostId && myId === hostId);

    this.playersBox.innerHTML = players.map(p => {
      const isHost = (p.id === hostId);
      const name = p.name || "Pilot";
      return `
        <div class="mp-player">
          <div>${name}</div>
          <div>${isHost ? `<span class="mp-badge">HOST</span>` : ""}</div>
        </div>
      `;
    }).join("");

    this._refreshLobbyButtons();
  }

  setLobbyMessage(msg) {
    if (this.lobbyMsg) this.lobbyMsg.innerText = msg;
  }

  // ==========================================================
  // Helpers
  // ==========================================================
  showError(msg) {
    if (!this.errBox) return;
    this.errBox.style.display = "block";
    this.errBox.innerText = msg;
  }

  clearError() {
    if (!this.errBox) return;
    this.errBox.style.display = "none";
    this.errBox.innerText = "";
  }

  _readName() {
    const raw = (this.nameInput?.value || "").trim();
    if (!raw) return "";
    return raw.substring(0, 12);
  }

  _readCode() {
    const raw = (this.codeInput?.value || "").trim();
    if (raw.length !== 4) return "";
    return raw; // we allow mix-case & numbers
  }

  _refreshLobbyButtons() {
    if (!this.startBtn) return;

    if (this.isHost) {
      this.startBtn.disabled = false;
      this.startBtn.style.opacity = "1";
      this.setLobbyMessage("You are host. Start when ready ✅");
    } else {
      this.startBtn.disabled = true;
      this.startBtn.style.opacity = "0.55";
      this.setLobbyMessage("Waiting for host to start...");
    }
  }
}

// global export
window.MPUI = MPUI;
