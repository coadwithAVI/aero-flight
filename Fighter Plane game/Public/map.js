/**
 * SKY PILOT - MAP MANAGER
 * Centralized logic for Terrain, Ocean, and Ring generation.
 * This file is shared between Singleplayer and Multiplayer modes.
 */

const MapManager = {
    // World Constants
    WORLD_LIMIT: 24500,
    TERRAIN_SIZE: 50000,
    TERRAIN_SEGMENTS: 60, // Optimized for performance

    /**
     * Mathematical formula for terrain height at a specific (x, z)
     * Used for both visual generation and physics/collision.
     */
    getTerrainHeight: function(x, z) {
        let y = Math.sin(x * 0.001) * Math.cos(z * 0.001) * 1000 + Math.sin(x * 0.005) * 200;
        // Flatten the center area (spawn point)
        if (z > -1000 && z < 1000 && x > -1000 && x < 1000) {
            y *= 0.1;
        }
        if (y < -150) y = -150;
        return y - 50;
    },

    /**
     * Generates the visual Terrain Mesh with vertex colors based on height.
     */
    generateTerrain: function(config) {
        const colors_cfg = config.TERRAIN_COLORS;
        const geometry = new THREE.PlaneGeometry(this.TERRAIN_SIZE, this.TERRAIN_SIZE, this.TERRAIN_SEGMENTS, this.TERRAIN_SEGMENTS);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;
        const colors = [];

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            const y = this.getTerrainHeight(x, z);
            positions.setY(i, y);

            // Coloring logic based on height
            const color = new THREE.Color();
            if (y < -50) {
                color.setHex(colors_cfg.SAND);
            } else if (y < 100) {
                color.setHex(colors_cfg.SAND);
            } else if (y < 500) {
                color.setHex(colors_cfg.GRASS);
            } else if (y < 900) {
                color.setHex(colors_cfg.ROCK);
            } else {
                color.setHex(colors_cfg.SNOW);
            }
            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            flatShading: true
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = -50;
        mesh.receiveShadow = false; // Disabled for performance
        return mesh;
    },

    /**
     * Generates the Ocean Mesh.
     */
    generateOcean: function(config) {
        const geo = new THREE.PlaneGeometry(this.TERRAIN_SIZE, this.TERRAIN_SIZE);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: config.TERRAIN_COLORS.WATER,
            transparent: true,
            opacity: 0.6
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = -80;
        return mesh;
    },

    /**
     * Generates an array of ring objects and their mathematical waypoints.
     * Supports seeded random for multiplayer synchronization.
     */
    generateRings: function(count, seed = 12345) {
        const rings = [];
        const waypoints = [];
        
        // Simple seeded random function
        let s = seed;
        const seededRandom = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };

        const ringGeo = new THREE.TorusGeometry(80, 10, 16, 50);
        const ringMat = new THREE.MeshPhongMaterial({
            color: 0xFFD700,
            emissive: 0xffaa00,
            shininess: 100
        });

        for (let i = 0; i < count; i++) {
            const angle = i * (Math.PI * 2 / count);
            const x = Math.sin(angle) * 12000;
            const z = Math.cos(angle) * -12000;
            const groundY = this.getTerrainHeight(x, z);
            const y = Math.max(500, groundY + 400);

            waypoints.push({ x, y, z });

            const ring = new THREE.Mesh(ringGeo, ringMat.clone());
            ring.position.set(x, y, z);
            ring.rotation.y = seededRandom() * Math.PI;
            ring.userData = { locked: false, index: i };
            rings.push(ring);
        }

        return { rings, waypoints };
    }
};

// Export to window so scripts can access it
window.MapManager = MapManager;
