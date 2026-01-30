/**
 * 🎵 SKY PILOT: MUSIC MANAGER
 * Procedural Music Sequencer. No external files needed.
 */

const MusicManager = {
    ctx: null,
    masterGain: null,
    intervalId: null,
    currentTheme: null,

    init: function() {
        if (this.ctx) return;
        // Reuse SFX context if available to save resources
        if (window.SFXManager && SFXManager.ctx) {
            this.ctx = SFXManager.ctx;
        } else {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = GameManager.state.isMusicOn ? GameManager.state.musicVolume : 0;
        this.masterGain.connect(this.ctx.destination);
    },

    updateState: function(isOn) {
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(isOn ? 0.3 : 0, this.ctx.currentTime, 0.5);
        }
        if (!isOn) this.stop();
        else if (this.currentTheme) this[this.currentTheme](); // Restart theme
    },

    stop: function() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
    },

    // --- THEMES ---

    playLobby: function() {
        this.init();
        this.stop();
        this.currentTheme = 'playLobby';
        if (!GameManager.state.isMusicOn) return;

        // Ambient Arpeggio (C Major 7)
        const notes = [261.63, 329.63, 392.00, 493.88]; 
        let idx = 0;

        this.intervalId = setInterval(() => {
            this.playNote(notes[idx % notes.length] * (Math.random() > 0.5 ? 1 : 0.5), 'sine', 0.5, 0.1);
            idx++;
        }, 300);
    },

    playCombat: function() {
        this.init();
        this.stop();
        this.currentTheme = 'playCombat';
        if (!GameManager.state.isMusicOn) return;

        // Driving Bassline
        let step = 0;
        this.intervalId = setInterval(() => {
            const t = this.ctx.currentTime;
            
            // Kick
            if (step % 4 === 0) {
                this.playTone(150, 'square', 0.2, 0.1, 50); // Punchy kick
            }
            
            // Hi-hat
            if (step % 2 === 1) {
                this.playTone(800, 'triangle', 0.05, 0.05);
            }

            // Bass (F - G sequence)
            const freq = (Math.floor(step / 16) % 2 === 0) ? 87.31 : 98.00;
            if (step % 2 === 0) {
                this.playNote(freq, 'sawtooth', 0.2, 0.1);
            }
            
            step++;
        }, 125); // Fast Tempo (120 BPM)
    },

    // --- HELPER FUNCTIONS ---

    playNote: function(freq, type, dur, vol) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + dur + 0.1);
    },

    playTone: function(freq, type, dur, vol, dropTo) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (dropTo) osc.frequency.exponentialRampToValueAtTime(dropTo, t + dur);

        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + dur);
    }
};

window.MusicManager = MusicManager;
