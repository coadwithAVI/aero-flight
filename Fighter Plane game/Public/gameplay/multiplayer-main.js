// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Mode Booting... (Fixed UI & Hits)");

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

  if (!game.procAudio && typeof ProceduralAudio !== "undefined") {
    game.procAudio = new ProceduralAudio();
  }

  // ✅ MOBILE CONTROLS
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

// ✅ FIXED: Incoming Events
    onEvent: (evt) => {
      if (!evt) return;

      // 1. SCORE / RINGS Update
      if (evt.type === "SCORE" && evt.msg) {
        if (mpClient.socket && evt.msg.id === mpClient.socket.id) {
          if (ringSystem && typeof evt.msg.rings === "number") {
             ringSystem.currentIndex = evt.msg.rings;
             ringSystem._setActiveRing(evt.msg.rings); 
          }
        }
      }

      // 2. HIT / DAMAGE Update
      if (evt.type === "HIT" || evt.type === "DAMAGE") {
        const myId = mpClient.socket?.id;

        // ✅ IMPORTANT: Data extract karo (Direct ya nested 'msg' mein)
        // Server kabhi {targetId: '...'} bhejta hai, kabhi {msg: {targetId: '...'}}
        const payload = evt.msg || evt; 
        const targetId = payload.targetId || payload.id;
        const damage = payload.damage || 10;

        // Agar targetId MERI hai -> Mujhe damage hua
        if (targetId && myId && targetId === myId) {
            console.log(`⚠️ I GOT HIT! Damage: ${damage}`);
            
            if (game.playerController) {
                // Health decrease
                game.playerController.health -= damage;
                
                // Dead check
                if (game.playerController.health <= 0) {
                    game.playerController.health = 0;
                    console.log("💀 PLAYER DESTROYED");
                    // Optional: Respawn logic here
                }

                // 🔥 UI UPDATE IMMEDIATELY
                if (game.uiManager) {
                    game.uiManager.update(
                        game.playerController.speed || 0,
                        game.playerController.health, // Updated HP
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
  // 3) Systems (Bullets, Weapons, HITS)
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

  // ✅ FIXED: Initialize Hit Detection (Missing in original)
  // Yeh check karega agar HUMARI goli ENEMY ko lagi
  const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, {
      hitRadius: 8.0, // Thoda bada radius hit connect hone ke liye
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

    // Terrain dhoondho
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
  // 5) Helpers: Spawn & Collision
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
      game.playerController.health = 100; // Reset HP
      if (game.playerController.respawnInstant) game.playerController.respawnInstant();
      game.playerController.mesh.visible = true;
    }

    bulletSystem.clearAll();
    resetRingSystem(msg?.seed);
  }

  function showHUDOnly() {
    if (game.uiManager) game.uiManager.hidePause?.();
  }

  // ✅ NEW: Simple Terrain Collision Check (Agar PlayerController mein miss ho)
  function checkTerrainCollision() {
      if (!game.playerController || !game.playerController.mesh) return;
      if (!game.map) return;

      const p = game.playerController.mesh.position;
      
      // Map se height lo (Example function name, adjust as per your Map logic)
      let groundH = 0;
      if (game.map.getAltitudeAt) {
          groundH = game.map.getAltitudeAt(p.x, p.z);
      } else if (game.map.terrainMesh) {
          // Fallback simple check agar getAltitudeAt nahi hai
          groundH = 10; // Base level
      }

      // Agar player ground ke andar hai
      if (p.y < groundH + 2) {
          // Crash logic
          if (game.playerController.health > 0) {
             console.log("💥 CRASH! Terrain Impact");
             game.playerController.health -= 2; // Damage per frame on impact
             
             // Bounce up slightly
             p.y = groundH + 3;
             // Slow down
             if (game.playerController.speed) game.playerController.speed *= 0.9;
          }
      }
  }
  // ✅ NEW: Raycaster setup for accurate collision
  const _terrainRaycaster = new THREE.Raycaster();
  const _downDir = new THREE.Vector3(0, -1, 0);

  function checkTerrainCollision() {
      if (!game.playerController || !game.playerController.mesh) return;
      
      // Terrain dhoondho
      let terrain = game.map?.terrainMesh;
      if (!terrain) {
          // Fallback: Scene mein dhoondho agar map mein nahi mila
          terrain = game.scene.getObjectByName("terrain") || game.scene.getObjectByName("Terrain");
      }

      if (!terrain) return; // Terrain hi nahi mila toh return

      const p = game.playerController.mesh.position;
      
      // 1. Raycast from sky downwards at player's X,Z
      // (Player ke upar se neeche laser maaro taaki exact zameen ki height mile)
      const rayOrigin = new THREE.Vector3(p.x, 2000, p.z);
      _terrainRaycaster.set(rayOrigin, _downDir);
      
      // Optimize: Raycaster ko sirf terrain check karne do
      const hits = _terrainRaycaster.intersectObject(terrain, true); // true = recursive check
      
      if (hits.length > 0) {
          const groundH = hits[0].point.y;
          
          // 2. Check collision (Player radius ~2-3 units maan ke)
          if (p.y < groundH + 3.5) {
              
              // 💥 CRASH LOGIC
              if (game.playerController.health > 0) {
                  // Damage (Time based taaki instant kill na ho, par heavy damage ho)
                  game.playerController.health -= 1.5; 
                  
                  // Console debug
                  // console.log("💥 CRASH! Terrain Height:", groundH, "Player Y:", p.y);
                  
                  // Force bounce UP (Taaki zameen ke andar na ghuse)
                  p.y = groundH + 5.0; 
                  
                  // Speed slow karo
                  if (game.playerController.speed > 0) {
                      game.playerController.speed *= 0.85;
                  }
                  
                  // Visual shake (Optional - agar camera system support kare)
                  if(game.cameraSystem) game.cameraSystem.addShake?.(0.5);
              }
          }
      }
  }

  // ----------------------------------------------------------
  // 6) GAME LOOP (The Fix)
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

    // 1. Inputs & Player
    game.inputManager?.update?.(dt);
    game.playerController?.update?.(dt);
    
    // 2. Extra Collision Check (Fix for "Health nahi ja rahi mountain pe")
    checkTerrainCollision();

    // 3. Rings
    if (ringSystem && game.playerController?.mesh) {
        if (performance.now() > ringClaimBlockedUntil) {
            ringSystem.update(dt, game.playerController.mesh);
        }
    }

    // 4. Weapons & Bullets
    weaponSystem.update(dt);
    bulletSystem.update(dt);
    
    // ✅ 5. Hit Detection Update (Fix for "Enemy fire not working")
    if (hitDetection) hitDetection.update(dt);

    // 6. Network Sync
    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh.position, game.playerController.mesh.quaternion);
      if (game.inputManager?.getAction?.("fire")) {
        mpClient.fire(game.playerController.mesh.position, game.playerController.mesh.quaternion);
      }
    }
    mpState.update(dt);

    // 7. Minimap
    if (game.minimap && game.playerController?.mesh) {
        const enemies = mpState.getRemotePlayers().map(p => p.mesh);
        const ringsRaw = ringSystem?.rings || [];
        game.minimap.update(game.playerController.mesh, enemies, ringsRaw, ringSystem?.currentIndex);
    }

    // ✅ 8. UI UPDATE (Fix for UI not updating)
    if (game.uiManager && game.playerController) {
        game.uiManager.update(
            game.playerController.speed || 0,
            game.playerController.health || 0,  // Pass HP
            game.playerController.score || 0,
            game.playerController.boostEnergy || 100 // Pass Boost
        );
    }

    // 9. Render
    game.cameraSystem?.update?.(dt);
    game.renderer.render(game.scene, game.camera);
  };
});
