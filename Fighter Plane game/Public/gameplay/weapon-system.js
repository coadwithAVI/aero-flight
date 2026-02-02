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

        // ✅ REVERTED: Muzzle back to +6.5 (Standard for your model)
        this.muzzleOffset = options.muzzleOffset ?? new THREE.Vector3(0, 0, 6.5);
        this.spread = options.spread ?? 0.0;

        this._spawnPos = new THREE.Vector3();
        this._spreadQuat = new THREE.Quaternion();
        this._tempQuat = new THREE.Quaternion();

        this.aimAssist = options.aimAssist ?? true;
        this.aimAssistAngle = options.aimAssistAngle ?? 1;
        this.aimAssistStrength = options.aimAssistStrength ?? 1;
        this.getTargets = options.getTargets ?? null;

        this.camera = options.camera ?? null;

        this.screenAimAssist = options.screenAimAssist ?? true;
        this.screenAimRadius = options.screenAimRadius ?? 0.55;
        this.screenAimStrength = options.screenAimStrength ?? 0.8;
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

    _getBestAimAssistQuat(baseQuat, origin) {
        if (!this.aimAssist || !this.getTargets) return baseQuat;

        const targets = this.getTargets();
        if (!targets || !targets.length) return baseQuat;

        // ✅ FIX: Use (0,0,1) because your game uses +Z as forward
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

        // Use LookAt to target the enemy
        const m = new THREE.Matrix4();
        m.lookAt(origin, origin.clone().add(best), new THREE.Vector3(0, 1, 0));
        
        const assistQuat = new THREE.Quaternion().setFromRotationMatrix(m);
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
            v.copy(t.position).project(this.camera);

            // Check if in front of camera (0 to 1 in Z for standard proj)
            if (v.z < 0 || v.z > 1) continue;

            const dx = v.x;
            const dy = v.y;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);

            if (distFromCenter > this.screenAimRadius) continue;

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

        // ✅ REVERTED: Muzzle offset back to +6.5
        const leftMuzzle = new THREE.Vector3(-1.3, 0, 6.5);
        const rightMuzzle = new THREE.Vector3(1.3, 0, 6.5);

        const shootFrom = (offset) => {
            this._spawnPos.copy(offset);
            this._spawnPos.applyQuaternion(mesh.quaternion);
            this._spawnPos.add(mesh.position);

            this._tempQuat.copy(mesh.quaternion);

            // Aim Assist Logic
            if (this.screenAimAssist) {
                const target = this._getBestScreenTarget(this._spawnPos);
                if (target) {
                    const m = new THREE.Matrix4();
                    m.lookAt(this._spawnPos, target.position, new THREE.Vector3(0,1,0));
                    const assistQuat = new THREE.Quaternion().setFromRotationMatrix(m);
                    this._tempQuat.slerp(assistQuat, this.screenAimStrength);
                } else {
                     this._tempQuat.copy(this._getBestAimAssistQuat(this._tempQuat, this._spawnPos));
                }
            } else {
                 this._tempQuat.copy(this._getBestAimAssistQuat(this._tempQuat, this._spawnPos));
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

        if (window.game?.procAudio) window.game.procAudio.shoot();
    }
}
window.WeaponSystem = WeaponSystem;
