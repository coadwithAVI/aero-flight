// ==========================================
// PATH: gameplay/enemy-manager.js
// ==========================================

/**
 * EnemyManager (FINAL v12 - PERSONALITIES + FIRING + ENEMY VS ENEMY)
 *
 * ✅ 3 personalities:
 *   - racer     (fast, low damage, mostly rings)
 *   - balanced  (medium, sometimes fights)
 *   - attacker  (aggressive, more bullets)
 *
 * ✅ Speed range: 0.9x -> 1.3x (relative feel vs player)
 * ✅ Enemy bullets spawn here (independent from BulletSystem)
 * ✅ Enemy vs Enemy fights
 * ✅ Terrain collision clamp
 * ✅ World bounds clamp
 */

class EnemyManager {
    constructor(scene, playerController, ringSystem = null, terrainMesh = null) {
        this.scene = scene;
        this.player = playerController;
        this.ringSystem = ringSystem;

        // Terrain collision support
        this.terrainMesh = terrainMesh;
        this._raycaster = new THREE.Raycaster();
        this._down = new THREE.Vector3(0, -1, 0);

        // state
        this.enemies = [];
        this.score = 0;

        // =========================
        // SETTINGS
        // =========================
        this.maxEnemies = 6;

        this.spawnRadiusMin = 900;
        this.spawnRadiusMax = 2400;

        this.minAltitude = 160;
        this.maxAltitude = 850;

        // ring racing
        this.enemyRingPassRadius = 170;

        // Terrain safety
        this.enemyTerrainClearance = 35;
        this.enemyHullRadius = 16;
        this.enemyTerrainKnockback = 180;

        // ---------------------------------
        // Enemy bullets (local system)
        // ---------------------------------
        this.enemyBullets = [];
        this.enemyBulletSpeed = 520;       // units/sec
        this.enemyBulletLifetime = 2.2;    // seconds
        this.enemyBulletRadius = 0.45;
        this.enemyBulletHitRadius = 14;

        this._bulletGeo = new THREE.SphereGeometry(this.enemyBulletRadius, 6, 6);
        this._bulletMat = new THREE.MeshBasicMaterial({ color: 0xff5533 });

        // How often enemies shoot
        this.enemyFireCooldownBase = 0.6; // base seconds
        this.enemyFireDistance = 900;     // shoot if closer than this
        this.enemyFireAngleMax = 0.55;    // rad (~31 deg)

        // Enemy vs Enemy
        this.enemyVsEnemyRange = 1000;
        this.enemyVsEnemyChance = 0.10;  // chance per update tick
        this.enemyFriendlyFire = true;

        // AI
        this.ai = new EnemyAI({
            terrainMesh: this.scene.getObjectByName("terrain") || this.terrainMesh,
            terrainClearance: 90,
            avoidLookAhead: 240,
            detectRange: 20000,
            minDistance: 260,
            baseSpeed: 130,
            turnSpeed: 2.8,
            patrolTurn: 0.6,
            altitudeKeepStrength: 0.55,
            altitudeOffsetRange: 140
        });

        this.factory = new ModelFactory();

        // Spawn initial enemies
        this.init();
    }

