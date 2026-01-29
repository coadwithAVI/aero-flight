/**
 * SKY PILOT - GLOBAL MUSIC MANAGER
 * Dedicated strictly for background music and atmospheric loops.
 * SFX (Gunshots, Explosions) should be handled separately in AudioSys.
 */

const MusicManager = {
    audioCtx: null,
    activeNodes: [],
    loopIds: [],
    currentTheme: null, // Track kar raha hai ki abhi kaunsa music chal raha hai

    // ✅ Improvement 1: Auto-init safety helper
    _ensureInit: function() {
        if (!this.audioCtx) this.init();
    },

    // Audio Context initialize karne ke liye (User ke pehle click par call karein)
    init: function() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    // Saare chalu music aur loops ko band karne ke liye
    stop: function() {
        // Saare intervals clear karein
        this.loopIds.forEach(id => clearInterval(id));
        this.loopIds = [];
        
        // Saare active audio nodes ko disconnect aur stop karein
        this.activeNodes.forEach(n => {
            try { 
                if(n.stop) n.stop(); 
                n.disconnect(); 
            } catch(e){}
        });
        this.activeNodes = [];
        this.currentTheme = null;
    },

    // --- STYLE D: MAIN MENU ---
    playMenu: function() {
        this._ensureInit(); // Safety Check
        if (this.currentTheme === 'menu') return;
        this.stop();
        this.currentTheme = 'menu';
        
        const chords = [[146.83, 220.00, 349.23], [116.54, 174.61, 233.08]];
        const masterG = this.audioCtx.createGain(); 
        masterG.gain.value = 0.2; 
        masterG.connect(this.audioCtx.destination); 
        this.activeNodes.push(masterG);
        
        const f = this.audioCtx.createBiquadFilter(); 
        f.type='lowpass'; 
        f.frequency.value = 400; 
        f.connect(masterG);
        
        let cIdx = 0;
        const play = () => {
            chords[cIdx % 2].forEach(freq => {
                const osc = this.audioCtx.createOscillator(); 
                osc.type = 'triangle'; 
                osc.frequency.value = freq;
                
                const env = this.audioCtx.createGain(); 
                env.gain.setValueAtTime(0, this.audioCtx.currentTime);
                env.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 2);
                env.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 5.5);
                
                osc.connect(env); 
                env.connect(f); 
                osc.start(); 
                osc.stop(this.audioCtx.currentTime + 6);
                this.activeNodes.push(osc);
            });
            cIdx++;
        };
        play();
        this.loopIds.push(setInterval(play, 5000));
    },

    // --- STYLE H: LOBBY ---
    playLobby: function() {
        this._ensureInit(); // Safety Check
        if (this.currentTheme === 'lobby') return;
        this.stop();
        this.currentTheme = 'lobby';

        // Background rumble (Engine idle feel)
        const rumble = this.audioCtx.createOscillator(); 
        rumble.type = 'sawtooth'; 
        rumble.frequency.value = 40; 
        const rFilter = this.audioCtx.createBiquadFilter(); 
        rFilter.type = 'lowpass'; 
        rFilter.frequency.value = 120;
        const rGain = this.audioCtx.createGain(); 
        rGain.gain.value = 0.3;
        
        rumble.connect(rFilter); 
        rFilter.connect(rGain); 
        rGain.connect(this.audioCtx.destination);
        rumble.start(); 
        this.activeNodes.push(rumble);

        // Periodic system check blips
        let tick = 0;
        const sequence = [523.25, 0, 659.25, 0, 783.99, 523.25, 0, 0]; 
        this.loopIds.push(setInterval(() => {
            const t = this.audioCtx.currentTime;
            if (tick % 4 === 0) {
                const osc = this.audioCtx.createOscillator(); 
                osc.type = 'square'; 
                osc.frequency.value = 100;
                const g = this.audioCtx.createGain(); 
                g.gain.setValueAtTime(0.04, t); 
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                const f = this.audioCtx.createBiquadFilter(); 
                f.type = 'bandpass'; 
                f.frequency.value = 2000;
                osc.connect(f); f.connect(g); g.connect(this.audioCtx.destination);
                osc.start(t); osc.stop(t + 0.1);
            }
            const note = sequence[tick % 8];
            if (note > 0 && Math.random() > 0.2) {
                const osc = this.audioCtx.createOscillator(); 
                osc.type = 'sine'; 
                osc.frequency.value = note;
                const g = this.audioCtx.createGain(); 
                g.gain.setValueAtTime(0.02, t); 
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.connect(g); 
                g.connect(this.audioCtx.destination);
                osc.start(t); 
                osc.stop(t + 0.1);
            }
            tick++;
        }, 250));
    },

    // --- GAMEPLAY MUSIC LOGIC ---
    updateGameplayMusic: function(hp) {
        this._ensureInit(); // Safety Check
        if (hp <= 0) return; 
        
        if (hp < 50) {
            if (this.currentTheme !== 'danger') this._playDanger();
        } else {
            if (this.currentTheme !== 'normal') this._playNormal();
        }
    },

    // STYLE E: Normal Flying (HP > 50)
    _playNormal: function() {
        this._ensureInit(); // Safety Check
        this.stop();
        this.currentTheme = 'normal';
        let tick = 0;
        this.loopIds.push(setInterval(() => {
            const t = this.audioCtx.currentTime;
            if(tick % 4 === 0) { // Kick Drum
                const o = this.audioCtx.createOscillator(); 
                const g = this.audioCtx.createGain();
                o.frequency.setValueAtTime(120, t); 
                o.frequency.exponentialRampToValueAtTime(0.01, t + 0.4);
                g.gain.setValueAtTime(0.8, t); 
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
                o.connect(g); 
                g.connect(this.audioCtx.destination); 
                o.start(t); 
                o.stop(t + 0.4);
            }
            if(tick % 4 !== 0) { // Bassline
                const o = this.audioCtx.createOscillator(); 
                o.type = 'sawtooth'; 
                o.frequency.value = (Math.floor(tick / 16) % 2 === 0) ? 55 : 65;
                const g = this.audioCtx.createGain(); 
                g.gain.setValueAtTime(0.15, t); 
                g.gain.linearRampToValueAtTime(0, t + 0.1);
                o.connect(g); 
                g.connect(this.audioCtx.destination); 
                o.start(t); 
                o.stop(t + 0.2);
            }
            tick++;
        }, 120));
    },

    // STYLE F: Danger/Combat (HP < 50)
    _playDanger: function() {
        this._ensureInit(); // Safety Check
        this.stop();
        this.currentTheme = 'danger';
        let step = 0;
        this.loopIds.push(setInterval(() => {
            const t = this.audioCtx.currentTime; 
            const ps = step % 16;
            if(ps === 0 || ps === 10) { // Fast intense kick
                const o = this.audioCtx.createOscillator(); 
                const g = this.audioCtx.createGain();
                o.frequency.setValueAtTime(150, t); 
                g.gain.setValueAtTime(0.7, t);
                o.connect(g); 
                g.connect(this.audioCtx.destination); 
                o.start(t); 
                o.stop(t + 0.15);
            }
            if(ps === 4 || ps === 12) { // Tense snare
                const o = this.audioCtx.createOscillator(); 
                o.type = 'triangle'; 
                o.frequency.value = 200;
                const g = this.audioCtx.createGain(); 
                g.gain.setValueAtTime(0.4, t);
                o.connect(g); 
                g.connect(this.audioCtx.destination); 
                o.start(t); 
                o.stop(t + 0.1);
            }
            step++;
        }, 90));
    },

    // --- STYLE G: VICTORY ---
    playWin: function() {
        this._ensureInit(); // Safety Check
        if (this.currentTheme === 'win') return;
        this.stop();
        this.currentTheme = 'win';
        const now = this.audioCtx.currentTime;
        const playBrass = (freq, time, dur) => {
            const o = this.audioCtx.createOscillator(); 
            o.type = 'sawtooth'; 
            o.frequency.value = freq;
            const f = this.audioCtx.createBiquadFilter(); 
            f.type = 'lowpass'; 
            f.frequency.setValueAtTime(500, time); 
            f.frequency.linearRampToValueAtTime(3000, time + 0.1);
            const g = this.audioCtx.createGain(); 
            g.gain.setValueAtTime(0, time); 
            g.gain.linearRampToValueAtTime(0.4, time + 0.05); 
            g.gain.exponentialRampToValueAtTime(0.01, time + dur);
            o.connect(f); f.connect(g); g.connect(this.audioCtx.destination); 
            o.start(time); o.stop(time + dur + 0.1);
        };
        const tune = [
            {f:261.63, t:0, d:0.2}, {f:329.63, t:0.2, d:0.2}, 
            {f:392.00, t:0.4, d:0.2}, {f:523.25, t:0.6, d:1.0}, 
            {f:392.00, t:1.0, d:0.4}, {f:523.25, t:1.4, d:1.5}
        ];
        tune.forEach(n => playBrass(n.f, now + n.t, n.d));
    },

    // --- STYLE I: LOSE ---
    playLose: function() {
        this._ensureInit(); // Safety Check
        if (this.currentTheme === 'lose') return;
        this.stop();
        this.currentTheme = 'lose';
        const now = this.audioCtx.currentTime;
        const playNote = (freq, time, dur) => {
            const o = this.audioCtx.createOscillator(); 
            o.type = 'triangle'; 
            o.frequency.value = freq;
            const g = this.audioCtx.createGain(); 
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(0.2, time + 0.1); 
            g.gain.exponentialRampToValueAtTime(0.001, time + dur);
            o.connect(g); 
            g.connect(this.audioCtx.destination); 
            o.start(time); 
            o.stop(time + dur);
        };
        const sequence = [
            { f: 196.00, t: 0, d: 0.5 }, 
            { f: 185.00, t: 0.5, d: 0.5 }, 
            { f: 174.61, t: 1.0, d: 0.5 }, 
            { f: 130.81, t: 1.5, d: 2.0 }
        ];
        sequence.forEach(n => playNote(n.f, now + n.t, n.d));
    }
};

// ✅ Improvement 2: Expose globally to prevent scope issues
window.MusicManager = MusicManager;