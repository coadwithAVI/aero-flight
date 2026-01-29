/**
 * SKY PILOT - GLOBAL GAME CONFIGURATION
 * * Ye file Singleplayer aur Multiplayer dono ke rules ko sync rakhti hai.
 * Kisi bhi value ko yahan change karne par poore game mein update ho jayega.
 */

// --- 🎯 RINGS & RACE RULES ---
// Total 12 rings ka race track (1 Lap)
const RINGS_PER_LAP = 12;
const TOTAL_RINGS_WIN = 12; 

// --- ✈️ FLIGHT PHYSICS ---
// Speed values 'Units per Second' ke logic par based hain (DT scaled)
const NORMAL_SPEED = 5;  
const BOOST_SPEED  = 10;  
const TURN_SPEED   = 0.03;
const LIFT_SPEED   = 5;

// --- 🔥 COMBAT & DAMAGE ---
const FIRE_RATE = 120;       // Shots ke beech ka gap (ms)
const COLLISION_DAMAGE = 8;  // Zameen se takrane par damage
const BOOST_DRAIN = 0.5;     // Boost khali hone ki speed
const BOOST_REFILL = 0.1;    // Boost wapas bharne ki speed

// --- 🌍 TERRAIN VISUALS ---
// Standardized colors for all game environments
const TERRAIN_COLORS = {
  SAND: 0xC2B280,
  GRASS: 0x228B22,
  ROCK: 0x666666,
  SNOW: 0xFFFFFF,
  WATER: 0x0033aa
};

// Global export safety for various script environments
if (typeof window !== 'undefined') {
    window.SKY_CONFIG = {
        RINGS_PER_LAP,
        TOTAL_RINGS_WIN,
        NORMAL_SPEED,
        BOOST_SPEED,
        TURN_SPEED,
        LIFT_SPEED,
        FIRE_RATE,
        COLLISION_DAMAGE,
        BOOST_DRAIN,
        BOOST_REFILL,
        TERRAIN_COLORS
    };
}
