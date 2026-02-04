// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
    console.log("🌐 Multiplayer Mode Initializing... (UI Bridge Integrated)");

    // ------------------------------------------------------------
    // 1. DEVICE DETECTION
    // ------------------------------------------------------------
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0);
    console.log("📱 Device Type:", isMobile ? "Mobile" : "PC");

    // ------------------------------------------------------------
    // 2. GLOBAL MOBILE STATE & AUDIO
    // ------------------------------------------------------------
    window.mobileState = { x: 0, y: 0, fire: false, boost: false };

    const procAudio = (typeof ProceduralAudio !== "undefined") ? new ProceduralAudio() : null;
    const sfx = (typeof SFXManager !== "undefined") ? new SFXManager({ masterVolume: 0.4, enableEngineHum: false }) : null;
    
    // Audio Unlocker
    const unlockAudio = () => {
        if(sfx) sfx.init();
        if(procAudio) procAudio.unlock();
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // ------------------------------------------------------------
    // 3. GAME ENGINE INIT
    // ------------------------------------------------------------
    const game = new GameManager();
    game.init(); 
    game.isPaused = true; // Start paused until lobby launch
    game.isRunning = true;
    window.game = game;

    if (!game.uiManager && typeof UIManager !== "undefined") {
        game.uiManager = new UIManager();
    }

    // Hide canvas initially (Lobby Screen dikhana hai pehle)
    if (game.renderer?.domElement) {
        game.renderer.domElement.style.display = "none";
    }

    // ------------------------------------------------------------
    // 4. MOBILE INPUTS (Joystick & Buttons)
    // ------------------------------------------------------------
    function setupMobileInputs() {
        if (!isMobile) return;
        
        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        const btnFire = document.getElementById('btn-fire');
        const btnBoost = document.getElementById('btn-boost');

        if (!zone || !knob) return;
        console.log("📱 Mobile Inputs Active");

        let startX = 0, startY = 0;
        let isDragging = false;
        const maxDist = 40;

        // Joystick Logic
        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            startX = t.clientX; startY = t.clientY;
            isDragging = true;
            knob.style.transition = 'none';
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const t = e.touches[0];
            let dx = t.clientX - startX;
            let dy = t.clientY - startY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > maxDist) {
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * maxDist;
                dy = Math.sin(angle) * maxDist;
            }
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            window.mobileState.x = dx / maxDist;
            window.mobileState.y = dy / maxDist;
        }, { passive: false });

        const endDrag = (e) => {
            e.preventDefault();
            isDragging = false;
            knob.style.transition = '0.2s ease-out';
            knob.style.transform = `translate(-50%, -50%)`;
            window.mobileState.x = 0;
            window.mobileState.y = 0;
        };
        zone.addEventListener('touchend', endDrag);
        zone.addEventListener('touchcancel', endDrag);

        // Buttons
        if (btnFire) {
            btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); window.mobileState.fire = true; btnFire.style.opacity = "0.5"; }, { passive: false });
            btnFire.addEventListener('touchend', (e) => { e.preventDefault(); window.mobileState.fire = false; btnFire.style.opacity = "1"; }, { passive: false });
        }
        if (btnBoost) {
            btnBoost.addEventListener('touchstart', (e) => { e.preventDefault(); window.mobileState.boost = true; btnBoost.style.opacity = "0.5"; }, { passive: false });
            btnBoost.addEventListener('touchend', (e) => { e.preventDefault(); window.mobileState.boost = false; btnBoost.style.opacity = "1"; }, { passive: false });
        }
    }
    setupMobileInputs();

    // ------------------------------------------------------------
    // 5. MULTIPLAYER SETUP
    // ------------------------------------------------------------
    const mpState = new MPState(game.scene, {
        modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
        debug: false
    });

    const mpClient = new MPClient({
        mpState: mpState,
        playerName: localStorage.getItem("SP_MP_NAME") || "Pilot",
        debug: true
    });
    window.mpClient = mpClient;

    // Helper to safely access the HTML UI Bridge
    const getUI = () => window.mpUIBridge;

    // Game Logic Variables
    let gameStartedOnce = false;
    let ringClaimBlockedUntil = 0;
    let ringSystem = null;
    let lastFireTime = 0; 
    let lastSoundTime = 0;
    const FIRE_DELAY = 100;
    const SOUND_DELAY = 150; 

    // Gameplay Systems
    if (typeof MinimapSystem !== "undefined" && !game.minimap) game.minimap = new MinimapSystem(game);
    const bulletSystem = new BulletSystem(game.scene);
    
    const weaponSystem = new WeaponSystem(
        null, bulletSystem, game.inputManager, game.sfx || sfx, 
        {
            fireRate: 14, spread: 0.01, camera: game.camera, screenAimAssist: true,
            getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
        }
    );

    const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, { hitRadius: 24.0, damage: 15 });

    // ------------------------------------------------------------
    // 6. EVENT HANDLERS (LINKING TO UI)
    // ------------------------------------------------------------
    
    mpClient.onConnected = () => {
        if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
        console.log("✅ Socket Connected. Notifying UI...");
        if (getUI()) getUI().onConnected();
    };

    mpClient.onDisconnected = (reason) => {
        console.warn("❌ Disconnected:", reason);
        if (getUI()) getUI().onDisconnected(reason);
        game.isPaused = true;
        if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
    };

    mpClient.onLobbyUpdate = (msg) => {
        if (msg.you?.id) mpState.setLocalId(msg.you.id);
        
        // If game is running, don't show lobby update unless it's a critical change
        if (msg.status === "playing") return; 

        // Update the HTML UI
        if (getUI()) getUI().onLobbyUpdate(msg);

        // Ensure game is paused in lobby
        game.isPaused = true;
        if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
    };

    mpClient.onGameStart = (msg) => {
        if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
        console.log("🚀 Game Launching...");
        
        gameStartedOnce = true;
        game.isPaused = false;
        ringClaimBlockedUntil = performance.now() + 2000;
        
        // Show the 3D Canvas
        if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
        
        // Initialize Player/Map
        freshStartMatch(msg);

        // Notify UI to switch to HUD
        if (getUI()) getUI().onGameStart(msg);
    };

    mpClient.onEvent = (evt) => {
        if (!evt) return;
        const myId = mpClient.socket?.id;

        switch (evt.type) {
            case "GAME_OVER":
                console.log("🏁 Game Over:", evt.msg);
                game.isPaused = true; 
                // Don't hide canvas immediately so they can see result, but UI covers it
                if (getUI()) getUI().onGameOver(evt.msg);
                break;

            case "KILL": 
                if (sfx) sfx.playExplosion(); 
                break;

            case "HIT":
            case "DAMAGE":
                const payload = evt.msg || evt;
                const targetId = payload.targetId || payload.id;
                const damage = payload.damage || 10;
                
                // If I took damage
                if (targetId === myId && game.playerController && !game.playerController.isRespawning) {
                    game.playerController.health -= damage;
                    if (game.cameraSystem?.addShake) game.cameraSystem.addShake(0.5);
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
    // 7. HELPER FUNCTIONS
    // ------------------------------------------------------------
    function freshStartMatch(msg) {
        // Create Player if not exists
        if (!game.playerController) {
            game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
            let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
            if (terrain) game.playerController.setTerrainMesh(terrain);
            
            game.cameraSystem = new CameraSystem(game.camera);
            game.cameraSystem.setTarget(game.playerController);
        }

        // Reset Player State
        weaponSystem.player = game.playerController;
        const pc = game.playerController;
        pc.health = 100;
        pc.score = 0;
        pc.kills = 0;
        pc.isRespawning = false;
        pc.mesh.visible = true;

        if (pc.respawnInstant) pc.respawnInstant();
        else {
            pc.mesh.position.set(0, 400, 0);
            pc.rb.velocity.set(0,0,0);
        }

        // Reset Systems
        bulletSystem.clearAll();
        resetRingSystem(msg?.seed || 12345);
        if (getUI()) getUI().hideRespawn();
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
                        if (procAudio) procAudio.ring(); 
                        mpClient.claimRing(idx);
                    }
                };
            }
        }
    }

    // Terrain Collision Logic
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

    // ------------------------------------------------------------
    // 8. GAME LOOP (ANIMATE)
    // ------------------------------------------------------------
    game.animate = function () {
        requestAnimationFrame(game.animate);

        // If paused, render static
        if (game.isPaused) {
            if (game.renderer?.domElement?.style.display !== "none") {
                game.renderer.render(game.scene, game.camera);
            }
            return;
        }

        try {
            const dt = Math.min(game.clock.getDelta(), 0.1);
            const now = performance.now();

            // Local Player Logic
            if (game.playerController && !game.playerController.isRespawning) {
                
                // 1. Inputs Update
                game.inputManager.update(dt);

                // 2. MOBILE INPUTS (Non-Destructive)
                // This updates "Mobile" keys without touching "Keyboard" keys.
                // Both can work at the same time now.
                if (window.mobileState) {
                    const threshold = 0.15; // Increased Sensitivity
                    
                    // Reset Mobile Keys Frame by Frame
                    game.inputManager.keys['MobileUp'] = false;
                    game.inputManager.keys['MobileDown'] = false;
                    game.inputManager.keys['MobileLeft'] = false;
                    game.inputManager.keys['MobileRight'] = false;
                    game.inputManager.keys['MobileFire'] = false;
                    game.inputManager.keys['MobileBoost'] = false;
                    
                    // ✅ SAFETY: Also reset PC keys mapped to mobile to prevent stuck keys
                    if (isMobile) {
                        game.inputManager.keys['ShiftLeft'] = false;
                        game.inputManager.keys['Space'] = false;
                    }

                    // Apply Joystick (X Axis)
                    if (window.mobileState.x > threshold) game.inputManager.keys['MobileRight'] = true;
                    else if (window.mobileState.x < -threshold) game.inputManager.keys['MobileLeft'] = true;
                    
                    // Apply Joystick (Y Axis)
                    if (window.mobileState.y > threshold) game.inputManager.keys['MobileDown'] = true;
                    else if (window.mobileState.y < -threshold) game.inputManager.keys['MobileUp'] = true;

                    // Apply Buttons
                    if (window.mobileState.fire) {
                        game.inputManager.keys['MobileFire'] = true;
                        game.inputManager.keys['Space'] = true; // ✅ Trigger PC Fire Key
                    }
                    if (window.mobileState.boost) {
                        game.inputManager.keys['MobileBoost'] = true;
                        game.inputManager.keys['ShiftLeft'] = true; // ✅ Trigger PC Boost Key
                    }
                }

                game.playerController.update(dt);
                checkTerrainCollision();

                // Fire
                if (game.inputManager.getAction("fire")) {
                    if (now - lastFireTime > FIRE_DELAY) {
                        if (mpClient.isInRoom) {
                            mpClient.fire(game.playerController.mesh.position, game.playerController.mesh.quaternion);
                        }
                        lastFireTime = now;
                    }
                    if (now - lastSoundTime > SOUND_DELAY) {
                        if (sfx) sfx.playShoot();
                        lastSoundTime = now;
                    }
                }

                // Boost Audio
                if (game.inputManager.getAction("boost")) {
                    if (procAudio) procAudio.startBoost();
                } else {
                    if (procAudio) procAudio.stopBoost();
                }

                // Send Network Transform
                if (mpClient.isInRoom && game.playerController.mesh) {
                    mpClient.sendTransform(game.playerController.mesh.position, game.playerController.mesh.quaternion);
                }
            }

            // Respawn Logic
            if (game.playerController && game.playerController.health <= 0 && !game.playerController.isRespawning) {
                game.playerController.health = 0;
                game.playerController.isRespawning = true;
                game.playerController.respawnTimer = 3.9;
                game.playerController.mesh.visible = false;
                if (getUI()) getUI().showRespawn(4);
            }

            if (game.playerController?.isRespawning) {
                game.playerController.respawnTimer -= dt;
                if (getUI()) getUI().showRespawn(Math.ceil(game.playerController.respawnTimer));

                if (game.playerController.respawnTimer <= 0) {
                    game.playerController.isRespawning = false;
                    game.playerController.health = 100;
                    game.playerController.mesh.visible = true;
                    if (game.playerController.respawnInstant) game.playerController.respawnInstant();
                    else game.playerController.mesh.position.set(0, 400, 0);
                    if (getUI()) getUI().hideRespawn();
                }
                mpState.update(dt);
                game.renderer.render(game.scene, game.camera);
                return;
            }

            // Rings & Systems Update
            if (ringSystem && performance.now() > ringClaimBlockedUntil && game.playerController?.mesh) {
                ringSystem.update(dt, game.playerController.mesh);
            }

            weaponSystem.update(dt);
            bulletSystem.update(dt);
            hitDetection.update(dt);
            mpState.update(dt);

            // Minimap Update
            if (game.minimap && game.playerController?.mesh) {
                const enemies = mpState.getRemotePlayers().filter(p => p && p.mesh && p.mesh.visible).map(p => p.mesh);
                game.minimap.update(game.playerController.mesh, enemies, ringSystem?.rings || [], ringSystem?.currentIndex);
            }

            // HUD Update
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
    // START LOOP
    game.animate();
});
