// ==========================================
// PATH: gameplay/bullet-system.js
// ==========================================

/**
 * BulletSystem
 * - Manages bullets lifecycle
 * - dt based movement (units per second)
 * - reuses geometry/material
 */

class BulletSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.bullets = [];

        // Settings
        this.speed = options.speed ?? 450;        // units/second (fast)
        this.lifetime = options.lifetime ?? 2.0;  // seconds

        // Visual config
        this.radius = options.radius ?? 0.35;

        // Shared mesh assets
        this.bulletGeo = new THREE.SphereGeometry(this.radius, 6, 6);
        this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffee00 });
    }

    /**
     * Fire a bullet from a given position + quaternion
     * @param {THREE.Vector3} startPosition
     * @param {THREE.Quaternion} startQuaternion
     * @param {Object} options
     */
    fire(startPosition, startQuaternion, options = {}) {
        if (!this.scene) return;

        const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);

        mesh.position.copy(startPosition);
        mesh.quaternion.copy(startQuaternion);

        // optional: small visual scaling
        mesh.scale.setScalar(options.scale ?? 1);

        this.scene.add(mesh);

        // Precompute velocity vector from quaternion
        // IMPORTANT: We assume bullet forward is +Z (translateZ)
        const velocity = new THREE.Vector3(0, 0, 1);
        velocity.applyQuaternion(startQuaternion);
        velocity.multiplyScalar(this.speed);

        this.bullets.push({
            mesh,
            vel: velocity,
            age: 0
        });
    }

    /**
     * Update bullets with delta time
     * @param {number} dt seconds
     */
    update(dt) {
        if (!this.bullets.length) return;

        // Hard clamp dt for stability
        const delta = Math.min(dt, 0.05);

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (!b || !b.mesh) continue;

            // Move: position += velocity * dt
            b.mesh.position.x += b.vel.x * delta;
            b.mesh.position.y += b.vel.y * delta;
            b.mesh.position.z += b.vel.z * delta;

            // Age update
            b.age += delta;

            // Remove if expired
            if (b.age >= this.lifetime) {
                this.removeBullet(i);
            }
        }
    }

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

// Global export
window.BulletSystem = BulletSystem;
