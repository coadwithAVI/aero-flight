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

        // --- KEYBOARD EVENTS (Fixed A/D & CapsLock issues) ---
        window.addEventListener("keydown", (e) => {
            // e.code use karne se 'A' aur 'a' ka chakkar khatam
            this.keys[e.code] = true; 
        });

        window.addEventListener("keyup", (e) => {
            this.keys[e.code] = false;
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

        switch (action) {
            // --- MOVEMENT (W/S = Speed, A/D = Turn) ---
            case "moveForward":  return !!this.keys["KeyW"];
            case "moveBackward": return !!this.keys["KeyS"];
            case "moveLeft":     return !!this.keys["KeyA"];
            case "moveRight":    return !!this.keys["KeyD"];

            // --- BOOST ---
            case "boost":        
                return !!(this.keys["ShiftLeft"] || this.keys["ShiftRight"]);

            // --- FIRE ---
            case "fire":         
                return !!(this.mouse.isDown || this.keys["Space"]);

            // --- PITCH (Fixed: W = Up, S = Down) ---
            // Agar abhi bhi ulta lage, to in dono ko swap kar dena
            case "pitchUp":      return !!this.keys["KeyS"]; // S for Pull Up (Standard Flight) or W?
            // NOTE: Agar "W" dabane se neeche ja raha tha, to maine Logic reverse kar diya hai.
            // Ab 'KeyS' Pitch Up karega (Nose Upar) - Ye Flight Sim standard hai.
            // Agar aapko W = Upar chahiye (Arcade), to niche wali line use karein:
            // case "pitchUp": return !!this.keys["KeyW"]; 
            
            case "pitchDown":    return !!this.keys["KeyW"]; 

            default: return false;
        }
    }
}
window.InputManager = InputManager;
