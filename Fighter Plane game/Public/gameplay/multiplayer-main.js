// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
    console.log("🌐 Multiplayer Mode Initializing... (Stats & Audio Fix v26)");

    // ------------------------------------------------------------
    // 1. INITIALIZE AUDIO & SYSTEMS
    // ------------------------------------------------------------
    const procAudio = (typeof ProceduralAudio !== "undefined") ? new ProceduralAudio() : null;
    const sfx = (typeof SFXManager !== "undefined") ? new SFXManager({ masterVolume: 0.4, enableEngineHum: false }) : null;
    
    // Unlock Audio on first interaction
    document.addEventListener('click', () => {
        if(sfx) sfx.init();
        if(procAudio) procAudio.unlock();
    }, { once: true });

    const game = new GameManager();
    game.init(); 
    game.isPaused = true;
    game.isRunning = true;
    window.game = game;

    if (!game.uiManager && typeof UIManager !== "undefined") {
        game.uiManager = new UIManager();
    }

    // ------------------------------------------------------------
    // 2. MOBILE CONTROLS INJECTOR (GUARANTEED FIX)
    // ------------------------------------------------------------
    if (typeof MobileControls !== "undefined") {
        console.log("📱 Injecting Mobile Controls...");
        game.mobileControls = new MobileControls(game.inputManager);
        
        // Force inject HTML if missing or hidden
        setTimeout(() => {
            let mc = document.getElementById("mobile-controls");
            if (!mc) {
                // Creates controls dynamically if HTML is missing
                const div = document.createElement("div");
                div.id = "mobile-controls";
                div.innerHTML = `
                    <div id="joystick-zone" style="position:absolute; bottom:50px; left:50px; width:120px; height:120px; background:rgba(255,255,255,0.1); border-radius:50%; pointer-events:auto;"></div>
                    <button id="btn-fire" class="mobile-btn" style="position:absolute; bottom:60px; right:40px; width:80px; height:80px; background:rgba(255,0,0,0.5); border:2px solid red; border-radius:50%; color:white; font-weight:bold; pointer-events:auto;">FIRE</button>
                    <button id="btn-boost" class="mobile-btn" style="position:absolute; bottom:160px; right:40px; width:60px; height:60px; background:rgba(255,255,0,0.5); border:2px solid yellow; border-radius:50%; color:black; font-weight:bold; pointer-events:auto;">BST</button>
                `;
                document.body.appendChild(div);
                mc = div;
            }
            mc.style.zIndex = "2147483647"; // Max Z-Index
            mc.style.position = "fixed";
            mc.style.bottom = "0";
            mc.style.left = "0";
            mc.style.width = "100%";
            mc.style.height = "100%";
            mc.style.pointerEvents = "none"; // Let clicks pass through empty areas
            
            // Re-bind events explicitly
            const btnFire = document.getElementById("btn-fire");
            const btnBoost = document.getElementById("btn-boost");
            
            if(btnFire) {
                btnFire.style.pointerEvents = "auto";
                btnFire.addEventListener("touchstart", (e) => { e.preventDefault(); game.inputManager.keys[' ']=true; });
                btnFire.addEventListener("touchend", (e) => { e.preventDefault(); game.inputManager.keys[' ']=false; });
            }
            if(btnBoost) {
                btnBoost.style.pointerEvents = "auto";
                btnBoost.addEventListener("touchstart", (e) => { e.preventDefault(); game.inputManager.keys['Shift']=true; });
                btnBoost.addEventListener("touchend", (e) => { e.preventDefault(); game.inputManager.keys['Shift']=false; });
            }
        }, 500);
    }

    const mpState = new MPState(game.scene, {
        modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
        debug: false
    });

    // ------------------------------------------------------------
    // 3. NETWORK CLIENT
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
    // 4. GAMEPLAY SYSTEMS
    // ------------------------------------------------------------
    let gameStartedOnce = false;
    let ringClaimBlockedUntil = 0;
    let ringSystem = null;
    let lastBoostTime = 0;

    if (typeof MinimapSystem !== "undefined" && !game.minimap) {
        game.minimap = new MinimapSystem(game);
    }

    const bulletSystem = new BulletSystem(game.scene);
    
    // Weapon System
    const weaponSystem = new WeaponSystem(
        null, 
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
    // 5. EVENT HANDLING (Stats & Audio)
    // ------------------------------------------------------------

    mpClient.onConnected = () => {
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
        if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
        gameStartedOnce = true;
        game.isPaused = false;
        ringClaimBlockedUntil = performance.now() + 2000;

        if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
        freshStartMatch(msg);
        if (mpUI) mpUI.onGameStart();
    };

    // ✅ STATS SYNCING (Crucial Fix)
    mpClient.onState = (snapshot) => {
        if (!game.playerController) return;
        const myId = mpClient.socket?.id;
        
        // Find me in the server snapshot
        const meServer = snapshot.players.find(p => p.id === myId);
        
        if (meServer) {
            // Sync Server Stats to Local Player
            // This ensures Score/Kills/Rings are accurate for Game Over
            game.playerController.score = meServer.score || 0;
            game.playerController.kills = meServer.kills || 0; // Requires adding .kills to PlayerController if not present
            
            // Also update Rings locally if needed
            if (ringSystem && typeof meServer.rings === "number") {
                if (ringSystem.currentIndex !== meServer.rings) {
                    ringSystem._setActiveRing(meServer.rings);
                }
            }
        }
    };

    mpClient.onEvent = (evt) => {
        if (!evt) return;
        const myId = mpClient.socket?.id;

        switch (evt.type) {
            case "GAME_OVER":
                game.isPaused = true; 
                if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
                if (mpUI) mpUI.showGameOver(evt.msg);
                break;

            case "SCORE":
                // Play Audio Only (Stats synced in onState)
                if (evt.msg && evt.msg.id === myId) {
                    if (procAudio) procAudio.ring();
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
                
                if (targetId === myId && game.playerController && !game.playerController.isRespawning) {
                    game.playerController.health -= damage;
                    
                    if (game.cameraSystem && game.cameraSystem.addShake) {
                        game.cameraSystem.addShake(0.5);
                    }
                    if (game.uiManager) {
                        game.uiManager.update(game.playerController.speed, game.playerController.health, game.playerController.score, 100);
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
    // 6. HELPER FUNCTIONS
    // ------------------------------------------------------------
    function freshStartMatch(msg) {
        if (!game.playerController) {
            game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
            let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
            if (terrain) game.playerController.setTerrainMesh(terrain);
            
            game.cameraSystem = new CameraSystem(game.camera);
            game.cameraSystem.setTarget(game.playerController);
        }

        // Re-attach weapon system
        weaponSystem.player = game.playerController;

        const pc = game.playerController;
        pc.health = 100;
        pc.score = 0;
        pc.kills = 0; // Ensure kills property exists
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
            ringSystem.rings.forEach(r => { if (r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh); });
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
                    if (game.cameraSystem?.addShake) game.cameraSystem.addShake(0.5);
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
    // 7. GAME LOOP (The Heartbeat)
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

                // ✅ AUDIO FIX: Fire Sound
                if (game.inputManager.getAction("fire")) {
                    // Fire network event
                    if (mpClient.isInRoom) {
                        mpClient.fire(game.playerController.mesh.position, game.playerController.mesh.quaternion);
                    }
                    // Play local sound immediately
                    if (sfx) sfx.playShoot();
                }

                // ✅ AUDIO FIX: Boost Sound
                if (game.inputManager.getAction("boost")) {
                    if (procAudio) procAudio.startBoost();
                } else {
                    if (procAudio) procAudio.stopBoost();
                }

                if (mpClient.isInRoom && game.playerController.mesh) {
                    mpClient.sendTransform(game.playerController.mesh.position, game.playerController.mesh.quaternion);
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

            weaponSystem.update(dt);
            bulletSystem.update(dt);
            hitDetection.update(dt);
            mpState.update(dt);

            if (game.minimap && game.playerController?.mesh) {
                const enemies = mpState.getRemotePlayers().map(p => p.mesh).filter(m => m);
                game.minimap.update(game.playerController.mesh, enemies, ringSystem?.rings || [], ringSystem?.currentIndex);
            }

            // ✅ STATS SYNC to HUD
            if (game.uiManager && game.playerController) {
                game.uiManager.update(
                    game.playerController.speed || 0,
                    game.playerController.health,
                    game.playerController.score || 0, // Now synced from server
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
