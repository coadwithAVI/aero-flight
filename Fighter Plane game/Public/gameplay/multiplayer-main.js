// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
    console.log("🌐 Multiplayer Mode Booting... (Final Full Version - v20)");

    // ------------------------------------------------------------------------
    // 0. Utilities & Helpers
    // ------------------------------------------------------------------------
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    
    // UI Bridge Accessor (Safe check)
    const safeUI = () => window.mpUIBridge || null;

    // ------------------------------------------------------------------------
    // 1. Game Engine Initialization
    // ------------------------------------------------------------------------
    const game = new GameManager();
    game.init();

    // Start in Paused mode (Lobby State)
    game.isPaused = true;
    game.isRunning = true;
    
    // Expose game instance globally for debugging/UI
    window.game = game;

    // Initialize UI Manager if missing
    if (!game.uiManager) {
        console.log("⚠️ UI Manager missing, creating new instance.");
        game.uiManager = new UIManager();
    }

    // Initialize Procedural Audio (Music/SFX)
    if (game.procAudio && typeof ProceduralAudio !== "undefined") {
        game.procAudio = new ProceduralAudio();
    }

    // Initialize Mobile Controls (if on mobile)
    if (typeof MobileControls !== "undefined") {
        game.mobileControls = new MobileControls(game.inputManager);
    }

    // Hide Canvas initially (Show Lobby UI instead)
    if (game.renderer?.domElement) {
        game.renderer.domElement.style.display = "none";
    }

    // ------------------------------------------------------------------------
    // 2. Multiplayer Systems Setup
    // ------------------------------------------------------------------------
    
    // MP State: Handles interpolation of remote players
    const mpState = new MPState(game.scene, {
        modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
        debug: false,
        entityTimeoutMs: 5000,
        positionLerp: 0.18,
        rotationSlerp: 0.22
    });

    // Flags for game flow
    let gameStartedOnce = false;
    let ringClaimBlockedUntil = 0; // Prevent instant ring claim on spawn

    // ------------------------------------------------------------------------
    // 3. Multiplayer Client Logic (The Brain)
    // ------------------------------------------------------------------------
    const mpClient = new MPClient({
        mpState,
        game,
        debug: true,

        // --- Connection Events ---
        onConnected: () => {
            console.log("✅ Connected to Server. Socket ID:", mpClient.socket.id);
            if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
            safeUI()?.onConnected?.();

            // 🎵 Audio: Start Lobby Music immediately on connection
            if (game.procAudio) {
                game.procAudio.playLobbyMusic();
            }
        },

        onDisconnected: (reason) => {
            console.warn("❌ Disconnected from Server:", reason);
            game.isPaused = true;
            safeUI()?.onDisconnected?.(reason);
        },

        // --- Lobby Events ---
        onLobbyUpdate: (msg) => {
            // If game is already playing, ignore lobby updates to prevent flicker
            if (msg.status === "playing") return;

            // Update local ID if provided
            if (msg.you?.id) mpState.setLocalId(msg.you.id);

            // Ensure game is paused and canvas is hidden
            game.isPaused = true;
            if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";

            // Update UI
            safeUI()?.onLobbyUpdate?.(msg);
        },

        // --- Game Start Event ---
        onGameStart: (msg) => {
            if (gameStartedOnce) return; // Prevent double start
            gameStartedOnce = true;
            console.log("🎮 Game Start Command Received");

            // Show Game Canvas
            if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
            
            // Block ring claims for 1.5s to allow spawn
            ringClaimBlockedUntil = performance.now() + 1500;
            
            // Reset player and systems
            freshStartMatch(msg);
            
            // Unpause Game Loop
            game.isPaused = false;
            
            // Update UI
            safeUI()?.onGameStart?.(msg);
            showHUDOnly();

            // 🎵 Audio: Switch to Game Music
            if (game.procAudio) {
                game.procAudio.playGameMusic();
            }
        },

        // --- Game State Sync (CRITICAL FOR VICTORY) ---
        onState: (snapshot) => {
            // Apply remote player positions
            // (mpState handles this automatically via mpClient internally, 
            // but we use this hook for Victory Checking)
            
            if (window.mpVictory) {
                // Check if I collected all rings
                window.mpVictory.tryRingWinFromSnapshot(snapshot);
                // Check if I am the last survivor
                window.mpVictory.tryLastPlayerWinFromSnapshot(snapshot);
            }
        },

        // --- In-Game Events (Hits, Scores, Deaths) ---
        onEvent: (evt) => {
            if (!evt) return;
            const socket = window.mpClient?.socket;
            const myId = socket?.id;

            // 1. SCORE / RING Update
            if (evt.type === "SCORE" && evt.msg) {
                // If this is MY score update
                if (socket && evt.msg.id === socket.id) {
                    if (ringSystem && typeof evt.msg.rings === "number") {
                        // Sync local ring index with server
                        ringSystem.currentIndex = evt.msg.rings;
                        ringSystem._setActiveRing(evt.msg.rings);
                        
                        // SFX
                        if (game.procAudio) game.procAudio.ring();
                    }
                }
            }

            // 2. HIT / DAMAGE Update
            if (evt.type === "HIT" || evt.type === "DAMAGE") {
                const payload = evt.msg || evt;
                const targetId = payload.targetId || payload.id || payload.victimId;
                const damage = payload.damage || 10;
                
                // If **I** am the target
                if (targetId && myId && String(targetId) === String(myId)) {
                    // Ignore damage if already dead/respawning
                    if (game.playerController && game.playerController.isRespawning) return;

                    if (game.playerController) {
                        // Apply Damage
                        game.playerController.health -= damage;
                        
                        // Camera Shake Effect
                        if (game.cameraSystem?.addShake) game.cameraSystem.addShake(0.8);
                        
                        // Immediate UI Update
                        if (game.uiManager) {
                            game.uiManager.update(
                                game.playerController.speed || 0,
                                Math.max(0, game.playerController.health),
                                game.playerController.score || 0,
                                game.playerController.boostEnergy || 100
                            );
                        }
                    }
                }
            }
        },

        // --- Game Over Event ---
        onGameOver: (msg) => {
            console.log("🏁 Match Ended");
            game.isPaused = true;
            gameStartedOnce = false;
            
            // Hide Canvas
            if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
            
            // Show End Screen via UI Bridge
            safeUI()?.onGameOver?.(msg);
        }
    });

    // Make client global
    window.mpClient = mpClient;
    // Initiate connection
    mpClient.connect();


    // ------------------------------------------------------------------------
    // 4. Gameplay Systems (Weapons, Physics, Rings)
    // ------------------------------------------------------------------------

    // A. Bullet System (Visuals)
    const bulletSystem = new BulletSystem(game.scene);

    // B. Weapon System (Firing Logic)
    const weaponSystem = new WeaponSystem(
        game.playerController,
        bulletSystem,
        game.inputManager,
        game.sfx,
        {
            fireRate: 14,
            spread: 0.01,
            camera: game.camera,
            screenAimAssist: true,
            // Helper to get enemies for auto-aim
            getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
        }
    );

    // C. Hit Detection (Client-side Authority)
    // Ensures shots register on server
    const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, {
        hitRadius: 24.0,
        damage: 15
    });

    // D. Ring System & Minimap
    let ringSystem = null;

    if (typeof MinimapSystem !== "undefined" && !game.minimap) {
        game.minimap = new MinimapSystem(game);
    }

    // Helper to clear old rings
    function destroyRingSystem() {
        try {
            if (ringSystem?.rings) {
                ringSystem.rings.forEach(r => { 
                    if (r?.mesh?.parent) r.mesh.parent.remove(r.mesh); 
                });
            }
        } catch (e) {
            console.warn("Error destroying rings:", e);
        }
        ringSystem = null;
    }

    // Helper to spawn new rings based on server seed
    function resetRingSystem(seed) {
        destroyRingSystem();
        
        if (typeof RingSystem === "undefined") {
            console.error("RingSystem class not found!");
            return;
        }

        // Find Terrain to place rings on
        let terrain = game.map?.terrainMesh;
        if (!terrain) {
            game.scene.traverse(o => { if (o.name === "Terrain") terrain = o; });
        }

        if (terrain) {
            // Initialize Rings
            ringSystem = new RingSystem(game.scene, terrain, { seed: seed ?? 12345 });
            ringSystem.currentIndex = 0;
            if(ringSystem._setActiveRing) ringSystem._setActiveRing(0);
            
            // Hook: When local player touches a ring
            ringSystem.onRingClaim = (idx) => {
                if (performance.now() > ringClaimBlockedUntil && mpClient.roomId) {
                    mpClient.claimRing(idx);
                }
            };
        }
    }


    // ------------------------------------------------------------------------
    // 5. Player Spawning & Management Helpers
    // ------------------------------------------------------------------------

    function ensureSpawnLocalPlayer() {
        // If player doesn't exist, create it
        if (typeof PlayerController !== "undefined" && !game.playerController) {
            game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
            
            // Attach terrain for altitude checks
            if (game.map?.terrainMesh) game.playerController.setTerrainMesh(game.map.terrainMesh);
            
            // Link weapon system to new player instance
            weaponSystem.player = game.playerController;
            
            // Setup Camera
            if (!game.cameraSystem) game.cameraSystem = new CameraSystem(game.camera);
            game.cameraSystem.setTarget(game.playerController);
        }
    }

    function freshStartMatch(msg) {
        // 1. Ensure Player Object
        ensureSpawnLocalPlayer();
        
        // 2. Set ID
        if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
        
        // 3. Reset Health & State
        if (game.playerController) {
            game.playerController.health = 100;
            game.playerController.isRespawning = false;
            game.playerController.score = 0;
            
            // Reset Position
            if (game.playerController.respawnInstant) {
                game.playerController.respawnInstant();
            } else {
                // Fallback reset
                game.playerController.mesh.position.set(0, 400, 0);
                game.playerController.mesh.rotation.set(0, 0, 0);
            }
            game.playerController.mesh.visible = true;
        }

        // 4. Clear old bullets
        bulletSystem.clearAll();
        
        // 5. Generate Rings from Seed
        resetRingSystem(msg?.seed);
        
        // 6. Reset UI overlays
        safeUI()?.hideRespawn?.();
    }

    function showHUDOnly() {
        if (game.uiManager) game.uiManager.hidePause?.();
    }


    // ------------------------------------------------------------------------
    // 6. Terrain Collision Logic (Optimized)
    // ------------------------------------------------------------------------
    const _terrainRaycaster = new THREE.Raycaster();
    const _downDir = new THREE.Vector3(0, -1, 0);

    function checkTerrainCollision() {
        if (!game.playerController || !game.playerController.mesh) return;
        if (game.playerController.isRespawning) return; 

        let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
        if (!terrain) return;

        const p = game.playerController.mesh.position;
        // Cast ray from above the player downwards
        const rayOrigin = new THREE.Vector3(p.x, 2000, p.z);
        _terrainRaycaster.set(rayOrigin, _downDir);
        
        const hits = _terrainRaycaster.intersectObject(terrain, true);
        
        if (hits.length > 0) {
            const groundH = hits[0].point.y;
            // Collision Threshold (3.5 units above ground)
            if (p.y < groundH + 3.5) {
                if (game.playerController.health > 0) {
                    // Apply Crash Damage
                    const dmg = 1.5;
                    game.playerController.health -= dmg; 
                    
                    // Bounce Player Up
                    p.y = groundH + 5.0; 
                    if (game.playerController.speed) game.playerController.speed *= 0.85;
                    
                    // Shake Camera
                    if (game.cameraSystem?.addShake) game.cameraSystem.addShake(0.5);
                    
                    // Update UI
                    if (game.uiManager) {
                        game.uiManager.update(
                            game.playerController.speed || 0,
                            Math.max(0, game.playerController.health),
                            game.playerController.score || 0,
                            game.playerController.boostEnergy || 100
                        );
                    }
                }
            }
        }
    }


    // ------------------------------------------------------------------------
    // 7. MAIN GAME LOOP (The Heartbeat)
    // ------------------------------------------------------------------------
    game.animate = function () {
        if (!game.isRunning) return;
        requestAnimationFrame(game.animate);

        // A. Pause Logic
        if (game.isPaused) {
            // Still render the scene if the canvas is visible (e.g. background for menu)
            if (game.renderer?.domElement?.style.display !== "none") {
                game.renderer.render(game.scene, game.camera);
            }
            return;
        }

        // B. Time Delta
        const dt = clamp(game.clock.getDelta(), 0.0, 0.05);

        // C. Local Player Update
        if (!game.playerController?.isRespawning) {
            game.inputManager?.update?.(dt);
            game.playerController?.update?.(dt);
            checkTerrainCollision(); 
        }

        // D. Death Monitor
        if (game.playerController && game.playerController.health <= 0) {
            if (!game.playerController.isRespawning) {
                // START DEATH SEQUENCE
                game.playerController.health = 0;
                game.playerController.isRespawning = true;
                game.playerController.respawnTimer = 3.9; // 4 seconds respawn
                
                console.log("💀 PILOT DOWN. Respawn Sequence...");
                
                // Hide Player
                if (game.playerController.mesh) game.playerController.mesh.visible = false;
                
                // Stop Physics
                if (game.playerController.rb) {
                    game.playerController.rb.velocity.set(0,0,0);
                    game.playerController.rb.angularVelocity.set(0,0,0);
                }
                
                // Zero UI
                if (game.uiManager) game.uiManager.update(0, 0, game.playerController.score||0, 100);
            }
        }

        // E. Respawn Timer Logic
        if (game.playerController?.isRespawning) {
            game.playerController.respawnTimer -= dt;
            
            // Update Respawn UI Overlay
            const ui = safeUI();
            if (ui && ui.showRespawn) {
                let timeLeft = Math.ceil(game.playerController.respawnTimer);
                if (timeLeft < 1) timeLeft = 1;
                ui.showRespawn(timeLeft);
            }

            // CHECK RESPAWN COMPLETION
            if (game.playerController.respawnTimer <= 0) {
                 game.playerController.isRespawning = false;
                 game.playerController.health = 100;
                 
                 // Reset Position
                 if (game.playerController.respawnInstant) {
                     game.playerController.respawnInstant();
                 } else {
                     game.playerController.mesh.position.set(0, 400, 0);
                     game.playerController.mesh.rotation.set(0, 0, 0);
                 }
                 
                 // Show Player
                 game.playerController.mesh.visible = true;
                 
                 // Hide UI Overlay
                 if (ui && ui.hideRespawn) ui.hideRespawn();
                 
                 // Restore UI
                 if (game.uiManager) game.uiManager.update(0, 100, game.playerController.score || 0, 100);
                 
                 console.log("✅ RESPAWNED.");
            }

            // Even while dead, update remote players so the world doesn't freeze
            mpState.update(dt);
            game.renderer.render(game.scene, game.camera);
            return; // Skip rest of loop while dead
        }

        // F. Ring System Update
        if (ringSystem && game.playerController?.mesh) {
            if (performance.now() > ringClaimBlockedUntil) {
                ringSystem.update(dt, game.playerController.mesh);
            }
        }

        // G. Weapons & Bullets Update
        weaponSystem.update(dt);
        bulletSystem.update(dt);
        
        // H. Hit Detection Update
        if (hitDetection) hitDetection.update(dt);

        // I. Network Synchronization
        if (game.playerController?.mesh) {
            // Send position to server
            mpClient.sendTransform(
                game.playerController.mesh.position, 
                game.playerController.mesh.quaternion
            );
            
            // Send fire command if shooting
            if (game.inputManager?.getAction?.("fire")) {
                mpClient.fire(
                    game.playerController.mesh.position, 
                    game.playerController.mesh.quaternion
                );
            }
        }
        
        // J. Update Remote Players (Smooth Interpolation)
        mpState.update(dt);

        // K. Minimap Update
        if (game.minimap && game.playerController?.mesh) {
            const enemies = mpState.getRemotePlayers().map(p => p.mesh);
            const ringsRaw = ringSystem?.rings || [];
            game.minimap.update(
                game.playerController.mesh, 
                enemies, 
                ringsRaw, 
                ringSystem?.currentIndex
            );
        }

        // L. UI Manager Update
        if (game.uiManager && game.playerController) {
            game.uiManager.update(
                game.playerController.speed || 0,
                game.playerController.health, 
                game.playerController.score || 0,
                game.playerController.boostEnergy || 100
            );
        }

        // M. Render
        game.cameraSystem?.update?.(dt);
        game.renderer.render(game.scene, game.camera);
    };
});
