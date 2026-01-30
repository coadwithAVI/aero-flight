/**
 * 🎮 UI MANAGER
 * Handles HUD, Minimap, Mobile Controls, and Pause Menu.
 * Auto-injects HTML/CSS to keep main files clean.
 */

const UIManager = {
    canvasCtx: null,
    elements: {},

    // --- 1. INITIALIZATION (Creates HTML/CSS) ---
    init: function() {
        this.injectStyles();
        this.createHUD();
        this.createPauseMenu();
        
        // Setup Minimap Context
        const c = document.getElementById('minimap-canvas');
        if(c) this.canvasCtx = c.getContext('2d');
        
        console.log("✅ UI System Initialized");
    },

    // --- 2. CSS STYLES ---
    injectStyles: function() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* HUD Layout */
            #ui-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; user-select: none; }
            .hud-panel { position: absolute; padding: 15px; }
            .top-left { top: 10px; left: 10px; text-align: left; }
            .top-right { top: 10px; right: 10px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
            
            /* Bars & Text */
            .hud-label { color: #00d2ff; font-weight: 900; font-size: 16px; margin-bottom: 5px; text-shadow: 0 0 5px #000; letter-spacing: 2px; font-family: 'Segoe UI', sans-serif; }
            .bar-frame { width: 250px; height: 15px; background: rgba(0,0,0,0.6); border: 2px solid #555; transform: skewX(-20deg); margin-bottom: 10px; overflow: hidden; }
            #hp-fill { height: 100%; background: linear-gradient(90deg, #ff3333, #ff0000); width: 100%; transition: width 0.1s linear; box-shadow: 0 0 15px #f00; }
            #boost-fill { height: 100%; background: linear-gradient(90deg, #00d2ff, #0088ff); width: 100%; transition: width 0.1s linear; box-shadow: 0 0 15px #00f; }

            /* Minimap */
            #minimap-container {
                width: 160px; height: 160px;
                background: rgba(0, 10, 20, 0.85);
                border: 2px solid #00d2ff;
                border-radius: 50%;
                margin-top: 15px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 0 20px rgba(0, 210, 255, 0.3);
            }

            /* Pause Menu */
            #pause-menu { 
                display: none; position: absolute; top: 50%; left: 50%; 
                transform: translate(-50%, -50%); 
                background: rgba(0, 15, 30, 0.95); border: 2px solid white; 
                padding: 50px; text-align: center; pointer-events: auto; 
                box-shadow: 0 0 50px rgba(0,0,0,0.8); z-index: 90;
                font-family: 'Segoe UI', sans-serif;
            }
            .btn { 
                background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 2px solid #00d2ff; 
                padding: 15px 50px; font-size: 20px; font-weight: bold; cursor: pointer; 
                transition: 0.3s; transform: skewX(-10deg); margin-top: 20px; 
            }
            .btn:hover { background: #00d2ff; color: #000; box-shadow: 0 0 30px #00d2ff; transform: skewX(-10deg) scale(1.05); }
        `;
        document.head.appendChild(style);
    },

    // --- 3. HTML GENERATION ---
    createHUD: function() {
        const div = document.createElement('div');
        div.id = 'ui-layer';
        div.innerHTML = `
            <div class="hud-panel top-left">
                <div class="hud-label">HULL INTEGRITY</div>
                <div class="bar-frame"><div id="hp-fill"></div></div>
                <div class="hud-label" style="font-size:18px; color:#ffd700; margin-top:10px;">
                    TARGETS: <span id="ring-txt">0/0</span>
                </div>
                <div class="hud-label" style="font-size:14px; color:#aaa;">LAP: <span id="lap-txt">1</span></div>
            </div>

            <div class="hud-panel top-right">
                <div class="hud-label">AFTERBURNER</div>
                <div class="bar-frame"><div id="boost-fill"></div></div>
                <div id="minimap-container">
                    <canvas id="minimap-canvas" width="160" height="160"></canvas>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        
        // Cache elements for performance
        this.elements.hp = document.getElementById('hp-fill');
        this.elements.boost = document.getElementById('boost-fill');
        this.elements.rings = document.getElementById('ring-txt');
        this.elements.laps = document.getElementById('lap-txt');
    },

    createPauseMenu: function() {
        const div = document.createElement('div');
        div.id = 'pause-menu';
        div.innerHTML = `
            <h2 style="color:white; letter-spacing: 5px; margin-bottom: 30px;">SYSTEM PAUSED</h2>
            <button class="btn" onclick="togglePause()">RESUME</button><br><br>
            <button class="btn" onclick="toggleSound()">TOGGLE SOUND</button><br><br>
            <button class="btn" style="border-color:#ff4444; color:#ff4444;" onclick="location.href='index.html'">EXIT MISSION</button>
        `;
        document.body.appendChild(div);
        this.elements.pause = div;
    },

    // --- 4. UPDATE FUNCTIONS (Called from Game Loop) ---
    
    updateHUD: function(stats, config) {
        if(!this.elements.hp) return;
        
        this.elements.hp.style.width = Math.max(0, stats.hp) + "%";
        this.elements.boost.style.width = Math.max(0, stats.boost) + "%";
        this.elements.rings.innerText = stats.rings + "/" + (config.RINGS_TOTAL * config.LAPS);
        this.elements.laps.innerText = Math.min(config.LAPS, Math.ceil((stats.rings+0.1)/config.RINGS_TOTAL));
    },

    togglePauseMenu: function(isPaused) {
        if(this.elements.pause) {
            this.elements.pause.style.display = isPaused ? 'block' : 'none';
        }
    },

    // --- 5. MINIMAP LOGIC ---
    drawMinimap: function(player, rings, bots) {
        if(!this.canvasCtx || !player) return;
        
        const ctx = this.canvasCtx;
        const width = 160;
        const center = width / 2;
        const range = 4000; // Map Range

        // Clear Background
        ctx.fillStyle = 'rgba(0, 10, 20, 0.6)'; 
        ctx.fillRect(0, 0, width, width);
        
        ctx.save(); 
        ctx.translate(center, center); 
        ctx.rotate(-player.rotation.y); // Rotate map with player

        // Draw Rings (Yellow)
        ctx.fillStyle = '#ffd700';
        rings.forEach(r => {
            if(!r.visible) return;
            const dx = (r.position.x - player.position.x)/range*center;
            const dz = (r.position.z - player.position.z)/range*center;
            ctx.beginPath(); ctx.arc(dx, dz, 4, 0, Math.PI*2); ctx.fill();
        });

        // Draw Enemies (Red)
        ctx.fillStyle = '#ff0000';
        bots.forEach(b => {
            const dx = (b.position.x - player.position.x)/range*center;
            const dz = (b.position.z - player.position.z)/range*center;
            ctx.beginPath(); ctx.arc(dx, dz, 3, 0, Math.PI*2); ctx.fill();
        });

        // Draw Player (Green Triangle)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-5, 5); ctx.lineTo(5, 5); ctx.fill();
        
        ctx.restore();
    }
};

window.UIManager = UIManager;
