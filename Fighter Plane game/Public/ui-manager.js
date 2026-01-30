/**
 * 🎮 UI MANAGER
 * Handles HUD, Minimap, Mobile Controls, Menus, and Game Over Screen.
 */
const UIManager = {
    canvasCtx: null,
    elements: {},

    init: function() {
        this.injectCSS();
        this.createHTML();
        
        // Setup Minimap
        const c = document.getElementById('minimap-canvas');
        if(c) this.canvasCtx = c.getContext('2d');
    },

    injectCSS: function() {
        const css = `
            body { margin: 0; overflow: hidden; background: #000; font-family: 'Segoe UI', sans-serif; user-select: none; -webkit-user-select: none; touch-action: none; }
            #ui-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
            
            /* HUD Panels */
            .hud-panel { position: absolute; padding: 15px; }
            .top-left { top: 10px; left: 10px; text-align: left; }
            .top-right { top: 10px; right: 10px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
            
            .hud-label { color: #00d2ff; font-weight: 900; font-size: 14px; margin-bottom: 5px; text-shadow: 0 0 5px #000; letter-spacing: 2px; }
            .bar-frame { width: 220px; height: 12px; background: rgba(0,0,0,0.6); border: 2px solid #555; transform: skewX(-20deg); margin-bottom: 10px; overflow: hidden; }
            
            #hp-fill { height: 100%; background: linear-gradient(90deg, #ff3333, #ff0000); width: 100%; transition: width 0.1s; box-shadow: 0 0 10px #f00; }
            #boost-fill { height: 100%; background: linear-gradient(90deg, #00d2ff, #0088ff); width: 100%; transition: width 0.1s; box-shadow: 0 0 10px #00f; }

            /* Minimap */
            #minimap-container { width: 150px; height: 150px; background: rgba(0, 10, 20, 0.8); border: 2px solid #00d2ff; border-radius: 50%; margin-top: 10px; position: relative; overflow: hidden; box-shadow: 0 0 20px rgba(0, 210, 255, 0.2); }
            
            /* Menus (Start, Pause, Game Over) */
            #start-overlay, #pause-menu, #game-over-screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 100; pointer-events: auto; }
            #pause-menu, #game-over-screen { display: none; background: rgba(0,0,0,0.85); }
            
            h1 { color: #fff; font-size: 50px; text-shadow: 0 0 20px #00d2ff; margin-bottom: 10px; text-align: center; }
            .sub-text { color:#aaa; margin-bottom:30px; letter-spacing:3px; font-size: 18px; text-align: center; }
            
            .btn { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid #00d2ff; padding: 15px 50px; font-size: 18px; font-weight: bold; cursor: pointer; transition: 0.3s; transform: skewX(-10deg); margin-top: 15px; }
            .btn:hover { background: #00d2ff; color: #000; box-shadow: 0 0 20px #00d2ff; }

            /* Victory/Defeat Specifics */
            .victory-text { color: #ffd700; text-shadow: 0 0 30px #ffd700; border-bottom: 3px solid #ffd700; }
            .defeat-text { color: #ff3333; text-shadow: 0 0 30px #ff0000; border-bottom: 3px solid #ff3333; }
            
            /* --- MOBILE CONTROLS --- */
            .mobile-controls { display: none; }
            @media (pointer: coarse) { .mobile-controls { display: block; } }
            
            #dpad { position: absolute; bottom: 20px; left: 20px; width: 150px; height: 150px; pointer-events: auto; }
            .d-btn { position: absolute; width: 50px; height: 50px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; backdrop-filter: blur(2px); }
            .d-btn:active { background: rgba(0, 210, 255, 0.5); }
            #btn-up { top: 0; left: 50px; }
            #btn-down { bottom: 0; left: 50px; }
            #btn-left { top: 50px; left: 0; }
            #btn-right { top: 50px; right: 0; }

            #actions { position: absolute; bottom: 20px; right: 20px; width: 160px; height: 120px; pointer-events: auto; }
            .act-btn { position: absolute; border-radius: 50%; color: white; font-weight: bold; border: 2px solid white; display: flex; justify-content: center; align-items: center; }
            #btn-fire { width: 80px; height: 80px; bottom: 0; right: 0; background: rgba(255, 0, 0, 0.3); border-color: #ff4444; }
            #btn-fire:active { background: rgba(255, 0, 0, 0.8); }
            #btn-boost { width: 60px; height: 60px; bottom: 20px; right: 90px; background: rgba(0, 210, 255, 0.3); border-color: #00d2ff; }
            #btn-boost:active { background: rgba(0, 210, 255, 0.8); }
        `;
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    },

    createHTML: function() {
        const root = document.body;
        
        // Start Screen
        const startDiv = document.createElement('div');
        startDiv.id = 'start-overlay';
        startDiv.innerHTML = `
            <h1>SKY PILOT</h1>
            <div class="sub-text">TACTICAL DOGFIGHT</div>
            <button class="btn" onclick="startGame()">LAUNCH MISSION</button>
            <button class="btn" style="border-color:#555; color:#777;" onclick="location.href='index.html'">ABORT</button>
        `;
        root.appendChild(startDiv);

        // Pause Menu
        const pauseDiv = document.createElement('div');
        pauseDiv.id = 'pause-menu';
        pauseDiv.innerHTML = `
            <h2 style="color:white; letter-spacing:5px;">SYSTEM PAUSED</h2>
            <button class="btn" onclick="togglePause()">RESUME</button>
            <button class="btn" onclick="toggleSound()">TOGGLE SOUND</button>
            <button class="btn" style="border-color:#f00; color:#f00;" onclick="location.href='index.html'">EXIT</button>
        `;
        root.appendChild(pauseDiv);

        // Game Over Screen (NEW)
        const goDiv = document.createElement('div');
        goDiv.id = 'game-over-screen';
        goDiv.innerHTML = `
            <h1 id="go-title">MISSION STATUS</h1>
            <div id="go-msg" class="sub-text">REPORT</div>
            <button class="btn" onclick="location.reload()">RETRY MISSION</button>
            <button class="btn" style="border-color:#555; color:#aaa;" onclick="location.href='index.html'">RETURN TO BASE</button>
        `;
        root.appendChild(goDiv);

        // HUD
        const hudDiv = document.createElement('div');
        hudDiv.id = 'ui-layer';
        hudDiv.style.display = 'none';
        hudDiv.innerHTML = `
            <div class="hud-panel top-left">
                <div class="hud-label">HEALTH</div>
                <div class="bar-frame"><div id="hp-fill"></div></div>
                <div class="hud-label" style="font-size:12px; color:#ffd700;">RINGS: <span id="ring-txt">0/0</span></div>
            </div>
            <div class="hud-panel top-right">
                <div class="hud-label">BOOST</div>
                <div class="bar-frame"><div id="boost-fill"></div></div>
                <div id="minimap-container"><canvas id="minimap-canvas" width="150" height="150"></canvas></div>
            </div>
            <div class="mobile-controls">
                <div id="dpad">
                    <div id="btn-up" class="d-btn"></div>
                    <div id="btn-down" class="d-btn"></div>
                    <div id="btn-left" class="d-btn"></div>
                    <div id="btn-right" class="d-btn"></div>
                </div>
                <div id="actions">
                    <div id="btn-boost" class="act-btn">BST</div>
                    <div id="btn-fire" class="act-btn">FIRE</div>
                </div>
            </div>
        `;
        root.appendChild(hudDiv);

        this.elements = {
            start: startDiv,
            pause: pauseDiv,
            gameOver: goDiv,
            goTitle: goDiv.querySelector('#go-title'),
            goMsg: goDiv.querySelector('#go-msg'),
            hud: hudDiv,
            hp: document.getElementById('hp-fill'),
            boost: document.getElementById('boost-fill'),
            rings: document.getElementById('ring-txt')
        };
    },

    updateHUD: function(stats, totalRings) {
        if(this.elements.hp) this.elements.hp.style.width = Math.max(0, stats.hp) + "%";
        if(this.elements.boost) this.elements.boost.style.width = Math.max(0, stats.boost) + "%";
        if(this.elements.rings) this.elements.rings.innerText = `${stats.rings}/${totalRings}`;
    },

    togglePause: function(isPaused) {
        this.elements.pause.style.display = isPaused ? 'flex' : 'none';
    },

    // --- NEW: Game Over Logic ---
    showGameOver: function(isVictory) {
        this.elements.hud.style.display = 'none'; // Hide HUD
        this.elements.gameOver.style.display = 'flex'; // Show Screen
        
        if(isVictory) {
            this.elements.goTitle.innerText = "MISSION ACCOMPLISHED";
            this.elements.goTitle.className = "victory-text";
            this.elements.goMsg.innerText = "AIRSPACE SECURED. GREAT WORK, ACE!";
            this.elements.goMsg.style.color = "#ffd700";
        } else {
            this.elements.goTitle.innerText = "MISSION FAILED";
            this.elements.goTitle.className = "defeat-text";
            this.elements.goMsg.innerText = "AIRCRAFT CRASHED OR SHOT DOWN.";
            this.elements.goMsg.style.color = "#ff4444";
        }
    },

    hideStartScreen: function() {
        this.elements.start.style.display = 'none';
        this.elements.hud.style.display = 'block';
        if(/Android|iPhone|iPad/i.test(navigator.userAgent)) {
            document.querySelector('.mobile-controls').style.display = 'block';
        }
    },

    drawMinimap: function(player, rings, bots) {
        if(!this.canvasCtx || !player) return;
        const ctx = this.canvasCtx;
        
        ctx.fillStyle = 'rgba(0, 10, 20, 0.6)';
        ctx.fillRect(0, 0, 150, 150);
        
        const range = 5000;
        const center = 75;
        
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(-player.rotation.y); 

        ctx.fillStyle = '#ffd700';
        rings.forEach(r => {
            if(!r.visible) return;
            const dx = (r.position.x - player.position.x)/range*center;
            const dz = (r.position.z - player.position.z)/range*center;
            if(Math.sqrt(dx*dx + dz*dz) < center) {
                ctx.beginPath(); ctx.arc(dx, dz, 4, 0, Math.PI*2); ctx.fill();
            }
        });

        ctx.fillStyle = '#ff0000';
        bots.forEach(b => {
            const dx = (b.position.x - player.position.x)/range*center;
            const dz = (b.position.z - player.position.z)/range*center;
            if(Math.sqrt(dx*dx + dz*dz) < center) {
                ctx.beginPath(); ctx.arc(dx, dz, 3, 0, Math.PI*2); ctx.fill();
            }
        });

        ctx.fillStyle = '#00ff00';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-5, 6); ctx.lineTo(5, 6); ctx.fill();
        ctx.restore();
    }
};
window.UIManager = UIManager;
