// ==========================================
// PATH: audio/music-manager.js
// ==========================================

/**
 * MusicManager (FINAL SAFE DISABLED)
 *
 * ✅ Keeps API so GameManager crash nahi karega
 * ✅ DOES NOT play drone music (disabled)
 * ✅ If you ever want to enable later: set this.enabled = true
 */

class MusicManager {
    constructor(options = {}) {
        this.ctx = null;
        this.masterGain = null;
        this.nodes = [];
        this.isPlaying = false;
        this.initialized = false;

        // ✅ Disabled by default because ProceduralAudio handles music
        this.enabled = !!options.enabled; // default false
        this.volume = options.volume ?? 0.15;
    }

    init() {
        if (this.initialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);

        this.initialized = true;
    }

    playBGM() {
        // ✅ Do nothing unless explicitly enabled
        if (!this.enabled) return;

        if (!this.initialized) this.init();
        if (this.ctx.state === "suspended") this.ctx.resume();
        if (this.isPlaying) return;

        // (keeping your original drone implementation if you enable later)
        const frequencies = [73.42, 110.0, 146.83, 174.61, 220.0];

        frequencies.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            osc.type = index < 2 ? "sawtooth" : "sine";
            osc.frequency.value = freq;
            osc.detune.value = (Math.random() * 20) - 10;

            const gainNode = this.ctx.createGain();
            gainNode.gain.value = 0.0;

            const filter = this.ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = 400 + (index * 200);

            const lfo = this.ctx.createOscillator();
            lfo.type = "sine";
            lfo.frequency.value = 0.1 + (Math.random() * 0.2);

            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.2;

            lfo.connect(lfoGain);
            lfoGain.connect(gainNode.gain);

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterGain);

            osc.start();
            lfo.start();

            gainNode.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 2.0);

            this.nodes.push({ osc, lfo, gainNode });
        });

        this.isPlaying = true;
    }

    stopBGM() {
        if (!this.isPlaying) return;

        const fadeTime = 1.5;

        this.nodes.forEach(node => {
            node.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
            node.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeTime);

            try {
                node.osc.stop(this.ctx.currentTime + fadeTime);
                node.lfo.stop(this.ctx.currentTime + fadeTime);
            } catch (e) {}
        });

        setTimeout(() => {
            this.nodes = [];
            this.isPlaying = false;
        }, fadeTime * 1000);
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) this.masterGain.gain.value = this.volume;
    }
}

window.MusicManager = MusicManager;
