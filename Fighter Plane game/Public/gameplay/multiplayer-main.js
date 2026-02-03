// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
    console.log("🌐 Multiplayer Mode Initializing... (Final Version)");

    // ------------------------------------------------------------
    // 1. INITIALIZE CORE SYSTEMS
    // ------------------------------------------------------------
    
    // Audio Systems (Music & SFX)
    // ProceduralAudio handle karega Music aur Engine Noise
    const procAudio = (typeof ProceduralAudio !== "undefined") ? new ProceduralAudio() : null;
    
    // SFXManager handle karega Gunshots aur Explosions
    const sfx = (typeof SFXManager !== "undefined") ? new SFXManager({ masterVolume: 0.3, enableEngineHum: false }) : null;
    if (sfx) sfx.init();

    // Game Engine (3D World)
    const game = new GameManager();
    game.init(); 
    game.isPaused = true;  // Default paused until game starts
    game.isRunning = true; // App is running
    window.game = game;    // Debug access

    // Initialize Local HUD (Health/Boost bars)
    if (!game.uiManager && typeof UIManager !== "undefined") {
        game.uiManager = new UIManager();
    }

    // Initialize MP State (Remote Players)
    const mpState = new MPState(game.scene, {
        modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
        debug: false
    });

    // ------------------------------------------------------------
    // 2. NETWORK CLIENT & UI BRIDGE
    // ------------------------------------------------------------

    // MP Client create karein
    const mpClient = new MPClient({
        mpState: mpState, // Attach state for auto-sync
        playerName: localStorage.getItem("sky_pilot_name") || "Pilot",
        debug: true
    });
    window.mpClient = mpClient;

    // ✅ CRITICAL: MPUIManager ko Client aur Audio pass karein
    // Isse buttons click karne par audio unlock hoga aur screen change hogi
    const mpUI = (typeof MPUIManager !== "undefined") 
        ? new MPUIManager(mpClient, procAudio) 
        : null;

    // ------------------------------------------------------------
    // 3. GAMEPLAY VARIABLES
    // ------------------------------------------------------------
    let gameStartedOnce = false;
    let ringClaimBlockedUntil = 0;
    let ringSystem = null;

    // Minimap
    if (typeof MinimapSystem !== "undefined" && !game.minimap) {
        game.minimap = new MinimapSystem(game);
    }

    // Combat Systems
    const bulletSystem = new BulletSystem(game.scene);
    
    // Weapon System Setup
    const weaponSystem = new WeaponSystem(
        null, // Player controller attached later
        bulletSystem,
        game.inputManager,
        game.sfx || sfx, 
        {
            fireRate: 14,
            spread: 0.01,
            camera: game.camera,
            screenAimAssist: true,
            getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
        }
    );

    // Hit Detection (Client Side Prediction + Server Validation)
    const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, {
        hitRadius: 24.0,
        damage: 15
    });

    // ------------------------------------------------------------
    // 4. CLIENT EVENTS (Network -> Game Logic)
    // ------------------------------------------------------------

    mpClient.onConnected = () => {
        console.log("✅ Socket Connected");
        if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
    };

    mpClient.onLobbyUpdate = (msg) => {
        // Agar game chal raha tha aur wapas lobby aa gaye (Host left etc)
        if (msg.status === "lobby" && !game.isPaused && gameStartedOnce) {
            window.location.reload(); // Reload safe hai prototype ke liye
            return;
        }

        // UI Update karein
        if (mpUI) mpUI.updateLobby(msg);

        // Game pause rakhein lobby mein
        game.isPaused = true;
        if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
    };

    mpClient.onGameStart = (msg) => {
        console.log("🎮 Game Started by Host");
        
        // 1. State Reset
        gameStartedOnce = true;
        game.isPaused = false;
        ringClaimBlockedUntil = performance.now() + 2000; // 2 sec block to prevent instant claim

        // 2. Visuals Enable
        if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
        
        // 3. Spawning
        freshStartMatch(msg);

        // 4. UI Transition
        if (mpUI) mpUI.onGameStart();
    };

    // Generic Events (Hit, Kill, Game Over, Score)
    mpClient.onEvent = (evt) => {
        if (!evt) return;
        const myId = mpClient.socket?.id;

        switch (evt.type) {
            case "GAME_OVER":
                // ✅ Game Stop & Show Victory Screen
                console.log("🏁 GAME OVER received");
                game.isPaused = true; 
                if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
                if (mpUI) mpUI.showGameOver(evt.msg);
                break;

            case "SCORE":
                // Ring update from server
                if (evt.msg && evt.msg.id === myId) {
                    if (ringSystem && typeof evt.msg.rings === "number") {
                        ringSystem._setActiveRing(evt.msg.rings);
                        if (procAudio) procAudio.ring(); // Play ring sound
                    }
                }
                break;

            case "KILL":
                // Play explosion sound
                if (sfx) sfx.playExplosion();
                console.log(`💀 KILL: ${evt.killerName} -> ${evt.victimName}`);
                break;

            case "HIT":
            case "DAMAGE":
                // Damage Logic
                const payload = evt.msg || evt;
                const targetId = payload.targetId || payload.id;
                const damage = payload.damage || 10;
                
                // Agar humein damage mila
                if (targetId === myId && game.playerController) {
                    if (!game.playerController.isRespawning) {
                        game.playerController.health -= damage;
                        if (game.cameraSystem?.addShake) game.cameraSystem.addShake(0.5);
                        
                        // Local HUD update
                        if (game.uiManager) {
                            game.uiManager.update(
                                game.playerController.speed || 0,
                                Math.max(0, game.playerController.health),
                                game.playerController.score || 0,
                                100
                            );
                        }
                    }
                }
                // Agar humne fire kiya tha
                else if (payload.attackerId === myId) {
                     // Hitmarker sound logic here (optional)
                }
                break;
            
            case "FIRE":
                if (evt.ownerId !== myId && sfx) {
                    sfx.playShoot(); // Remote player shot sound
                }
                break;
        }
    };

    // Connect now!
    mpClient.connect();

    // ------------------------------------------------------------
    // 5. HELPER FUNCTIONS
    // ------------------------------------------------------------

    function freshStartMatch(msg) {
        // 1. Ensure Player Exists
        if (!game.playerController) {
            game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
            
            // Link Terrain
            let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
            if (terrain) game.playerController.setTerrainMesh(terrain);

            // Link Systems
            weaponSystem.player = game.playerController;
            game.cameraSystem = new CameraSystem(game.camera);
            game.cameraSystem.setTarget(game.playerController);
        }

        // 2. Reset Stats
        const pc = game.playerController;
        pc.health = 100;
        pc.score = 0;
        pc.isRespawning = false;
        pc.mesh.visible = true;

        // 3. Reset Position
        if (pc.respawnInstant) pc.respawnInstant();
        else {
            pc.mesh.position.set(0, 400, 0);
            pc.rb.velocity.set(0,0,0);
        }

        // 4. Reset Bullets
        bulletSystem.clearAll();

        // 5. Reset Rings
        resetRingSystem(msg?.seed || 12345);

        // 6. Hide Respawn UI if open
        if (mpUI) mpUI.hideRespawn();
    }

    function resetRingSystem(seed) {
        // Destroy Old
        if (ringSystem && ringSystem.rings) {
            ringSystem.rings.forEach(r => { 
                if (r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh); 
            });
        }
        ringSystem = null;

        // Create New
        if (typeof RingSystem !== "undefined") {
            let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
            if (terrain) {
                ringSystem = new RingSystem(game.scene, terrain, { seed: seed });
                ringSystem.currentIndex = 0;
                ringSystem._setActiveRing(0);
                
                // Ring Pass Callback
                ringSystem.onRingClaim = (idx) => {
                    if (performance.now() > ringClaimBlockedUntil && mpClient.isConnected()) {
                        mpClient.claimRing(idx);
                    }
                };
            }
        }
    }

    // Terrain Collision (Crash Prevention)
    const _terrainRaycaster = new THREE.Raycaster();
    const _downDir = new THREE.Vector3(0, -1, 0);
    
    function checkTerrainCollision() {
        const pc = game.playerController;
        if (!pc || !pc.mesh || pc.isRespawning) return;

        let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
        if (!terrain) return;

        const p = pc.mesh.position;
        // Optimization: Raycast only when low enough
        if (p.y > 600) return; 

        _terrainRaycaster.set(new THREE.Vector3(p.x, 2000, p.z), _downDir);
        const hits = _terrainRaycaster.intersectObject(terrain, true);
        
        if (hits.length > 0) {
            const groundH = hits[0].point.y;
            if (p.y < groundH + 3.0) {
                // Crash!
                if (pc.health > 0) {
                    pc.health -= 2.0; // Damage per frame touching ground
                    p.y = groundH + 5.0; // Push up
                    pc.speed *= 0.9; // Slow down
                    if (game.cameraSystem) game.cameraSystem.addShake(0.5);
                    
                    // Update HUD
                    if (game.uiManager) game.uiManager.update(pc.speed, pc.health, pc.score, 100);
                }
            }
        }
    }

    // ------------------------------------------------------------
    // 6. GAME LOOP (The Heartbeat)
    // ------------------------------------------------------------
    game.animate = function () {
        requestAnimationFrame(game.animate);

        // 1. Pause Logic
        if (game.isPaused) {
            // Render one frame if needed but don't update physics
            // This keeps the "Frozen" look at end screen
            if (game.renderer?.domElement?.style.display !== "none") {
                game.renderer.render(game.scene, game.camera);
            }
            return;
        }

        try {
            const dt = Math.min(game.clock.getDelta(), 0.1); // Cap dt to prevent jumps

            // 2. Player Logic
            if (game.playerController && !game.playerController.isRespawning) {
                game.inputManager.update(dt);
                game.playerController.update(dt);
                checkTerrainCollision();

                // Send Transform to Server
                if (mpClient.isInRoom && game.playerController.mesh) {
                    mpClient.sendTransform(
                        game.playerController.mesh.position,
                        game.playerController.mesh.quaternion
                    );
                    
                    // Fire Input
                    if (game.inputManager.getAction("fire")) {
                         mpClient.fire(
                            game.playerController.mesh.position,
                            game.playerController.mesh.quaternion
                         );
                    }
                }
            }

            // 3. Death & Respawn Logic
            if (game.playerController && game.playerController.health <= 0 && !game.playerController.isRespawning) {
                // Die
                game.playerController.health = 0;
                game.playerController.isRespawning = true;
                game.playerController.respawnTimer = 3.9;
                game.playerController.mesh.visible = false;
                
                // Show UI
                if (mpUI) mpUI.showRespawn(4);
            }

            if (game.playerController?.isRespawning) {
                game.playerController.respawnTimer -= dt;
                
                // Update UI Timer
                if (mpUI) mpUI.showRespawn(Math.ceil(game.playerController.respawnTimer));

                if (game.playerController.respawnTimer <= 0) {
                    // Respawn Done
                    game.playerController.isRespawning = false;
                    game.playerController.health = 100;
                    game.playerController.mesh.visible = true;
                    
                    if (game.playerController.respawnInstant) game.playerController.respawnInstant();
                    else game.playerController.mesh.position.set(0, 400, 0);

                    if (mpUI) mpUI.hideRespawn();
                }
                
                // Even when dead, we update network entities so they don't freeze
                mpState.update(dt);
                game.renderer.render(game.scene, game.camera);
                return; // Skip other updates
            }

            // 4. Game Systems Update
            if (ringSystem && performance.now() > ringClaimBlockedUntil && game.playerController?.mesh) {
                ringSystem.update(dt, game.playerController.mesh);
            }

            weaponSystem.update(dt);
            bulletSystem.update(dt);
            hitDetection.update(dt);
            mpState.update(dt); // Interpolate other players

            // 5. Minimap Update
            if (game.minimap && game.playerController?.mesh) {
                const enemies = mpState.getRemotePlayers().map(p => p.mesh).filter(m => m);
                game.minimap.update(game.playerController.mesh, enemies, ringSystem?.rings || [], ringSystem?.currentIndex);
            }

            // 6. HUD Update (In-Game)
            if (game.uiManager && game.playerController) {
                game.uiManager.update(
                    game.playerController.speed || 0,
                    game.playerController.health,
                    game.playerController.score || 0,
                    game.playerController.boostEnergy || 100
                );
            }

            // 7. Render
            if (game.cameraSystem) game.cameraSystem.update(dt);
            game.renderer.render(game.scene, game.camera);

        } catch (err) {
            console.error("⚠️ Game Loop Error (Recovered):", err);
        }
    };
});
