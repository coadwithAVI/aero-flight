// ==========================================
// PATH: gameplay/enemy-weapon-system.js
// ==========================================

/**
 * EnemyWeaponSystem (FINAL)
 * ✅ Enemy fires small amount while racing/chasing
 * ✅ Personality based:
 *   - racer: rare shooting, prefers racing
 *   - balanced: medium shooting, mix target selection
 *   - attacker: high shooting, targets player + enemies
 * ✅ Enemy vs Enemy enabled (friendly fire)
 */

class EnemyWeaponSystem {
    constructor(enemyManager, enemyBulletSystem, playerController, options = {}) {
        this.enemyManager = enemyManager;
        this.bullets = enemyBulletSystem;
        this.player = playerController;

        // tuning
        this.range = options.range ?? 1400;

        this.baseFireRate = options.baseFireRate ?? 4; // shots/sec overall style
        this.spread = options.spread ?? 0.04;

        // per personality fire rates
        this.fireRates = {
            racer: 1.5,     // rare
            balanced: 3.5,
            attacker: 6.5   // aggressive
        };

        // how much they choose enemy target instead of player
        this.enemyTargetChance = {
            racer: 0.05,
            balanced: 0.25,
            attacker: 0.55
        };

        // internal
        this._tmpPos = new THREE.Vector3();
        this._tmpQuat = new THREE.Quaternion();
        this._dir = new THREE.Vector3();
        this._spreadQuat = new THREE.Quaternion();
    }

    update(dt) {
        if (!this.enemyManager?.enemies?.length) return;

        const delta = Math.min(dt, 0.05);

        for (const e of this.enemyManager.enemies) {
            if (!e?.mesh || !e.alive) continue;

            // cooldown
            e.fireCooldown -= delta;
            if (e.fireCooldown > 0) continue;

            // choose target
            const target = this._pickTargetForEnemy(e);
            if (!target) {
                e.fireCooldown = 0.6 + Math.random() * 1.2;
                continue;
            }

            const dist = e.mesh.position.distanceTo(target.position);
            if (dist > this.range) {
                e.fireCooldown = 0.4 + Math.random() * 0.8;
                continue;
            }

            // shoot (small probability for non-attacker even if cooldown hit)
            if (!this._shouldShootNow(e)) {
                e.fireCooldown = 0.2 + Math.random() * 0.8;
                continue;
            }

            this._fireFromEnemy(e, target);

            // reset cooldown based on personality
            const rate = this.fireRates[e.personality] ?? 3.0;
            e.fireCooldown = 1 / rate;
        }
    }

    _shouldShootNow(enemy) {
        // makes firing feel “thoda thoda bullets”
        if (enemy.personality === "attacker") return true;

        // balanced fires often but not constant
        if (enemy.personality === "balanced") return Math.random() < 0.65;

        // racer rarely shoots
        return Math.random() < 0.25;
    }

    _pickTargetForEnemy(enemy) {
        // decide whether to target player OR another enemy
        const chance = this.enemyTargetChance[enemy.personality] ?? 0.2;

        const canPlayer = !!this.player?.mesh;
        const canEnemy = this.enemyManager?.enemies?.length > 1;

        // if enemy target allowed
        if (canEnemy && Math.random() < chance) {
            const t = this._pickNearestEnemyTarget(enemy);
            if (t) return t;
        }

        // fallback player
        if (canPlayer) return this.player.mesh;

        // fallback enemy if no player
        if (canEnemy) return this._pickNearestEnemyTarget(enemy);

        return null;
    }

    _pickNearestEnemyTarget(shooter) {
        let best = null;
        let bestD = Infinity;

        for (const other of this.enemyManager.enemies) {
            if (!other?.mesh || other === shooter || !other.alive) continue;

            const d = shooter.mesh.position.distanceTo(other.mesh.position);
            if (d < bestD) {
                bestD = d;
                best = other.mesh;
            }
        }

        return best;
    }

    _fireFromEnemy(enemy, targetMesh) {
        if (!this.bullets) return;

        // muzzle spawn
        this._tmpPos.copy(enemy.mesh.position);
        this._tmpPos.add(new THREE.Vector3(0, 0, 4).applyQuaternion(enemy.mesh.quaternion));

        // aim direction
        this._dir.subVectors(targetMesh.position, this._tmpPos).normalize();

        const yaw = Math.atan2(this._dir.x, this._dir.z);
        const pitch = -Math.asin(Math.max(-1, Math.min(1, this._dir.y)));

        const eul = new THREE.Euler(pitch, yaw, 0, "YXZ");
        this._tmpQuat.setFromEuler(eul);

        // spread
        const yawS = (Math.random() - 0.5) * this.spread;
        const pitchS = (Math.random() - 0.5) * this.spread;

        this._spreadQuat.setFromEuler(new THREE.Euler(pitchS, yawS, 0, "YXZ"));
        this._tmpQuat.multiply(this._spreadQuat);

        // fire
        this.bullets.fire(this._tmpPos, this._tmpQuat, enemy.mesh.name || "enemy");
    }
}

window.EnemyWeaponSystem = EnemyWeaponSystem;
