/**
 * UIManager - Handles the HUD, Pause Menu, and Game Over screens.
 * Features a modern, skewed Sci-Fi/Cyberpunk aesthetic.
 */
class UIManager {
    constructor() {
        this.injectStyles(); // Inject CSS styles dynamically
        this.createDOM();    // Create HTML elements
        this.bindInternalEvents();
        this.onPlayAgain = null;

    }

    setOnPlayAgain(fn) {
    this.onPlayAgain = fn;
    }
    


    /**
     * Creates all necessary DOM elements for the UI.
     */
    createDOM() {
        // 1. HUD Container (Health, Boost, Score)
        this.hudContainer = document.createElement('div');
        this.hudContainer.id = 'game-hud';
        this.hudContainer.innerHTML = `
            <div class="hud-group bottom-left">
                <div class="bar-container health-box">
                    <div class="bar-label">HP</div>
                    <div class="bar-track">
                        <div class="bar-fill health-fill" id="healthBar"></div>
                    </div>
                </div>
                <div class="bar-container boost-box">
                    <div class="bar-label">BST</div>
                    <div class="bar-track">
                        <div class="bar-fill boost-fill" id="boostBar"></div>
                    </div>
                </div>
            </div>
            
            <div class="hud-group top-right">
                <div class="score-box">
                    <span class="score-label">SCORE</span>
                    <span id="scoreValue">0</span>
                </div>
                <button id="pauseBtn" class="icon-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
            </div>
        `;
        document.body.appendChild(this.hudContainer);

        // 2. Pause Menu Overlay
        this.pauseMenu = document.createElement('div');
        this.pauseMenu.id = 'pause-menu';
        this.pauseMenu.className = 'overlay hidden';
        this.pauseMenu.innerHTML = `
            <div class="menu-content">
                <h1 class="menu-title">PAUSED</h1>
                <div class="menu-buttons">
                    <button id="resumeBtn" class="menu-btn primary">RESUME</button>
                    <button id="settingsBtn" class="menu-btn">SETTINGS</button>
                    <button id="abortBtn" class="menu-btn danger">ABORT MISSION</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.pauseMenu);

        // Store references to buttons for external access (logic compatibility)
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resumeBtn = document.getElementById('resumeBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.abortBtn = document.getElementById('abortBtn');
        
        // Element references for updates
        this.healthBar = document.getElementById('healthBar');
        this.boostBar = document.getElementById('boostBar');
        this.scoreDisplay = document.getElementById('scoreValue');
    }

    /**
     * Injects the CSS for the modern UI directly into the head.
     */
    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* --- FONTS & VARS --- */
            @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap');
            
            :root {
                --ui-font: 'Rajdhani', sans-serif;
                --primary: #00f0ff; /* Cyber Cyan */
                --danger: #ff003c;  /* Cyber Red */
                --warning: #fcee0a; /* Cyber Yellow */
                --dark-bg: rgba(0, 0, 0, 0.85);
                --glass-bg: rgba(20, 30, 40, 0.6);
            }

            /* --- HUD LAYOUT --- */
            #game-hud {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; /* Let clicks pass through to game */
                z-index: 100;
                font-family: var(--ui-font);
            }

            .hud-group {
                position: absolute;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .bottom-left {
                bottom: 20px;
                left: 20px;
                transform: skewX(-15deg); /* Speedy look */
            }

            .top-right {
                top: 20px;
                right: 20px;
                align-items: flex-end;
            }

            /* --- BARS (Health & Boost) --- */
            .bar-container {
                display: flex;
                align-items: center;
                background: rgba(0,0,0,0.5);
                padding: 4px;
                border-left: 4px solid #555;
                width: 250px;
                transition: transform 0.2s;
            }

            .health-box { border-color: var(--danger); }
            .boost-box { border-color: var(--warning); width: 200px; }

            .bar-label {
                font-weight: 700;
                font-size: 1.2rem;
                color: #fff;
                width: 40px;
                text-align: center;
                text-shadow: 0 0 5px rgba(0,0,0,0.5);
            }

            .bar-track {
                flex-grow: 1;
                height: 12px;
                background: #222;
                margin-left: 5px;
                position: relative;
            }

            .bar-fill {
                height: 100%;
                width: 100%;
                transition: width 0.2s cubic-bezier(0.1, 0.8, 0.2, 1);
                box-shadow: 0 0 10px currentColor;
            }

            .health-fill { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
            .boost-fill { background: var(--warning); box-shadow: 0 0 8px var(--warning); }

            /* --- SCORE & PAUSE BTN --- */
            .score-box {
                background: var(--glass-bg);
                padding: 5px 20px;
                border-bottom: 2px solid var(--primary);
                color: white;
                font-size: 1.5rem;
                font-weight: bold;
                letter-spacing: 2px;
                margin-bottom: 10px;
                transform: skewX(-15deg);
                text-shadow: 0 0 5px var(--primary);
            }
            
            .score-label { font-size: 0.8rem; opacity: 0.8; margin-right: 8px; }

            .icon-btn {
                background: var(--glass-bg);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                width: 48px;
                height: 48px;
                cursor: pointer;
                pointer-events: auto; /* Enable clicks */
                transition: all 0.2s;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .icon-btn:hover {
                background: var(--primary);
                color: black;
                box-shadow: 0 0 15px var(--primary);
            }

            .icon-btn svg { width: 24px; height: 24px; }

            /* --- PAUSE MENU OVERLAY --- */
            .overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(10, 10, 15, 0.85);
                backdrop-filter: blur(8px);
                z-index: 200;
                display: flex;
                justify-content: center;
                align-items: center;
                opacity: 1;
                transition: opacity 0.3s;
                font-family: var(--ui-font);
            }

            .overlay.hidden {
                opacity: 0;
                pointer-events: none;
            }

            .menu-content {
                background: rgba(0,0,0,0.6);
                padding: 40px 60px;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 0 30px rgba(0,0,0,0.5);
                transform: scale(1);
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                min-width: 300px;
            }
            
            .overlay.hidden .menu-content {
                transform: scale(0.9);
            }

            .menu-title {
                color: white;
                font-size: 3rem;
                margin: 0 0 30px 0;
                text-transform: uppercase;
                letter-spacing: 5px;
                text-shadow: 0 0 10px rgba(255,255,255,0.3);
                border-bottom: 2px solid var(--primary);
                padding-bottom: 10px;
            }

            .menu-buttons {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .menu-btn {
                background: transparent;
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 12px 24px;
                font-size: 1.2rem;
                font-family: var(--ui-font);
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
                letter-spacing: 2px;
                position: relative;
                overflow: hidden;
            }

            .menu-btn:hover {
                background: rgba(255,255,255,0.1);
                border-color: white;
                letter-spacing: 4px;
            }

            .menu-btn.primary {
                background: var(--primary);
                color: black;
                border-color: var(--primary);
            }
            .menu-btn.primary:hover {
                background: #fff;
                box-shadow: 0 0 20px var(--primary);
            }

            .menu-btn.danger:hover {
                border-color: var(--danger);
                color: var(--danger);
                box-shadow: 0 0 15px var(--danger);
            }

            /* Mobile Adjustments */
            @media (max-width: 768px) {
                .bottom-left { bottom: 10px; left: 10px; transform: none; }
                .top-right { top: 10px; right: 10px; }
                .bar-container { width: 180px; }
                .menu-title { font-size: 2rem; }
            }
        `;
        document.head.appendChild(style);
    }

