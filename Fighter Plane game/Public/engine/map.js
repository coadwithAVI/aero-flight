// PATH: engine/map.js
// ==========================================

/**
 * GameMap (MERGED FINAL)
 * - Terrain logic from SimplexNoise procedural map (smooth mountains)
 * - Works inside engine format (WORLD_CONFIG + GameMap class)
 * - Biome colors: sand -> grass -> rock -> snow
 * - Center flattened (spawn area)
 * - Reduced segments for performance
 */

class GameMap {
    constructor(scene) {
        this.scene = scene;

        this.terrainMesh = null;
        this.waterMesh = null;

        this.init();
    }

    init() {
        console.log("🗺️ Initializing GAME MAP:", WORLD_CONFIG.worldSize);

        // Sky + Fog
        this.scene.background = new THREE.Color(WORLD_CONFIG.skyColor ?? 0x87CEEB);

        if (WORLD_CONFIG.useFog) {
            this.scene.fog = new THREE.Fog(
                WORLD_CONFIG.fogColor ?? (WORLD_CONFIG.skyColor ?? 0x87CEEB),
                WORLD_CONFIG.fogNear ?? 300,
                WORLD_CONFIG.fogFar ?? 1800
            );
        }

        // Lighting
        this.setupLighting();

        // World Objects
        this.createOcean();
        this.createTerrain();
    }

    // ==========================================================
    // Lighting (engine-friendly)
    // ==========================================================
    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, WORLD_CONFIG.ambientIntensity ?? 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, WORLD_CONFIG.sunIntensity ?? 0.8);

        const sp = WORLD_CONFIG.sunPosition ?? { x: 100, y: 1000, z: 100 };
        sun.position.set(sp.x, sp.y, sp.z);

        sun.castShadow = false;

        // Shadow Optimization
        sun.shadow.mapSize.width = WORLD_CONFIG.shadowMapSize ?? 2048;
        sun.shadow.mapSize.height = WORLD_CONFIG.shadowMapSize ?? 2048;

        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 2000;

        const r = WORLD_CONFIG.shadowRange ?? 1000;
        sun.shadow.camera.left = -r;
        sun.shadow.camera.right = r;
        sun.shadow.camera.top = r;
        sun.shadow.camera.bottom = -r;

        this.scene.add(sun);
    }

    // ==========================================================
    // Ocean (from first file logic)
    // ==========================================================
    createOcean() {
        const size = (WORLD_CONFIG.worldSize ?? 10000) * 1.25;

        const geo = new THREE.PlaneGeometry(size, size, 1, 1);
        geo.rotateX(-Math.PI / 2);

        const mat = new THREE.MeshPhongMaterial({
            color: WORLD_CONFIG.waterColor ?? 0x1E90FF,
            transparent: true,
            opacity: WORLD_CONFIG.waterOpacity ?? 0.7,
            shininess: WORLD_CONFIG.waterShininess ?? 80,
            side: THREE.DoubleSide
        });

        this.waterMesh = new THREE.Mesh(geo, mat);
        this.waterMesh.position.y = WORLD_CONFIG.waterLevel ?? -100;
        this.waterMesh.receiveShadow = true;

        this.scene.add(this.waterMesh);
    }

    // ==========================================================
    // Terrain (SimplexNoise logic from first file)
    // ==========================================================
    createTerrain() {
        // Requires SimplexNoise library
        if (typeof SimplexNoise === "undefined") {
            console.error("❌ SimplexNoise library not found! Terrain cannot generate.");
            return;
        }

        const simplex = new SimplexNoise();

        const size = WORLD_CONFIG.worldSize ?? 8000;

        // ✅ Keep performance good (first file had 150x150 which is heavy)
        const seg = WORLD_CONFIG.terrainSegments ?? 50;

        const geo = new THREE.PlaneGeometry(size, size, seg, seg);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        const count = pos.count;

        const colors = new Float32Array(count * 3);
        const color = new THREE.Color();

        // Biome levels (same as first file)
        const sandLevel = WORLD_CONFIG.sandLevel ?? 100;
        const grassLevel = WORLD_CONFIG.grassLevel ?? 600;
        const rockLevel = WORLD_CONFIG.rockLevel ?? 1000;

        const cSand = new THREE.Color(WORLD_CONFIG.sandColor ?? 0xE6C288);
        const cGrass = new THREE.Color(WORLD_CONFIG.grassColor ?? 0x556B2F);
        const cRock = new THREE.Color(WORLD_CONFIG.rockColor ?? 0x808080);
        const cSnow = new THREE.Color(WORLD_CONFIG.snowColor ?? 0xFFFFFF);

        // height tuning
        const minHeight = WORLD_CONFIG.minTerrainHeight ?? -200;
        const mountainScale = WORLD_CONFIG.mountainScale ?? 900;

        // flatten center radius
        const centerRadius = WORLD_CONFIG.centerFlatRadius ?? 500;

        for (let i = 0; i < count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);

            // --- Smooth Mountain Logic (first file exact style) ---
            let noise = simplex.noise2D(x * 0.0003, z * 0.0003);
            noise += simplex.noise2D(x * 0.001, z * 0.001) * 0.2;

            let h = Math.max(minHeight, noise * mountainScale);

            // flatten center for spawn/runway
            const distFromCenter = Math.sqrt(x * x + z * z);
            if (distFromCenter < centerRadius) h *= 0.1;

            pos.setY(i, h);

            // --- Color Logic ---
            if (h < sandLevel) {
                color.copy(cSand);
            } else if (h < grassLevel) {
                color.copy(cGrass);
            } else if (h < rockLevel) {
                color.copy(cRock);
            } else {
                color.copy(cSnow);
            }

            colors[i * 3 + 0] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: WORLD_CONFIG.terrainRoughness ?? 0.9,
            metalness: WORLD_CONFIG.terrainMetalness ?? 0.1,
            side: THREE.DoubleSide
        });

        this.terrainMesh = new THREE.Mesh(geo, mat);
        // ✅ ADD THESE 2 LINES
        this.terrainMesh.name = "terrain";
        this.terrainMesh.userData.isTerrain = true;
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.castShadow = false;

        // optional offset (engine style)
        this.terrainMesh.position.y = WORLD_CONFIG.terrainYOffset ?? 0;

        this.scene.add(this.terrainMesh);
    }
}

window.GameMap = GameMap;
