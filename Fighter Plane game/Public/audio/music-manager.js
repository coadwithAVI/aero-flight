//BGM
/**
 * MusicManager
 * Handles background music.
 * Generates an ambient cinematic drone using Web Audio API to avoid external asset dependencies.
 */
class MusicManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.nodes = []; // Stores active oscillators to manage memory
        this.isPlaying = false;
        this.initialized = false;
    }

    /**
     * Initializes the AudioContext.
     * Must be called after a user interaction (click/keydown) to comply with browser policies.
     */
    init() {
        if (this.initialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.15; // Keep BGM subtle (15% volume)
        this.masterGain.connect(this.ctx.destination);
        
        this.initialized = true;
    }

    /**
     * Starts the procedural ambient soundtrack.
     * Creates a lush, sci-fi style drone using multiple oscillators (D Minor Add9 Chord).
     */
    playBGM() {
        if (!this.initialized) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.isPlaying) return;

        // Frequencies for a D Minor Add9 chord (D2, A2, D3, F3, A3)
        // These intervals create a moody, "Hans Zimmer-esque" tension suitable for flight.
        const frequencies = [73.42, 110.00, 146.83, 174.61, 220.00];

        frequencies.forEach((freq, index) => {
            // 1. Oscillator Setup
            const osc = this.ctx.createOscillator();
            // Use Sawtooth for bass (gritty) and Sine for highs (pure)
            osc.type = index < 2 ? 'sawtooth' : 'sine'; 
            osc.frequency.value = freq;

            // Detune slightly for a thick "Analog Synth" chorus effect
            osc.detune.value = (Math.random() * 20) - 10; 

            // 2. Gain (Volume) Setup
            const gainNode = this.ctx.createGain();
            gainNode.gain.value = 0.0; // Start silent for fade-in

            // 3. Filter Setup (Muffle the sound)
            // This prevents the sawtooth waves from sounding like a buzzing bee
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400 + (index * 200); // Higher notes get more brightness

            // 4. LFO (Low Frequency Oscillator) for movement
            // Modulates the volume slowly so the sound "breathes" instead of being static
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + (Math.random() * 0.2); // Very slow pulses
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.2; // How much the volume wobbles

            // Connections: LFO -> Gain -> Master
            lfo.connect(lfoGain);
            lfoGain.connect(gainNode.gain);

            // Connections: Osc -> Filter -> Gain -> Master
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.masterGain);

            // Start Generators
            osc.start();
            lfo.start();

            // Fade in (Attack) - takes 2 seconds to reach full volume
            gainNode.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 2.0);

            // Store nodes to stop them later
            this.nodes.push({ osc, lfo, gainNode });
        });

        this.isPlaying = true;
    }

    /**
     * Stops the music with a gentle fade out.
     */
    stopBGM() {
        if (!this.isPlaying) return;

        const fadeTime = 2.0;

        this.nodes.forEach(node => {
            // Fade out
            // cancelScheduledValues is needed to override the LFO modulation
            node.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
            node.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeTime);
            
            // Stop oscillators after fade
            node.osc.stop(this.ctx.currentTime + fadeTime);
            node.lfo.stop(this.ctx.currentTime + fadeTime);
        });

        // Clear array after fade completes
        setTimeout(() => {
            this.nodes = [];
            this.isPlaying = false;
        }, fadeTime * 1000);
    }
}