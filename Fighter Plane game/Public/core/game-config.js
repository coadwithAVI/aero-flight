//Global settings
// ==========================================
// PATH: core/game-config.js
// ==========================================

const GAME_CONFIG = {
    // --- System Settings ---
    version: "0.1.0",
    debugMode: true,        // Agar true hai, toh screen par extra info (FPS, positions) dikhegi
    showFPS: true,          // Frame rate counter
    
    // --- Graphics / Performance ---
    targetFPS: 60,
    shadows: false,         // Shadows on/off (Performance ke liye off kar sakte hain)
    antialiasing: true,     // Smooth edges (High performance cost)
    resolutionScale: 1.0,   // 1.0 = Full Res, 0.5 = Half Res (Low end PC ke liye)

    // --- Audio Defaults ---
    masterVolume: 1.0,
    musicVolume: 0.7,
    sfxVolume: 1.0,

    // --- Input Preferences ---
    invertY: false,         // Flight games mein kuch log "Down" daba kar "Up" jana pasand karte hain
    sensitivity: 1.0        // Global mouse/stick sensitivity multiplier
};

// Agar ES6 use kar rahe ho:
// export default GAME_CONFIG;