// ==========================================
// PATH: engine/collision-system.js
// ==========================================

/**
 * CollisionSystem
 * Handles:
 * - Bullet vs Enemy collision
 * - (Optional) Enemy vs Player collision (ram damage)
 *
 * Uses fast distance-based collision.
 */

class CollisionSystem {
    /**
     * @param {BulletSystem} bulletSystem
     * @param {EnemyManager} enemyManager
     * @param {Object} options
     */
    constructor(bulletSystem, enemyManager, options = {}) {
        this.bulletSystem = bulletSystem;
        this.enemyManager = enemyManager;

        // Tunables
        this.bulletEnemyHitRadius = options.bulletEnemyHitRadius ?? 6; // better than 25
        this.enemyPlayerHitRadius = options.enemyPlayerHitRadius ?? 10;

        this.enemyDamage = options.enemyDamage ?? 50; // bullet hit dmg (can be 100 for 1-shot)
        this.ramDamage = options.ramDamage ?? 100; // enemy hits player

        // Effects hooks
        this.onEnemyDestroyed = options.onEnemyDestroyed || null;
        this.onPlayerHit = options.onPlayerHit || null;

        // Cached vectors (avoid garbage)
        this._temp = new THREE.Vector3();
    }

    update() {
        if (!this.bulletSystem || !this.enemyManager) return;

        const bullets = this.bulletSystem.bullets;
        const enemies = this.enemyManager.enemies;

        if (!bullets || bullets.length === 0) return;
        if (!enemies || enemies.length === 0) return;

        // ---------------------------------------------
        // Bullet vs Enemy
        // ---------------------------------------------
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const bullet = bullets[bi];
            if (!bullet || !bullet.mesh) continue;

            let hitEnemyId = null;

            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const enemy = enemies[ei];
                if (!enemy || !enemy.mesh) continue;

                // distance between bullet and enemy
                const d = bullet.mesh.position.distanceTo(enemy.mesh.position);

                // dynamic radius can be: base + (enemy size)
                const radius = this.bulletEnemyHitRadius;

                if (d <= radius) {
                    hitEnemyId = enemy.id;

                    // Apply damage
                    enemy.health -= this.enemyDamage;

                    // If dead -> remove enemy
                    if (enemy.health <= 0) {
                        this.enemyManager.removeEnemyById(enemy.id);

                        if (typeof this.onEnemyDestroyed === "function") {
                            this.onEnemyDestroyed(enemy);
                        }
                    }

                    break;
                }
            }

            // Remove bullet if it hit something (no piercing)
            if (hitEnemyId) {
                this.bulletSystem.removeBullet(bi);
            }
        }
    }

    /**
     * Optional: enemy vs player collision (ram)
     * If you want this, call collisionSystem.updatePlayerCollisions(playerController)
     */
    updatePlayerCollisions(playerController) {
        if (!playerController || !playerController.mesh) return;
        if (!this.enemyManager) return;

        const enemies = this.enemyManager.enemies;
        if (!enemies || enemies.length === 0) return;

        const playerPos = playerController.mesh.position;

        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            const enemy = enemies[ei];
            if (!enemy || !enemy.mesh) continue;

            const d = enemy.mesh.position.distanceTo(playerPos);
            if (d <= this.enemyPlayerHitRadius) {
                // damage player
                playerController.takeDamage(this.ramDamage);

                if (typeof this.onPlayerHit === "function") {
                    this.onPlayerHit({ enemy, player: playerController });
                }

                // destroy enemy on ram
                this.enemyManager.removeEnemyById(enemy.id);

                break;
            }
        }
    }
}

// Global export
window.CollisionSystem = CollisionSystem;
