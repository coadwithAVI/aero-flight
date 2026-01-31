// ==========================================
// PATH: gameplay/player-controller.js
// ==========================================

/**
 * PlayerController (FINAL - Jet Feel + Solid Terrain Collision)
 *
 * ✅ No axis locking (rotation order YXZ)
 * ✅ Boost energy drain/regen
 * ✅ Bank-to-turn turning
 * ✅ Terrain collision:
 *    - raycast terrain height
 *    - if plane touches mountain => push out + damage 10
 */

class PlayerController {
    constructor(scene, inputManager, terrainMesh = null) {
        this.scene = scene;
        this.input = inputManager;

        // Terrain collision
        this.terrainMesh = terrainMesh;
        this._raycaster = new THREE.Raycaster();
        this._down = new THREE.Vector3(0, -1, 0);

        this.collisionCooldown = 0;

        this.mesh = null;
        this.health = 100;

        // Safe spawn
        this.spawnPoint = new THREE.Vector3(250, 260, -250);

        // Boost
        this.boostEnergy = PHYSICS_CONFIG.boostMax ?? 100;

        // ============================
        // Flight tuning (JET)
        // ============================
        this.maxPitch = 0.65;
        this.maxRoll = 1.25;

        this.pitchResponse = 0.14;
        this.rollResponse = 0.18;

        this.turnStrength = 3;
        this.rollAutoLevel = 0.05;

        // Internals
        this.desiredPitch = 0;
        this.desiredRoll = 0;

        this.initModel();
    }

    // ==========================================================
    // Terrain injection
    // ==========================================================
    setTerrainMesh(mesh) {
        this.terrainMesh = mesh;
    }

    // ==========================================================
    // Model
    // ==========================================================
    initModel() {
        const factory = new ModelFactory();

        // ✅ ONLY SVX-57 model
        this.mesh = factory.createPlayerPlane();

        // ✅ crucial for no axis lock
        this.mesh.rotation.order = "YXZ";

        // scale optional
        this.mesh.scale.set(1.2, 1.2, 1.2);

        // shadows
        this.mesh.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        this.respawnInstant();
        this.scene.add(this.mesh);
    }

    respawnInstant() {
        if (!this.mesh) return;

        this.health = 100;
        this.boostEnergy = PHYSICS_CONFIG.boostMax ?? 100;

        this.desiredPitch = 0;
        this.desiredRoll = 0;

        this.collisionCooldown = 0;

        this.mesh.position.copy(this.spawnPoint);
        this.mesh.rotation.set(0, 0, 0);
    }

    // ==========================================================
    // Terrain height (raycast)
    // ==========================================================
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

    _resolveTerrainCollision(dt) {
        if (!this.mesh || !this.terrainMesh) return;

        // cooldown tick
        if (this.collisionCooldown > 0) {
            this.collisionCooldown -= dt;
        }

        const x = this.mesh.position.x;
        const z = this.mesh.position.z;

        const terrainY = this._getTerrainY(x, z);

        // approximate plane collision size
        const hullRadius = 10;
        const clearance = 2;

        const minAllowedY = terrainY + hullRadius + clearance;

        if (this.mesh.position.y < minAllowedY) {
            // push out upward
            this.mesh.position.y = minAllowedY;

            // knockback backward
            this.mesh.translateZ(-45 * dt * 60);

            // sideways nudge (prevents stuck in slope)
            this.mesh.position.x += (Math.random() - 0.5) * 10;
            this.mesh.position.z += (Math.random() - 0.5) * 10;

            // damage with cooldown
            if (this.collisionCooldown <= 0) {
                this.takeDamage(10);
                this.collisionCooldown = 0.25; // 250ms
            }

            // drain boost slightly to feel impact
            this.boostEnergy = Math.max(0, this.boostEnergy - 12);
        }
    }

