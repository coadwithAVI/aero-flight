// ==========================================
// SKY PILOT - GAME CONFIGURATION
// ==========================================
// Change variables here to update BOTH Singleplayer and Multiplayer

// --- GRAPHICS ---
const TERRAIN_COLORS = { 
    WATER: 0x1E90FF, 
    SAND: 0xEEDD82, 
    GRASS: 0x556B2F, 
    ROCK: 0x808080, 
    SNOW: 0xFFFFFF 
};

// --- FLIGHT PHYSICS ---
const NORMAL_SPEED = 6.5;
const BOOST_SPEED  = 14.5;
const TURN_SPEED   = 0.05;
const LIFT_SPEED   = 3.5;

// --- GAMEPLAY RULES ---
const RINGS_PER_LAP = 4;
const TOTAL_LAPS = 2;
const TOTAL_RINGS_WIN = RINGS_PER_LAP * TOTAL_LAPS;

// --- STATS ---
const BOOST_DRAIN = 0.8;      // Kitna fast boost khatam hoga
const BOOST_REFILL = 0.3;     // Kitna fast wapis bharega
const COLLISION_DAMAGE = 0.6; // Zameen se takraane par damage
const FIRE_RATE = 100;        // Milliseconds between shots