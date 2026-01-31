// ==========================================
// PATH: gameplay/weapon-system.js
// ==========================================

/**
 * WeaponSystem
 * Handles:
 * - fire rate control
 * - bullet spawn position
 * - integrates with BulletSystem
 * - optional SFX
 *
 * Usage:
 *   const bullets = new BulletSystem(scene)
 *   const weapon = new WeaponSystem(player, bullets, input, sfx)
 *   weapon.update(dt)
 */

class WeaponSystem {
    constructor(playerController, bulletSystem, inputManager, sfxManager = null, options = {}) {
        this.player = playerController;
        this.bulletSystem = bulletSystem;
        this.input = inputManager;
        this.sfx = sfxManager;

        // Fire tuning
        this.fireRate = options.fireRate ?? 10;      // bullets per second
        this.cooldown = 0;                            // seconds

        // Bullet tuning
        this.muzzleOffset = options.muzzleOffset ?? new THREE.Vector3(0, 0, 6.5);
        this.spread = options.spread ?? 0.0;          // radians (0 = perfect aim)

        // for reuse (avoid GC)
        this._spawnPos = new THREE.Vector3();
        this._spreadQuat = new THREE.Quaternion();
        this._tempQuat = new THREE.Quaternion();
    }

    update(dt) {
        if (!this.player || !this.player.mesh) return;
        if (!this.input) return;

        const delta = Math.min(dt, 0.05);

        // reduce cooldown
        if (this.cooldown > 0) this.cooldown -= delta;

        // check fire input
        const wantsFire = this.input.getAction("fire");
        if (wantsFire && this.cooldown <= 0) {
            this.fire();
            this.cooldown = 1 / this.fireRate;
        }
    }

    fire() {
        const mesh = this.player.mesh;
        if (!mesh) return;
        if (!this.bulletSystem) return;

        // --- Spawn position ---
        // muzzleOffset is local -> rotate by plane quaternion -> add world position
        this._spawnPos.copy(this.muzzleOffset);
        this._spawnPos.applyQuaternion(mesh.quaternion);
        this._spawnPos.add(mesh.position);

        // --- Rotation / Spread ---
        // Base rotation = plane rotation
        this._tempQuat.copy(mesh.quaternion);

        // Spread: small random yaw/pitch
        if (this.spread > 0) {
            const yaw = (Math.random() - 0.5) * this.spread;
            const pitch = (Math.random() - 0.5) * this.spread;

            // Euler order is important
            const e = new THREE.Euler(pitch, yaw, 0, "YXZ");
            this._spreadQuat.setFromEuler(e);

            this._tempQuat.multiply(this._spreadQuat);
        }

        // Fire bullet
        this.bulletSystem.fire(this._spawnPos, this._tempQuat);

        // Sound
        if (this.sfx && typeof this.sfx.playShoot === "function") {
            this.sfx.playShoot();
        }
    }
}

// Global export
window.WeaponSystem = WeaponSystem;
