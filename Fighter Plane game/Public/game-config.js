// ==========================================
// SKY PILOT - GAME CONFIGURATION
// ==========================================
// This file is loaded by both Singleplayer and Multiplayer.
// Changing values here updates the game rules everywhere.

// --- 🎯 RINGS & RACE RULES ---
const RINGS_PER_LAP = 12;
// Rule: 1 Lap Race (TOTAL = PER_LAP * 1)
const TOTAL_RINGS_WIN = 12; 

// --- ✈️ FLIGHT PHYSICS ---
// Speed is in "Units per Frame" (approx 60 FPS)
// Note: 180 would be too fast for this map scale, set to safe defaults.
const NORMAL_SPEED = 5;  
const BOOST_SPEED  = 10;  
const TURN_SPEED   = 0.03;
const LIFT_SPEED   = 5;

// --- 🔥 COMBAT & DAMAGE ---
const FIRE_RATE = 120;       // Time between shots (ms)
const COLLISION_DAMAGE = 8;  // Damage on hitting ground
const BOOST_DRAIN = 0.5;     // How fast boost empties
const BOOST_REFILL = 0.1;    // How fast boost recharges

// --- 🌍 TERRAIN VISUALS ---
const TERRAIN_COLORS = {
  SAND: 0xC2B280,
  GRASS: 0x228B22,
  ROCK: 0x666666,
  SNOW: 0xFFFFFF,
  WATER: 0x0033aa
};
