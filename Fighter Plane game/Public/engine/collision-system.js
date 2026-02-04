// ==========================================
// PATH: engine/collision-system.js
// ==========================================

/**
 * CollisionSystem (FINAL v3)
 *
 * Handles:
 * ✅ Player bullets -> Enemy
 * ✅ Player crash -> Enemy
 * ✅ Player -> Water/floor
 * ✅ Enemy bullets -> Player
 * ✅ Enemy bullets -> Enemy (enemy vs enemy fight)
 *
 * Damage:
 * ✅ Enemy bullet damage based on personality:
 *    - racer: 6
 *    - balanced: 9
 *    - attacker: 12
 */

class CollisionSystem {
    constructor(playerController, bulletSystem, enemyManager, sfxManager = null) {
        this.player = playerController;
        this.bullets = bulletSystem;      // player bullets
        this.enemies = enemyManager;      // EnemyManager instance
        this.sfx = sfxManager;

        // radii
        this.enemyHitRadius = 18;
        this.playerCrashRadius = 18;
        this.floorCrashHeight = (WORLD_CONFIG.waterLevel ?? 0) + 4;

        // damage
        this.bulletDamage = 50;
        this.crashDamage = 35;

        // enemy bullets hit tuning
        this.enemyBulletPlayerHitRadius = 14;
        this.enemyBulletEnemyHitRadius = 14;
    }

    update(deltaTime) {
        if (!this.player?.mesh) return;
        if (!this.bullets) return;

        // enemies optional, but required for enemy bullet checks
        if (!this.enemies) {
            this._playerVsFloor(deltaTime);
            return;
        }

        this._bulletVsEnemy();
        this._playerVsEnemy(deltaTime);
        this._playerVsFloor(deltaTime);

        this._enemyBulletsVsPlayer();
        this._enemyBulletsVsEnemies();
    }

    // ======================================================
    // Player bullets -> Enemy
    // ======================================================
    _bulletVsEnemy() {
        if (!this.enemies?.enemies?.length) return;

        const bullets = this.bullets.bullets;
        const enemies = this.enemies.enemies;

        if (!bullets || !enemies) return;

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (!b?.mesh) continue;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (!e?.mesh) continue;

                const d = b.mesh.position.distanceTo(e.mesh.position);
                if (d < this.enemyHitRadius) {
                    e.health -= this.bulletDamage;

                    // remove bullet
                    this.bullets.removeBullet(i);

                    if (e.health <= 0) {
                        this.enemies.removeEnemyById(e.id);
                        this.enemies.addScore(1);
                        if (this.sfx) this.sfx.playExplosion();
                    }
                    break;
                }
            }
        }
    }

    // ======================================================
    // Player crash -> Enemy
    // ======================================================
    _playerVsEnemy(deltaTime) {
        const enemies = this.enemies?.enemies;
        if (!enemies || enemies.length === 0) return;

        const pPos = this.player.mesh.position;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (!e?.mesh) continue;

            const dist = pPos.distanceTo(e.mesh.position);

            if (dist < this.playerCrashRadius) {
                this.player.takeDamage(this.crashDamage);
                this.enemies.removeEnemyById(e.id);
                if (this.sfx) this.sfx.playExplosion();
            }
        }
    }

    // ======================================================
    // Player -> Water/Floor
    // ======================================================
    _playerVsFloor(deltaTime) {
        const y = this.player.mesh.position.y;

        if (y <= this.floorCrashHeight) {
            this.player.mesh.position.y = this.floorCrashHeight + 2;
            this.player.takeDamage(10);
            if (this.sfx) this.sfx.playExplosion();
        }
    }

    // ======================================================
    // Enemy bullets -> Player
    // ======================================================
    _enemyBulletsVsPlayer() {
        const bullets = this.enemies?.getEnemyBullets?.();
        if (!bullets || !bullets.length) return;

        const pPos = this.player.mesh.position;

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (!b?.mesh) continue;

            const d = b.mesh.position.distanceTo(pPos);

            if (d <= this.enemyBulletPlayerHitRadius) {
                // ✅ damage depends on bullet owner personality
                const dmg = b.damage ?? 9;
                this.player.takeDamage(dmg);

                // remove bullet
                this.enemies.removeEnemyBullet(i);

                if (this.sfx) this.sfx.playExplosion();
            }
        }
    }

    // ======================================================
    // Enemy bullets -> Enemies (Enemy vs Enemy)
    // ======================================================
    _enemyBulletsVsEnemies() {
        const bullets = this.enemies?.getEnemyBullets?.();
        const enemies = this.enemies?.enemies;

        if (!bullets || !bullets.length) return;
        if (!enemies || !enemies.length) return;

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (!b?.mesh) continue;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (!e?.mesh) continue;

                // ignore self-hit
                if (b.ownerId && e.id === b.ownerId) continue;

                const d = b.mesh.position.distanceTo(e.mesh.position);

                if (d <= this.enemyBulletEnemyHitRadius) {
                    // enemy takes damage too (same system)
                    const dmg = b.damage ?? 9;
                    e.health -= dmg;

                    this.enemies.removeEnemyBullet(i);

                    if (e.health <= 0) {
                        this.enemies.removeEnemyById(e.id);
                        if (this.sfx) this.sfx.playExplosion();
                    }

                    break;
                }
            }
        }
    }
}

window.CollisionSystem = CollisionSystem;
