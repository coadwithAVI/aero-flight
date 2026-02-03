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
    // ✅ only enable on real touch devices / small screens
    // ✅ prevent duplicates (multiple init causes double touch handlers)
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
    let ringClaimBlockedUntil = 0;
    let ringSystem = null;
    let lastFireTime = 0;
    let lastSoundTime = 0;
    const FIRE_DELAY = 100;
    const SOUND_DELAY = 150;

    if (typeof MinimapSystem !== "undefined" && !game.minimap) {
        game.minimap = new MinimapSystem(game);
    }

    // ------------------------------------------------------------
    // WEAPON / BULLET / HIT SYSTEM
    // ------------------------------------------------------------
    const bulletSystem = new MPBulletSystem(
        game.scene,
        {
            modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
            camera: game.camera,
            screenAimAssist: true,
            getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
        }
    );

    const weaponSystem = new WeaponSystem(game.playerController, bulletSystem, game.inputManager, sfx, {
        autoFire: false,
        fireRate: 100
    });

    const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, {
        hitRadius: 24.0,
        damage: 15
    });

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

        // Setup ring system (if available)
        if (typeof RingSystem !== "undefined") {
            ringSystem = new RingSystem(game.scene, game.playerController?.mesh);
        }

        game.isPaused = false;
    };

    // MP UI start button should call this
    if (mpUI) {
        mpUI.onStartClicked = () => {
            startGame();
        };
    } else {
        // fallback: auto start if mpUI not present
        setTimeout(() => startGame(), 2000);
    }

    // ------------------------------------------------------------
    // 7. MAIN GAME LOOP
    // ------------------------------------------------------------
    let lastTime = performance.now();

    game.loop = () => {
        requestAnimationFrame(game.loop);

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
            if (game.uiManager && game.playerController) {
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

    // start loop
    game.loop();
});
