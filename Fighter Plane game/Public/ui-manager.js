/**
 * 🎮 UI MANAGER
 * Handles HUD, Minimap, Mobile Controls, and Menus.
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
            
            /* Menus */
            #start-overlay, #pause-menu { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 100; pointer-events: auto; }
            #pause-menu { display: none; background: rgba(0,0,0,0.85); }
            
            h1 { color: #fff; font-size: 50px; text-shadow: 0 0 20px #00d2ff; margin-bottom: 10px; }
            .btn { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid #00d2ff; padding: 15px 50px; font-size: 18px; font-weight: bold; cursor: pointer; transition: 0.3s; transform: skewX(-10deg); margin-top: 15px; }
            .btn:hover { background: #00d2ff; color: #000; box-shadow: 0 0 20px #00d2ff; }

            /* --- MOBILE CONTROLS --- */
            .mobile-controls { display: none; /* Hidden by default, shown via JS if needed or always block */ }
            @media (pointer: coarse) { .mobile-controls { display: block; } } /* Show on touch devices */
            
            /* D-Pad (Left) */
            #dpad { position: absolute; bottom: 20px; left: 20px; width: 150px; height: 150px; pointer-events: auto; }
            .d-btn { position: absolute; width: 50px; height: 50px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; backdrop-filter: blur(2px); }
            .d-btn:active { background: rgba(0, 210, 255, 0.5); }
            #btn-up { top: 0; left: 50px; }
            #btn-down { bottom: 0; left: 50px; }
            #btn-left { top: 50px; left: 0; }
            #btn-right { top: 50px; right: 0; }

            /* Action Buttons (Right) */
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
            <div style="color:#aaa; margin-bottom:30px; letter-spacing:3px;">TACTICAL DOGFIGHT</div>
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

        // Cache Elements
        this.elements = {
            start: startDiv,
            pause: pauseDiv,
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

    hideStartScreen: function() {
        this.elements.start.style.display = 'none';
        this.elements.hud.style.display = 'block';
        // Force show controls on mobile if detection fails
        if(/Android|iPhone|iPad/i.test(navigator.userAgent)) {
            document.querySelector('.mobile-controls').style.display = 'block';
        }
    },

    drawMinimap: function(player, rings, bots) {
        if(!this.canvasCtx || !player) return;
        const ctx = this.canvasCtx;
        
        ctx.fillStyle = 'rgba(0, 10, 20, 0.6)';
        ctx.fillRect(0, 0, 150, 150);
        
        // INCREASED VISIBILITY
        const range = 5000; // Increased range to see further rings
        const center = 75;
        
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(-player.rotation.y); // Rotate map with player

        // Draw Rings (Yellow - Big Dots)
        ctx.fillStyle = '#ffd700';
        rings.forEach(r => {
            if(!r.visible) return;
            const dx = (r.position.x - player.position.x)/range*center;
            const dz = (r.position.z - player.position.z)/range*center;
            
            // Fix: Check if within bounds before drawing
            if(Math.sqrt(dx*dx + dz*dz) < center) {
                ctx.beginPath(); ctx.arc(dx, dz, 4, 0, Math.PI*2); ctx.fill();
            }
        });

        // Draw Bots (Red)
        ctx.fillStyle = '#ff0000';
        bots.forEach(b => {
            const dx = (b.position.x - player.position.x)/range*center;
            const dz = (b.position.z - player.position.z)/range*center;
            if(Math.sqrt(dx*dx + dz*dz) < center) {
                ctx.beginPath(); ctx.arc(dx, dz, 3, 0, Math.PI*2); ctx.fill();
            }
        });

        // Player (Green Triangle)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-5, 6); ctx.lineTo(5, 6); ctx.fill();
        
        ctx.restore();
    }
};
window.UIManager = UIManager;
