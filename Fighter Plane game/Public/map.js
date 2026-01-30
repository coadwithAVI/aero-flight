/**
 * 🌍 SKY PILOT: MAP MANAGER
 * Procedural Terrain with 4 Layers (Sand, Grass, Rock, Snow) + Ocean.
 * Ensures Objects spawn ABOVE the ground.
 */

const MapManager = {
    noise: null,
    groundMesh: null,
    
    // Config
    CHUNK_SIZE: 30000, // World size
    SEGMENTS: 150,     // Detail level (Higher = smoother, more lag)
    MAX_HEIGHT: 1000,   // Mountain Peak height

    init: function() {
        if (!this.noise) {
            this.noise = new SimpleNoise(); // Initialize noise generator
        }
    },

    // --- 1. GENERATE TERRAIN VISUALS ---
    generateTerrain: function(scene) {
        this.init();

        // A. Geometry
        const geometry = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, this.SEGMENTS, this.SEGMENTS);
        geometry.rotateX(-Math.PI / 2);

        const colors = [];
        const vertices = geometry.attributes.position;
        const count = vertices.count;

        // B. Height & Color Calculation
        for (let i = 0; i < count; i++) {
            const x = vertices.getX(i);
            const z = vertices.getZ(i);
            
            // Calculate Height
            const h = this.calculateHeight(x, z);
            vertices.setY(i, h);

            // Assign Color based on Height (Layers)
            let color;
            if (h < 50) {
                // SAND (Beach)
                color = new THREE.Color(0xeebb88); 
            } else if (h < 300) {
                // GRASS (Green Plains)
                // Mix light and dark green based on height
                const t = (h - 50) / 250;
                color = new THREE.Color(0x228b22).lerp(new THREE.Color(0x32cd32), t * 0.5);
            } else if (h < 600) {
                // ROCK (Mountain)
                const t = (h - 300) / 300;
                color = new THREE.Color(0x666666).lerp(new THREE.Color(0x444444), t);
            } else {
                // SNOW (Peaks)
                color = new THREE.Color(0xffffff);
            }
            
            colors.push(color.r, color.g, color.b);
        }

        // Apply Colors
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        // Material (Vertex Colors enabled)
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true // Low-poly look
        });

        this.groundMesh = new THREE.Mesh(geometry, material);
        scene.add(this.groundMesh);

        // C. OCEAN WATER (Bottom Layer)
        const waterGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x0066ff,
            transparent: true,
            opacity: 0.6,
            roughness: 0.1
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = 20; // Slightly above 0 level
        scene.add(water);
    },

    // --- 2. CALCULATE HEIGHT (Math Logic) ---
    // This is used by Physics to detect collisions
    getTerrainHeight: function(x, z) {
        if (!this.noise) this.init();
        return this.calculateHeight(x, z);
    },

    calculateHeight: function(x, z) {
        // Combine multiple noise layers for realistic mountains
        const scale1 = 0.0005; // Big mountains
        const scale2 = 0.002;  // Small details

        let y = this.noise.noise2D(x * scale1, z * scale1) * this.MAX_HEIGHT;
        y += this.noise.noise2D(x * scale2, z * scale2) * (this.MAX_HEIGHT * 0.1);
        
        // Flatten the bottom (for ocean/sand)
        if(y < 0) y = y * 0.3; 
        
        return Math.max(-100, y); // Floor
    },

    // --- 3. OBJECT PLACEMENT (Smart Spawning) ---
    generateObjects: function(scene) {
        const rings = [];
        const medkits = [];

        // Generate Path for Rings (Figure-8 or Circle)
        const totalRings = SKY_CONFIG.RINGS_TOTAL;
        const radius = 1500;

        for (let i = 0; i < totalRings; i++) {
            const angle = (i / totalRings) * Math.PI * 2;
            
            // Calculate X, Z position in a circle/oval
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius * 1.5; // Oval shape

            // --- CRITICAL FIX: HEIGHT CHECK ---
            // 1. Get ground height at this specific spot
            const groundH = this.getTerrainHeight(x, z);
            
            // 2. Set Ring Height: Always 150 units ABOVE the ground
            // Min height 400 (for air gameplay), but if mountain is tall, go higher.
            const y = Math.max(400, groundH + 150);

            // Ring Mesh
            const geometry = new THREE.TorusGeometry(30, 2, 16, 32);
            const material = new THREE.MeshBasicMaterial({ color: 0xffd700 });
            const ring = new THREE.Mesh(geometry, material);
            
            ring.position.set(x, y, z);
            ring.lookAt(0, y, 0); // Face inward
            
            scene.add(ring);
            rings.push(ring);

            // Add Medkits occasionally (near rings but lower)
            if (i % 3 === 0) {
                const mkGeo = new THREE.BoxGeometry(10, 10, 10);
                const mkMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const kit = new THREE.Mesh(mkGeo, mkMat);
                
                // Place kit slightly below ring path
                kit.position.set(x + 50, y - 50, z);
                kit.rotation.y = Math.random();
                kit.userData = { active: true };
                
                scene.add(kit);
                medkits.push(kit);
            }
        }

        return { rings, medkits };
    }
};

// --- SIMPLEX NOISE UTILITY (Compact) ---
// Minimal implementation to avoid external dependencies
class SimpleNoise {
    constructor() {
        this.perm = new Uint8Array(512);
        for(let i=0; i<256; i++) this.perm[i] = this.perm[i+256] = Math.floor(Math.random()*256);
    }
    noise2D(x, y) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = x*x*(3-2*x), v = y*y*(3-2*y);
        const A = this.perm[X]+Y, B = this.perm[X+1]+Y;
        return this.lerp(v, this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x-1, y)),
               this.lerp(u, this.grad(this.perm[A+1], x, y-1), this.grad(this.perm[B+1], x-1, y-1)));
    }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h<8 ? x : y, v = h<4 ? y : h===12||h===14 ? x : 0;
        return ((h&1) === 0 ? u : -u) + ((h&2) === 0 ? v : -v);
    }
}

window.MapManager = MapManager;
