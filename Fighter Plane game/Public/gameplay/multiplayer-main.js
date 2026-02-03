// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
    console.log("🌐 Multiplayer Mode Initializing...");

    // ------------------------------------------------------------
    // 1. AUDIO SETUP
    // ------------------------------------------------------------
    const procAudio = (typeof ProceduralAudio !== "undefined") ? new ProceduralAudio() : null;
    const sfx = (typeof SFXManager !== "undefined") ? new SFXManager({ masterVolume: 0.4, enableEngineHum: false }) : null;

    const unlockAudio = () => {
        if (sfx) sfx.init();
        if (procAudio) procAudio.unlock();
        document.removeEventListener("click", unlockAudio);
        document.removeEventListener("touchstart", unlockAudio);
    };
    document.addEventListener("click", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);

    // ------------------------------------------------------------
    // 2. GAME ENGINE SETUP
    // ------------------------------------------------------------
    const game = new GameManager();
    game.init();
    game.isPaused = true;
    game.isRunning = true;
    window.game = game;

    if (!game.uiManager && typeof UIManager !== "undefined") {
        game.uiManager = new UIManager();
    }

    // ------------------------------------------------------------
    // 3. MOBILE CONTROLS (SAFE INTEGRATION)
    // ------------------------------------------------------------
    const isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    const isLikelyMobile = isTouchDevice && Math.min(window.innerWidth, window.innerHeight) <= 1024;

    if (isLikelyMobile && typeof MobileControls !== "undefined") {
        if (!window.__mobileControlsInstance) {
            console.log("📱 MobileControls Initializing (mobile detected)...");
            window.__mobileControlsInstance = new MobileControls(game.inputManager);
        } else {
            console.log("📱 MobileControls already initialized (skipping duplicate).");
        }
    } else {
        console.log("🖥️ MobileControls skipped (desktop or not found).");
    }

    // ------------------------------------------------------------
    // 4. MP CONFIG
    // ------------------------------------------------------------
    const mpState = new MPState(game.scene, {
        modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
        debug: false
    });

    const mpClient = new MPClient({
        mpState: mpState,
        playerName: localStorage.getItem("sky_pilot_name") || "Pilot",
        debug: true
    });
    window.mpClient = mpClient;

    const mpUI = (typeof MPUIManager !== "undefined")
        ? new MPUIManager(mpClient, procAudio)
        : null;

    // Game Logic Vars
    let gameStartedOnce = false;
    let ringSystem = null;

    if (typeof MinimapSystem !== "undefined" && !game.minimap) {
        game.minimap = new MinimapSystem(game);
    }

    // ------------------------------------------------------------
    // WEAPON / BULLET / HIT SYSTEM
    // ------------------------------------------------------------
    // ✅ FIX: MPBulletSystem not defined -> fallback safely
    const BulletSystemClass =
        (typeof MPBulletSystem !== "undefined") ? MPBulletSystem :
        (typeof BulletSystem !== "undefined") ? BulletSystem :
        null;

    if (!BulletSystemClass) {
        console.error("❌ Neither MPBulletSystem nor BulletSystem is defined. Check script loading order.");
    }

    const bulletSystem = BulletSystemClass
        ? new BulletSystemClass(game.scene, {
            modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
            camera: game.camera,
            screenAimAssist: true,
            getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
        })
        : {
            update() {}
        };

    const weaponSystem = (typeof WeaponSystem !== "undefined")
        ? new WeaponSystem(game.playerController, bulletSystem, game.inputManager, sfx, {
            autoFire: false,
            fireRate: 100
        })
        : { update() {} };

    const hitDetection = (typeof MPHitDetection !== "undefined")
        ? new MPHitDetection(mpClient, bulletSystem, mpState, {
            hitRadius: 24.0,
            damage: 15
        })
        : { update() {} };

    // ------------------------------------------------------------
    // 5. EVENTS
    // ------------------------------------------------------------
    mpClient.onConnected = () => {
        console.log("✅ Connected to Multiplayer Server");
        if (mpUI) mpUI.showConnected();
    };

    mpClient.onDisconnected = () => {
        console.warn("❌ Disconnected from Multiplayer Server");
        if (mpUI) mpUI.showDisconnected();
    };

    mpClient.onError = (msg) => {
        console.error("❌ MP Error:", msg);
        if (mpUI) mpUI.showError(msg);
    };

    // ------------------------------------------------------------
    // 6. START / INIT GAME
    // ------------------------------------------------------------
    const startGame = () => {
        if (gameStartedOnce) return;
        gameStartedOnce = true;

        console.log("🚀 Starting Multiplayer Game...");

        // Ensure player exists
        if (!game.playerController) {
            console.warn("⚠️ PlayerController missing, attempting init...");
            if (typeof PlayerController !== "undefined") {
                game.playerController = new PlayerController(game.scene, game.camera, game.inputManager);
            }
        }

        // Setup ring system
        if (typeof RingSystem !== "undefined") {
            ringSystem = new RingSystem(game.scene, game.playerController?.mesh);
        }

        game.isPaused = false;
    };

    if (mpUI) {
        mpUI.onStartClicked = () => startGame();
    } else {
        setTimeout(() => startGame(), 2000);
    }

    // ------------------------------------------------------------
    // 7. MAIN GAME LOOP  (ONLY FPS CAP + ANTI DUPLICATE)
    // ------------------------------------------------------------

    // ✅ ANTI-DUPLICATE LOOP
    if (window.__mpLoopStarted) {
        console.warn("⚠️ Multiplayer loop already started. Skipping duplicate start.");
        return;
    }
    window.__mpLoopStarted = true;

    // ✅ FPS CAP (60)
    const TARGET_FPS = 60;
    const FRAME_TIME = 1000 / TARGET_FPS;

    let lastTime = performance.now();
    let lastFrameMS = 0;

    game.loop = (nowMS) => {
        requestAnimationFrame(game.loop);

        // FPS lock
        if (!lastFrameMS) lastFrameMS = nowMS;
        if (nowMS - lastFrameMS < FRAME_TIME) return;
        lastFrameMS = nowMS;

        const now = performance.now();
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        try {
            if (game.isPaused) {
                if (game.renderer && game.scene && game.camera) {
                    game.renderer.render(game.scene, game.camera);
                }
                return;
            }

            // Update input + player
            game.inputManager?.update(dt);
            game.playerController?.update(dt);

            // Rings
            if (ringSystem && game.playerController?.mesh) {
                ringSystem.update(dt, game.playerController.mesh);
            }

            // Update weapon/bullets/hit
            weaponSystem.update(dt);
            bulletSystem.update(dt);
            hitDetection.update(dt);

            // MP state update
            mpState.update(dt);

            // Minimap update
            if (game.minimap && game.playerController?.mesh) {
                const enemies = mpState.getRemotePlayers()
                    .filter(p => p && p.mesh && p.mesh.visible)
                    .map(p => p.mesh);

                const ringsRaw = ringSystem?.rings || [];
                game.minimap.update(
                    game.playerController.mesh,
                    enemies,
                    ringsRaw,
                    ringSystem?.currentIndex
                );
            }

            // HUD update
            if (game.uiManager && game.playerController && typeof game.uiManager.updateHUD === "function") {
                game.uiManager.updateHUD(
                    game.playerController.speed || 0,
                    game.playerController.health,
                    game.playerController.score || 0,
                    game.playerController.boostEnergy || 100
                );
            }

            // camera system
            if (game.cameraSystem) game.cameraSystem.update(dt);

            // render
            game.renderer.render(game.scene, game.camera);

        } catch (err) {
            console.error("⚠️ Game Loop Error:", err);
        }
    };

    requestAnimationFrame(game.loop);
});
