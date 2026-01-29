/**
 * SKY PILOT - GLOBAL CONFIGURATION (Version 2.0 - Optimized)
 * Ye file game ke physics, rules aur visuals ka "Single Source of Truth" hai.
 * Multiplayer aur Singleplayer dono isi ko refer karenge.
 */

// --- 🌍 WORLD & RINGS ---
const RINGS_PER_LAP = 12;      // Race track mein total rings
const TOTAL_RINGS_WIN = 12;    // Win karne ke liye kitni chahiye
const WORLD_SIZE = 50000;      // Map ka total size
const FOG_DENSITY = 0.00015;   // Performance ke liye fog limit

// --- ✈️ PHYSICS & MOVEMENT (Delta-Time Based) ---
// Note: Ye values ab per-second basis par hain (Not per-frame)
const NORMAL_SPEED = 300;      // Units per second
const BOOST_SPEED  = 600;      // Boost speed per second
const TURN_SPEED   = 2.0;      // Rotation speed (Radians per second)
const LIFT_SPEED   = 150;      // Ascent/Descent speed

// --- 🔥 COMBAT & HEALTH ---
const FIRE_RATE = 150;         // Milliseconds between shots
const COLLISION_DAMAGE = 20;   // Zameen se takkar ka damage
const BULLET_SPEED = 1200;     // Bullet speed units/sec
const MAX_HEALTH = 100;
const MAX_BOOST = 100;
const BOOST_DRAIN = 25;        // Boost drain per second
const BOOST_REFILL = 10;       // Refill per second

// --- 🎨 VISUAL PALETTE (Low Poly Art Style) ---
const TERRAIN_COLORS = {
  SAND:  0xE6C288, // Warm Sand
  GRASS: 0x567D46, // Muted Green
  ROCK:  0x5A5A5A, // Dark Grey
  SNOW:  0xFFFFFF, // Pure White
  WATER: 0x1E90FF, // Deep Sky Blue (Low opacity)
  SKY:   0x87CEEB  // Sky Background
};

// --- 🛠️ EXPORT LOGIC ---
if (typeof window !== 'undefined') {
    window.SKY_CONFIG = {
        RINGS_PER_LAP, TOTAL_RINGS_WIN, WORLD_SIZE, FOG_DENSITY,
        NORMAL_SPEED, BOOST_SPEED, TURN_SPEED, LIFT_SPEED,
        FIRE_RATE, COLLISION_DAMAGE, BULLET_SPEED,
        MAX_HEALTH, MAX_BOOST, BOOST_DRAIN, BOOST_REFILL,
        TERRAIN_COLORS
    };
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RINGS_PER_LAP, TOTAL_RINGS_WIN }; // Server sirf rules leta hai
}
