// ==========================================
// PATH: gameplay/bullet-system.js
// ==========================================

/**
 * BulletSystem (FINAL - Multiplayer Hybrid + Bullet Magnet)
 *
 * ✅ Local bullets move client-side (smooth instant)
 * ✅ Remote bullets (from server) are synced & interpolated (no stutter)
 * ✅ Bullet magnet: if target is in 30° cone, bullets pull smoothly
 *
 * Bullet Object:
 * {
 *   id: string,
 *   ownerId: string,
 *   mesh: THREE.Mesh,
 *   vel: THREE.Vector3,
 *   age: number,
 *   remote: boolean,
 *   targetPos?: THREE.Vector3,
 *   homingStrength?: number
 * }
 */

class BulletSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.bullets = [];

        // Speed/life
        this.speed = options.speed ?? 520;       // units/sec
        this.lifetime = options.lifetime ?? 2.0; // seconds

        // Visual
        this.radius = options.radius ?? 0.35;

        // Shared mesh assets
        this.bulletGeo = new THREE.SphereGeometry(this.radius, 6, 6);
        this.bulletMatLocal = new THREE.MeshBasicMaterial({ color: 0xffee00 });
        this.bulletMatRemote = new THREE.MeshBasicMaterial({ color: 0xff8800 });

        // Remote smoothing
        this.remoteLerp = options.remoteLerp ?? 0.45;

        // ✅ Bullet magnet config
        this.homingTime = options.homingTime ?? 0.35; // ✅ first 0.35 sec only
    }

    // ==========================================================
    // LOCAL FIRE (client instant)
    // ==========================================================
    fire(startPosition, startQuaternion, options = {}) {
        if (!this.scene) return;

        const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMatLocal);
        mesh.position.copy(startPosition);
        mesh.quaternion.copy(startQuaternion);

        const id = options.id ?? Math.random().toString(36).substring(2, 10);
        const ownerId = options.ownerId ?? "local";

        // Velocity from +Z forward (NOTE: your game uses +Z forward)
        const velocity = new THREE.Vector3(0, 0, 1);
        velocity.applyQuaternion(startQuaternion);
        velocity.multiplyScalar(options.speed ?? this.speed);

        this.scene.add(mesh);

        this.bullets.push({
            id,
            ownerId,
            mesh,
            vel: velocity,
            age: 0,
            remote: false,

            // ✅ Magnet info (optional)
            targetPos: options.targetPos ? options.targetPos.clone() : null,
            homingStrength: options.homingStrength ?? 0
        });
    }

    // ==========================================================
    // REMOTE BULLET UPSERT (from server snapshots)
    // ==========================================================
    upsertRemoteBullet(bdata) {
        if (!bdata || !bdata.id) return;

        const existing = this.bullets.find(b => b.remote && b.id === bdata.id);
        const p = bdata.p || bdata.position;
        const q = bdata.q || bdata.quaternion;

        if (!p) return;

        if (!existing) {
            // create remote bullet
            const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMatRemote);
            mesh.position.set(p.x, p.y, p.z);

            // apply rotation (optional)
            if (q) mesh.quaternion.set(q.x, q.y, q.z, q.w);

            this.scene.add(mesh);

            this.bullets.push({
                id: bdata.id,
                ownerId: bdata.ownerId ?? "remote",
                mesh,
                vel: new THREE.Vector3(),
                age: 0,
                remote: true,
                targetPos: new THREE.Vector3(p.x, p.y, p.z)
            });

            return;
        }

        // update target position
        if (existing.targetPos) {
            existing.targetPos.set(p.x, p.y, p.z);
        } else {
            existing.targetPos = new THREE.Vector3(p.x, p.y, p.z);
        }
    }

    // ==========================================================
    // SERVER BULLET SYNC
    // serverBullets = [{id, ownerId, p, q, createdAt}]
    // ==========================================================
    syncRemoteBullets(serverBullets = []) {
        if (!Array.isArray(serverBullets)) return;

        const seen = new Set();

        for (const b of serverBullets) {
            if (!b?.id) continue;
            seen.add(b.id);
            this.upsertRemoteBullet(b);
        }

        // cleanup bullets that server removed
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (!b?.remote) continue;
            if (!seen.has(b.id)) {
                this.removeBullet(i);
            }
        }
    }

    // ==========================================================
    // UPDATE
    // ==========================================================
    update(dt) {
        if (!this.bullets.length) return;

        const delta = Math.min(dt, 0.05);

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (!b || !b.mesh) continue;

            b.age += delta;

            // Remove if expired
            if (b.age >= this.lifetime) {
                this.removeBullet(i);
                continue;
            }

            if (b.remote) {
                // ✅ remote bullet smoothing
                if (b.targetPos) {
                    b.mesh.position.lerp(b.targetPos, this.remoteLerp);
                }
                continue;
            }

            // ======================================================
            // ✅ LOCAL BULLET MAGNET (pull towards target)
            // Only for first 0.35 sec for fair gameplay
            // ======================================================
            if (b.targetPos && b.homingStrength > 0 && b.age < this.homingTime) {
                const desiredDir = new THREE.Vector3().subVectors(b.targetPos, b.mesh.position);

                // if target reached / invalid
                if (desiredDir.lengthSq() > 0.0001) {
                    desiredDir.normalize();

                    const currentDir = b.vel.clone().normalize();
                    const blend = Math.min(1, b.homingStrength * delta);

                    currentDir.lerp(desiredDir, blend).normalize();

                    const speed = b.vel.length();
                    b.vel.copy(currentDir.multiplyScalar(speed));
                }
            }

            // move bullet
            b.mesh.position.x += b.vel.x * delta;
            b.mesh.position.y += b.vel.y * delta;
            b.mesh.position.z += b.vel.z * delta;
        }
    }

    // ==========================================================
    // REMOVE / CLEAR
    // ==========================================================
    removeBullet(index) {
        const b = this.bullets[index];
        if (!b) return;

        if (b.mesh && this.scene) {
            this.scene.remove(b.mesh);
        }
        this.bullets.splice(index, 1);
    }

    clearAll() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.removeBullet(i);
        }
    }
}

window.BulletSystem = BulletSystem;