// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - GREEN RINGS FIX)
 *
 * Fixes Included:
 * ✅ Active Ring Sync: Listens to server 'SCORE' events to update RingSystem.currentIndex (Fixes Green Color).
 * ✅ Rings Visibility: Robust Terrain search to ensure rings spawn correctly.
 * ✅ Minimap Fix: Passes correct mesh to minimap.
 * ✅ Identity Fix: Prevents "Ghost Enemy" bug.
 */

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Mode Booting...");

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

  // Hide canvas initially (Lobby Mode)
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

  // Flags
  let gameStartedOnce = false;
  let ringClaimBlockedUntil = 0;

  const mpClient = new MPClient({
    mpState,
    game,
    debug: true,

    onConnected: () => {
      console.log("✅ Connected to server. ID:", mpClient.socket.id);
      
      // Identity Set
      if (mpClient.socket && mpClient.socket.id) {
        mpState.setLocalId(mpClient.socket.id);
      }

      safeUI()?.onConnected?.();
      game.procAudio?.playLobbyMusic?.();
    },

    onDisconnected: (reason) => {
      console.warn("❌ Disconnected:", reason);
      game.isPaused = true;
      gameStartedOnce = false;
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
      game.procAudio?.playLobbyMusic?.();
      safeUI()?.onDisconnected?.(reason || "disconnected");
    },

    onLobbyUpdate: (msg) => {
      if (msg.status === "playing") return;

      if (msg.you && msg.you.id) {
        mpState.setLocalId(msg.you.id);
      }

      game.isPaused = true;
      gameStartedOnce = false;
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
      game.procAudio?.playLobbyMusic?.();
      safeUI()?.onLobbyUpdate?.(msg);
    },

    onGameStart: (msg) => {
      if (gameStartedOnce) return;
      gameStartedOnce = true;

      console.log("🎮 Game Start:", msg);

      if (game.renderer?.domElement) {
        game.renderer.domElement.style.display = "block";
      }

      ringClaimBlockedUntil = performance.now() + 1400;

      freshStartMatch(msg);

      game.isPaused = false;
      game.procAudio?.playGameMusic?.();
      safeUI()?.onGameStart?.(msg);
      showHUDOnly();
    },

    // ✅ NEW: Event Listener for Score/Rings Sync
    onEvent: (evt) => {
      if (!evt) return;

      // Sync Rings Color/Index when server confirms score
      if (evt.type === "SCORE" && evt.msg) {
        // If this update is for ME
        if (mpClient.socket && evt.msg.id === mpClient.socket.id) {
          if (ringSystem && typeof evt.msg.rings === "number") {
             // Force visual system to match server count (This makes the next ring Green)
             ringSystem.currentIndex = evt.msg.rings;
          }
        }
      }
    },

    onGameOver: (msg) => {
      console.warn("🏁 Game Over received:", msg);
      game.isPaused = true;
      gameStartedOnce = false;
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
      game.procAudio?.playLobbyMusic?.();
      safeUI()?.onGameOver?.(msg);
    },

    onError: (txt) => {
      console.warn("MP ERROR:", txt);
      safeUI()?.onError?.(txt);
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
      screenAimRadius: 0.75,
      screenAimStrength: 0.90,
      getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
    }
  );

  if (game.playerController && game.map?.terrainMesh) {
    game.playerController.setTerrainMesh(game.map.terrainMesh);
  }

  // ----------------------------------------------------------
  // 4) Rings & Minimap Setup
  // ----------------------------------------------------------
  let ringSystem = null;

  if (typeof MinimapSystem !== "undefined" && !game.minimap) {
    game.minimap = new MinimapSystem(game);
  }

  function destroyRingSystem() {
    try {
      if (ringSystem?.rings?.length) {
        ringSystem.rings.forEach(r => {
          if (r?.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh);
        });
      }
    } catch (e) {}
    ringSystem = null;
  }

  function resetRingSystem(seed) {
    destroyRingSystem();

    if (typeof RingSystem === "undefined") {
      console.warn("❌ RingSystem not loaded.");
      return;
    }

    // Robust Terrain Search
    let terrain = game.map?.terrainMesh;
    if (!terrain) {
        game.scene.traverse(obj => {
            if (obj.isMesh && (obj.name === "Terrain" || obj.name === "Ground" || (obj.geometry?.type === "PlaneGeometry" && obj.scale.x > 100))) {
                terrain = obj;
            }
        });
    }

    ringSystem = new RingSystem(game.scene, terrain, {
      ringCount: 8,
      terrainClearance: 30,
      seed: seed ?? 12345
    });

    console.log(`💍 RingSystem Initialized. Count: ${ringSystem.rings?.length || 0}`);

    // ✅ Explicitly set index to 0 at start
    if (typeof ringSystem.currentIndex === "number") {
        ringSystem.currentIndex = 0;
    }

    ringSystem.onRingClaim = (ringIndex) => {
      if (performance.now() < ringClaimBlockedUntil) return;
      if (!mpClient.roomId) return;
      
      // Local prediction (optional): instantly update color before server confirms
      // ringSystem.currentIndex = ringIndex + 1; 

      mpClient.claimRing(ringIndex);
    };
  }

  // ----------------------------------------------------------
  // 5) Respawn & Match Logic
  // ----------------------------------------------------------
  let respawnPending = false;
  let respawnAt = 0;

  function processRespawn() {
    if (!respawnPending) return;
    if (performance.now() < respawnAt) return;

    respawnPending = false;
    if (!game.playerController) return;

    game.playerController.respawnInstant?.();
    game.playerController.health = 100;
    if (game.playerController.mesh) game.playerController.mesh.visible = true;
  }

  function ensureSpawnLocalPlayer() {
    if (game.playerController && game.playerController.mesh) {
      weaponSystem.player = game.playerController;
      return;
    }
    if (typeof PlayerController !== "undefined") {
      game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
      weaponSystem.player = game.playerController;
      if (game.map?.terrainMesh) game.playerController.setTerrainMesh(game.map.terrainMesh);
      if (!game.cameraSystem) game.cameraSystem = new CameraSystem(game.camera);
      game.cameraSystem.setTarget(game.playerController);
    }
  }

  function freshStartMatch(msg) {
    ensureSpawnLocalPlayer();

    if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);

    if (game.playerController) {
      game.playerController.health = 100;
      if (typeof game.playerController.respawnInstant === "function") {
        game.playerController.respawnInstant();
      } else if (game.playerController.mesh) {
        game.playerController.mesh.position.set(0, 250, 0);
        game.playerController.mesh.quaternion.set(0, 0, 0, 1);
      }
      if (game.playerController.mesh) game.playerController.mesh.visible = true;
    }

    bulletSystem.clearAll();
    resetRingSystem(msg?.seed);
    respawnPending = false;
    respawnAt = 0;
  }

  function showHUDOnly() {
    if (game.uiManager) game.uiManager.hidePause?.();
  }

  // ----------------------------------------------------------
  // 8) Game Loop
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

    game.inputManager?.update?.(dt);
    game.playerController?.update?.(dt);
    processRespawn();

    // Rings Update
    if (ringSystem && game.playerController?.mesh) {
      if (performance.now() > ringClaimBlockedUntil) {
        ringSystem.update(dt, game.playerController.mesh);
      }
    }

    weaponSystem.update(dt);
    bulletSystem.update(dt);

    // Network Send
    if (game.playerController?.mesh) {
      mpClient.sendTransform(
        game.playerController.mesh.position, 
        game.playerController.mesh.quaternion
      );

      if (game.inputManager?.getAction?.("fire")) {
        mpClient.fire(
          game.playerController.mesh.position,
          game.playerController.mesh.quaternion
        );
      }
    }

    mpState.update(dt);

    // Minimap Update
    if (game.minimap && game.playerController?.mesh) {
        const enemies = mpState.getRemotePlayers().map(p => p.mesh);
        
        // Safety check for rings array
        const rings = (ringSystem && Array.isArray(ringSystem.rings)) 
            ? ringSystem.rings.map(r => r.mesh).filter(m => m && m.visible) 
            : [];
        
        game.minimap.update(game.playerController.mesh, enemies, rings);
    }

    game.cameraSystem?.update?.(dt);
    game.renderer.render(game.scene, game.camera);
  };

  console.log("✅ Multiplayer-main loaded (Final: Green Rings Sync Active)");
});
