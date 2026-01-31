// ==========================================
// PATH: config/config.physics.js
// ========================================== (Flight physics constants)

const PHYSICS_CONFIG = {
    // --- Speed Settings (Gati) ---
    maxSpeed: 2.5,          // Maximum normal flight speed
    minSpeed: 0.5,          // Stall speed (plane girne lagega agar isse slow hua)
    boostSpeed: 4.0,        // Speed jab Shift press karoge
    acceleration: 0.02,     // Throttle badhane ki speed
    deceleration: 0.01,     // Brake lagane ki speed

    // --- Handling / Rotation (Modne ki shamta) ---
    pitchSpeed: 0.04,       // Nose Up/Down sensitivity (W/S keys)
    rollSpeed: 0.06,        // Wing Roll sensitivity (A/D keys)
    yawSpeed: 0.015,        // Rudder Left/Right sensitivity (Q/E keys)
    
    // --- Aerodynamics (Hawa ka asar) ---
    levelOutSpeed: 0.02,    // Plane auto-level (wings seedha karna) ka rate
    turnBankingDelta: 0.05, // Turn karte waqt plane khud thoda roll karega (Visual feel)

    // --- World Forces ---
    gravity: 0.0,           // 0.0 = Arcade (Space like), 0.1 = Realism (Need lift)
    drag: 0.98,             // Air resistance (Throttle chhodne par slow hona)
    groundBounce: 0.3       // Zameen se takrane par kitna uchhlega
};

// Note: Agar tum ES6 Modules (import/export) use kar rahe ho future mein,
// toh niche wali line uncomment kar dena:
// export default PHYSICS_CONFIG;