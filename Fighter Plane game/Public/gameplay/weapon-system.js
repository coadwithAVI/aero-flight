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

        // Aim Assist tuning
        this.aimAssist = options.aimAssist ?? true;
        this.aimAssistAngle = options.aimAssistAngle ?? 1;   // radians (~10°)
        this.aimAssistStrength = options.aimAssistStrength ?? 1; // 0..1
        this.getTargets = options.getTargets ?? null; // function that returns enemy meshes

        this.camera = options.camera ?? null;

        // screen-based aim assist
        this.screenAimAssist = options.screenAimAssist ?? true;
        this.screenAimRadius = options.screenAimRadius ?? 0.55;     // 0..1 (screen center radius)
        this.screenAimStrength = options.screenAimStrength ?? 0.8;  // 0..1


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

    _getBestAimAssistQuat(baseQuat, origin) {
    if (!this.aimAssist || !this.getTargets) return baseQuat;

    const targets = this.getTargets();
    if (!targets || !targets.length) return baseQuat;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(baseQuat);
    let best = null;
    let bestAngle = this.aimAssistAngle;

    const dir = new THREE.Vector3();

    for (const t of targets) {
        if (!t || !t.position) continue;

        dir.copy(t.position).sub(origin).normalize();

        const angle = forward.angleTo(dir);
        if (angle < bestAngle) {
            bestAngle = angle;
            best = dir.clone();
        }
    }

    if (!best) return baseQuat;

    // build assist quat
    const yaw = Math.atan2(best.x, best.z);
    const pitch = -Math.asin(Math.max(-1, Math.min(1, best.y)));

    const assistEuler = new THREE.Euler(pitch, yaw, 0, "YXZ");
    const assistQuat = new THREE.Quaternion().setFromEuler(assistEuler);

    // blend (smooth aim assist)
    const blended = baseQuat.clone();
    blended.slerp(assistQuat, this.aimAssistStrength);

    return blended;
}

    _getBestScreenTarget(origin) {
    if (!this.camera || !this.getTargets) return null;

    const targets = this.getTargets();
    if (!targets || !targets.length) return null;

    let best = null;
    let bestScore = Infinity;

    const v = new THREE.Vector3();

    for (const t of targets) {
        if (!t?.position) continue;

        // project to screen
        v.copy(t.position).project(this.camera);

        // if behind camera -> skip
        if (v.z < 0 || v.z > 1) continue;

        // v.x, v.y are in -1..1
        const dx = v.x;
        const dy = v.y;

        const distFromCenter = Math.sqrt(dx * dx + dy * dy);

        // only inside radius around crosshair
        if (distFromCenter > this.screenAimRadius) continue;

        // score by closeness to center
        if (distFromCenter < bestScore) {
            bestScore = distFromCenter;
            best = t;
        }
    }

    return best;
}


    fire() {
    const mesh = this.player.mesh;
    if (!mesh || !this.bulletSystem) return;

    // ✅ left + right muzzle
    const leftMuzzle = new THREE.Vector3(-1.3, 0, 6.5);
    const rightMuzzle = new THREE.Vector3(1.3, 0, 6.5);

    const shootFrom = (offset) => {
        this._spawnPos.copy(offset);
        this._spawnPos.applyQuaternion(mesh.quaternion);
        this._spawnPos.add(mesh.position);

        this._tempQuat.copy(mesh.quaternion);
        // ✅ Aim Assist quaternion correction
        this._tempQuat.copy(this._getBestAimAssistQuat(this._tempQuat, this._spawnPos));

        // ✅ Screen-based aim assist
        if (this.screenAimAssist) {
            const target = this._getBestScreenTarget(this._spawnPos);

            if (target) {
                const dir = new THREE.Vector3().subVectors(target.position, this._spawnPos).normalize();

                // build quaternion from yaw/pitch (game forward = +Z)
                const yaw = Math.atan2(dir.x, dir.z);
                const pitch = -Math.asin(Math.max(-1, Math.min(1, dir.y)));

                const assistEuler = new THREE.Euler(pitch, yaw, 0, "YXZ");
                const assistQuat = new THREE.Quaternion().setFromEuler(assistEuler);

                // blend with current aim
                this._tempQuat.slerp(assistQuat, this.screenAimStrength);
            }
        }

        // spread
        if (this.spread > 0) {
            const yaw = (Math.random() - 0.5) * this.spread;
            const pitch = (Math.random() - 0.5) * this.spread;

            const e = new THREE.Euler(pitch, yaw, 0, "YXZ");
            this._spreadQuat.setFromEuler(e);
            this._tempQuat.multiply(this._spreadQuat);
        }

        this.bulletSystem.fire(this._spawnPos, this._tempQuat);
    };

    shootFrom(leftMuzzle);
    shootFrom(rightMuzzle);

    // sound
    if (window.game?.procAudio) window.game.procAudio.shoot();
}
}

// Global export
window.WeaponSystem = WeaponSystem;
