/**
 * 🛠️ SKY PILOT - CONFIGURATION
 * Single Source of Truth for Server & Client.
 */

const SKY_CONFIG = {
    // --- 🏁 RACE RULES ---
    RINGS_TOTAL: 4,   // map par kitni rings (per lap)
    LAPS: 2,          // total laps

    // ✅ Server Multiplayer expects these:
    RINGS_PER_LAP: 4,               // same as RINGS_TOTAL
    TOTAL_RINGS_WIN: 4 * 2,         // RINGS_TOTAL * LAPS
    TOTAL_RINGS_TO_WIN: 4 * 2,      // (optional alias)

    WORLD_SIZE: 50000,
    FOG_DENSITY: 0.00015,

    // --- ✈️ PHYSICS ---
    NORMAL_SPEED: 5,
    BOOST_SPEED: 10,
    TURN_SPEED: 0.03,
    LIFT_SPEED: 5,
    
    // --- 🔥 COMBAT & HEALTH ---
    MAX_HEALTH: 100,
    MAX_BOOST: 100,
    BOOST_DRAIN: 0.5,
    BOOST_REFILL: 0.1,
    
    TERRAIN_DAMAGE: 0.5,
    MEDKIT_HEAL: 30,
    
    FIRE_RATE: 200,
    BULLET_SPEED: 40,
    BULLET_DAMAGE: 10,

    // --- 🎨 COLORS ---
    COLORS: {
        SAND: 0xE6C288, GRASS: 0x567D46, ROCK: 0x5A5A5A,
        SNOW: 0xFFFFFF, WATER: 0x1E90FF, SKY: 0x87CEEB
    }
};

// ✅ Auto-sync derived rules (no manual mismatch)
SKY_CONFIG.RINGS_PER_LAP = SKY_CONFIG.RINGS_TOTAL;
SKY_CONFIG.TOTAL_RINGS_WIN = SKY_CONFIG.RINGS_TOTAL * SKY_CONFIG.LAPS;
SKY_CONFIG.TOTAL_RINGS_TO_WIN = SKY_CONFIG.TOTAL_RINGS_WIN;

// Export for Node.js & Browser
if (typeof window !== 'undefined') window.SKY_CONFIG = SKY_CONFIG;
if (typeof module !== 'undefined') module.exports = { SKY_CONFIG };
