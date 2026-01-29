/**
 * SKY PILOT - MAP MANAGER (Seeded Generation)
 * Uses a deterministic random number generator so all players see the SAME map.
 */

const MapManager = {
    seed: 12345, // Default seed, Server will override this

    // --- 🎲 CUSTOM SEEDED RANDOM (Linear Congruential Generator) ---
    // Math.random() sync nahi ho sakta, isliye hum ye use karenge.
    setSeed: function(s) {
        this.seed = s;
        console.log("Map Seed Set To:", this.seed);
    },

    random: function() {
        // Simple LCG algorithm for speed and consistency
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    },

    // --- 🏔️ TERRAIN HEIGHT LOGIC ---
    // Returns exact Y height at (x, z). Used for collision and generation.
    getTerrainHeight: function(x, z) {
        // Base Hills (Large scale)
        let y = Math.sin(x * 0.0004) * Math.cos(z * 0.0004) * 1000;
        
        // Detail Noise (Small bumps)
        y += Math.sin(x * 0.001) * Math.cos(z * 0.001) * 300;
        
        // Spawn Area Flattening (Taaki spawn par plane pahad me na phase)
        const dist = Math.sqrt(x*x + z*z);
        if (dist < 3000) {
            y *= (dist / 3000); // 0 at center, full height at 3000 radius
        }
        
        // Water Level limit
        return Math.max(y, -200); 
    },

    // --- 🌍 GENERATE MESHES ---
    generateTerrain: function(config) {
        const size = config.WORLD_SIZE;
        const segments = 100; // Good balance for visuals vs performance

        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        const count = geometry.attributes.position.count;
        const colors = [];
        const colorObj = new THREE.Color();

        for (let i = 0; i < count; i++) {
            const x = geometry.attributes.position.getX(i);
            const z = geometry.attributes.position.getZ(i);
            
            // Height Calculation
            const y = this.getTerrainHeight(x, z);
            geometry.attributes.position.setY(i, y);

            // Color Logic (Based on Height)
            if (y < -50) colorObj.setHex(config.TERRAIN_COLORS.SAND);
            else if (y < 400) colorObj.setHex(config.TERRAIN_COLORS.GRASS);
            else if (y < 1200) colorObj.setHex(config.TERRAIN_COLORS.ROCK);
            else colorObj.setHex(config.TERRAIN_COLORS.SNOW);

            // Thoda Random Variation add karte hain natural look ke liye
            // lekin "Seeded" random use karenge taaki sync na toote
            const variation = (this.random() * 0.1) - 0.05;
            colorObj.r += variation;
            colorObj.g += variation;
            colorObj.b += variation;

            colors.push(colorObj.r, colorObj.g, colorObj.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals(); // Lighting ke liye zaroori hai

        // Material Upgrade: StandardMaterial for Lighting Reaction
        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true, 
            roughness: 0.8, 
            flatShading: true // Low Poly Style
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "Terrain";
        return mesh;
    },

    generateOcean: function(config) {
        const geometry = new THREE.PlaneGeometry(config.WORLD_SIZE, config.WORLD_SIZE);
        geometry.rotateX(-Math.PI / 2);
        
        const material = new THREE.MeshPhongMaterial({
            color: config.TERRAIN_COLORS.WATER,
            transparent: true,
            opacity: 0.75,
            shininess: 80 // Shiny water
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = -220; // Slightly below lowest sand level
        mesh.name = "Ocean";
        return mesh;
    },

    // --- 💍 RING GENERATION (Sync-Safe) ---
    generateRings: function(count, config) {
        const rings = [];
        const waypoints = [];
        
        const ringGeo = new THREE.TorusGeometry(80, 5, 16, 50);
        // Emissive material taaki rings door se chamkein
        const ringMat = new THREE.MeshStandardMaterial({ 
            color: 0xFFD700, 
            emissive: 0xFFD700,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });

        for (let i = 0; i < count; i++) {
            // Seeded Random se positions decide hongi
            const angle = (i / count) * Math.PI * 2;
            const radius = 6000 + (this.random() * 2000 - 1000); // Varied path
            
            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius;
            
            // Height: Ground se kam se kam 400 unit upar
            const groundH = this.getTerrainHeight(x, z);
            const y = Math.max(groundH + 400, 600 + (this.random() * 500));

            const ring = new THREE.Mesh(ringGeo, ringMat.clone());
            ring.position.set(x, y, z);
            ring.lookAt(0, y, 0); // Rings center ki taraf face karengi
            
            ring.userData = { id: i, collected: false };
            rings.push(ring);
            waypoints.push(new THREE.Vector3(x, y, z));
        }

        return { rings, waypoints };
    }
};

// Global Export
window.MapManager = MapManager;
