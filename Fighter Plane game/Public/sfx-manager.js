/**
 * SKY PILOT - GLOBAL SFX MANAGER (AudioSys)
 * Dedicated strictly for short sound effects (Gunshots, Explosions, etc.)
 * and continuous mechanical sounds (Engine, Boost).
 */

const SFXManager = {
    audioCtx: null,
    
    // Continuous Sound Nodes
    noiseNode: null,
    noiseGain: null,
    boostOsc: null,
    boostGain: null,
    boostNoise: null,
    boostNoiseGain: null,

    // Safety Init Helper
    _ensureInit: function() {
        if (!this.audioCtx) this.init();
    },

    init: function() {
        if (this.audioCtx) return;
        
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create a shared noise buffer for wind/boost sounds
            const bufferSize = this.audioCtx.sampleRate;
            const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            // 1. Wind/Damage Noise (Continuous)
            this.noiseNode = this.audioCtx.createBufferSource();
            this.noiseNode.buffer = noiseBuffer;
            this.noiseNode.loop = true;
            this.noiseGain = this.audioCtx.createGain();
            this.noiseGain.gain.value = 0;
            this.noiseNode.connect(this.noiseGain);
            this.noiseGain.connect(this.audioCtx.destination);
            this.noiseNode.start();

            // 2. Boost Engine Tone
            this.boostOsc = this.audioCtx.createOscillator();
            this.boostOsc.type = 'triangle';
            this.boostOsc.frequency.value = 200;
            this.boostGain = this.audioCtx.createGain();
            this.boostGain.gain.value = 0;
            this.boostOsc.connect(this.boostGain);
            this.boostGain.connect(this.audioCtx.destination);
            this.boostOsc.start();

            // 3. Boost Rushing Air (Noise)
            this.boostNoise = this.audioCtx.createBufferSource();
            this.boostNoise.buffer = noiseBuffer;
            this.boostNoise.loop = true;
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1000;
            this.boostNoiseGain = this.audioCtx.createGain();
            this.boostNoiseGain.gain.value = 0;
            this.boostNoise.connect(filter);
            filter.connect(this.boostNoiseGain);
            this.boostNoiseGain.connect(this.audioCtx.destination);
            this.boostNoise.start();

        } catch (e) {
            console.error("SFXManager: Audio initialization failed", e);
        }
    },

    // --- CONTINUOUS UPDATES ---
    // Isko har frame (animate) mein call karein
    updateContinuous: function(isBoosting, isDamaging, sfxEnabled = true) {
        this._ensureInit();
        if (!sfxEnabled || this.audioCtx.state === 'suspended') {
            this.boostGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
            this.boostNoiseGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
            this.noiseGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
            return;
        }

        const now = this.audioCtx.currentTime;

        // Boost logic
        if (isBoosting) {
            this.boostOsc.frequency.setTargetAtTime(600, now, 0.5);
            this.boostGain.gain.setTargetAtTime(0.15, now, 0.1);
            this.boostNoiseGain.gain.setTargetAtTime(0.3, now, 0.1);
        } else {
            this.boostOsc.frequency.setTargetAtTime(200, now, 0.5);
            this.boostGain.gain.setTargetAtTime(0, now, 0.2);
            this.boostNoiseGain.gain.setTargetAtTime(0, now, 0.2);
        }

        // Damage/Wind logic
        const targetVol = isDamaging ? 0.4 : 0;
        this.noiseGain.gain.setTargetAtTime(targetVol, now, 0.1);
    },

    // --- ONE-SHOT EFFECTS ---

    playGun: function(sfxEnabled = true) {
        if (!sfxEnabled) return;
        this._ensureInit();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(now + 0.2);
    },

    playExplosion: function(sfxEnabled = true) {
        if (!sfxEnabled) return;
        this._ensureInit();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(now + 0.5);
    },

    playRing: function(sfxEnabled = true) {
        if (!sfxEnabled) return;
        this._ensureInit();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(1800, now + 0.1);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(now + 0.5);
    },

    playRepair: function(sfxEnabled = true) {
        if (!sfxEnabled) return;
        this._ensureInit();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.2);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(now + 0.3);
    },

    stopAll: function() {
        if (!this.audioCtx) return;
        try {
            this.audioCtx.close();
            this.audioCtx = null;
        } catch(e) {}
    }
};

// Global expose
window.SFXManager = SFXManager;