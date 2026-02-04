// ==========================================
// PATH: gameplay/enemy-bullet-system.js
// ==========================================

/**
 * EnemyBulletSystem (FINAL)
 * ✅ Same as BulletSystem but separate channel
 * ✅ Stores ownerId for friendly-fire / enemy-vs-enemy
 */

class EnemyBulletSystem {
    constructor(scene) {
        this.scene = scene;
        this.bullets = [];

        // tuning
        this.speed = 2200;
        this.life = 1.8;
    }

    fire(position, quaternion, ownerId = "enemy") {
        if (!this.scene) return;

        const geo = new THREE.SphereGeometry(0.35, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff5533 });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.copy(position);
        mesh.quaternion.copy(quaternion);

        // forward (+Z)
        const vel = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).multiplyScalar(this.speed);

        this.scene.add(mesh);

        this.bullets.push({
            mesh,
            vel,
            life: this.life,
            ownerId
        });
    }

    removeBullet(i) {
        const b = this.bullets[i];
        if (!b) return;

        if (b.mesh && this.scene) this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
    }

    clearAll() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.removeBullet(i);
        }
    }

    update(dt) {
        const delta = Math.min(dt, 0.05);

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (!b?.mesh) continue;

            b.mesh.position.addScaledVector(b.vel, delta);
            b.life -= delta;

            if (b.life <= 0) {
                this.removeBullet(i);
            }
        }
    }
}

window.EnemyBulletSystem = EnemyBulletSystem;
