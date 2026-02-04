// ==========================================
// PATH: config/config.physics.js
// ==========================================

/**
 * PHYSICS_CONFIG
 * Flight + Boost constants (optimized arcade style)
 * ✅ Constant base speed
 * ✅ Boost = speed multiplier (Shift)
 * ✅ Boost energy drains + regenerates
 */

const PHYSICS_CONFIG = {
    // ======================================================
    // ✈️ Flight Speed (Arcade)
    // ======================================================
    baseSpeed: 2.2,          // Constant speed in normal flight
    boostMultiplier: 2.0,    // Shift dabane par speed = baseSpeed * boostMultiplier

    // ======================================================
    // ⚡ Boost Energy System
    // ======================================================
    boostMax: 100,           // Max boost energy (0-100)
    boostDrainPerSec: 35,    // Boost ON: per second kitna energy drain hoga
    boostRegenPerSec: 18,    // Boost OFF: per second kitna energy regen hoga
    boostMinToUse: 5,        // Itni energy se kam hui to boost allow nahi hoga (prevents flicker)

    // ======================================================
    // 🎮 Handling / Rotation
    // ======================================================
    pitchSpeed: 0.04,        // W/S
    rollSpeed: 0.06,         // A/D
    yawSpeed: 0.015,         // Q/E (agar use ho)

    // ======================================================
    // 🛫 Stability / Feel
    // ======================================================
    levelOutSpeed: 0.02,     // Auto-level support (optional if used)
    turnBankingDelta: 0.05,  // Turning feel (visual banking)

    // ======================================================
    // 🌍 World Forces (Arcade)
    // ======================================================
    gravity: 0.0,            // 0.0 arcade (recommended)
    drag: 1.0,               // Constant speed mode => drag should be 1.0
    groundBounce: 0.3        // future: ground hit bounce
};

// export default PHYSICS_CONFIG; (if ES6 modules in future)
window.PHYSICS_CONFIG = PHYSICS_CONFIG;
