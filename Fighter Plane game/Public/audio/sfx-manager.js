//Engine, explosions
/**
 * SFXManager
 * Handles procedural audio generation using the Web Audio API.
 * No external files required.
 */
class SFXManager {
    constructor() {
        // Initialize Audio Context
        // Note: Browsers require a user interaction (click) to resume audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Global Volume (0.0 to 1.0)
        this.masterGain.connect(this.ctx.destination);

        // Engine Sound State
        this.engineOscillator = null;
        this.isEngineRunning = false;
    }

    /**
     * Call this once on the first user interaction (e.g., Start Game click)
     * to unlock audio in the browser.
     */
    init() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.startEngineSound();
    }

    /**
     * Generates a continuous engine hum
     */
    startEngineSound() {
        if (this.isEngineRunning) return;

        // Create oscillator for engine drone
        this.engineOscillator = this.ctx.createOscillator();
        this.engineOscillator.type = 'sawtooth';
        this.engineOscillator.frequency.value = 100; // Base frequency (idle)

        // Filter to muffle the harsh sawtooth wave
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        // Volume for engine
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.1;

        // Connect graph: Osc -> Filter -> Gain -> Master
        this.engineOscillator.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOscillator.start();
        this.isEngineRunning = true;
    }

    /**
     * Updates engine pitch based on plane speed
     * @param {Number} speedRatio - 0.0 to 1.0 (minSpeed to maxSpeed)
     */
    updateEnginePitch(speedRatio) {
        if (!this.engineOscillator) return;
        
        // Pitch rises with speed (100Hz to 300Hz)
        const targetFreq = 100 + (speedRatio * 200);
        this.engineOscillator.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    /**
     * Plays a "Pew" laser sound
     */
    playShoot() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        // Frequency sweep (High to Low)
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);

        // Volume envelope (Short burst)
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    /**
     * Plays a noise-based explosion sound
     */
    playExplosion() {
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds duration
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Fill buffer with white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Filter to make it sound like an explosion (Low pass)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        
        // Envelope: Loud attack, long decay
        gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
    }
}