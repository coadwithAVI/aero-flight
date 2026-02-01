// ==========================================
// PATH: gameplay/singleplayer-main.js
// ==========================================

/**
 * Singleplayer Main (FINAL - STABLE + Enemy Shooting)
 *
 * Fixes:
 * ✅ NEVER recreates PlayerController inside loop (BIG BUG FIX)
 * ✅ Injects terrainMesh into playerController one time
 * ✅ Rings spawn above terrain
 * ✅ Enemies update works
 * ✅ Minimap shows rings + active ring
 * ✅ Leaderboard
 *
 * NEW:
 * ✅ Enemy bullets system
 * ✅ Enemy weapon system (personalities)
 */

window.addEventListener("load", () => {
    console.log("🛩️ Singleplayer Mode Booting...");

    // ----------------------------------------------------------
    // 1) Game Core
    // ----------------------------------------------------------
    const game = new GameManager();
    game.init();
    game.procAudio = new ProceduralAudio();
    window.game = game;

    const leaderboard = new LeaderboardUI();

    window.addEventListener("click", async () => {
        if (game.procAudio) await game.procAudio.unlock();
    }, { once: true });

    // Mobile controls (optional)
    new MobileControls(game.inputManager);

    // ----------------------------------------------------------
    // 2) Terrain mesh connect to player (IMPORTANT)
    // ----------------------------------------------------------
    if (game.playerController && game.map?.terrainMesh) {
        game.playerController.setTerrainMesh(game.map.terrainMesh);
    }

    // ----------------------------------------------------------
    // 3) Rings (Terrain-safe spawn)
    // ----------------------------------------------------------
    const ringSystem = new RingSystem(game.scene, game.map?.terrainMesh, {
        ringCount: 8,
        terrainClearance: 30
    });

    ringSystem.onLapComplete = () => {
        console.log("🏆 Victory! Race Completed");

        game.isPaused = true;

        if (game.procAudio) game.procAudio.stopBoost();
        if (game.uiManager?.showVictory) game.uiManager.showVictory();
        if (game.procAudio) game.procAudio.victory();

        if (game.music) game.music.stopBGM();
        setTimeout(() => {
            if (game.music) game.music.playBGM();
        }, 2200);
    };

    // medkit system
    const medkitSystem = new MedkitSystem(game.scene, game.map?.terrainMesh, {
        count: 4,
        healAmount: 50,
        respawnDelay: 7
    });

    // ----------------------------------------------------------
    // 4) Weapons + Bullets
    // ----------------------------------------------------------
    const bulletSystem = new BulletSystem(game.scene);

    const weaponSystem = new WeaponSystem(
        game.playerController,
        bulletSystem,
        game.inputManager,
        game.sfx,
        {
            fireRate: 12,
            spread: 0.02,

            camera: game.camera,
            screenAimAssist: true,
            screenAimRadius: 0.65,
            screenAimStrength: 0.85,

            getTargets: () => game.enemyManager ? game.enemyManager.enemies.map(e => e.mesh) : []
        }
    );

    // ----------------------------------------------------------
    // 5) Enemies
    // ----------------------------------------------------------
    game.enemyManager = new EnemyManager(game.scene, game.playerController, ringSystem, game.map?.terrainMesh);

    // ✅ spawn enemies now
    game.enemyManager.init();

    // ----------------------------------------------------------
    // ✅ NEW: Enemy Bullets + Enemy Weapon
    // ----------------------------------------------------------
    const enemyBulletSystem = new EnemyBulletSystem(game.scene);

    const enemyWeaponSystem = new EnemyWeaponSystem(
        game.enemyManager,
        enemyBulletSystem,
        game.playerController,
        { range: 1400 }
    );

    // ----------------------------------------------------------
    // 6) Collisions
    // ----------------------------------------------------------
    const collisionSystem = new CollisionSystem(
        game.playerController,
        bulletSystem,
        game.enemyManager,
        game.sfx,
        enemyBulletSystem // ✅ pass enemy bullets
    );

    // ----------------------------------------------------------
    // 7) Camera follow
    // ----------------------------------------------------------
    if (!game.cameraSystem) {
        game.cameraSystem = new CameraSystem(game.camera);
    }
    game.cameraSystem.setTarget(game.playerController);

    // ======================================================
    // ⏸ Pause Menu Buttons
    // ======================================================
    if (game.uiManager) {
        game.uiManager.pauseBtn.onclick = () => {
            game.isPaused = true;
            game.uiManager.showPause();
            if (game.procAudio) game.procAudio.medkit();
        };

        game.uiManager.resumeBtn.onclick = () => {
            game.isPaused = false;
            game.uiManager.hidePause();
            if (game.procAudio) game.procAudio.medkit();
        };

        game.uiManager.settingsBtn.onclick = () => {
            window.location.href = "./settings.html";
        };

        game.uiManager.abortBtn.onclick = () => {
            window.location.href = "./index.html";
        };
    }

    // ----------------------------------------------------------
    // 8) Patch Game Loop
    // ----------------------------------------------------------
    game.animate = function () {
        if (!game.isRunning) return;

        requestAnimationFrame(game.animate.bind(game));

        if (game.isPaused) {
            game.renderer.render(game.scene, game.camera);
            return;
        }

        const dt = game.clock.getDelta();

        if (game.procAudio && game.procAudio.musicPlaying !== "game") {
            game.procAudio.playGameMusic();
        }

        // ---- INPUT
        if (game.inputManager && typeof game.inputManager.update === "function") {
            game.inputManager.update(dt);
        }

        // ======================================================
        // ⏸ Pause Toggle (ESC + button)
        // ======================================================
        if (game.uiManager && game.inputManager) {
            if (game.inputManager.getAction("pause")) {
                game.isPaused = !game.isPaused;

                if (game.isPaused) {
                    game.uiManager.showPause();
                    if (game.procAudio) game.procAudio.medkit();
                } else {
                    game.uiManager.hidePause();
                }
            }
        }

        // ---- PLAYER
        if (game.playerController) {
            game.playerController.update(dt);
        }

        // ---- RINGS
        if (ringSystem && game.playerController?.mesh) {
            ringSystem.update(dt, game.playerController.mesh);
        }

        // ---- MEDKITS
        if (medkitSystem) {
            medkitSystem.update(dt, game.playerController);
        }

        // ---- WEAPON + BULLETS
        weaponSystem.update(dt);
        bulletSystem.update(dt);

        // ✅ NEW: ENEMY BULLETS
        enemyWeaponSystem.update(dt);
        enemyBulletSystem.update(dt);

        // ---- ENEMIES
        if (game.enemyManager) {
            game.enemyManager.update(dt);
        }

        // ✅ LEADERBOARD UPDATE
        if (leaderboard && ringSystem && game.enemyManager && game.playerController?.mesh) {
            const rows = [];

            const activeRingObj = ringSystem.rings[ringSystem.currentIndex];
            const activeRingMesh = activeRingObj?.mesh || activeRingObj;

            let playerDist = 999999;
            if (activeRingMesh?.position) {
                playerDist = game.playerController.mesh.position.distanceTo(activeRingMesh.position);
            }

            rows.push({
                name: "Player",
                score: ringSystem.ringsClaimed,
                dist: playerDist
            });

            for (let i = 0; i < game.enemyManager.enemies.length; i++) {
                const e = game.enemyManager.enemies[i];
                if (!e?.mesh) continue;

                const eRingObj = ringSystem.rings[e.targetRingIndex];
                const eRingMesh = eRingObj?.mesh || eRingObj;

                let d = 999999;
                if (eRingMesh?.position) d = e.mesh.position.distanceTo(eRingMesh.position);

                // show personality
                const tag = e.personality === "racer" ? "🏁" : e.personality === "attacker" ? "💥" : "⚖";

                rows.push({
                    name: `${tag} Enemy ${i + 1}`,
                    score: e.ringsPassed ?? 0,
                    dist: d
                });
            }

            rows.sort((a, b) => (b.score - a.score) || (a.dist - b.dist));
            leaderboard.update(rows);
        }

        // ---- COLLISIONS
        collisionSystem.update(dt);

        // ======================================================
        // 🏆 VICTORY CONDITION (all enemies destroyed)
        // ======================================================
        if (!game.isPaused && game.enemyManager) {
            if (game.enemyManager.enemies.length === 0) {
                console.log("🏆 Victory! All enemies destroyed.");

                game.isPaused = true;

                if (game.procAudio) game.procAudio.stopBoost();
                if (game.music) game.music.stopBGM();
                if (game.procAudio) game.procAudio.victory();

                if (game.uiManager?.showVictory) game.uiManager.showVictory();
                else if (game.uiManager?.showGameOver) game.uiManager.showGameOver();

                setTimeout(() => {
                    if (game.music) game.music.playBGM();
                }, 2200);
            }
        }

        // ---- CAMERA
        if (game.cameraSystem) {
            game.cameraSystem.update(dt);
        }

        // ---- MINIMAP (rings + enemies)
        if (game.minimap && game.playerController?.mesh) {
            game.minimap.update(
                game.playerController.mesh,
                game.enemyManager ? game.enemyManager.enemies : [],
                ringSystem ? ringSystem.rings : [],
                ringSystem ? ringSystem.currentIndex : -1
            );
        }

        // ---- UI
        if (game.uiManager) {
            const baseSpeed = PHYSICS_CONFIG.baseSpeed ?? 2.2;
            const boosting = game.inputManager && game.inputManager.getAction("boost");
            const speedNow = boosting
                ? baseSpeed * (PHYSICS_CONFIG.boostMultiplier ?? 2.0)
                : baseSpeed;

            const hp = game.playerController ? (game.playerController.health ?? 100) : 100;
            const boost = game.playerController ? game.playerController.boostEnergy : (PHYSICS_CONFIG.boostMax ?? 100);

            game.uiManager.updateHealth(hp, 100);
            game.uiManager.updateBoost(boost, (PHYSICS_CONFIG.boostMax ?? 100));
            game.uiManager.updateScore(ringSystem ? ringSystem.ringsClaimed : 0);
        }

        // ---- BOOST SFX
        if (game.procAudio && game.inputManager) {
            const boosting = game.inputManager.getAction("boost");
            if (boosting) game.procAudio.startBoost();
            else game.procAudio.stopBoost();
        }

        // ---- GAME OVER
        if (game.playerController && game.playerController.health <= 0 && !game.isPaused) {
            game.isPaused = true;

            if (game.procAudio) game.procAudio.stopBoost();
            if (game.music) game.music.stopBGM();
            if (game.procAudio) game.procAudio.defeat();

            if (game.uiManager?.showGameOver) game.uiManager.showGameOver();

            setTimeout(() => {
                if (game.music) game.music.playBGM();
            }, 2200);
        }

        // ======================================================
        // 🏁 RACE LOSE CONDITION (Enemy wins)
        // ======================================================
        if (!game.isPaused && ringSystem && game.enemyManager) {
            const ringCount = ringSystem.rings?.length ?? 0;

            if (ringCount > 0) {
                const enemyWon = game.enemyManager.enemies.some(e => (e.ringsPassed ?? 0) >= ringCount);

                if (enemyWon) {
                    console.log("❌ Enemy finished race first. Player defeated!");

                    if (game.uiManager) game.uiManager.showGameOver();
                    game.isPaused = true;

                    if (game.procAudio) game.procAudio.stopBoost();
                }
            }
        }

        // ---- MUSIC auto start
        if (game.music && game.audioStarted && !game.music.isPlaying) {
            game.music.playBGM();
        }

        // ---- RENDER
        game.renderer.render(game.scene, game.camera);
    };

    // ----------------------------------------------------------
    // 9) Restart
    // ----------------------------------------------------------
    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() !== "r") return;
        if (!game.playerController) return;
        if (game.playerController.health > 0) return;

        console.log("🔁 Restarting...");

        game.isPaused = false;

        if (game.uiManager) game.uiManager.hideGameOver();

        game.playerController.respawnInstant();

        bulletSystem.clearAll();
        enemyBulletSystem.clearAll();

        if (game.enemyManager) {
            game.enemyManager.clearAll();
            game.enemyManager.init();
        }

        // rings reset
        if (ringSystem) {
            ringSystem.rings.forEach(r => {
                if (!r) return;
                r.claimed = false;
                if (r.mesh) r.mesh.visible = true;
            });
            ringSystem.ringsClaimed = 0;
            ringSystem.currentIndex = 0;

            if (typeof ringSystem._setActiveRing === "function") {
                ringSystem._setActiveRing(0);
            }
        }

        console.log("✅ Restart done.");
    });

    console.log("✅ Singleplayer ready.");
});
