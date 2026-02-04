// ==========================================
// PATH: gameplay/input-manager.js
// ==========================================

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { isDown: false, x: 0, y: 0, dx: 0, dy: 0 };
        this._lastMouseX = null;
        this._lastMouseY = null;
        this.enabled = true;

        // --- KEYBOARD EVENTS ---
        window.addEventListener("keydown", (e) => {
            this.keys[e.code] = true;
            this.keys[e.key] = true; 
            this.keys[e.key.toLowerCase()] = true; 
        });

        window.addEventListener("keyup", (e) => {
            this.keys[e.code] = false;
            this.keys[e.key] = false;
            this.keys[e.key.toLowerCase()] = false;
        });

        // --- MOUSE EVENTS ---
        window.addEventListener("mousedown", () => { this.mouse.isDown = true; });
        window.addEventListener("mouseup", () => { this.mouse.isDown = false; });
        
        window.addEventListener("mousemove", (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            if (this._lastMouseX === null) {
                this._lastMouseX = e.clientX;
                this._lastMouseY = e.clientY;
                return;
            }
            this.mouse.dx += e.clientX - this._lastMouseX;
            this.mouse.dy += e.clientY - this._lastMouseY;
            this._lastMouseX = e.clientX;
            this._lastMouseY = e.clientY;
        });

        window.addEventListener("blur", () => this.reset());
        document.addEventListener("visibilitychange", () => { if(document.hidden) this.reset(); });
    }

    reset() {
        this.keys = {};
        this.mouse.isDown = false;
        this.mouse.dx = 0;
        this.mouse.dy = 0;
    }

    update(dt) {
        if (!this.enabled) return;
        this.mouse.dx *= 0.7;
        this.mouse.dy *= 0.7;
    }

    getAction(action) {
        if (!this.enabled) return false;
        
        // Helper to check Keyboard OR Mobile inputs
        const isPressed = (...codes) => codes.some(c => this.keys[c]);

        switch (action) {
            // --- MOVEMENT ---
            // Now checks for "Mobile..." keys separately. No conflict with Keyboard.
            case "moveForward":  return isPressed("KeyW", "ArrowUp", "w", "MobileUp");
            case "moveBackward": return isPressed("KeyS", "ArrowDown", "s", "MobileDown");
            case "moveLeft":     return isPressed("KeyA", "ArrowLeft", "a", "MobileLeft");
            case "moveRight":    return isPressed("KeyD", "ArrowRight", "d", "MobileRight");

            // --- BOOST ---
            case "boost":        return isPressed("ShiftLeft", "ShiftRight", "MobileBoost");

            // --- FIRE ---
            case "fire":         return !!(this.mouse.isDown || isPressed("Space", "MobileFire"));

            // --- PITCH (Flight Standard: S=Up, W=Down) ---
            // Joystick Down (MobileDown) -> Nose Up
            // Joystick Up (MobileUp) -> Nose Down
            case "pitchUp":      return isPressed("KeyS", "ArrowDown", "s", "MobileDown");
            case "pitchDown":    return isPressed("KeyW", "ArrowUp", "w", "MobileUp"); 

            default: return false;
        }
    }
}
window.InputManager = InputManager;
