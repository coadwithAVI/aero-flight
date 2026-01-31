// Terrain & skybox
// ==========================================
// PATH: engine/map.js
// ==========================================

class GameMap {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.waterMesh = null;
        
        this.init();
    }

    init() {
        console.log("Initializing Map with size:", WORLD_CONFIG.worldSize);

        // 1. Setup Environment (Fog & Sky)
        this.scene.background = new THREE.Color(WORLD_CONFIG.skyColor);
        if (WORLD_CONFIG.useFog) {
            this.scene.fog = new THREE.FogExp2(WORLD_CONFIG.fogColor, WORLD_CONFIG.fogDensity);
        }

        // 2. Add Lighting (Suraj aur ambient light)
        this.setupLighting();

        // 3. Generate Ocean
        this.createOcean();

        // 4. Generate Terrain (Mountains)
        this.createTerrain();
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(1000, 2000, 1000);
        sun.castShadow = true;
        
        // Shadow properties badhane padenge bade map ke liye
        sun.shadow.camera.top = 2000;
        sun.shadow.camera.bottom = -2000;
        sun.shadow.camera.left = -2000;
        sun.shadow.camera.right = 2000;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        
        this.scene.add(sun);
    }

    createOcean() {
        // Ocean ek simple flat blue plane hai
        const geometry = new THREE.PlaneGeometry(WORLD_CONFIG.worldSize, WORLD_CONFIG.worldSize);
        const material = new THREE.MeshPhongMaterial({
            color: WORLD_CONFIG.waterColor,
            shininess: 80,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        this.waterMesh = new THREE.Mesh(geometry, material);
        this.waterMesh.rotation.x = -Math.PI / 2; // Flat leta do
        this.waterMesh.position.y = WORLD_CONFIG.waterLevel;
        this.scene.add(this.waterMesh);
    }

    createTerrain() {
        // PlaneGeometry: Width, Height, SegmentsX, SegmentsY
        // Segments jitne zyada honge, mountain utna smooth dikhega (lekin FPS kam honge)
        const segments = 256; 
        const geometry = new THREE.PlaneGeometry(WORLD_CONFIG.worldSize, WORLD_CONFIG.worldSize, segments, segments);
        
        // --- Height Generation (Mountains) ---
        const count = geometry.attributes.position.count;
        const colors = []; // Har vertex ka color yahan store hoga
        
        // Colors define kar lete hain
        const cSand = new THREE.Color(0xd2b48c);  // Tan
        const cGrass = new THREE.Color(0x228b22); // Forest Green
        const cRock = new THREE.Color(0x696969);  // Dim Grey
        const cSnow = new THREE.Color(0xffffff);  // White

        for (let i = 0; i < count; i++) {
            // X aur Y coordinate nikalo (Geometry flat hai toh Z use nahi hota height ke liye initially)
            const x = geometry.attributes.position.getX(i);
            const y = geometry.attributes.position.getY(i); // Note: PlaneGeometry mein Y 'up' nahi hota, Z hota hai rotation ke baad.

            // Noise Function (Simple Math.sin/cos combination for procedural mountains)
            // Complex noise ke liye humein 'SimplexNoise' library chahiye hoti, par ye formula bhi kaam karega:
            const frequency = 0.0005; // Pahaad kitne phailay hue honge
            let height = 
                Math.sin(x * frequency) * Math.cos(y * frequency) * 500 + 
                Math.sin(x * frequency * 2.5) * Math.cos(y * frequency * 2.5) * 200 +
                Math.abs(Math.sin(x * frequency * 5) * 50); // Roughness

            // Height ko absolute scale par le jao aur adjust karo
            height = Math.max(height, -500) + 200; // Base height lift
            
            // Random peaks
            if (height > 500) height *= 1.5; 

            // Height set karo (Z axis par kyunki geometry abhi rotate nahi hui hai)
            geometry.attributes.position.setZ(i, height);

            // --- Coloring Logic (Ocean -> Sand -> Green -> Rock -> Snow) ---
            let color = new THREE.Color();

            if (height < WORLD_CONFIG.sandLevel) {
                color.copy(cSand);
            } else if (height < WORLD_CONFIG.grassLevel) {
                // Mix Sand and Grass smoothly? Abhi direct switch karte hain
                color.copy(cGrass);
            } else if (height < WORLD_CONFIG.rockLevel) {
                color.copy(cRock);
            } else {
                color.copy(cSnow);
            }

            // Color array mein push karo (R, G, B values)
            colors.push(color.r, color.g, color.b);
        }

        // Color attribute geometry mein add karo
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        // Normals recalculate karo taaki lighting sahi dikhe (Shadows mountains par padein)
        geometry.computeVertexNormals();

        // Material setup (VertexColors use karega)
        const material = new THREE.MeshLambertMaterial({
            vertexColors: true, // Important: Ye batata hai ki humne jo colors array banaya hai use use karo
            side: THREE.DoubleSide
        });

        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.rotation.x = -Math.PI / 2; // Flat leta do
        this.terrainMesh.position.y = -50; // Thoda neeche taaki pani upar aa sake
        
        this.scene.add(this.terrainMesh);
    }
}