// ==========================================
// PATH: gameplay/enemy-manager.js
// ==========================================

/**
 * EnemyManager
 * Spawns enemies and updates them.
 * Uses EnemyAI for movement.
 *
 * Constructor:
 *   new EnemyManager(scene, playerController)
 */

class EnemyManager {
    constructor(scene, playerController) {
        this.scene = scene;
        this.player = playerController;

        // List of enemies
        this.enemies = [];

        // Score tracking (enemies destroyed)
        this.score = 0;

        // Settings
        this.maxEnemies = 10;
        this.spawnAreaSize = 2500; // radius-ish (world units)
        this.baseAltitude = 200;
        this.maxAltitude = 700;

        // AI system
        this.ai = new EnemyAI();

        // Shared geometry/material for performance
        this.enemyGeo = new THREE.BoxGeometry(4, 2, 6);
        this.enemyMat = new THREE.MeshPhongMaterial({ color: 0xff3333, flatShading: true });

        // Spawn
        this.init();
    }

    init() {
        // Fill enemy count at start
        while (this.enemies.length < this.maxEnemies) {
            this.spawnEnemy();
        }
    }

    // ==========================================================
    // Spawning
    // ==========================================================

    spawnEnemy() {
        const mesh = new THREE.Mesh(this.enemyGeo, this.enemyMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Random spawn around player, but not too close
        const px = this.player?.mesh?.position?.x ?? 0;
        const pz = this.player?.mesh?.position?.z ?? 0;

        const angle = Math.random() * Math.PI * 2;
        const dist = 600 + Math.random() * (this.spawnAreaSize - 600);

        const x = px + Math.cos(angle) * dist;
        const z = pz + Math.sin(angle) * dist;
        const y = this.baseAltitude + Math.random() * (this.maxAltitude - this.baseAltitude);

        mesh.position.set(x, y, z);

        // Random facing
        mesh.rotation.y = Math.random() * Math.PI * 2;

        this.scene.add(mesh);

        const enemy = {
            id: Math.random().toString(36).substring(2, 10),
            mesh,
            health: 100,
            speed: 0.6 + Math.random() * 0.6
        };

        this.enemies.push(enemy);
    }

    // ==========================================================
    // Update loop
    // ==========================================================

    update(deltaTime) {
        // Respawn logic (small chance)
        if (this.enemies.length < this.maxEnemies) {
            if (Math.random() < 0.02) {
                this.spawnEnemy();
            }
        }

        if (!this.player || !this.player.mesh) return;

        const playerPos = this.player.mesh.position;

        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            if (!enemy.mesh) continue;

            // AI update (movement + turning)
            this.ai.update(enemy, playerPos, deltaTime);

            // Optional: altitude clamp
            if (enemy.mesh.position.y < WORLD_CONFIG.waterLevel + 10) {
                enemy.mesh.position.y = WORLD_CONFIG.waterLevel + 10;
            }
            if (enemy.mesh.position.y > WORLD_CONFIG.ceilingHeight - 30) {
                enemy.mesh.position.y = WORLD_CONFIG.ceilingHeight - 30;
            }
        }
    }

    // ==========================================================
    // Removal helpers (for CollisionSystem)
    // ==========================================================

    removeEnemyById(id) {
        const index = this.enemies.findIndex(e => e.id === id);
        if (index === -1) return;
        this.removeEnemyByIndex(index);
    }

    removeEnemyByIndex(index) {
        const enemy = this.enemies[index];
        if (!enemy) return;

        // Remove mesh
        this.scene.remove(enemy.mesh);

        // Remove from list
        this.enemies.splice(index, 1);

        // Update score
        this.score++;

        // Optional explosion sound can be triggered in CollisionSystem/GameManager
    }

    removeAll() {
        for (let i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].mesh) this.scene.remove(this.enemies[i].mesh);
        }
        this.enemies = [];
    }
}

// Global export
window.EnemyManager = EnemyManager;
