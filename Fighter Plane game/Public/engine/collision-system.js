// ==========================================
// PATH: engine/collision-system.js
// ==========================================

/**
 * CollisionSystem (FINAL)
 * Handles:
 * ✅ Bullet vs Enemy
 * ✅ Player vs Enemy
 * ✅ Player vs Water/terrain floor
 *
 * Requires:
 * - playerController
 * - bulletSystem
 * - enemyManager
 * - optional sfxManager (explosion + shoot)
 */

class CollisionSystem {
    constructor(playerController, bulletSystem, enemyManager, sfxManager = null) {
        this.player = playerController;
        this.bullets = bulletSystem;
        this.enemies = enemyManager;
        this.sfx = sfxManager;

        // collision radii
        this.enemyHitRadius = 18;     // bullet-enemy
        this.playerCrashRadius = 22;  // player-enemy
        this.floorCrashHeight = (WORLD_CONFIG.waterLevel ?? 0) + 4;

        // damage
        this.bulletDamage = 50;
        this.crashDamage = 35;
    }

    update(deltaTime) {
        if (!this.player || !this.player.mesh) return;
        if (!this.bullets || !this.enemies) return;

        this._bulletVsEnemy();
        this._playerVsEnemy(deltaTime);
        this._playerVsFloor(deltaTime);
    }

    // ======================================================
    // Bullet vs Enemy
    // ======================================================
    _bulletVsEnemy() {
        const bullets = this.bullets.bullets;
        const enemies = this.enemies.enemies;

        if (!bullets || !enemies) return;

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (!b || !b.mesh) continue;

            let hitEnemyId = null;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (!e || !e.mesh) continue;

                const d = b.mesh.position.distanceTo(e.mesh.position);

                if (d < this.enemyHitRadius) {
                    // ✅ hit
                    e.health -= this.bulletDamage;
                    hitEnemyId = e.id;

                    // remove bullet (no piercing)
                    this.bullets.removeBullet(i);

                    // enemy dead?
                    if (e.health <= 0) {
                        this.enemies.removeEnemyById(e.id);
                        this.enemies.addScore(1);

                        if (this.sfx) this.sfx.playExplosion();
                    }

                    break;
                }
            }

            if (hitEnemyId) continue;
        }
    }

    // ======================================================
    // Player vs Enemy crash
    // ======================================================
    _playerVsEnemy(deltaTime) {
        const enemies = this.enemies.enemies;
        if (!enemies || enemies.length === 0) return;

        const pPos = this.player.mesh.position;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (!e || !e.mesh) continue;

            const dist = pPos.distanceTo(e.mesh.position);

            if (dist < this.playerCrashRadius) {
                // ✅ crash
                this.player.takeDamage(this.crashDamage);

                // remove enemy on crash (kamikaze)
                this.enemies.removeEnemyById(e.id);

                if (this.sfx) this.sfx.playExplosion();
            }
        }
    }

    // ======================================================
    // Player vs Water/Floor
    // ======================================================
    _playerVsFloor(deltaTime) {
        if (!this.player || !this.player.mesh) return;

        const y = this.player.mesh.position.y;

        // If player goes into water/ground => damage
        if (y <= this.floorCrashHeight) {
            // keep them up
            this.player.mesh.position.y = this.floorCrashHeight + 2;

            this.player.takeDamage(10);

            // optional sfx
            if (this.sfx) this.sfx.playExplosion();
        }
    }
}

window.CollisionSystem = CollisionSystem;
