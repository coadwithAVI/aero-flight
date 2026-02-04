//World boundaries & lighting
// ==========================================
// PATH: config/config.world.js
// ==========================================

const WORLD_CONFIG = {
    // --- Environment / Mahaul ---
    skyColor: 0x87CEEB,     // Sky Blue (Aasmaan ka rang)
    groundColor: 0x2a2a2a,  // Dark Grey/Green (Zameen ka rang)
    
    // --- Visibility (Dhund) ---
    // Fog game ko optimize karta hai taaki door ki cheezein render na karni padein
    useFog: true,
    fogColor: 0x87CEEB,     // Fog ka rang aasmaan jaisa hona chahiye blend hone ke liye
    fogDensity: 0.0015,     // Jitna zyada number, utni gahri dhund (0.001 - 0.01)

    // --- Map Boundaries (Seema) ---
    worldSize: 10000,       // Map ka total size (10,000 units)
    ceilingHeight: 1000,    // Isse upar plane nahi ja sakta (Max altitude)
    floorHeight: 0,         // Zameen ka level (Sea level)
    
    // --- Grid / Terrain Settings ---
    gridSize: 200,          // Zameen par jo boxes dikhenge unka size
    chunkSize: 1000,        // Terrain generation ke liye (agar future mein infinite world chahiye)

    // --- Water / Ocean ---
    waterColor: 0x1e90ff,     // Deep sky blue
    waterLevel: 0,            // Sea level

    // --- Terrain Height Zones ---
    sandLevel: 50,
    grassLevel: 250,
    rockLevel: 500,

    // --- Lighting (Roshni) ---
    ambientLightIntensity: 0.6, // General roshni (har jagah)
    sunLightIntensity: 0.8,     // Suraj ki roshni
    sunPosition: { x: 100, y: 200, z: 100 } // Suraj kahan se chamkega
    
    
};

// Agar ES6 use kar rahe ho:
// export default WORLD_CONFIG;