    // ======================================================
    // Inject terrain mesh later (optional)
    // ======================================================
    setTerrainMesh(mesh) {
        this.terrainMesh = mesh;
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
    // TERRAIN HEIGHT (raycast)
    // ======================================================
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

    _resolveTerrainCollision(enemy, dt) {
        if (!enemy?.mesh || !this.terrainMesh) return;

        const pos = enemy.mesh.position;

        const terrainY = this._getTerrainY(pos.x, pos.z);
        const minAllowedY = terrainY + this.enemyTerrainClearance + this.enemyHullRadius;

        if (pos.y < minAllowedY) {
            pos.y = minAllowedY;

            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
            pos.addScaledVector(forward, -this.enemyTerrainKnockback * dt);

            pos.x += (Math.random() - 0.5) * 30;
            pos.z += (Math.random() - 0.5) * 30;
        }
    }

    // ======================================================
    // Ring helpers
    // ======================================================
    _getRingMeshByIndex(idx) {
        if (!this.ringSystem || !this.ringSystem.rings?.length) return null;
        const ringObj = this.ringSystem.rings[idx];
        return ringObj?.mesh || ringObj || null;
    }

    _getEnemyTargetPosition(enemy) {
        if (!enemy?.mesh) return null;

        // fallback: chase player
        if (!this.ringSystem || !this.ringSystem.rings?.length) {
            return this.player?.mesh ? this.player.mesh.position : null;
        }

        const ringCount = this.ringSystem.rings.length;

        if (enemy.targetRingIndex == null) enemy.targetRingIndex = 0;

        let ringMesh = this._getRingMeshByIndex(enemy.targetRingIndex);
        if (!ringMesh) return this.player?.mesh ? this.player.mesh.position : null;

        const dist = enemy.mesh.position.distanceTo(ringMesh.position);
        if (dist <= this.enemyRingPassRadius) {
            enemy.ringsPassed = (enemy.ringsPassed ?? 0) + 1;
            enemy.targetRingIndex = (enemy.targetRingIndex + 1) % ringCount;

            ringMesh = this._getRingMeshByIndex(enemy.targetRingIndex);
            if (!ringMesh) return this.player?.mesh ? this.player.mesh.position : null;
        }

        enemy._target.copy(ringMesh.position);

        // keep above terrain
        if (this.terrainMesh) {
            const ty = this._getTerrainY(enemy._target.x, enemy._target.z);
            const safeY = ty + this.enemyTerrainClearance + 70;
            if (enemy._target.y < safeY) enemy._target.y = safeY;
        }

        return enemy._target;
    }

    // ======================================================
    // PERSONALITY
    // ======================================================
    _pickPersonality(index) {
        // mix distribution
        if (index % 3 === 0) return "racer";
        if (index % 3 === 1) return "balanced";
        return "attacker";
    }

    _getPersonalityConfig(type) {
        // speed: relative range 0.9x..1.3x
        switch (type) {
            case "racer":
                return {
                    type,
                    speedMulMin: 1.15,
                    speedMulMax: 1.30,
                    fireRate: 0.18, // very low shooting
                    damage: 6
                };
            case "balanced":
                return {
                    type,
                    speedMulMin: 0.98,
                    speedMulMax: 1.12,
                    fireRate: 0.45,
                    damage: 9
                };
            case "attacker":
            default:
                return {
                    type: "attacker",
                    speedMulMin: 0.90,
                    speedMulMax: 1.05,
                    fireRate: 0.85, // shoots a lot
                    damage: 12
                };
        }
    }

    // ======================================================
    // SPAWN
    // ======================================================
    spawnEnemy() {
        if (!this.player || !this.player.mesh) return;

        const ship = this.factory.createEnemyShip();
        ship.castShadow = true;
        ship.receiveShadow = true;

        const pivot = new THREE.Group();
        pivot.add(ship);

        const p = this.player.mesh.position;

        const angle = Math.random() * Math.PI * 2;
        const r = this.spawnRadiusMin + Math.random() * (this.spawnRadiusMax - this.spawnRadiusMin);

        const x = p.x + Math.cos(angle) * r;
        const z = p.z + Math.sin(angle) * r;

        let y = this.minAltitude + Math.random() * (this.maxAltitude - this.minAltitude);

        if (this.terrainMesh) {
            const ty = this._getTerrainY(x, z);
            const safeY = ty + this.enemyTerrainClearance + 150;
            if (y < safeY) y = safeY;
        }

        pivot.position.set(x, y, z);
        pivot.rotation.y = Math.random() * Math.PI * 2;

        this.scene.add(pivot);

        const startIndex =
            (this.ringSystem && typeof this.ringSystem.currentIndex === "number")
                ? this.ringSystem.currentIndex
                : 0;

        const personalityType = this._pickPersonality(this.enemies.length);
        const personality = this._getPersonalityConfig(personalityType);

        const speedMulBase =
            personality.speedMulMin +
            Math.random() * (personality.speedMulMax - personality.speedMulMin);

        this.enemies.push({
            id: Math.random().toString(36).substr(2, 9),

            mesh: pivot,
            ship,

            health: 100,

            // personality
            personality: personality.type,
            damagePerHit: personality.damage,
            fireAggression: personality.fireRate,

            // speed
            speedMulBase,
            speedMul: 1.0,

            altOffset: null,

            // race tracking
            targetRingIndex: startIndex,
            ringsPassed: 0,

            // cooldowns
            fireCooldown: 0,

            _target: new THREE.Vector3()
        });
    }

    // ======================================================
    // BULLETS
    // ======================================================
    _spawnEnemyBullet(enemy, startPos, startQuat) {
        const mesh = new THREE.Mesh(this._bulletGeo, this._bulletMat);
        mesh.position.copy(startPos);
        mesh.quaternion.copy(startQuat);

        this.scene.add(mesh);

        const vel = new THREE.Vector3(0, 0, 1).applyQuaternion(startQuat).multiplyScalar(this.enemyBulletSpeed);

        this.enemyBullets.push({
            id: Math.random().toString(36).substring(2, 10),
            ownerId: enemy.id,
            ownerType: enemy.personality,
            damage: enemy.damagePerHit ?? 9,
            mesh,
            vel,
            age: 0
        });
    }

    _updateEnemyBullets(dt) {
        if (!this.enemyBullets.length) return;

        const delta = Math.min(dt, 0.05);

        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            if (!b?.mesh) continue;

            b.mesh.position.x += b.vel.x * delta;
            b.mesh.position.y += b.vel.y * delta;
            b.mesh.position.z += b.vel.z * delta;

            b.age += delta;

            if (b.age >= this.enemyBulletLifetime) {
                this.scene.remove(b.mesh);
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    // ======================================================
    // Target selection for shooting
    // ======================================================
    _getShootTarget(enemy) {
        if (!enemy?.mesh) return null;

        // Attackers prefer Player
        if (enemy.personality === "attacker") return this.player?.mesh || null;

        // Balanced: sometimes attack player
        if (enemy.personality === "balanced") {
            if (Math.random() < 0.55) return this.player?.mesh || null;
        }

        // Racer: only rarely shoots player
        if (enemy.personality === "racer") {
            if (Math.random() < 0.12) return this.player?.mesh || null;
        }

        // Enemy vs Enemy
        if (Math.random() < this.enemyVsEnemyChance) {
            // pick random other enemy
            const others = this.enemies.filter(e => e && e.id !== enemy.id && e.mesh);
            if (!others.length) return null;

            // pick nearest other enemy within range
            let best = null;
            let bestD = this.enemyVsEnemyRange;

            for (const e2 of others) {
                const d = enemy.mesh.position.distanceTo(e2.mesh.position);
                if (d < bestD) {
                    bestD = d;
                    best = e2.mesh;
                }
            }

            return best;
        }

        return null;
    }

    _canShoot(enemy, targetMesh) {
        if (!enemy?.mesh || !targetMesh) return false;

        const dist = enemy.mesh.position.distanceTo(targetMesh.position);
        if (dist > this.enemyFireDistance) return false;

        // check angle (enemy must face target)
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion).normalize();
        const dir = new THREE.Vector3().subVectors(targetMesh.position, enemy.mesh.position).normalize();

        const angle = forward.angleTo(dir);
        if (angle > this.enemyFireAngleMax) return false;

        return true;
    }

    _shootAt(enemy, targetMesh) {
        if (!enemy?.mesh || !targetMesh) return;

        // muzzle pos (ahead)
        const muzzle = new THREE.Vector3(0, 0, 8);
        muzzle.applyQuaternion(enemy.mesh.quaternion);
        muzzle.add(enemy.mesh.position);

        // aim quaternion towards target direction
        const dir = new THREE.Vector3().subVectors(targetMesh.position, muzzle).normalize();

        const yaw = Math.atan2(dir.x, dir.z);
        const pitch = -Math.asin(Math.max(-1, Math.min(1, dir.y)));

        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));

        // small random spread
        const spread = enemy.personality === "attacker" ? 0.035 : 0.055;
        const e = new THREE.Euler(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread,
            0,
            "YXZ"
        );
        q.multiply(new THREE.Quaternion().setFromEuler(e));

        this._spawnEnemyBullet(enemy, muzzle, q);
    }

