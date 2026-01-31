// ==========================================
// PATH: ui/mobile-controls.js
// ==========================================

class MobileControls {
    constructor(inputManager) {
        this.input = inputManager;

        this.joy = {
            active: false,
            startX: 0,
            startY: 0,
            dx: 0,
            dy: 0
        };

        this.maxRadius = 60; // joystick move radius
        this.enabled = this.isMobile();

        if (this.enabled) {
            this.createUI();
            this.attachEvents();
        }
    }

    isMobile() {
        return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    createUI() {
        // joystick base
        this.base = document.createElement("div");
        Object.assign(this.base.style, {
            position: "absolute",
            bottom: "40px",
            left: "40px",
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "2px solid rgba(255,255,255,0.25)",
            touchAction: "none",
            zIndex: 999
        });

        // joystick knob
        this.knob = document.createElement("div");
        Object.assign(this.knob.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "55px",
            height: "55px",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            border: "2px solid rgba(255,255,255,0.3)"
        });

        this.base.appendChild(this.knob);
        document.body.appendChild(this.base);

        // fire button
        this.fireBtn = document.createElement("button");
        this.fireBtn.innerText = "FIRE";
        Object.assign(this.fireBtn.style, {
            position: "absolute",
            bottom: "60px",
            right: "40px",
            width: "110px",
            height: "110px",
            borderRadius: "50%",
            background: "rgba(255,80,80,0.25)",
            border: "2px solid rgba(255,80,80,0.6)",
            color: "white",
            fontWeight: "bold",
            fontSize: "18px",
            touchAction: "none",
            zIndex: 999
        });

        document.body.appendChild(this.fireBtn);

        // boost button
        this.boostBtn = document.createElement("button");
        this.boostBtn.innerText = "BOOST";
        Object.assign(this.boostBtn.style, {
            position: "absolute",
            bottom: "190px",
            right: "55px",
            width: "90px",
            height: "55px",
            borderRadius: "12px",
            background: "rgba(120,200,255,0.25)",
            border: "2px solid rgba(120,200,255,0.6)",
            color: "white",
            fontWeight: "bold",
            fontSize: "14px",
            touchAction: "none",
            zIndex: 999
        });

        document.body.appendChild(this.boostBtn);
    }

    attachEvents() {
        // joystick touch
        this.base.addEventListener("touchstart", (e) => this.onJoyStart(e), { passive: false });
        this.base.addEventListener("touchmove", (e) => this.onJoyMove(e), { passive: false });
        this.base.addEventListener("touchend", () => this.onJoyEnd());

        // fire
        this.fireBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.input.mouse.isDown = true;
        }, { passive: false });

        this.fireBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            this.input.mouse.isDown = false;
        }, { passive: false });

        // boost
        this.boostBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.input.keys.Shift = true;
        }, { passive: false });

        this.boostBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            this.input.keys.Shift = false;
        }, { passive: false });
    }

    onJoyStart(e) {
        e.preventDefault();
        const t = e.touches[0];
        this.joy.active = true;
        this.joy.startX = t.clientX;
        this.joy.startY = t.clientY;
        this.joy.dx = 0;
        this.joy.dy = 0;
    }

    onJoyMove(e) {
        e.preventDefault();
        if (!this.joy.active) return;

        const t = e.touches[0];
        let dx = t.clientX - this.joy.startX;
        let dy = t.clientY - this.joy.startY;

        // clamp radius
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > this.maxRadius) {
            dx = dx / dist * this.maxRadius;
            dy = dy / dist * this.maxRadius;
        }

        this.joy.dx = dx;
        this.joy.dy = dy;

        // move knob
        this.knob.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;

        // map to input keys
        // X => roll (A/D)
        // Y => pitch (W/S)
        const normX = dx / this.maxRadius; // -1..1
        const normY = dy / this.maxRadius; // -1..1

        this.input.keys.a = normX < -0.3;
        this.input.keys.d = normX > 0.3;

        this.input.keys.w = normY > 0.3;   // down finger => pitchDown
        this.input.keys.s = normY < -0.3;  // up finger => pitchUp
    }

    onJoyEnd() {
        this.joy.active = false;
        this.joy.dx = 0;
        this.joy.dy = 0;

        // reset knob
        this.knob.style.transform = "translate(-50%, -50%)";

        // reset input
        this.input.keys.a = false;
        this.input.keys.d = false;
        this.input.keys.w = false;
        this.input.keys.s = false;
    }
}

window.MobileControls = MobileControls;
