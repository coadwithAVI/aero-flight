// ==========================================
// PATH: multiplayer/mp-ui-manager.js
// ==========================================

class MPUIManager {
    constructor(mpClient, procAudio = null) {
        this.mpClient = mpClient;
        this.procAudio = procAudio;

        // prevent duplicates
        if (window.__mpUIManagerInstance) {
            console.warn("⚠️ MPUIManager already exists. Using existing instance.");
            return window.__mpUIManagerInstance;
        }
        window.__mpUIManagerInstance = this;

        this.uiRoot = null;
        this.lobbyPanel = null;
        this.statusText = null;
        this.startBtn = null;

        this.onStartClicked = null;

        this.gameRunning = false;

        this.injectStyles();
        this.createDOM();
        this.bindEvents();
        this.showLobby();

        // ✅ start button should work always
        this.setStatus("Press START to begin");
        if (this.startBtn) this.startBtn.disabled = false;
    }

    injectStyles() {
        if (document.getElementById("mpUIStyles")) return;

        const style = document.createElement("style");
        style.id = "mpUIStyles";
        style.innerHTML = `
            #mp-ui-root{
                position: fixed;
                inset: 0;
                z-index: 9999;
                display:flex;
                align-items:center;
                justify-content:center;
                pointer-events:none;
                font-family: Arial, Helvetica, sans-serif;
            }

            #mp-ui-root.hidden{ display:none; }

            .mp-panel{
                pointer-events:auto;
                width:min(520px, 92vw);
                border-radius:18px;
                padding:22px 22px;
                background: rgba(10,10,15,0.85);
                border: 1px solid rgba(255,255,255,0.12);
                backdrop-filter: blur(8px);
                box-shadow: 0 0 40px rgba(0,0,0,0.55);
                color:#fff;
            }

            .mp-title{
                font-size: 28px;
                font-weight: 800;
                letter-spacing: 1px;
                margin: 0 0 6px 0;
                text-transform: uppercase;
            }

            .mp-sub{
                margin: 0 0 18px 0;
                opacity:0.8;
                font-size: 14px;
                line-height:1.3;
            }

            .mp-status{
                padding: 12px 14px;
                border-radius: 12px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.08);
                margin-bottom: 16px;
                font-size: 14px;
                opacity: 0.95;
            }

            .mp-row{
                display:flex;
                gap: 12px;
                flex-wrap:wrap;
                align-items:center;
                justify-content:flex-end;
            }

            .mp-btn{
                border: none;
                border-radius: 12px;
                padding: 12px 18px;
                font-weight: 800;
                letter-spacing: 0.5px;
                cursor:pointer;
                transition: transform 0.15s, opacity 0.15s;
                text-transform: uppercase;
                user-select:none;
            }

            .mp-btn:active{ transform: scale(0.98); }

            .mp-btn.primary{
                background: #00f0ff;
                color: #000;
            }
            .mp-btn.primary:hover{
                opacity:0.92;
            }

            .mp-btn.secondary{
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.15);
                color: #fff;
            }
        `;
        document.head.appendChild(style);
    }

    createDOM() {
        if (document.getElementById("mp-ui-root")) {
            this.uiRoot = document.getElementById("mp-ui-root");
            return;
        }

        this.uiRoot = document.createElement("div");
        this.uiRoot.id = "mp-ui-root";

        this.lobbyPanel = document.createElement("div");
        this.lobbyPanel.className = "mp-panel";

        this.lobbyPanel.innerHTML = `
            <div class="mp-title">Multiplayer Lobby</div>
            <div class="mp-sub">
                START dabao aur game begin karo.
            </div>
            <div class="mp-status" id="mpStatusText">Press START to begin</div>
            <div class="mp-row">
                <button class="mp-btn secondary" id="mpLeaveBtn">Leave</button>
                <button class="mp-btn primary" id="mpStartBtn">Start</button>
            </div>
        `;

        this.uiRoot.appendChild(this.lobbyPanel);
        document.body.appendChild(this.uiRoot);

        this.statusText = this.lobbyPanel.querySelector("#mpStatusText");
        this.startBtn = this.lobbyPanel.querySelector("#mpStartBtn");
        this.leaveBtn = this.lobbyPanel.querySelector("#mpLeaveBtn");
    }

    bindEvents() {
        if (this.startBtn) {
            this.startBtn.addEventListener("click", () => {
                if (this.gameRunning) return;

                this.setStatus("Starting...");
                this.hideLobby();
                this.gameRunning = true;

                try {
                    if (this.procAudio && typeof this.procAudio.unlock === "function") {
                        this.procAudio.unlock();
                    }
                } catch (e) {}

                if (typeof this.onStartClicked === "function") {
                    this.onStartClicked();
                }
            });
        }

        if (this.leaveBtn) {
            this.leaveBtn.addEventListener("click", () => {
                // if you want: go back to menu
                window.location.href = "index.html";
            });
        }
    }

    setStatus(text) {
        if (this.statusText) this.statusText.textContent = text;
    }

    showLobby() {
        if (this.uiRoot) this.uiRoot.classList.remove("hidden");
    }

    hideLobby() {
        if (this.uiRoot) this.uiRoot.classList.add("hidden");
    }

    showConnected() {
        this.setStatus("✅ Connected. Press START.");
    }

    showDisconnected() {
        this.setStatus("❌ Disconnected.");
        this.showLobby();
    }

    showError(msg) {
        this.setStatus("❌ Error: " + msg);
        this.showLobby();
    }
}

window.MPUIManager = MPUIManager;