    // ======================================================
    // UPDATE
    // ======================================================
    update(deltaTime) {
        if (!this.player || !this.player.mesh) return;

        const dt = Math.min(deltaTime, 0.05);

        // bullets update
        this._updateEnemyBullets(dt);

        // Player boost sync feel
        const boosting = this.player.input?.getAction?.("boost");
        const speedSync = boosting ? 1.10 : 1.0;

        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            if (!enemy?.mesh) continue;

            // speed multiplier
            enemy.speedMul = (enemy.speedMulBase ?? 1.0) * speedSync;

            // pick ring target
            const targetPos = this._getEnemyTargetPosition(enemy);
            if (!targetPos) continue;

            // AI update
            this.ai.update(enemy, targetPos, dt);

            // Terrain clamp
            this._resolveTerrainCollision(enemy, dt);

            // --------------------------------
            // FIRING LOGIC
            // --------------------------------
            enemy.fireCooldown -= dt;
            const target = this._getShootTarget(enemy);

            if (target && enemy.fireCooldown <= 0) {
                if (this._canShoot(enemy, target)) {
                    // chance depends on personality aggression
                    if (Math.random() < (enemy.fireAggression ?? 0.4)) {
                        this._shootAt(enemy, target);

                        // cooldown
                        const mood = enemy.personality;
                        const cd =
                            mood === "attacker" ? 0.20 :
                            mood === "balanced" ? 0.35 :
                            0.55;

                        enemy.fireCooldown = cd + Math.random() * 0.25;
                    }
                }
            }

            // --------------------------------
            // Safety clamps
            // --------------------------------
            const floor = (WORLD_CONFIG.waterLevel ?? 0) + 14;
            const ceiling = WORLD_CONFIG.ceilingHeight ?? 1000;

            if (enemy.mesh.position.y < floor) enemy.mesh.position.y = floor;
            if (enemy.mesh.position.y > ceiling) enemy.mesh.position.y = ceiling;

            // world bounds
            const ws = WORLD_CONFIG.worldSize ?? 10000;
            const half = ws * 0.5;

            const beforeX = enemy.mesh.position.x;
            const beforeZ = enemy.mesh.position.z;

            enemy.mesh.position.x = clamp(enemy.mesh.position.x, -half, half);
            enemy.mesh.position.z = clamp(enemy.mesh.position.z, -half, half);

            const hitX = (enemy.mesh.position.x !== beforeX);
            const hitZ = (enemy.mesh.position.z !== beforeZ);

            if (hitX || hitZ) {
                // steer towards center
                const toCenter = new THREE.Vector3(
                    -enemy.mesh.position.x,
                    0,
                    -enemy.mesh.position.z
                ).normalize();

                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.mesh.quaternion);
                const crossY = forward.clone().cross(toCenter).y;

                enemy.mesh.rotation.y += crossY * 2.2 * dt;
                enemy.mesh.translateZ(140 * dt);
            }
        }
    }

    // ======================================================
    // API for collision system
    // ======================================================
    getEnemyBullets() {
        return this.enemyBullets;
    }

    removeEnemyBullet(index) {
        const b = this.enemyBullets[index];
        if (!b) return;

        if (b.mesh && this.scene) this.scene.remove(b.mesh);
        this.enemyBullets.splice(index, 1);
    }

    removeEnemyById(id) {
        const idx = this.enemies.findIndex(e => e.id === id);
        if (idx === -1) return;

        const enemy = this.enemies[idx];
        if (enemy?.mesh) this.scene.remove(enemy.mesh);

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
