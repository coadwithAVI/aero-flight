// ==========================================
// PATH: gameplay/enemy-manager.js
// ==========================================

/**
 * EnemyManager (FINAL - FIXED)
 * - Spawns enemies around player
 * - Uses EnemyAI to move them
 * - Target = Active Ring (if RingSystem exists) else Player
 *
 * FIXES:
 * ✅ Pivot bug fixed (no duplicate mesh in scene)
 * ✅ Enemy movement now works (pivot moves, model follows)
 * ✅ Enemies speed synced with player feel
 */

class EnemyManager {
    constructor(scene, playerController, ringSystem = null) {
        this.scene = scene;
        this.player = playerController;
        this.ringSystem = ringSystem;

        this.enemies = [];
        this.score = 0;

        // =========================
        // SETTINGS
        // =========================
        this.maxEnemies = 5;

        this.spawnRadiusMin = 900;
        this.spawnRadiusMax = 2400;

        this.minAltitude = 140;
        this.maxAltitude = 800;

        // AI
        this.ai = new EnemyAI({
            detectRange: 8000,
            minDistance: 180,
            baseSpeed: 160,     // base units/sec
            turnSpeed: 2.2
        });

        this.factory = new ModelFactory();

        // Spawn initial enemies
        this.init();
    }

    // ======================================================
    // INIT
    // ======================================================
    init() {
        while (this.enemies.length < this.maxEnemies) {
            this.spawnEnemy();
        }
    }

    // ======================================================
    // TARGET POSITION (ring > player)
    // ======================================================
    _getTargetPosition() {
        // 1) RingSystem exists -> active ring
        if (this.ringSystem && this.ringSystem.rings?.length) {
            const idx = this.ringSystem.currentIndex ?? 0;
            const ringObj = this.ringSystem.rings[idx];
            const ringMesh = ringObj?.mesh || ringObj;
            if (ringMesh && ringMesh.position) return ringMesh.position;
        }

        // 2) fallback -> player
        if (this.player && this.player.mesh) return this.player.mesh.position;

        return null;
    }

    // ======================================================
    // SPAWN
    // ======================================================
    spawnEnemy() {
        if (!this.player || !this.player.mesh) return;

        // Create enemy ship mesh
        const ship = this.factory.createEnemyShip();
        ship.castShadow = true;
        ship.receiveShadow = true;

        // Pivot for correct movement + rotation
        const pivot = new THREE.Group();

        // ✅ Fix forward direction: ship faces correct way
        // (pivot will rotate, ship is just visual)
        ship.rotation.y = Math.PI;

        pivot.add(ship);

        // Spawn around player
        const p = this.player.mesh.position;

        const angle = Math.random() * Math.PI * 2;
        const r =
            this.spawnRadiusMin +
            Math.random() * (this.spawnRadiusMax - this.spawnRadiusMin);

        const x = p.x + Math.cos(angle) * r;
        const z = p.z + Math.sin(angle) * r;
        const y =
            this.minAltitude +
            Math.random() * (this.maxAltitude - this.minAltitude);

        // ✅ IMPORTANT: set pivot position (NOT ship position)
        pivot.position.set(x, y, z);
        pivot.rotation.y = Math.random() * Math.PI * 2;

        this.scene.add(pivot);

        this.enemies.push({
            id: Math.random().toString(36).substr(2, 9),
            mesh: pivot, // ✅ AI moves pivot
            ship,        // (optional ref)
            health: 100,

            // enemy-specific multiplier (random)
            speedMul: 0.9 + Math.random() * 0.25
        });
    }

    // ======================================================
    // UPDATE
    // ======================================================
    update(deltaTime) {
        if (!this.player || !this.player.mesh) return;

        const dt = Math.min(deltaTime, 0.05);

        // Keep enemy count
        if (this.enemies.length < this.maxEnemies) {
            if (Math.random() < 0.03) this.spawnEnemy();
        }

        const targetPos = this._getTargetPosition();
        if (!targetPos) return;

        // Player speed feel
        const baseSpeed = PHYSICS_CONFIG.baseSpeed ?? 2.2;
        const boostMultiplier = PHYSICS_CONFIG.boostMultiplier ?? 2.0;

        const boosting = this.player.input?.getAction?.("boost");
        const playerSpeedNow = boosting ? baseSpeed * boostMultiplier : baseSpeed;

        // Convert player speed scale -> AI multiplier
        // (player speed is small: 2.2-ish; AI uses 160 units/sec)
        const speedSync = boosting ? 1.25 : 1.0;

        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            if (!enemy || !enemy.mesh) continue;

            // ✅ Each enemy gets speed multiplier
            // (sync with player boost feel)
            enemy.speed = speedSync * enemy.speedMul;

            // AI update
            this.ai.update(enemy, targetPos, dt);

            // -------------------------
            // Safety clamps
            // -------------------------
            const floor = (WORLD_CONFIG.waterLevel ?? 0) + 12;
            const ceiling = WORLD_CONFIG.ceilingHeight ?? 1000;

            if (enemy.mesh.position.y < floor) enemy.mesh.position.y = floor;
            if (enemy.mesh.position.y > ceiling) enemy.mesh.position.y = ceiling;

            // World bounds clamp
            const ws = WORLD_CONFIG.worldSize ?? 10000;
            const half = ws * 0.5;

            enemy.mesh.position.x = clamp(enemy.mesh.position.x, -half, half);
            enemy.mesh.position.z = clamp(enemy.mesh.position.z, -half, half);
        }
    }

    // ======================================================
    // Removal / Scoring
    // ======================================================
    removeEnemyById(id) {
        const idx = this.enemies.findIndex(e => e.id === id);
        if (idx === -1) return;

        const enemy = this.enemies[idx];
        if (enemy && enemy.mesh) this.scene.remove(enemy.mesh);

        this.enemies.splice(idx, 1);
    }

    addScore(points = 1) {
        this.score += points;
    }
}

// utils
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

window.EnemyManager = EnemyManager;
