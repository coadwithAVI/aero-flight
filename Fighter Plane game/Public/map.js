/**
 * SKY PILOT - MAP MANAGER (Ultra Smooth Highlands - AI Safe Version)
 * Terrain, Ocean aur Ring generation ka centralized logic.
 * Is version mein height math ko simplify kiya gaya hai taaki AI planes terrain mein na ghusein.
 */

const MapManager = {
    // Duniya ke constants
    WORLD_LIMIT: 24500,
    TERRAIN_SIZE: 50000,
    TERRAIN_SEGMENTS: 65, 

    /**
     * Terrain ki EXACT visual unchai nikaalne ka naya formula.
     * Mesh position 0 par set ki gayi hai taaki confusion na ho.
     */
    getTerrainHeight: function(x, z) {
        // Base structure: Asymmetrical mountains
        let h = Math.sin(x * 0.0004 + z * 0.0001) * Math.cos(z * 0.0005 - x * 0.0001) * 1400;
        
        // Secondary layer: Rolling hills
        h += Math.sin(x * 0.0015) * Math.sin(z * 0.002) * 350;
        
        // High frequency roughness
        h += (Math.sin(x * 0.008) + Math.cos(z * 0.008)) * 25;

        // Spawn point flattening: 2200 units tak rasta smooth rahega
        let distFromCenter = Math.sqrt(x * x + z * z);
        if (distFromCenter < 2200) {
            let factor = Math.pow(distFromCenter / 2200, 2);
            h *= factor;
        }

        // Global ground offset taaki 0 level par bhi thodi zameen ho
        // Final value wahi hai jo screen par dikhegi (No mesh shift needed)
        let finalY = h - 150;

        // Samundar ke niche ka floor limit
        if (finalY < -400) finalY = -400;

        return finalY; 
    },

    /**
     * Zameen (Terrain) generate karna.
     */
    generateTerrain: function(config) {
        const COLORS = {
            SAND: new THREE.Color(0xd2b48c),
            GRASS: new THREE.Color(0x3a5f0b),
            ROCK: new THREE.Color(0x606060),
            SNOW: new THREE.Color(0xffffff)
        };

        const geometry = new THREE.PlaneGeometry(this.TERRAIN_SIZE, this.TERRAIN_SIZE, this.TERRAIN_SEGMENTS, this.TERRAIN_SEGMENTS);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;
        const colors = [];

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            const y = this.getTerrainHeight(x, z);
            positions.setY(i, y); // Exact height set yahan ho rahi hai

            let finalColor = new THREE.Color();
            // Smoother altitude-based coloring logic
            if (y < -50) {
                finalColor.copy(COLORS.SAND);
            } else if (y < 450) {
                let ratio = (y + 50) / 500;
                finalColor.copy(COLORS.SAND).lerp(COLORS.GRASS, ratio);
            } else if (y < 900) {
                let ratio = (y - 450) / 450;
                finalColor.copy(COLORS.GRASS).lerp(COLORS.ROCK, ratio);
            } else {
                let ratio = Math.min((y - 900) / 500, 1);
                finalColor.copy(COLORS.ROCK).lerp(COLORS.SNOW, ratio);
            }
            colors.push(finalColor.r, finalColor.g, finalColor.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false 
        });

        const mesh = new THREE.Mesh(geometry, material);
        // ✅ Fix: Mesh position ab y=0 par hai taaki logic aur visual match karein
        mesh.position.y = 0; 
        return mesh;
    },

    /**
     * Samundar (Ocean) logic.
     */
    generateOcean: function(config) {
        const geo = new THREE.PlaneGeometry(this.TERRAIN_SIZE, this.TERRAIN_SIZE);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x1565c0,
            specular: 0x555555,
            shininess: 50,
            transparent: true,
            opacity: 0.7
        });
        const mesh = new THREE.Mesh(geo, mat);
        // Ocean ko sand ke thoda niche set kiya hai
        mesh.position.y = -210; 
        return mesh;
    },

    /**
     * Rings generation.
     */
    generateRings: function(count, seed = 12345) {
        const rings = [];
        const waypoints = [];
        
        let s = seed;
        const seededRandom = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };

        const ringGeo = new THREE.TorusGeometry(95, 9, 16, 60);
        const ringMat = new THREE.MeshPhongMaterial({
            color: 0xFFD700, 
            emissive: 0xaa8800,
            emissiveIntensity: 0.4,
            shininess: 100
        });

        for (let i = 0; i < count; i++) {
            const angle = i * (Math.PI * 2 / count);
            const dynamicRadius = 6500 + Math.sin(angle * 3) * 1500; 
            const x = Math.sin(angle) * dynamicRadius;
            const z = Math.cos(angle) * dynamicRadius;
            
            const groundY = this.getTerrainHeight(x, z);
            // Rings altitude calculation
            const y = Math.max(500, groundY + 400 + Math.sin(angle * 5) * 200);

            waypoints.push({ x, y, z });

            const ring = new THREE.Mesh(ringGeo, ringMat.clone());
            ring.position.set(x, y, z);
            ring.rotation.y = angle + Math.PI/2; 
            ring.userData = { locked: false, index: i };
            rings.push(ring);
        }

        return { rings, waypoints };
    }
};

window.MapManager = MapManager;
