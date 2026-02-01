// ==========================================
// PATH: audio/sfx-manager.js
// ==========================================

/**
 * SFXManager (FINAL CLEAN)
 * ✅ Procedural shoot + explosion sounds
 * ✅ Engine hum DISABLED by default (no unwanted noise)
 * ✅ Safe init / unlock
 * ✅ updateEnginePitch does nothing unless engine enabled
 */

class SFXManager {
    constructor(options = {}) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = options.masterVolume ?? 0.3;
        this.masterGain.connect(this.ctx.destination);

        // Engine State
        this.enableEngineHum = !!options.enableEngineHum; // ✅ default false
        this.engineOscillator = null;
        this.engineGain = null;
        this.isEngineRunning = false;
    }

    /**
     * Call once on user interaction to unlock
     */
    init() {
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }

        // ✅ Engine hum OFF by default
        if (this.enableEngineHum) {
            this.startEngineSound();
        }
    }

    // ===========================
    // ENGINE HUM (OPTIONAL)
    // ===========================

    startEngineSound() {
        if (!this.enableEngineHum) return;
        if (this.isEngineRunning) return;

        const osc = this.ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = 100;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 400;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.08;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start();

        this.engineOscillator = osc;
        this.engineGain = gain;
        this.isEngineRunning = true;
    }

    stopEngineSound() {
        if (!this.isEngineRunning) return;

        const t = this.ctx.currentTime;
        try {
            if (this.engineGain) {
                this.engineGain.gain.cancelScheduledValues(t);
                this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, t);
                this.engineGain.gain.linearRampToValueAtTime(0.0001, t + 0.15);
            }
            if (this.engineOscillator) {
                this.engineOscillator.stop(t + 0.2);
            }
        } catch (e) {}

        this.engineOscillator = null;
        this.engineGain = null;
        this.isEngineRunning = false;
    }

    /**
     * Updates engine pitch based on speed ratio
     * @param {Number} speedRatio - 0..1
     */
    updateEnginePitch(speedRatio) {
        // ✅ If engine hum disabled, do nothing
        if (!this.enableEngineHum) return;
        if (!this.engineOscillator) return;

        const targetFreq = 100 + (speedRatio * 200); // 100 -> 300
        this.engineOscillator.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
    }

    // ===========================
    // SFX
    // ===========================

    playShoot() {
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "square";

        // Frequency sweep
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.16);

        // Volume envelope
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.2);
    }

    playExplosion() {
        const t = this.ctx.currentTime;

        const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1200;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(t);
        noise.stop(t + 0.55);
    }

    setMasterVolume(v) {
        this.masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
}

window.SFXManager = SFXManager;
