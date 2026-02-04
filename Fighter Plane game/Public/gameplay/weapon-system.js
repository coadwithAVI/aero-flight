// ==========================================
// PATH: gameplay/weapon-system.js
// ==========================================

class WeaponSystem {
    constructor(playerController, bulletSystem, inputManager, sfxManager = null, options = {}) {
        this.player = playerController;
        this.bulletSystem = bulletSystem;
        this.input = inputManager;
        this.sfx = sfxManager;

        this.fireRate = options.fireRate ?? 10;
        this.cooldown = 0;

        // Muzzle offset (your model standard)
        this.muzzleOffset = options.muzzleOffset ?? new THREE.Vector3(0, 0, 6.5);
        this.spread = options.spread ?? 0.0;

        this._spawnPos = new THREE.Vector3();
        this._spreadQuat = new THREE.Quaternion();
        this._tempQuat = new THREE.Quaternion();

        // ✅ Aim assist disabled (OLD system OFF)
        this.aimAssist = false;
        this.screenAimAssist = false;

        // Target provider
        this.getTargets = options.getTargets ?? null;

        // ✅ Bullet magnet settings (new system)
        this.magnetAim = options.magnetAim ?? true;
        this.magnetAngleDeg = options.magnetAngleDeg ?? 30;        // ✅ 30 degree cone
        this.magnetStrength = options.magnetStrength ?? 6.0;       // good smooth pull

        // optional (not used now but keep)
        this.camera = options.camera ?? null;
    }

    update(dt) {
        if (!this.player || !this.player.mesh) return;
        if (!this.input) return;

        const delta = Math.min(dt, 0.05);
        if (this.cooldown > 0) this.cooldown -= delta;

        const wantsFire = this.input.getAction("fire");
        if (wantsFire && this.cooldown <= 0) {
            this.fire();
            this.cooldown = 1 / this.fireRate;
        }
    }

    // ==========================================================
    // ✅ New: Find best target inside forward cone (30° default)
    // ==========================================================
    _getConeTarget(origin, baseQuat) {
        if (!this.magnetAim || !this.getTargets) return null;

        const targets = this.getTargets();
        if (!targets || !targets.length) return null;

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(baseQuat); // +Z forward
        let best = null;
        let bestAngle = THREE.MathUtils.degToRad(this.magnetAngleDeg);

        const dir = new THREE.Vector3();

        for (const t of targets) {
            if (!t?.position) continue;

            dir.copy(t.position).sub(origin).normalize();
            const angle = forward.angleTo(dir);

            if (angle < bestAngle) {
                bestAngle = angle;
                best = t;
            }
        }
        return best;
    }

    fire() {
        const mesh = this.player.mesh;
        if (!mesh || !this.bulletSystem) return;

        // Two muzzles
        const leftMuzzle = new THREE.Vector3(-1.3, 0, 6.5);
        const rightMuzzle = new THREE.Vector3(1.3, 0, 6.5);

        const shootFrom = (offset) => {
            // spawn position
            this._spawnPos.copy(offset);
            this._spawnPos.applyQuaternion(mesh.quaternion);
            this._spawnPos.add(mesh.position);

            // base aim = player's current aim
            this._tempQuat.copy(mesh.quaternion);

            // spread (optional)
            if (this.spread > 0) {
                const yaw = (Math.random() - 0.5) * this.spread;
                const pitch = (Math.random() - 0.5) * this.spread;
                const e = new THREE.Euler(pitch, yaw, 0, "YXZ");
                this._spreadQuat.setFromEuler(e);
                this._tempQuat.multiply(this._spreadQuat);
            }

            // ✅ cone magnet target (DO NOT snap aim, only bullet pulls)
            const target = this._getConeTarget(this._spawnPos, this._tempQuat);

            this.bulletSystem.fire(this._spawnPos, this._tempQuat, {
                targetPos: target ? target.position.clone() : null,
                homingStrength: this.magnetStrength
            });
        };

        shootFrom(leftMuzzle);
        shootFrom(rightMuzzle);

        if (window.game?.procAudio) window.game.procAudio.shoot();
    }
}

window.WeaponSystem = WeaponSystem;