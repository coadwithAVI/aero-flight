// ==========================================
// PATH: audio/procedural-audio.js
// ==========================================

class ProceduralAudio {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // master volume
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);

        // music control
        this.musicIntervals = [];
        this.musicPlaying = null;

        // boost loop state
        this.boostNoise = null;
        this.boostGain = null;
    }

    async unlock() {
        if (this.ctx.state === "suspended") {
            await this.ctx.resume();
        }
    }

    // ==========================
    // 🏆 Victory / Defeat Jingles
    // ==========================
    victory() {
        const ctx = this.ctx;
        const t = ctx.currentTime;

        // bright chord: C major-ish
        this._playNote(523.25, "triangle", 0.25, 0.14, 0.00); // C5
        this._playNote(659.25, "triangle", 0.25, 0.12, 0.05); // E5
        this._playNote(783.99, "triangle", 0.35, 0.12, 0.10); // G5
        this._playNote(1046.5, "sine", 0.50, 0.10, 0.18);     // C6
    }

    defeat() {
        const ctx = this.ctx;
        const t = ctx.currentTime;

        // dark downward sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "sawtooth";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(120, t + 1.1);

        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 1.1);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);

        osc.start(t);
        osc.stop(t + 1.2);
    }


    // ==========================
    // 🎵 SFX
    // ==========================

    ring() {
        const ctx = this.ctx;
        const t = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        osc.connect(gain);
        gain.connect(this.master);

        osc.start(t);
        osc.stop(t + 0.5);

        // sparkle layer
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(2400, t);

        gain2.gain.setValueAtTime(0.1, t);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        osc2.connect(gain2);
        gain2.connect(this.master);

        osc2.start(t);
        osc2.stop(t + 0.3);
    }

    medkit() {
        const ctx = this.ctx;
        const t = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.3);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.1);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);

        osc.connect(gain);
        gain.connect(this.master);

        osc.start(t);
        osc.stop(t + 0.4);

        // shimmer layer
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "square";
        osc2.frequency.setValueAtTime(600, t);
        osc2.frequency.linearRampToValueAtTime(1200, t + 0.3);

        gain2.gain.value = 0.05;
        osc2.connect(gain2);
        gain2.connect(this.master);

        osc2.start(t);
        osc2.stop(t + 0.4);
    }

    shoot() {
        const ctx = this.ctx;
        const t = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc.connect(gain);
        gain.connect(this.master);

        osc.start(t);
        osc.stop(t + 0.2);
    }

    // ==========================
    // 🚀 BOOST LOOP
    // ==========================
    startBoost() {
        if (this.boostNoise) return;

        const ctx = this.ctx;
        const t = ctx.currentTime;

        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(3000, t + 0.8);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0, t);
        gain.gain.linearRampToValueAtTime(0.45, t + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);

        noise.start();

        this.boostNoise = noise;
        this.boostGain = gain;
    }

    stopBoost() {
        if (!this.boostNoise) return;

        const ctx = this.ctx;
        const t = ctx.currentTime;

        this.boostGain.gain.cancelScheduledValues(t);
        this.boostGain.gain.setValueAtTime(this.boostGain.gain.value, t);
        this.boostGain.gain.linearRampToValueAtTime(0.0001, t + 0.15);

        setTimeout(() => {
            try { this.boostNoise.stop(); } catch (e) {}
            this.boostNoise = null;
            this.boostGain = null;
        }, 200);
    }

    // ==========================
    // 🎵 MUSIC LOOPS
    // ==========================
    stopMusic() {
        this.musicIntervals.forEach(clearInterval);
        this.musicIntervals = [];
        this.musicPlaying = null;
    }

    _playNote(freq, type, dur, vol = 0.1, timeOffset = 0) {
        const ctx = this.ctx;
        const t = ctx.currentTime + timeOffset;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + dur * 0.1);
        gain.gain.linearRampToValueAtTime(0, t + dur);

        osc.connect(gain);
        gain.connect(this.master);

        osc.start(t);
        osc.stop(t + dur + 0.1);
    }

    playGameMusic() {
    if (this.musicPlaying === "game") return;
    this.stopMusic();
    this.musicPlaying = "game";

    const ctx = this.ctx;

    let step = 0;
    const arp = [82.41, 123.47, 164.81, 123.47]; // E2 B2 E3 B2 vibe

    // scheduling params
    const interval = 0.125;       // 125ms per note
    const lookAhead = 0.20;       // schedule ahead
    const scheduleRate = 0.05;    // check every 50ms

    let nextTime = ctx.currentTime + 0.05;

    const scheduleNote = (time, freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(420, time);
        filter.frequency.linearRampToValueAtTime(140, time + 0.08);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.20, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.11);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.master);

        osc.start(time);
        osc.stop(time + 0.13);
    };

    const scheduler = () => {
        const now = ctx.currentTime;

        // schedule future notes
        while (nextTime < now + lookAhead) {
            const note = arp[step % arp.length];

            // small variation
            const freq = (Math.floor(step / 16) % 2 === 0) ? note : note * 1.5;

            scheduleNote(nextTime, freq);

            step++;
            nextTime += interval;
        }
    };

    // start scheduler loop (lightweight)
    scheduler();
    const id = setInterval(scheduler, scheduleRate * 1000);
    this.musicIntervals.push(id);
}

}

window.ProceduralAudio = ProceduralAudio;
