const MapManager = {
    seed: 12345,

    setSeed: function(s) { this.seed = s; },
    
    // Pseudo Random Generator (Seeded)
    random: function() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    },

    getTerrainHeight: function(x, z) {
        let y = Math.sin(x * 0.0004) * Math.cos(z * 0.0004) * 1000;
        y += Math.sin(x * 0.001) * Math.cos(z * 0.001) * 300;
        const dist = Math.sqrt(x*x + z*z);
        if (dist < 3000) y *= (dist / 3000); // Flat spawn
        return Math.max(y, -200);
    },

    generateTerrain: function(scene) {
        const size = SKY_CONFIG.WORLD_SIZE;
        const geo = new THREE.PlaneGeometry(size, size, 60, 60); // 60 segments for performance
        geo.rotateX(-Math.PI / 2);
        
        const count = geo.attributes.position.count;
        const colors = [];
        const c = new THREE.Color();

        for (let i = 0; i < count; i++) {
            const x = geo.attributes.position.getX(i);
            const z = geo.attributes.position.getZ(i);
            const y = this.getTerrainHeight(x, z);
            geo.attributes.position.setY(i, y);

            if (y < -50) c.setHex(SKY_CONFIG.COLORS.SAND);
            else if (y < 500) c.setHex(SKY_CONFIG.COLORS.GRASS);
            else if (y < 1500) c.setHex(SKY_CONFIG.COLORS.ROCK);
            else c.setHex(SKY_CONFIG.COLORS.SNOW);
            colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        // Ocean
        const oceanGeo = new THREE.PlaneGeometry(size, size);
        oceanGeo.rotateX(-Math.PI/2);
        const oceanMat = new THREE.MeshPhongMaterial({ color: SKY_CONFIG.COLORS.WATER, transparent: true, opacity: 0.7 });
        const ocean = new THREE.Mesh(oceanGeo, oceanMat);
        ocean.position.y = -220;
        scene.add(ocean);
    },

    generateObjects: function(scene) {
        const rings = [];
        const medkits = [];
        const count = SKY_CONFIG.RINGS_TOTAL;
        
        // Ring Material
        const ringGeo = new THREE.TorusGeometry(80, 5, 8, 30);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.5 });
        
        // Medkit Material
        const kitGeo = new THREE.BoxGeometry(20, 20, 20);
        const kitMat = new THREE.MeshStandardMaterial({ color: 0x00FF00 });

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 6000 + (this.random() * 2000 - 1000);
            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius;
            const y = Math.max(this.getTerrainHeight(x, z) + 400, 600 + (this.random() * 500));

            // Ring
            const ring = new THREE.Mesh(ringGeo, ringMat.clone());
            ring.position.set(x, y, z);
            ring.lookAt(0, y, 0);
            scene.add(ring);
            rings.push(ring);

            // Medkit (Randomly placed between rings logic)
            if (this.random() > 0.3) {
                const mx = x + (this.random() * 400 - 200);
                const mz = z + (this.random() * 400 - 200);
                const my = y + (this.random() * 200 - 100);
                const kit = new THREE.Mesh(kitGeo, kitMat);
                kit.position.set(mx, my, mz);
                // Simple cross visual
                const cross = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 5), new THREE.MeshBasicMaterial({color:0xffffff}));
                const cross2 = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 5), new THREE.MeshBasicMaterial({color:0xffffff}));
                kit.add(cross, cross2);
                
                kit.userData = { active: true };
                scene.add(kit);
                medkits.push(kit);
            }
        }
        return { rings, medkits };
    }
};