    // ==========================================================
    // Update
    // ==========================================================
    update(deltaTime) {
        if (!this.mesh) return;
        const dt = Math.min(deltaTime, 0.05);

        // ======================================================
        // 1) Boost energy drain / regen
        // ======================================================
        const wantBoost = this.input.getAction("boost");

        const boostMax = PHYSICS_CONFIG.boostMax ?? 100;
        const drain = PHYSICS_CONFIG.boostDrainPerSec ?? 35;
        const regen = PHYSICS_CONFIG.boostRegenPerSec ?? 18;
        const boostMinToUse = PHYSICS_CONFIG.boostMinToUse ?? 5;

        let boosting = false;

        if (wantBoost && this.boostEnergy > boostMinToUse) {
            boosting = true;
            this.boostEnergy -= drain * dt;
        } else {
            boosting = false;
            this.boostEnergy += regen * dt;
        }

        this.boostEnergy = clamp(this.boostEnergy, 0, boostMax);

        // ======================================================
        // 2) Speed (constant)
        // ======================================================
        const baseSpeed = PHYSICS_CONFIG.baseSpeed ?? 2.2;
        const boostMultiplier = PHYSICS_CONFIG.boostMultiplier ?? 2.0;

        let speedNow = boosting ? baseSpeed * boostMultiplier : baseSpeed;
        if (this.input.getAction("brake")) speedNow *= 0.55;

        // ======================================================
        // 3) Input -> desired pitch/roll
        // ======================================================
        const pitchInput =
            (this.input.getAction("pitchDown") ? 1 : 0) -
            (this.input.getAction("pitchUp") ? 1 : 0);

        const rollInput =
            (this.input.getAction("rollRight") ? 1 : 0) -
            (this.input.getAction("rollLeft") ? 1 : 0);

        this.desiredPitch = (-pitchInput) * this.maxPitch;
        this.desiredRoll = (rollInput) * this.maxRoll;

        // ======================================================
        // 4) Smooth Pitch / Roll
        // ======================================================
        const pitchT = 1 - Math.pow(0.001, dt * this.pitchResponse * 60);
        const rollT = 1 - Math.pow(0.001, dt * this.rollResponse * 60);

        this.mesh.rotation.x = lerp(this.mesh.rotation.x, this.desiredPitch, pitchT);
        this.mesh.rotation.z = lerp(this.mesh.rotation.z, this.desiredRoll, rollT);

        // roll auto-level
        if (rollInput === 0 && this.rollAutoLevel > 0) {
            const relaxT = 1 - Math.pow(0.001, dt * this.rollAutoLevel * 60);
            this.mesh.rotation.z = lerp(this.mesh.rotation.z, this.mesh.rotation.z * 0.92, relaxT);
        }

        // ======================================================
        // 5) Bank-to-turn yaw
        // ======================================================
        const rollAngle = this.mesh.rotation.z;
        const speedRatio = clamp(speedNow / (baseSpeed * boostMultiplier), 0.4, 1.0);
        const yawPerFrame = (-rollAngle) * this.turnStrength * speedRatio * dt;
        this.mesh.rotation.y += yawPerFrame;

        // ======================================================
        // 6) Forward movement
        // ======================================================
        this.mesh.translateZ(speedNow * dt * 60);

        // ======================================================
        // 7) Terrain collision (solid)
        // ======================================================
        this._resolveTerrainCollision(dt);

        // ======================================================
        // 8) Bounds
        // ======================================================
        const floor = (WORLD_CONFIG.waterLevel ?? 0) + 5;
        const ceiling = WORLD_CONFIG.ceilingHeight ?? 1000;

        if (this.mesh.position.y < floor) this.mesh.position.y = floor;
        if (this.mesh.position.y > ceiling) this.mesh.position.y = ceiling;

        const ws = WORLD_CONFIG.worldSize ?? 10000;
        const half = ws * 0.5;

        this.mesh.position.x = clamp(this.mesh.position.x, -half, half);
        this.mesh.position.z = clamp(this.mesh.position.z, -half, half);

        if (PHYSICS_CONFIG.gravity && PHYSICS_CONFIG.gravity > 0) {
            this.mesh.position.y -= PHYSICS_CONFIG.gravity * dt * 60;
        }
    }

    // ==========================================================
    // Helpers
    // ==========================================================
    getBoostPercent() {
        const max = PHYSICS_CONFIG.boostMax ?? 100;
        return max > 0 ? (this.boostEnergy / max) : 0;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
    }

    getPosition() {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }

    getQuaternion() {
        return this.mesh ? this.mesh.quaternion : new THREE.Quaternion();
    }
}

// Utils
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}

window.PlayerController = PlayerController;
