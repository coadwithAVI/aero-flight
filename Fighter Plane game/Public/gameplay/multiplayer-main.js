// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
    console.log("🌐 Multiplayer Mode Initializing... (Shooting Fix v25)");

    // ------------------------------------------------------------
    // 1. INITIALIZE CORE SYSTEMS
    // ------------------------------------------------------------
    const procAudio = (typeof ProceduralAudio !== "undefined") ? new ProceduralAudio() : null;
    const sfx = (typeof SFXManager !== "undefined") ? new SFXManager({ masterVolume: 0.3, enableEngineHum: false }) : null;
    if (sfx) sfx.init();

    const game = new GameManager();
    game.init(); 
    game.isPaused = true;
    game.isRunning = true;
    window.game = game;

    if (!game.uiManager && typeof UIManager !== "undefined") {
        game.uiManager = new UIManager();
    }

    // ✅ MOBILE CONTROLS FORCE VISIBLE (Z-Index Fix)
    if (typeof MobileControls !== "undefined") {
        console.log("📱 Mobile Controls Detecting...");
        game.mobileControls = new MobileControls(game.inputManager);
        
        setTimeout(() => {
            const mc = document.getElementById("mobile-controls");
            if (mc) {
                mc.style.zIndex = "20000"; 
                mc.style.position = "fixed";
            }
        }, 1000);
    }

    const mpState = new MPState(game.scene, {
        modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
        debug: false
    });

    // ------------------------------------------------------------
    // 2. NETWORK CLIENT & UI BRIDGE
    // ------------------------------------------------------------
    const mpClient = new MPClient({
        mpState: mpState,
        playerName: localStorage.getItem("sky_pilot_name") || "Pilot",
        debug: true
    });
    window.mpClient = mpClient;

    const mpUI = (typeof MPUIManager !== "undefined") 
        ? new MPUIManager(mpClient, procAudio) 
        : null;

    // ------------------------------------------------------------
    // 3. GAMEPLAY VARIABLES
    // ------------------------------------------------------------
    let gameStartedOnce = false;
    let ringClaimBlockedUntil = 0;
    let ringSystem = null;

    if (typeof MinimapSystem !== "undefined" && !game.minimap) {
        game.minimap = new MinimapSystem(game);
    }

    const bulletSystem = new BulletSystem(game.scene);
    
    // Weapon System Setup
    const weaponSystem = new WeaponSystem(
        null, // Player assigned dynamically later
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

    const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, {
        hitRadius: 24.0,
        damage: 15
    });

    // ------------------------------------------------------------
    // 4. CLIENT EVENTS
    // ------------------------------------------------------------

    mpClient.onConnected = () => {
        console.log("✅ Socket Connected:", mpClient.socket?.id);
        if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
    };

    mpClient.onLobbyUpdate = (msg) => {
        if (msg.you?.id) mpState.setLocalId(msg.you.id); 

        if (msg.status === "playing") return; 

        if (msg.status === "lobby" && gameStartedOnce) {
            window.location.reload();
            return;
        }

        if (mpUI) mpUI.updateLobby(msg);
        game.isPaused = true;
        if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
    };

    mpClient.onGameStart = (msg) => {
        console.log("🎮 Game Started");
        if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);

        gameStartedOnce = true;
        game.isPaused = false;
        ringClaimBlockedUntil = performance.now() + 2000;

        if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
        
        freshStartMatch(msg);
        if (mpUI) mpUI.onGameStart();
    };

    mpClient.onEvent = (evt) => {
        if (!evt) return;
        const myId = mpClient.socket?.id;

        switch (evt.type) {
            case "GAME_OVER":
                console.log("🏁 GAME OVER");
                game.isPaused = true; 
                if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
                if (mpUI) mpUI.showGameOver(evt.msg);
                break;

            case "SCORE":
                if (evt.msg && evt.msg.id === myId) {
                    if (ringSystem && typeof evt.msg.rings === "number") {
                        ringSystem._setActiveRing(evt.msg.rings);
                        if (procAudio) procAudio.ring();
                    }
                }
                break;

            case "KILL":
                if (sfx) sfx.playExplosion();
                break;

            case "HIT":
            case "DAMAGE":
                const payload = evt.msg || evt;
                const targetId = payload.targetId || payload.id;
                const damage = payload.damage || 10;
                
                if (targetId === myId && game.playerController) {
                    if (!game.playerController.isRespawning) {
                        game.playerController.health -= damage;
                        
                        // Safe Camera Shake
                        if (game.cameraSystem && typeof game.cameraSystem.addShake === "function") {
                            game.cameraSystem.addShake(0.5);
                        } else if (game.cameraSystem && typeof game.cameraSystem.shake === "function") {
                            game.cameraSystem.shake(0.5);
                        }

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
                break;
            
            case "FIRE":
                if (evt.ownerId !== myId && sfx) sfx.playShoot();
                break;
        }
    };

    mpClient.connect();

    // ------------------------------------------------------------
    // 5. HELPER FUNCTIONS
    // ------------------------------------------------------------
    function freshStartMatch(msg) {
        if (!game.playerController) {
            game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
            let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
            if (terrain) game.playerController.setTerrainMesh(terrain);
            
            game.cameraSystem = new CameraSystem(game.camera);
            game.cameraSystem.setTarget(game.playerController);
        }

        // ✅ CRITICAL FIX: Always re-attach player to weapon system
        // This ensures shooting works after a restart
        weaponSystem.player = game.playerController;

        const pc = game.playerController;
        pc.health = 100;
        pc.score = 0;
        pc.isRespawning = false;
        pc.mesh.visible = true;

        if (pc.respawnInstant) pc.respawnInstant();
        else {
            pc.mesh.position.set(0, 400, 0);
            pc.rb.velocity.set(0,0,0);
        }

        bulletSystem.clearAll();
        resetRingSystem(msg?.seed || 12345);
        if (mpUI) mpUI.hideRespawn();
    }

    function resetRingSystem(seed) {
        if (ringSystem && ringSystem.rings) {
            ringSystem.rings.forEach(r => { 
                if (r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh); 
            });
        }
        ringSystem = null;

        if (typeof RingSystem !== "undefined") {
            let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
            if (terrain) {
                ringSystem = new RingSystem(game.scene, terrain, { seed: seed });
                ringSystem.currentIndex = 0;
                ringSystem._setActiveRing(0);
                ringSystem.onRingClaim = (idx) => {
                    if (performance.now() > ringClaimBlockedUntil && mpClient.isConnected()) {
                        mpClient.claimRing(idx);
                    }
                };
            }
        }
    }

    const _terrainRaycaster = new THREE.Raycaster();
    const _downDir = new THREE.Vector3(0, -1, 0);
    
    function checkTerrainCollision() {
        const pc = game.playerController;
        if (!pc || !pc.mesh || pc.isRespawning) return;

        let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
        if (!terrain) return;

        const p = pc.mesh.position;
        if (p.y > 600) return; 

        _terrainRaycaster.set(new THREE.Vector3(p.x, 2000, p.z), _downDir);
        const hits = _terrainRaycaster.intersectObject(terrain, true);
        
        if (hits.length > 0) {
            const groundH = hits[0].point.y;
            if (p.y < groundH + 3.0) {
                if (pc.health > 0) {
                    pc.health -= 2.0; 
                    p.y = groundH + 5.0; 
                    pc.speed *= 0.9;
                    
                    if (game.cameraSystem && typeof game.cameraSystem.addShake === "function") {
                        game.cameraSystem.addShake(0.5);
                    }

                    if (game.uiManager) game.uiManager.update(pc.speed, pc.health, pc.score, 100);
                }
            }
        }
    }

    function removeGhostPlayer() {
        if (!mpClient.socket || !mpState) return;
        const myId = mpClient.socket.id;
        if (!mpState.localId && myId) mpState.setLocalId(myId);

        if (mpState.remotePlayers && mpState.remotePlayers[myId]) {
            mpState.removePlayer(myId);
        }
    }

    // ------------------------------------------------------------
    // 6. GAME LOOP
    // ------------------------------------------------------------
    game.animate = function () {
        requestAnimationFrame(game.animate);

        if (game.isPaused) {
            if (game.renderer?.domElement?.style.display !== "none") {
                game.renderer.render(game.scene, game.camera);
            }
            return;
        }

        try {
            const dt = Math.min(game.clock.getDelta(), 0.1);

            removeGhostPlayer();

            if (game.playerController && !game.playerController.isRespawning) {
                game.inputManager.update(dt);
                game.playerController.update(dt);
                checkTerrainCollision();

                if (mpClient.isInRoom && game.playerController.mesh) {
                    mpClient.sendTransform(
                        game.playerController.mesh.position,
                        game.playerController.mesh.quaternion
                    );
                    
                    // Network Fire
                    if (game.inputManager.getAction("fire")) {
                         mpClient.fire(
                            game.playerController.mesh.position,
                            game.playerController.mesh.quaternion
                         );
                    }
                }
            }

            if (game.playerController && game.playerController.health <= 0 && !game.playerController.isRespawning) {
                game.playerController.health = 0;
                game.playerController.isRespawning = true;
                game.playerController.respawnTimer = 3.9;
                game.playerController.mesh.visible = false;
                if (mpUI) mpUI.showRespawn(4);
            }

            if (game.playerController?.isRespawning) {
                game.playerController.respawnTimer -= dt;
                if (mpUI) mpUI.showRespawn(Math.ceil(game.playerController.respawnTimer));

                if (game.playerController.respawnTimer <= 0) {
                    game.playerController.isRespawning = false;
                    game.playerController.health = 100;
                    game.playerController.mesh.visible = true;
                    if (game.playerController.respawnInstant) game.playerController.respawnInstant();
                    else game.playerController.mesh.position.set(0, 400, 0);
                    if (mpUI) mpUI.hideRespawn();
                }
                
                mpState.update(dt);
                game.renderer.render(game.scene, game.camera);
                return;
            }

            if (ringSystem && performance.now() > ringClaimBlockedUntil && game.playerController?.mesh) {
                ringSystem.update(dt, game.playerController.mesh);
            }

            // Update Weapons (Handles Local Shooting Visuals)
            weaponSystem.update(dt);
            bulletSystem.update(dt);
            
            hitDetection.update(dt);
            mpState.update(dt);

            if (game.minimap && game.playerController?.mesh) {
                const enemies = mpState.getRemotePlayers().map(p => p.mesh).filter(m => m);
                game.minimap.update(game.playerController.mesh, enemies, ringSystem?.rings || [], ringSystem?.currentIndex);
            }

            if (game.uiManager && game.playerController) {
                game.uiManager.update(
                    game.playerController.speed || 0,
                    game.playerController.health,
                    game.playerController.score || 0,
                    game.playerController.boostEnergy || 100
                );
            }

            if (game.cameraSystem) game.cameraSystem.update(dt);
            game.renderer.render(game.scene, game.camera);

        } catch (err) {
            console.error("⚠️ Game Loop Error:", err);
        }
    };
});
