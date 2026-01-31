// ==========================================
// PATH: gameplay/singleplayer-main.js
// ==========================================

/**
 * Singleplayer Main
 * Entry point for Singleplayer mode.
 * Initializes all systems and wires them into GameManager loop.
 *
 * Requirements in singleplayer.html load order:
 * - Three.js
 * - configs
 * - engine/map.js, camera-system.js, collision-system.js
 * - ui/ui-manager.js, ui/minimap-system.js
 * - audio/sfx-manager.js, audio/music-manager.js
 * - gameplay/input-manager.js, player-controller.js, bullet-system.js, weapon-system.js
 * - gameplay/enemy-ai.js, enemy-manager.js
 * - core/game-manager.js
 */

window.addEventListener("load", () => {
    console.log("🛩️ Singleplayer Mode Booting...");

    // ----------------------------------------------------------
    // 1) Game Core
    // ----------------------------------------------------------
    const game = new GameManager();
    game.init();
    new MobileControls(game.inputManager);

    // ----------------------------------------------------------
    // 2) World
    // ----------------------------------------------------------
    game.map = new GameMap(game.scene);

    // ----------------------------------------------------------
    // 3) Player
    // ----------------------------------------------------------
    game.playerController = new PlayerController(game.scene, game.inputManager);

    // ----------------------------------------------------------
    // 4) Camera
    // ----------------------------------------------------------
    game.cameraSystem = new CameraSystem(game.camera);
    game.cameraSystem.setTarget(game.playerController);

    // ----------------------------------------------------------
    // 5) Gameplay: Bullets + Weapons
    // ----------------------------------------------------------
    const bulletSystem = new BulletSystem(game.scene);
    const weaponSystem = new WeaponSystem(game.playerController, bulletSystem, game.inputManager, game.sfx, {
    fireRate: 12,
    spread: 0.02
    });

    // Weapon/Bullets update
    game.addUpdateHook((dt) => {
        weaponSystem.update(dt);
        bulletSystem.update(dt);
    });

    // ----------------------------------------------------------
    // 6) Enemies
    // ----------------------------------------------------------
    game.enemyManager = new EnemyManager(game.scene, game.playerController);

    // ----------------------------------------------------------
    // 7) Collisions
    // ----------------------------------------------------------
    const collisionSystem = new CollisionSystem(bulletSystem, game.enemyManager);

    game.addUpdateHook(() => {
        collisionSystem.update();
    });

    // ----------------------------------------------------------
    // 8) Game Over / Restart logic (basic)
    // ----------------------------------------------------------
    let gameOver = false;

    function triggerGameOver() {
        if (gameOver) return;
        gameOver = true;
        game.isPaused = true;

        if (game.uiManager) game.uiManager.showGameOver();

        // Optional explosion SFX
        if (game.sfx && game.audioStarted) game.sfx.playExplosion();

        console.log("💥 GAME OVER");
    }

    function restartGame() {
        console.log("🔁 Restarting...");

        gameOver = false;
        game.isPaused = false;

        // reset UI
        if (game.uiManager) game.uiManager.hideGameOver();

        // respawn player
        if (game.playerController) game.playerController.respawnInstant();

        // remove all bullets
        bulletSystem.bullets.forEach(b => game.scene.remove(b.mesh));
        bulletSystem.bullets = [];

        // remove enemies and respawn fresh set
        if (game.enemyManager) {
            game.enemyManager.enemies.forEach(e => game.scene.remove(e.mesh));
            game.enemyManager.enemies = [];
            game.enemyManager.init();
        }
    }

    // Restart key binding
    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "r" && gameOver) {
            restartGame();
        }
    });

    // Monitor death
    game.addUpdateHook(() => {
        if (!game.playerController) return;
        if (game.playerController.health <= 0 && !gameOver) triggerGameOver();
    });

    // ----------------------------------------------------------
    // 9) Optional Music
    // ----------------------------------------------------------
    // Music should only play after audio unlock (first click/key)
    // So we add hook once audio starts.
    game.addUpdateHook(() => {
        if (game.music && game.audioStarted && !game.music.isPlaying) {
            // Auto play BGM in singleplayer
            game.music.playBGM();
        }
    });

    console.log("✅ Singleplayer ready.");
});
