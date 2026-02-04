// ==========================================
// PATH: ui/mobile-controls.js
// ==========================================

class MobileControls {
    constructor(inputManager, options = {}) {
        this.input = inputManager;

        this.enabled = true;
        this.joy = {
            active: false,
            id: null,
            startX: 0,
            startY: 0,
            dx: 0,
            dy: 0
        };

        this.maxRadius = options.maxRadius || 50;

        // ----------------------------------------------------------
        // Root container (always on top)
        // ----------------------------------------------------------
        this.root = document.createElement("div");
        this.root.id = "mobileControlsRoot";
        Object.assign(this.root.style, {
            position: "fixed",
            inset: "0px",
            zIndex: "99999",
            pointerEvents: "none"
        });
        document.body.appendChild(this.root);

        // ----------------------------------------------------------
        // Joystick base
        // ----------------------------------------------------------
        this.joyBase = document.createElement("div");
        this.joyBase.id = "joyBase";
        Object.assign(this.joyBase.style, {
            position: "absolute",
            left: "60px",
            bottom: "60px",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "2px solid rgba(255,255,255,0.15)",
            pointerEvents: "auto",
            touchAction: "none",
            userSelect: "none"
        });

        // Joystick knob
        this.knob = document.createElement("div");
        this.knob.id = "joyKnob";
        Object.assign(this.knob.style, {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(255,255,255,0.18)",
            border: "2px solid rgba(255,255,255,0.25)"
        });

        this.joyBase.appendChild(this.knob);
        this.root.appendChild(this.joyBase);

        // ----------------------------------------------------------
        // Buttons container
        // ----------------------------------------------------------
        this.buttons = document.createElement("div");
        Object.assign(this.buttons.style, {
            position: "absolute",
            right: "40px",
            bottom: "50px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            pointerEvents: "auto"
        });
        this.root.appendChild(this.buttons);

        // FIRE button
        this.fireBtn = document.createElement("button");
        this.fireBtn.innerText = "FIRE";
        Object.assign(this.fireBtn.style, this._btnStyle());
        this.buttons.appendChild(this.fireBtn);

        // BOOST button
        this.boostBtn = document.createElement("button");
        this.boostBtn.innerText = "BOOST";
        Object.assign(this.boostBtn.style, this._btnStyle());
        this.buttons.appendChild(this.boostBtn);

        // ----------------------------------------------------------
        // Events: joystick
        // ----------------------------------------------------------
        this.joyBase.addEventListener("touchstart", (e) => this.onJoyStart(e), { passive: false });
        this.joyBase.addEventListener("touchmove", (e) => this.onJoyMove(e), { passive: false });
        this.joyBase.addEventListener("touchend", (e) => this.onJoyEnd(e), { passive: false });
        this.joyBase.addEventListener("touchcancel", (e) => this.onJoyEnd(e), { passive: false });

        // ----------------------------------------------------------
        // Events: FIRE
        // ----------------------------------------------------------
        this.fireBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.input.mouse.isDown = true;
        }, { passive: false });

        this.fireBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            this.input.mouse.isDown = false;
        }, { passive: false });

        // ----------------------------------------------------------
        // Events: BOOST
        // ----------------------------------------------------------
        this.boostBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.input.keys.Shift = true;
        }, { passive: false });

        this.boostBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            this.input.keys.Shift = false;
        }, { passive: false });

        // ✅ extra safety: prevent stuck buttons if touch is cancelled
        this.fireBtn.addEventListener("touchcancel", (e) => {
            e.preventDefault();
            this.releaseActions();
        }, { passive: false });

        this.boostBtn.addEventListener("touchcancel", (e) => {
            e.preventDefault();
            this.releaseActions();
        }, { passive: false });

        // ✅ extra safety: if tab/app loses focus, release actions
        this._onBlur = () => this.releaseActions();
        window.addEventListener("blur", this._onBlur);

        this._onVisibilityChange = () => {
            if (document.hidden) this.releaseActions();
        };
        document.addEventListener("visibilitychange", this._onVisibilityChange);
    }

    _btnStyle() {
        return {
            width: "120px",
            height: "60px",
            borderRadius: "14px",
            border: "2px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.10)",
            color: "white",
            fontSize: "16px",
            fontWeight: "700",
            letterSpacing: "0.5px",
            touchAction: "none"
        };
    }

    // ----------------------------------------------------------
    // SAFETY: release pressed actions (prevents stuck fire/boost)
    // ----------------------------------------------------------
    releaseActions() {
        if (!this.input) return;
        if (this.input.mouse) this.input.mouse.isDown = false;
        if (this.input.keys) this.input.keys.Shift = false;
    }

    // ----------------------------------------------------------
    // JOYSTICK HANDLERS
    // ----------------------------------------------------------
    onJoyStart(e) {
        if (!this.enabled) return;

        e.preventDefault();
        const t = e.changedTouches[0];
        this.joy.active = true;
        this.joy.id = t.identifier;

        const rect = this.joyBase.getBoundingClientRect();
        this.joy.startX = rect.left + rect.width / 2;
        this.joy.startY = rect.top + rect.height / 2;

        this.joy.dx = 0;
        this.joy.dy = 0;
    }

    onJoyMove(e) {
        if (!this.enabled || !this.joy.active) return;
        e.preventDefault();

        let t = null;
        for (const touch of e.touches) {
            if (touch.identifier === this.joy.id) {
                t = touch;
                break;
            }
        }
        if (!t) return;

        const dxRaw = t.clientX - this.joy.startX;
        const dyRaw = t.clientY - this.joy.startY;

        // clamp circle
        const dist = Math.hypot(dxRaw, dyRaw);
        let dx = dxRaw;
        let dy = dyRaw;

        if (dist > this.maxRadius) {
            const ratio = this.maxRadius / dist;
            dx *= ratio;
            dy *= ratio;
        }

        this.joy.dx = dx;
        this.joy.dy = dy;

        // move knob
        this.knob.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;

        // map to input keys
        const normX = dx / this.maxRadius;
        const normY = dy / this.maxRadius;

        this.input.keys.a = normX < -0.3;
        this.input.keys.d = normX > 0.3;

        // ✅ FIXED: UP on joystick => W, DOWN => S
        this.input.keys.w = normY < -0.3; // move forward (UP on joystick)
        this.input.keys.s = normY > 0.3;  // move backward (DOWN on joystick)
    }

    onJoyEnd(e) {
        if (!this.enabled) return;

        // if cancelled/ended: reset joystick
        this.joy.active = false;
        this.joy.id = null;
        this.joy.dx = 0;
        this.joy.dy = 0;

        // reset knob
        this.knob.style.transform = "translate(-50%, -50%)";

        // reset movement keys
        this.input.keys.a = false;
        this.input.keys.d = false;
        this.input.keys.w = false;
        this.input.keys.s = false;
    }
}

window.MobileControls = MobileControls;
