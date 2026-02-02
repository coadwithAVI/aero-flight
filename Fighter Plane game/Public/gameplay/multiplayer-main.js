// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - COMPLETE FIX)
 *
 * Fixes Included:
 * ✅ Lobby Logic: Ignores lobby updates when game status is 'playing' (Fixes black screen after start).
 * ✅ Crash Fix: Uses correct 'fire' function and sends position/quaternion separately.
 * ✅ Fresh Match: Resets bullets, player, and rings on start.
 * ✅ Blink Fix: Delays ring claim slightly to prevent instant-win bugs.
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

  // ✅ Hide canvas initially (Lobby Mode)
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
      console.log("✅ Connected to server.");
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
      // ✅ CRITICAL FIX: Agar game 'playing' state mein hai, toh lobby update ignore karo.
      // Ye us bug ko rokta hai jahan game start hone ke turant baad screen black ho jati thi.
      if (msg.status === "playing") {
        return; 
      }

      // Normal Lobby Logic
      game.isPaused = true;
      gameStartedOnce = false;

      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";

      game.procAudio?.playLobbyMusic?.();
      safeUI()?.onLobbyUpdate?.(msg);
    },

    onGameStart: (msg) => {
      // ✅ Prevent duplicate start calls
      if (gameStartedOnce) {
        console.warn("⚠️ Duplicate mp_game_start ignored.");
        return;
      }
      gameStartedOnce = true;

      console.log("🎮 Game Start:", msg);

      // Show Canvas
      if (game.renderer?.domElement) {
        game.renderer.domElement.style.display = "block";
      }

      // Block ring claim briefly (prevent glitch)
      ringClaimBlockedUntil = performance.now() + 1400;

      // Reset everything for fresh match
      freshStartMatch(msg);

      // Unpause
      game.isPaused = false;

      // Music
      game.procAudio?.playGameMusic?.();

      // UI Update
      safeUI()?.onGameStart?.(msg);
      showHUDOnly();
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
  // 4) Rings
  // ----------------------------------------------------------
  let ringSystem = null;

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

    ringSystem = new RingSystem(game.scene, game.map?.terrainMesh, {
      ringCount: 8,
      terrainClearance: 30,
      seed: seed ?? 12345
    });

    if (typeof ringSystem.currentIndex === "number") ringSystem.currentIndex = 0;

    ringSystem.onRingClaim = (ringIndex) => {
      if (performance.now() < ringClaimBlockedUntil) return;
      if (!mpClient.roomId) return;
      mpClient.claimRing(ringIndex);
    };
  }

  // ----------------------------------------------------------
  // 5) Respawn system
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

  // ----------------------------------------------------------
  // 6) Ensure player exists & Reset Match
  // ----------------------------------------------------------
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

    // Reset Player
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

    // Reset Bullets
    bulletSystem.clearAll();

    // Reset Rings
    resetRingSystem(msg?.seed);

    respawnPending = false;
    respawnAt = 0;

    console.log("✅ Fresh match reset complete.");
  }

  // ----------------------------------------------------------
  // 7) HUD
  // ----------------------------------------------------------
  function showHUDOnly() {
    if (game.uiManager) game.uiManager.hidePause?.();
  }

  // ----------------------------------------------------------
  // 8) Game Loop (Corrected)
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

    if (ringSystem && game.playerController?.mesh) {
      if (performance.now() > ringClaimBlockedUntil) {
        ringSystem.update(dt, game.playerController.mesh);
      }
    }

    weaponSystem.update(dt);
    bulletSystem.update(dt);

    // ✅ FIXED: Crash Prevention Logic
    if (game.playerController?.mesh) {
      // 1. Send Transform (Arguments separated)
      mpClient.sendTransform(
        game.playerController.mesh.position, 
        game.playerController.mesh.quaternion
      );

      // 2. Fire (Correct function name + Arguments separated)
      if (game.inputManager?.getAction?.("fire")) {
        mpClient.fire(
          game.playerController.mesh.position,
          game.playerController.mesh.quaternion
        );
      }
    }

    mpState.update(dt);
    game.cameraSystem?.update?.(dt);
    game.renderer.render(game.scene, game.camera);
  };

  console.log("✅ Multiplayer-main loaded (Final Stable Version)");
});
