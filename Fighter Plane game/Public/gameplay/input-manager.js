// ==========================================
// PATH: gameplay/input-manager.js
// ==========================================

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;

        // ------------------------------------------
        // KEY STATE
        // ------------------------------------------
        this.keys = {};

        // ------------------------------------------
        // MOUSE STATE
        // ------------------------------------------
        this.mouse = {
            isDown: false,
            x: 0,
            y: 0,
            dx: 0,
            dy: 0
        };

        this._lastMouseX = null;
        this._lastMouseY = null;

        // ------------------------------------------
        // SETTINGS
        // ------------------------------------------
        this.enabled = true;

        // ------------------------------------------
        // EVENT BINDINGS
        // ------------------------------------------
        window.addEventListener("keydown", (e) => {
            this.keys[e.key] = true;

            // also map special keys consistently
            if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.Shift = true;
            if (e.code === "Space") this.keys.Space = true;
            if (e.code === "Escape") this.keys.Escape = true;
        });

        window.addEventListener("keyup", (e) => {
            this.keys[e.key] = false;

            if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.Shift = false;
            if (e.code === "Space") this.keys.Space = false;
            if (e.code === "Escape") this.keys.Escape = false;
        });

        // Mouse events (desktop aim)
        window.addEventListener("mousedown", (e) => {
            this.mouse.isDown = true;
        });

        window.addEventListener("mouseup", (e) => {
            this.mouse.isDown = false;
        });

        window.addEventListener("mousemove", (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;

            if (this._lastMouseX === null || this._lastMouseY === null) {
                this._lastMouseX = e.clientX;
                this._lastMouseY = e.clientY;
                return;
            }

            const dx = e.clientX - this._lastMouseX;
            const dy = e.clientY - this._lastMouseY;

            this.mouse.dx += dx;
            this.mouse.dy += dy;

            this._lastMouseX = e.clientX;
            this._lastMouseY = e.clientY;
        });

        window.addEventListener("blur", () => {
            // reset everything if focus lost (prevents stuck keys)
            this.reset();
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) this.reset();
        });
    }

    // ------------------------------------------
    // RESET
    // ------------------------------------------
    reset() {
        this.keys = {};
        this.mouse.isDown = false;
        this.mouse.dx = 0;
        this.mouse.dy = 0;
        this._lastMouseX = null;
        this._lastMouseY = null;
    }

    // ------------------------------------------
    // UPDATE (called every frame)
    // ------------------------------------------
    update(dt = 0) {
        if (!this.enabled) return;

        // decay mouse deltas
        this.mouse.dx *= 0.7;
        this.mouse.dy *= 0.7;

        // reset escape once per frame (if you use it as "pressed this frame")
        if (this.keys.Escape) this.keys.Escape = false;
    }

    // ------------------------------------------
    // ACTIONS
    // ------------------------------------------
    getAction(action) {
        if (!this.enabled) return false;

        switch (action) {
            // movement
            case "moveForward":  return !!this.keys.w;
            case "moveBackward": return !!this.keys.s;
            case "moveLeft":     return !!this.keys.a;
            case "moveRight":    return !!this.keys.d;

            // sprint / boost
            case "boost":        return !!this.keys.Shift;

            // fire
            case "fire":         return !!this.mouse.isDown;

            // camera pitch/yaw (keyboard aim)
            // ✅ FIX: W should mean pitchUp? Depends on your game.
            // Usually: W => look up is NOT common; but if you use it for pitch, make it consistent.
            // Here we keep NATURAL:
            // - pitchUp => W
            // - pitchDown => S
            case "pitchUp":      return !!this.keys.w;
            case "pitchDown":    return !!this.keys.s;

            default:
                return false;
        }
    }
}

window.InputManager = InputManager;
