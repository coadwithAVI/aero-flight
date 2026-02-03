// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Mode Booting... (Final v16 - Receiver Fixed)");

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeUI = () => window.mpUIBridge || null;

  // ----------------------------------------------------------
  // 1) Game Core Init
  // ----------------------------------------------------------
  const game = new GameManager();
  game.init();

  game.isPaused = true;
  game.isRunning = true;

  window.game = game;

  if (!game.uiManager) game.uiManager = new UIManager();

  if (game.procAudio && typeof ProceduralAudio !== "undefined") {
    game.procAudio = new ProceduralAudio();
  }

  // Mobile Controls
  if (typeof MobileControls !== "undefined") {
    game.mobileControls = new MobileControls(game.inputManager);
  }

  if (game.renderer?.domElement) {
    game.renderer.domElement.style.display = "none";
  }

  // ----------------------------------------------------------
  // 2) Multiplayer state + client
  // ----------------------------------------------------------
  const mpState = new MPState(game.scene, {
    modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
    debug: false
  });

  let gameStartedOnce = false;
  let ringClaimBlockedUntil = 0;

  const mpClient = new MPClient({
    mpState,
    game,
    debug: true,

    onConnected: () => {
      console.log("✅ Connected. ID:", mpClient.socket.id);
      if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
      safeUI()?.onConnected?.();
    },

    onDisconnected: (reason) => {
      console.warn("❌ Disconnected:", reason);
      game.isPaused = true;
      safeUI()?.onDisconnected?.(reason);
    },

    onLobbyUpdate: (msg) => {
      if (msg.status === "playing") return;
      if (msg.you?.id) mpState.setLocalId(msg.you.id);
      game.isPaused = true;
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
      safeUI()?.onLobbyUpdate?.(msg);
    },

    onGameStart: (msg) => {
      if (gameStartedOnce) return;
      gameStartedOnce = true;
      console.log("🎮 Game Start");

      if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
      ringClaimBlockedUntil = performance.now() + 1400;
      
      freshStartMatch(msg);
      game.isPaused = false;
      safeUI()?.onGameStart?.(msg);
      showHUDOnly();
    },

    // --------------------------------------------------------
    // ✅ ADD THIS BLOCK (Fix for Victory/Defeat Screen)
    // --------------------------------------------------------
    onState: (snapshot) => {
       // This checks if we met win conditions every time server sends data (20 times/sec)
       if (window.mpVictory) {
           window.mpVictory.tryRingWinFromSnapshot(snapshot);
           window.mpVictory.tryLastPlayerWinFromSnapshot(snapshot);
       }
    },

// ✅ FIXED & CLEANED: No Console Spam
    onEvent: (evt) => {
      // LOG REMOVED: console.log("📨 PACKET RECVD:", evt.type, evt);

      if (!evt) return;

      const socket = window.mpClient?.socket; 
      const myId = socket?.id;

      // 1. SCORE Update
      if (evt.type === "SCORE" && evt.msg) {
        if (socket && evt.msg.id === socket.id) {
          if (ringSystem && typeof evt.msg.rings === "number") {
             ringSystem.currentIndex = evt.msg.rings;
             ringSystem._setActiveRing(evt.msg.rings); 
          }
        }
      }

      // 2. HIT / DAMAGE Update
      if (evt.type === "HIT" || evt.type === "DAMAGE") {
        
        const payload = evt.msg || evt; 
        const targetId = payload.targetId || payload.id || payload.victimId;
        const damage = payload.damage || 10;
        
        // Agar MAIN hi Target hu
        if (targetId && myId && String(targetId) === String(myId)) {
            
            // LOG OPTIONAL: Rakha hai taaki hit pata chale, agar ye bhi hatana hai to hata dena
            // console.log(`🩸 I WAS HIT! Damage: ${damage}`);

            if (game.playerController && game.playerController.isRespawning) {
                return;
            }

            if (game.playerController) {
                game.playerController.health -= damage;
                
                if (game.cameraSystem?.addShake) game.cameraSystem.addShake(0.8);
                
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

    onGameOver: (msg) => {
      game.isPaused = true;
      gameStartedOnce = false;
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
      safeUI()?.onGameOver?.(msg);
    }
  });

  window.mpClient = mpClient;
  mpClient.connect();

  // ----------------------------------------------------------
  // 3) Systems
  // ----------------------------------------------------------
  const bulletSystem = new BulletSystem(game.scene);

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
      getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
    }
  );

  // ✅ HIT DETECTION (Client side sender)
  // Ensure we pass mpClient correctly
  const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, {
      hitRadius: 24.0, 
      damage: 15
  });

  // ----------------------------------------------------------
  // 4) Rings & Minimap
  // ----------------------------------------------------------
  let ringSystem = null;

  if (typeof MinimapSystem !== "undefined" && !game.minimap) {
    game.minimap = new MinimapSystem(game);
  }

  function destroyRingSystem() {
    try {
      if (ringSystem?.rings) {
        ringSystem.rings.forEach(r => { if (r?.mesh?.parent) r.mesh.parent.remove(r.mesh); });
      }
    } catch (e) {}
    ringSystem = null;
  }

  function resetRingSystem(seed) {
    destroyRingSystem();
    if (typeof RingSystem === "undefined") return;

    let terrain = game.map?.terrainMesh;
    if (!terrain) {
        game.scene.traverse(o => { if (o.name === "Terrain") terrain = o; });
    }

    if (terrain) {
        ringSystem = new RingSystem(game.scene, terrain, { seed: seed ?? 12345 });
        ringSystem.currentIndex = 0;
        if(ringSystem._setActiveRing) ringSystem._setActiveRing(0);
        
        ringSystem.onRingClaim = (idx) => {
            if (performance.now() > ringClaimBlockedUntil && mpClient.roomId) {
                mpClient.claimRing(idx);
            }
        };
    }
  }

  // ----------------------------------------------------------
  // 5) Helpers
  // ----------------------------------------------------------
  function ensureSpawnLocalPlayer() {
    if (typeof PlayerController !== "undefined" && !game.playerController) {
        game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
        if (game.map?.terrainMesh) game.playerController.setTerrainMesh(game.map.terrainMesh);
        
        // Link weapon system
        weaponSystem.player = game.playerController;
        
        if (!game.cameraSystem) game.cameraSystem = new CameraSystem(game.camera);
        game.cameraSystem.setTarget(game.playerController);
    }
  }

  function freshStartMatch(msg) {
    ensureSpawnLocalPlayer();
    if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);

    if (game.playerController) {
      game.playerController.health = 100;
      game.playerController.isRespawning = false;
      if (game.playerController.respawnInstant) game.playerController.respawnInstant();
      game.playerController.mesh.visible = true;
    }

    bulletSystem.clearAll();
    resetRingSystem(msg?.seed);
    safeUI()?.hideRespawn?.();
  }

  function showHUDOnly() {
    if (game.uiManager) game.uiManager.hidePause?.();
  }

  // ✅ RAYCASTER TERRAIN COLLISION
  const _terrainRaycaster = new THREE.Raycaster();
  const _downDir = new THREE.Vector3(0, -1, 0);

  function checkTerrainCollision() {
      if (!game.playerController || !game.playerController.mesh) return;
      if (game.playerController.isRespawning) return; 

      let terrain = game.map?.terrainMesh || game.scene.getObjectByName("Terrain");
      if (!terrain) return;

      const p = game.playerController.mesh.position;
      
      const rayOrigin = new THREE.Vector3(p.x, 2000, p.z);
      _terrainRaycaster.set(rayOrigin, _downDir);
      
      const hits = _terrainRaycaster.intersectObject(terrain, true);
      
      if (hits.length > 0) {
          const groundH = hits[0].point.y;
          
          if (p.y < groundH + 3.5) {
              if (game.playerController.health > 0) {
                  const dmg = 1.5;
                  game.playerController.health -= dmg; 
                  
                  // Force bounce UP
                  p.y = groundH + 5.0; 
                  if (game.playerController.speed) game.playerController.speed *= 0.85;
                  
                  if(game.cameraSystem?.addShake) game.cameraSystem.addShake(0.5);

                  // Update UI on terrain hit
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

  // ----------------------------------------------------------
  // 6) GAME LOOP
  // ----------------------------------------------------------
  game.animate = function () {
    if (!game.isRunning) return;
    requestAnimationFrame(game.animate);

    if (game.isPaused) {
      if (game.renderer?.domElement?.style.display !== "none") {
        game.renderer.render(game.scene, game.camera);
      }
      return;
    }

    const dt = clamp(game.clock.getDelta(), 0.0, 0.05);

    // 1. Inputs
    if (!game.playerController?.isRespawning) {
        game.inputManager?.update?.(dt);
        game.playerController?.update?.(dt);
        checkTerrainCollision(); 
    }

    // 2. DEATH MONITOR
    if (game.playerController && game.playerController.health <= 0) {
        if (!game.playerController.isRespawning) {
            game.playerController.health = 0;
            game.playerController.isRespawning = true;
            game.playerController.respawnTimer = 3.9;

            console.log("💀 PILOT DOWN. Respawn Sequence...");

            if (game.playerController.mesh) game.playerController.mesh.visible = false;
            
            if (game.playerController.rb) {
                game.playerController.rb.velocity.set(0,0,0);
                game.playerController.rb.angularVelocity.set(0,0,0);
            }

            // Force UI update to show 0 HP
            if (game.uiManager) game.uiManager.update(0, 0, game.playerController.score||0, 100);
        }
    }

    // 3. RESPAWN PHASE
    if (game.playerController?.isRespawning) {
        game.playerController.respawnTimer -= dt;
        
        const ui = safeUI();
        if (ui && ui.showRespawn) {
            let timeLeft = Math.ceil(game.playerController.respawnTimer);
            if (timeLeft < 1) timeLeft = 1;
            ui.showRespawn(timeLeft);
        }

        if (game.playerController.respawnTimer <= 0) {
             game.playerController.isRespawning = false;
             game.playerController.health = 100;
             
             if (game.playerController.respawnInstant) {
                 game.playerController.respawnInstant();
             } else {
                 game.playerController.mesh.position.set(0, 400, 0);
                 game.playerController.mesh.rotation.set(0, 0, 0);
             }
             
             game.playerController.mesh.visible = true;
             
             if (ui && ui.hideRespawn) ui.hideRespawn();
             if (game.uiManager) game.uiManager.update(0, 100, game.playerController.score || 0, 100);
             
             console.log("✅ RESPAWNED.");
        }

        mpState.update(dt);
        game.renderer.render(game.scene, game.camera);
        return; 
    }

    // 4. Rings
    if (ringSystem && game.playerController?.mesh) {
        if (performance.now() > ringClaimBlockedUntil) {
            ringSystem.update(dt, game.playerController.mesh);
        }
    }

    // 5. Weapons
    weaponSystem.update(dt);
    bulletSystem.update(dt);
    
    // 6. Hit Detection
    if (hitDetection) hitDetection.update(dt);

    // 7. Network Sync
    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh.position, game.playerController.mesh.quaternion);
      if (game.inputManager?.getAction?.("fire")) {
        mpClient.fire(game.playerController.mesh.position, game.playerController.mesh.quaternion);
      }
    }
    mpState.update(dt);

    // 8. Minimap
    if (game.minimap && game.playerController?.mesh) {
        const enemies = mpState.getRemotePlayers().map(p => p.mesh);
        const ringsRaw = ringSystem?.rings || [];
        game.minimap.update(game.playerController.mesh, enemies, ringsRaw, ringSystem?.currentIndex);
    }

    // 9. UI UPDATE (Routine)
    if (game.uiManager && game.playerController) {
        game.uiManager.update(
            game.playerController.speed || 0,
            game.playerController.health, 
            game.playerController.score || 0,
            game.playerController.boostEnergy || 100
        );
    }

    // 10. Render
    game.cameraSystem?.update?.(dt);
    game.renderer.render(game.scene, game.camera);
  };
});
