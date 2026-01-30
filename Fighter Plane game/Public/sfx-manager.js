/**
 * 🔊 SKY PILOT: SFX MANAGER
 * Procedural Audio (Menu Silent, Game Heavy)
 * Features: Jet Engine, Wind, Boost, Scratch, Fire, Hit, Collect, Explosion.
 */

const SFXManager = {
    ctx: null,
    masterGain: null,
    
    // Engine & Wind Loop Nodes
    engineOsc: null,
    engineGain: null,
    windNode: null,
    windGain: null,
    isBoosting: false,

    init: function() {
        if (this.ctx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        this.masterGain = this.ctx.createGain();
        // Check if global GameManager state exists, else default to 0.5
        const vol = (window.GameManager && GameManager.state) ? 
                    (GameManager.state.isSfxOn ? GameManager.state.sfxVolume : 0) : 0.5;
        
        this.masterGain.gain.value = vol;
        this.masterGain.connect(this.ctx.destination);

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.createEngineSound();
    },

    // --- ✈️ JET ENGINE & WIND NOISE GENERATOR ---
    createEngineSound: function() {
        // 1. Low Rumble (Engine)
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60; // Idle frequency
        
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0; // Silent in menu
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);
        this.engineOsc.start();

        // 2. Wind Noise (High-speed air)
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.windNode = this.ctx.createBufferSource();
        this.windNode.buffer = buffer;
        this.windNode.loop = true;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0; // Silent in menu
        
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 1000;

        this.windNode.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);
        this.windNode.start();
    },

    // --- 🚀 DYNAMIC UPDATES ---
    updateEngine: function(speedRatio) { 
        if (!this.ctx || !this._check()) return;
        
        const now = this.ctx.currentTime;
        
        // Pitch logic: Speed badhne par frequency up
        let freq = 60 + (speedRatio * 140); 
        if(this.isBoosting) freq += 100; // Extra pitch when boosting

        this.engineOsc.frequency.setTargetAtTime(freq, now, 0.1);
        
        // Volume Logic: Speed badhne par roar badhega
        let engineVol = 0.05 + (speedRatio * 0.1);
        if(this.isBoosting) engineVol += 0.1;

        this.engineGain.gain.setTargetAtTime(engineVol, now, 0.1);
        this.windGain.gain.setTargetAtTime(speedRatio * 0.3, now, 0.1);
    },

    startBoost: function() {
        this.isBoosting = true;
        if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    stopBoost: function() {
        this.isBoosting = false;
    },

    // --- 💥 ONE-SHOT EFFECTS ---

    // Metal scratching zameen se takrane par
    playScratch: function() {
        if (!this._check()) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150 + Math.random() * 100, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.2);
        
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        
        osc.connect(g); g.connect(this.masterGain);
        osc.start(); osc.stop(t + 0.2);
    },

    playFire: function() {
        if (!this._check()) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(); osc.stop(t + 0.15);
    },

    playHit: function() {
        if (!this._check()) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.3);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(); osc.stop(t + 0.3);
    },

    playCollect: function() {
        if (!this._check()) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, t);
        osc.frequency.linearRampToValueAtTime(2000, t + 0.1);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(); osc.stop(t + 0.5);
    },

    playExplosion: function() {
        if (!this._check()) return;
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, t);
        filter.frequency.exponentialRampToValueAtTime(40, t + 1);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
        noise.stop(t + 1);
    },

    _check: function() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const isSfxOn = (window.GameManager && GameManager.state) ? GameManager.state.isSfxOn : true;
        return isSfxOn;
    }
};

window.SFXManager = SFXManager;
