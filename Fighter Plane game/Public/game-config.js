/**
 * 🛠️ SKY PILOT - GLOBAL CONFIGURATION
 * Single Source of Truth.
 * Ye object "Default Settings" hold karta hai.
 * Singleplayer ya Multiplayer files inhe zarurat padne par override kar sakti hain.
 */

const SKY_CONFIG = {
    // --- 🏁 GAME RULES (Defaults) ---
    // Singleplayer isse override karke 4 aur 8 kar dega
    RINGS_PER_LAP: 12,      
    TOTAL_RINGS_WIN: 12,    
    WORLD_SIZE: 50000,
    FOG_DENSITY: 0.00015,

    // --- ✈️ PHYSICS (Units per step) ---
    NORMAL_SPEED: 5,
    BOOST_SPEED: 10,
    TURN_SPEED: 0.03,
    LIFT_SPEED: 5,
    
    // --- 🔥 COMBAT & STATS ---
    MAX_HEALTH: 100,
    MAX_BOOST: 100,
    BOOST_DRAIN: 0.5,    // Kitna boost kam hoga per tick
    BOOST_REFILL: 0.1,   // Kitna wapas bharega
    
    FIRE_RATE: 150,      // Milliseconds between shots
    BULLET_SPEED: 40,
    COLLISION_DAMAGE: 10, // Zameen se takrane par damage

    // --- 🎨 VISUALS ---
    TERRAIN_COLORS: {
        SAND: 0xE6C288,
        GRASS: 0x567D46,
        ROCK: 0x5A5A5A,
        SNOW: 0xFFFFFF,
        WATER: 0x1E90FF,
        SKY: 0x87CEEB
    }
};

// --- 🔌 ENVIRONMENT EXPORT LOGIC ---
// Ye code ensure karta hai ki ye file Browser aur Node.js (Server) dono jagah chale.

if (typeof window !== 'undefined') {
    // Browser: Window object par attach karo
    window.SKY_CONFIG = SKY_CONFIG;
} 
else if (typeof module !== 'undefined' && module.exports) {
    // Server: Module exports ke through bhejo
    module.exports = SKY_CONFIG;
}
