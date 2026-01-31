// ==========================================
// PATH: ui/ui-manager.js
// ==========================================

/**
 * UIManager (Advanced Edition)
 * High-performance HUD overlay with:
 * ✅ Tactical Crosshair
 * ✅ Dynamic Health & Boost Bars with Glow effects
 * ✅ Speedometer & Score Counter
 * ✅ Damage Vignette (Low Health Feedback)
 */

class UIManager {
    constructor() {
        // 1. Inject Advanced CSS Styles dynamically
        this.injectStyles();

        // 2. HUD Container
        this.container = document.createElement('div');
        this.container.id = 'game-ui';
        // Base styling moved to CSS class 'hud-container'
        this.container.className = 'hud-container'; 
        document.body.appendChild(this.container);

        // 3. Setup Components
        this.setupDamageVignette(); // New Feature: Red screen edges on damage
        this.setupCrosshair();
        this.setupTopPanel();       // Score & Speed
        this.setupBottomPanel();    // Health & Boost combined
        this.setupGameOverScreen();

        // 4. Caching for performance
        this.lastSpeed = -999;
        this.lastScore = -999;
        this.lastHealth = -999;
        this.lastBoost = -999;
    }

    // ======================================================
    // 🎨 CSS Injection (Advanced Styling)
    // ======================================================
    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');

            .hud-container {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                pointer-events: none;
                font-family: 'Orbitron', 'Courier New', monospace;
                user-select: none;
                z-index: 999;
                overflow: hidden;
            }

            /* --- Damage Effect --- */
            .damage-vignette {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                box-shadow: inset 0 0 0px rgba(255, 0, 0, 0);
                transition: box-shadow 0.2s ease;
                z-index: -1;
            }

            /* --- Panels (Glassmorphism) --- */
            .hud-panel {
                background: linear-gradient(135deg, rgba(0, 20, 40, 0.6), rgba(0, 0, 0, 0.8));
                border: 1px solid rgba(0, 255, 255, 0.3);
                border-radius: 4px;
                padding: 10px 20px;
                box-shadow: 0 0 15px rgba(0, 255, 255, 0.1);
                color: #fff;
                text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
                backdrop-filter: blur(4px);
            }

            /* --- Crosshair --- */
            .crosshair-center {
                position: absolute;
                top: 50%; left: 50%;
                width: 4px; height: 4px;
                background: #ff3333;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                box-shadow: 0 0 8px #ff3333;
            }
            .crosshair-ring {
                position: absolute;
                top: 50%; left: 50%;
                width: 24px; height: 24px;
                border: 2px dashed rgba(255, 255, 255, 0.6);
                border-radius: 50%;
                transform: translate(-50%, -50%);
            }

            /* --- Bars (Health/Boost) --- */
            .bar-wrapper {
                margin-bottom: 8px;
                position: relative;
            }
            .bar-label {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 4px;
                display: flex;
                justify-content: space-between;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .bar-track {
                width: 100%;
                height: 12px;
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            }
            .bar-fill {
                height: 100%;
                width: 100%;
                background: white;
                transform-origin: left;
                transition: width 0.2s cubic-bezier(0.4, 0.0, 0.2, 1), background-color 0.2s;
                box-shadow: 0 0 10px currentColor;
            }
            
            /* Scanline effect on bars */
            .bar-fill::after {
                content: '';
                position: absolute;
                top: 0; left: 0; bottom: 0; right: 0;
                background: repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(0,0,0,0.3) 3px
                );
            }

