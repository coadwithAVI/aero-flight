// ==========================================
// PATH: gameplay/input-manager.js
// ==========================================

/**
 * InputManager
 * - Handles keyboard & mouse input
 * - Stores key states
 * - Provides getAction() abstraction
 * - Supports settings:
 *    - sensitivity (float)
 *    - invertY (bool)
 * - Calls GameManager.startAudioContext() on first interaction
 */

class InputManager {
    constructor(gameManager = null) {
        this.game = gameManager;

        // Settings controlled by GameManager.applySettings()
        this.sensitivity = 1.0;
        this.invertY = false;

        // Key State
        this.keys = {
            w: false, s: false,
            a: false, d: false,
            q: false, e: false,

            Shift: false,
            " ": false,

            f: false,
            r: false,

            Escape: false
        };

        // Mouse
        this.mouse = {
            x: 0,
            y: 0,
            dx: 0,
            dy: 0,
            isDown: false,
            rightDown: false
        };

        // Fire latch (prevents too many fires if needed)
        this._fireHeld = false;

        // pointer lock optional
        this.pointerLocked = false;

        this.init();
    }

    // ==========================================================
    // Init + Event Listeners
    // ==========================================================

    init() {
        // Keyboard
        window.addEventListener("keydown", (e) => this.onKey(e, true));
        window.addEventListener("keyup", (e) => this.onKey(e, false));

        // Mouse
        window.addEventListener("mousedown", (e) => this.onMouseDown(e));
        window.addEventListener("mouseup", (e) => this.onMouseUp(e));
        window.addEventListener("mousemove", (e) => this.onMouseMove(e));

        // Disable right click menu
        window.addEventListener("contextmenu", (e) => e.preventDefault());

        // Pointer lock change
        document.addEventListener("pointerlockchange", () => {
            this.pointerLocked = (document.pointerLockElement != null);
        });
    }

    // ==========================================================
    // Audio unlock trigger
    // ==========================================================

    _touchAudioUnlock() {
        // Browser requires interaction to start audio
        if (this.game && typeof this.game.startAudioContext === "function") {
            this.game.startAudioContext();
        }
    }

    // ==========================================================
    // Key Handling
    // ==========================================================

    onKey(e, isDown) {
        this._touchAudioUnlock();

        // normalize key
        const key = (e.key && e.key.length === 1) ? e.key.toLowerCase() : e.key;

        // store
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = isDown;
        }

        // special keys
        if (e.key === "Shift") this.keys.Shift = isDown;
        if (e.key === " ") this.keys[" "] = isDown;

        // optional: prevent scrolling with space
        if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
        }

        // Pause shortcut
        if (key === "escape" && isDown) {
            this.keys.Escape = true;
        }
    }

    // ==========================================================
    // Mouse Handling
    // ==========================================================

    onMouseDown(e) {
        this._touchAudioUnlock();

        // Left click
        if (e.button === 0) {
            this.mouse.isDown = true;

            // Optional pointer lock on click
            // This is optional; you can enable later if needed
            // if (!this.pointerLocked) document.body.requestPointerLock();
        }

        // Right click
        if (e.button === 2) {
            this.mouse.rightDown = true;
        }
    }

    onMouseUp(e) {
        if (e.button === 0) this.mouse.isDown = false;
        if (e.button === 2) this.mouse.rightDown = false;
    }

    onMouseMove(e) {
        // pointer lock gives movementX/Y for relative movement
        if (this.pointerLocked) {
            this.mouse.dx += e.movementX;
            this.mouse.dy += e.movementY;
        } else {
            // normalized absolute position
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        }
    }

    // ==========================================================
    // Update (called every frame by GameManager)
    // ==========================================================

    update(deltaTime) {
        // Escape key is a 1-frame tap trigger
        // Reset in update so it doesn't stay stuck true
        if (this.keys.Escape) {
            this.keys.Escape = false;
        }

        // decay pointer movement (smooth)
        // (helps avoid huge spikes)
        this.mouse.dx *= 0.85;
        this.mouse.dy *= 0.85;
    }

    // ==========================================================
    // Action Mapping API
    // ==========================================================

    /**
     * Returns boolean for an action name.
     */
    getAction(actionName) {
        switch (actionName) {
            // Flight
            case "pitchUp":   return this.keys.s;
            case "pitchDown": return this.keys.w;

            case "rollLeft":  return this.keys.a;
            case "rollRight": return this.keys.d;

            case "yawLeft":   return this.keys.q;
            case "yawRight":  return this.keys.e;

            // Throttle
            case "boost": return this.keys.Shift;
            case "brake": return this.keys[" "];

            // Combat
            case "fire": return this.mouse.isDown || this.keys.f;

            // System
            case "pause": return this.keys.Escape;

            default:
                return false;
        }
    }

    // ==========================================================
    // Advanced helper (Optional)
    // ==========================================================

    /**
     * Returns axis values -1..+1 for pitch/roll/yaw
     * Already applies sensitivity and invertY effect.
     */
    getAxes() {
        const pitch = (this.getAction("pitchUp") ? 1 : 0) - (this.getAction("pitchDown") ? 1 : 0);
        const roll  = (this.getAction("rollLeft") ? 1 : 0) - (this.getAction("rollRight") ? 1 : 0);
        const yaw   = (this.getAction("yawLeft") ? 1 : 0) - (this.getAction("yawRight") ? 1 : 0);

        const inv = this.invertY ? -1 : 1;

        return {
            pitch: pitch * this.sensitivity * inv,
            roll:  roll * this.sensitivity,
            yaw:   yaw * this.sensitivity
        };
    }
}

// Global export
window.InputManager = InputManager;
