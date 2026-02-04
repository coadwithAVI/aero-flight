// ==========================================
// PATH: gameplay/medkit-system.js
// ==========================================

/**
 * MedkitSystem
 * - Spawns medkits on terrain (above mountains)
 * - Player picks up -> heals + respawn after delay
 */

class MedkitSystem {
    constructor(scene, terrainMesh, options = {}) {
        this.scene = scene;
        this.terrainMesh = terrainMesh;

        this.count = options.count ?? 3;
        this.spawnRadiusMin = options.spawnRadiusMin ?? 800;
        this.spawnRadiusMax = options.spawnRadiusMax ?? 3500;

        this.terrainClearance = options.terrainClearance ?? 20;

        this.pickupRadius = options.pickupRadius ?? 60;

        this.healAmount = options.healAmount ?? 25;
        this.respawnDelay = options.respawnDelay ?? 8; // seconds

        // state
        this.medkits = [];

        // raycast helpers
        this._raycaster = new THREE.Raycaster();
        this._down = new THREE.Vector3(0, -1, 0);

        this._createMedkits();
    }

    // ==========================
    // Terrain height by raycast
    // ==========================
    _getTerrainY(x, z) {
        if (!this.terrainMesh) return (WORLD_CONFIG.waterLevel ?? 0);

        this.terrainMesh.updateMatrixWorld(true);

        const origin = new THREE.Vector3(x, 5000, z);
        this._raycaster.set(origin, this._down);
        this._raycaster.far = 10000;

        const hits = this._raycaster.intersectObject(this.terrainMesh, true);
        if (hits && hits.length > 0) return hits[0].point.y;

        return (WORLD_CONFIG.waterLevel ?? 0);
    }

    // ==========================
    // Visual model
    // ==========================
    _buildMedkitMesh() {
        const group = new THREE.Group();

        const boxGeo = new THREE.BoxGeometry(30, 18, 18);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0.1,
            emissive: new THREE.Color(0x111111)
        });

        const box = new THREE.Mesh(boxGeo, boxMat);
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);

        // red cross
        const crossMat = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            roughness: 0.4,
            metalness: 0.0,
            emissive: new THREE.Color(0x220000),
            emissiveIntensity: 1.5
        });

        const bar1 = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 2), crossMat);
        const bar2 = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 2), crossMat);

        bar1.position.set(0, 0, 10);
        bar2.position.set(0, 0, 10);

        group.add(bar1);
        group.add(bar2);

        return group;
    }

    _spawnOne(med) {
        const angle = Math.random() * Math.PI * 2;
        const r = this.spawnRadiusMin + Math.random() * (this.spawnRadiusMax - this.spawnRadiusMin);

        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        const terrainY = this._getTerrainY(x, z);
        let y = terrainY + this.terrainClearance;

        const waterSafe = (WORLD_CONFIG.waterLevel ?? 0) + 20;
        if (y < waterSafe) y = waterSafe;

        med.mesh.position.set(x, y, z);
        med.mesh.visible = true;
        med.cooldown = 0;
    }

    _createMedkits() {
        for (let i = 0; i < this.count; i++) {
            const mesh = this._buildMedkitMesh();
            mesh.name = `medkit-${i}`;

            this.scene.add(mesh);

            const med = {
                mesh,
                cooldown: 0
            };

            this._spawnOne(med);

            this.medkits.push(med);
        }
    }

    // ==========================
    // Update
    // ==========================
    update(dt, playerController) {
        if (!playerController?.mesh) return;

        const p = playerController.mesh.position;

        for (const med of this.medkits) {
            if (!med.mesh) continue;

            // respawn timer
            if (!med.mesh.visible) {
                med.cooldown -= dt;
                if (med.cooldown <= 0) {
                    this._spawnOne(med);
                }
                continue;
            }

            // floating + rotate effect
            med.mesh.rotation.y += dt * 1.2;
            med.mesh.position.y += Math.sin(performance.now() * 0.003) * 0.02;

            // pickup check
            const d = med.mesh.position.distanceTo(p);
            if (d <= this.pickupRadius) {
                // heal
                playerController.health = Math.min(100, playerController.health + this.healAmount);

                // hide + cooldown
                med.mesh.visible = false;
                med.cooldown = this.respawnDelay;
            }
        }
    }

    destroy() {
        for (const med of this.medkits) {
            if (med.mesh && this.scene) this.scene.remove(med.mesh);
        }
        this.medkits = [];
    }
}

window.MedkitSystem = MedkitSystem;