            /* Animations */
            @keyframes pulse-critical {
                0% { box-shadow: 0 0 10px #ff0000; border-color: #ff0000; }
                50% { box-shadow: 0 0 30px #ff0000; border-color: #ffaaaa; }
                100% { box-shadow: 0 0 10px #ff0000; border-color: #ff0000; }
            }
            .critical-health {
                animation: pulse-critical 1s infinite;
            }
        `;
        document.head.appendChild(style);
    }

    // ======================================================
    // 🩸 Damage Vignette (New Feature)
    // ======================================================
    setupDamageVignette() {
        this.damageVignette = document.createElement('div');
        this.damageVignette.className = 'damage-vignette';
        this.container.appendChild(this.damageVignette);
    }

    // ======================================================
    // 🎯 Crosshair
    // ======================================================
    setupCrosshair() {
        // Outer Ring
        const ring = document.createElement('div');
        ring.className = 'crosshair-ring';
        this.container.appendChild(ring);

        // Center Dot
        const dot = document.createElement('div');
        dot.className = 'crosshair-center';
        this.container.appendChild(dot);
    }

    // ======================================================
    // 📊 Top Panel (Score & Speed)
    // ======================================================
    setupTopPanel() {
        this.topPanel = document.createElement('div');
        this.topPanel.className = 'hud-panel';
        Object.assign(this.topPanel.style, {
            position: 'absolute',
            top: '20px',
            left: '20px',
            minWidth: '200px',
            clipPath: 'polygon(0 0, 100% 0, 95% 100%, 0% 100%)' // Futuristic shape
        });

        // Score
        this.scoreElement = document.createElement('div');
        this.scoreElement.style.fontSize = '18px';
        this.scoreElement.style.fontWeight = 'bold';
        this.scoreElement.style.color = '#00ffcc';
        this.scoreElement.style.marginBottom = '4px';
        
        // Speed
        this.speedElement = document.createElement('div');
        this.speedElement.style.fontSize = '14px';
        this.speedElement.style.color = '#ffffff';

        this.topPanel.appendChild(this.scoreElement);
        this.topPanel.appendChild(this.speedElement);
        this.container.appendChild(this.topPanel);
    }

    // ======================================================
    // ❤️⚡ Bottom Panel (Health & Boost)
    // ======================================================
    setupBottomPanel() {
        this.bottomContainer = document.createElement('div');
        // Centered bottom container
        Object.assign(this.bottomContainer.style, {
            position: 'absolute',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        });

        // --- Health Bar ---
        const healthWrapper = document.createElement('div');
        healthWrapper.className = 'bar-wrapper';
        
        const healthLabel = document.createElement('div');
        healthLabel.className = 'bar-label';
        healthLabel.innerHTML = `<span>Hull Integrity</span><span id="health-text">100%</span>`;
        
        const healthTrack = document.createElement('div');
        healthTrack.className = 'bar-track';
        
        this.healthFill = document.createElement('div');
        this.healthFill.className = 'bar-fill';
        this.healthFill.style.backgroundColor = '#2ecc71'; // Green
        
        healthTrack.appendChild(this.healthFill);
        healthWrapper.appendChild(healthLabel);
        healthWrapper.appendChild(healthTrack);
        
        // --- Boost Bar ---
        const boostWrapper = document.createElement('div');
        boostWrapper.className = 'bar-wrapper';

        const boostLabel = document.createElement('div');
        boostLabel.className = 'bar-label';
        boostLabel.innerHTML = `<span>Thruster Energy</span><span id="boost-text">100%</span>`;

        const boostTrack = document.createElement('div');
        boostTrack.className = 'bar-track';

        this.boostFill = document.createElement('div');
        this.boostFill.className = 'bar-fill';
        this.boostFill.style.backgroundColor = '#3498db'; // Blue

        boostTrack.appendChild(this.boostFill);
        boostWrapper.appendChild(boostLabel);
        boostWrapper.appendChild(boostTrack);

        // Add to main container
        this.bottomContainer.appendChild(healthWrapper);
        this.bottomContainer.appendChild(boostWrapper);
        this.container.appendChild(this.bottomContainer);

        // References for text updates
        this.healthText = healthLabel.querySelector('#health-text');
        this.boostText = boostLabel.querySelector('#boost-text');
    }

    // ======================================================
    // 💀 Game Over Screen
    // ======================================================
    setupGameOverScreen() {
        this.gameOverScreen = document.createElement('div');
        Object.assign(this.gameOverScreen.style, {
            position: 'absolute',
            top: '0', left: '0',
            width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            backdropFilter: 'blur(5px)',
            zIndex: 1000
        });

        const title = document.createElement('h1');
        title.innerText = 'SYSTEM FAILURE';
        Object.assign(title.style, {
            fontSize: '64px',
            color: '#e74c3c',
            textShadow: '0 0 20px #e74c3c',
            marginBottom: "20px",
            letterSpacing: '5px'
        });

        const sub = document.createElement('div');
        sub.innerText = 'MISSION TERMINATED';
        sub.style.fontSize = '24px';
        sub.style.color = '#ccc';
        sub.style.marginBottom = '40px';

        const restartHint = document.createElement('div');
        restartHint.innerText = '[ PRESS R TO REBOOT SYSTEM ]';
        restartHint.style.fontSize = '18px';
        restartHint.style.color = '#00ffcc';
        restartHint.style.animation = 'pulse-critical 2s infinite';
        restartHint.style.padding = '10px 20px';
        restartHint.style.border = '1px solid #00ffcc';

        this.gameOverScreen.appendChild(title);
        this.gameOverScreen.appendChild(sub);
        this.gameOverScreen.appendChild(restartHint);
        this.container.appendChild(this.gameOverScreen);
    }

    // ======================================================
    // ⚡ UPDATE LOOP
    // ======================================================
    update(speed, health, score, boostEnergy = 100) {
        // --- 1. Speed Update ---
        const displaySpeed = Math.floor(speed * 100);
        if (displaySpeed !== this.lastSpeed) {
            this.speedElement.innerText = `VELOCITY: ${displaySpeed} KM/H`;
            this.lastSpeed = displaySpeed;
        }

        // --- 2. Score Update ---
        if (score !== this.lastScore) {
            // Pad score with zeros (e.g., 005)
            const paddedScore = score.toString().padStart(3, '0');
            this.scoreElement.innerHTML = `TARGETS: <span style="color:#fff">${paddedScore}</span>`;
            this.lastScore = score;
        }

        // --- 3. Health Update (with visual FX) ---
        if (health !== this.lastHealth) {
            const h = Math.max(0, health);
            this.healthFill.style.width = `${h}%`;
            this.healthText.innerText = `${Math.ceil(h)}%`;

            // Color Logic & Critical Warning
            if (h < 30) {
                this.healthFill.style.backgroundColor = '#ff0000';
                this.healthFill.style.boxShadow = '0 0 15px #ff0000';
                // Add critical shake/pulse class to container
                this.bottomContainer.classList.add('critical-health');
                // Vignette gets strong red
                this.damageVignette.style.boxShadow = 'inset 0 0 150px rgba(255, 0, 0, 0.6)';
            } else if (h < 60) {
                this.healthFill.style.backgroundColor = '#f39c12'; // Orange
                this.healthFill.style.boxShadow = '0 0 10px #f39c12';
                this.bottomContainer.classList.remove('critical-health');
                this.damageVignette.style.boxShadow = 'inset 0 0 50px rgba(255, 0, 0, 0.2)';
            } else {
                this.healthFill.style.backgroundColor = '#2ecc71'; // Green
                this.healthFill.style.boxShadow = '0 0 10px #2ecc71';
                this.bottomContainer.classList.remove('critical-health');
                this.damageVignette.style.boxShadow = 'inset 0 0 0px rgba(255, 0, 0, 0)';
            }

            this.lastHealth = health;
        }

        // --- 4. Boost Update ---
        // Safety check for physics config
        const boostMax = (typeof PHYSICS_CONFIG !== 'undefined' && PHYSICS_CONFIG.boostMax) ? PHYSICS_CONFIG.boostMax : 100;
        const boostPercent = this.clamp((boostEnergy / boostMax) * 100, 0, 100);
        const boostInt = Math.floor(boostPercent);

        if (boostInt !== this.lastBoost) {
            this.boostFill.style.width = `${boostPercent}%`;
            this.boostText.innerText = `${boostInt}%`;

            if (boostPercent < 20) {
                this.boostFill.style.backgroundColor = "#e74c3c"; // Red when empty
                this.boostFill.style.boxShadow = 'none';
            } else {
                this.boostFill.style.backgroundColor = "#3498db"; // Blue normal
                this.boostFill.style.boxShadow = '0 0 10px #3498db';
            }

            this.lastBoost = boostInt;
        }
    }

    showGameOver() {
        this.gameOverScreen.style.display = 'flex';
    }

    hideGameOver() {
        this.gameOverScreen.style.display = 'none';
        this.bottomContainer.classList.remove('critical-health');
        this.damageVignette.style.boxShadow = 'none';
    }

    // Helper utility inside class to avoid external dependency
    clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }
}

// Make globally available
window.UIManager = UIManager;