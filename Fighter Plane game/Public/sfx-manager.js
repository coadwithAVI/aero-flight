/**
 * 🔊 SKY PILOT: SFX MANAGER
 * (Original Heavy Engine Sound + Crash Fixes)
 */

const SFXManager = {
    ctx: null,
    masterGain: null,
    
    // Engine Loop Nodes
    engineOsc: null,
    engineGain: null,
    windNode: null,
    windGain: null,

    init: function() {
        if (this.ctx) return;
        
        // Browser compatibility
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Master Volume Control
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = GameManager.state.isSfxOn ? GameManager.state.sfxVolume : 0;
        this.masterGain.connect(this.ctx.destination);

        // Resume context if suspended (Browser policy fix)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.createEngineSound();
    },

    // --- ✈️ ORIGINAL JET ENGINE DRONE (User's Choice) ---
    createEngineSound: function() {
        const t = this.ctx.currentTime;

        // 1. Low Rumble (Triangle Wave)
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 100;
        
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.1; // Base volume set directly
        
        // Lowpass filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);
        this.engineOsc.start();

        // 2. Wind Noise (Buffer) - The Heavy Sound
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
        this.windGain.gain.value = 0.05;
        
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 1000;

        this.windNode.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);
        this.windNode.start();
    },

    // Called every frame to update pitch based on speed
    updateEngine: function(speedRatio) { // 0.0 to 1.0
        if (!this.ctx || !GameManager.state.isSfxOn) return;
        
        const now = this.ctx.currentTime;
        
        // Pitch goes up with speed
        this.engineOsc.frequency.setTargetAtTime(100 + (speedRatio * 300), now, 0.1);
        
        // Volume logic
        this.engineGain.gain.setTargetAtTime(0.1 + (speedRatio * 0.1), now, 0.1);
        this.windGain.gain.setTargetAtTime(speedRatio * 0.4, now, 0.1);
    },

    // --- 🛠️ CRASH FIXES (Empty Functions) ---
    // Singleplayer.html inko dhund raha tha, isliye error aa raha tha.
    // Hum inhe khali chhod denge kyunki awaaz already 'updateEngine' se control ho rahi hai.
    
    startBoost: function() {
        // Just ensure audio is running
        if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    stopBoost: function() {
        // Do nothing, let updateEngine handle the pitch drop
    },

    // --- 💥 ONE-SHOT EFFECTS ---

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

    playHit: function() { // Added playHit for compatibility
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

    playCollect: function() { // Added playCollect for compatibility
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

    playRing: function() {
        this.playCollect(); // Mapping old name to new name
    },

    playExplosion: function() {
        if (!this._check()) return;
        const t = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.windNode.buffer; // Reuse buffer
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 1);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1, t);
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
        return GameManager.state.isSfxOn;
    }
};

window.SFXManager = SFXManager;