    bindInternalEvents() {
        // Just empty for now, logic is handled by external game loop as per snippet
    }

    // --- Public Methods to Control UI ---

    /**
     * Shows the pause menu with animation
     */
    showPause() {
        this.pauseMenu.classList.remove('hidden');
        this.hudContainer.style.filter = 'blur(4px)'; // Blur HUD too
    }

    /**
     * Hides the pause menu
     */
    hidePause() {
        this.pauseMenu.classList.add('hidden');
        this.hudContainer.style.filter = 'none';
    }

    showVictory() {
    // If you already have a gameOverScreen, reuse it.
    // Otherwise simple pause-like overlay use kar lo:

    // ✅ If pause menu exists, use it as victory modal
    this.showPause();

    // Title change
    const title = this.pauseMenu.querySelector(".menu-title");
    if (title) title.innerText = "MISSION COMPLETE";

    // Buttons text tweak (optional)
    if (this.resumeBtn) this.resumeBtn.innerText = "▶ PLAY AGAIN";
    if (this.abortBtn) this.abortBtn.innerText = "⬅ MAIN MENU";

    // Settings button optional hide
    if (this.settingsBtn) this.settingsBtn.style.display = "none";
    }

    showGameOver() {
    this.showPause();

    const title = this.pauseMenu.querySelector(".menu-title");
    if (title) title.innerText = "SYSTEM FAILURE";

    if (this.resumeBtn) this.resumeBtn.innerText = "RESTART";
    if (this.abortBtn) this.abortBtn.innerText = "ABORT MISSION";
    if (this.settingsBtn) this.settingsBtn.style.display = "inline-block";
    }


    /**
     * Update Health Bar
     * @param {number} current - Current Health
     * @param {number} max - Max Health
     */
    updateHealth(current, max) {
        const pct = Math.max(0, Math.min(100, (current / max) * 100));
        if(this.healthBar) this.healthBar.style.width = `${pct}%`;
    }

    /**
     * Update Boost Bar
     * @param {number} current 
     * @param {number} max 
     */
    updateBoost(current, max) {
        const pct = Math.max(0, Math.min(100, (current / max) * 100));
        if(this.boostBar) this.boostBar.style.width = `${pct}%`;
    }

    /**
     * Update Score
     * @param {number} score 
     */
    updateScore(score) {
        if(this.scoreDisplay) this.scoreDisplay.innerText = Math.floor(score);
    }
    /**
     * Backward compatibility with old code:
     * update(speed, health, score, boostEnergy)
     */
    update(speed, health, score, boostEnergy = 100) {
        // health
        this.updateHealth(health, 100);

        // boost
        const boostMax = (typeof PHYSICS_CONFIG !== "undefined" && PHYSICS_CONFIG.boostMax)
            ? PHYSICS_CONFIG.boostMax
            : 100;

        this.updateBoost(boostEnergy, boostMax);

        // score
        this.updateScore(score);
    }

}

window.UIManager = UIManager;
