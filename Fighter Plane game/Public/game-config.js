/**
 * 🛠️ SKY PILOT - CONFIGURATION
 * Single Source of Truth for Server & Client.
 */
const SKY_CONFIG = {
    // --- 🏁 RACE RULES ---
    RINGS_TOTAL: 4,      // Map par kitni rings hain
    LAPS: 2,             // Total Laps
    // Total rings to win = RINGS_TOTAL * LAPS (e.g., 4 * 2 = 8)
    
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
    
    TERRAIN_DAMAGE: 0.5, // Health drain per tick when hitting ground
    MEDKIT_HEAL: 30,     // Health restored by medkit
    
    FIRE_RATE: 200,      
    BULLET_SPEED: 40,
    BULLET_DAMAGE: 10,

    // --- 🎨 COLORS ---
    COLORS: {
        SAND: 0xE6C288, GRASS: 0x567D46, ROCK: 0x5A5A5A, 
        SNOW: 0xFFFFFF, WATER: 0x1E90FF, SKY: 0x87CEEB
    }
};

// Export for Node.js & Browser
if (typeof window !== 'undefined') window.SKY_CONFIG = SKY_CONFIG;
else if (typeof module !== 'undefined') module.exports = SKY_CONFIG;
