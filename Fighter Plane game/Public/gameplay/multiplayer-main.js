// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - FIXED FOR HTML UI)
 *
 * Fixes:
 * ✅ window.mpClient assigned (MPClient not ready bug fixed)
 * ✅ No duplicate injected lobby UI
 * ✅ Uses multiplayer.html mpUIBridge hooks
 * ✅ Lobby UI controlled only by multiplayer.html
 */

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Mode Booting...");

  // ----------------------------------------------------------
  // 0) Helpers
  // ----------------------------------------------------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeUI = () => window.mpUIBridge || null;

  // ----------------------------------------------------------
  // 1) Game Core Init
  // ----------------------------------------------------------
  const game = new GameManager();
  game.init();
  window.game = game;

  // Ensure UI exists
  if (!game.uiManager) game.uiManager = new UIManager();

  // Audio optional
  if (!game.procAudio && typeof ProceduralAudio !== "undefined") {
    game.procAudio = new ProceduralAudio();
    window.addEventListener(
      "click",
      async () => {
        if (game.procAudio) await game.procAudio.unlock();
      },
      { once: true }
    );
  }

  // ----------------------------------------------------------
  // 2) Multiplayer state + client
  // ----------------------------------------------------------
  const mpState = new MPState(game.scene, {
    modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
    debug: false
  });

  const mpClient = new MPClient({
    mpState,
    game,
    debug: true,

    onConnected: () => {
      console.log("✅ Connected to server.");
      safeUI()?.onConnected?.();
    },

    onDisconnected: (reason) => {
      console.warn("❌ Disconnected:", reason);
      safeUI()?.onDisconnected?.(reason || "disconnected");
    },

    onLobbyUpdate: (msg) => {
      // msg: {type, roomId, players, hostId, seed, isHost}
      safeUI()?.onLobbyUpdate?.(msg);
    },

    onGameStart: (msg) => {
      console.log("🎮 Game Start:", msg);
      game.isPaused = false;

      safeUI()?.onGameStart?.(msg);

      ensureSpawnLocalPlayer();
      ensureRingSystem(msg?.seed);
      showHUDOnly();
    },

    onGameOver: (msg) => {
      console.log("🏁 Game Over:", msg);
      safeUI()?.onGameOver?.(msg);

      // also pause local game loop
      game.isPaused = true;
    },

    onError: (txt) => {
      console.warn("MP ERROR:", txt);
      safeUI()?.onError?.(txt);
    }
  });

  // ✅ IMPORTANT: expose client globally for multiplayer.html UI
  window.mpClient = mpClient;

  // Connect now
  mpClient.connect();

  // ----------------------------------------------------------
  // 3) Systems for MP gameplay
  // ----------------------------------------------------------
  const bulletSystem = new BulletSystem(game.scene);

  const weaponSystem = new WeaponSystem(
    game.playerController, // will be set after spawn
    bulletSystem,
    game.inputManager,
    game.sfx,
    {
      fireRate: 14,
      spread: 0.01,
      camera: game.camera,
      screenAimAssist: true,
      screenAimRadius: 0.75,     // wider angle assist
      screenAimStrength: 0.9,    // strong assist
      getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
    }
  );

  // Map + terrain injection
  if (game.playerController && game.map?.terrainMesh) {
    game.playerController.setTerrainMesh(game.map.terrainMesh);
  }

  // ----------------------------------------------------------
  // 4) Rings (sequential + seeded)
  // ----------------------------------------------------------
  let ringSystem = null;
  let ringSeed = null;

  function ensureRingSystem(seed) {
    if (ringSystem) return;

    ringSeed = seed ?? ringSeed ?? 12345;

    // RingSystem should exist globally in your build
    ringSystem = new RingSystem(game.scene, game.map?.terrainMesh, {
      ringCount: 8,              // 2 laps * 4 rings
      terrainClearance: 30,
      seed: ringSeed
    });

    ringSystem.onRingClaim = (ringIndex) => {
      if (!mpClient.roomId) return;
      mpClient.claimRing(ringIndex);
    };
  }

  // ----------------------------------------------------------
  // 5) Respawn system
  // ----------------------------------------------------------
  let respawnPending = false;
  let respawnAt = 0;

  function triggerRespawn() {
    if (!game.playerController) return;

    respawnPending = true;
    respawnAt = performance.now() + 3000;

    game.playerController.health = 0;
    if (game.playerController.mesh) game.playerController.mesh.visible = false;

    // stop boost noise
    if (game.procAudio) game.procAudio.stopBoost();
  }

  function processRespawn() {
    if (!respawnPending) return;
    if (performance.now() < respawnAt) return;

    respawnPending = false;

    if (!game.playerController) return;

    // Respawn at safe start
    game.playerController.respawnInstant();

    // Full hp
    game.playerController.health = 100;

    // Visible
    if (game.playerController.mesh) game.playerController.mesh.visible = true;
  }

  // ----------------------------------------------------------
  // 6) MP events handling (remote bullets smooth)
  // ----------------------------------------------------------
  mpClient.onEvent = (evt) => {
    if (!evt || evt.type !== "FIRE") return;

    // do not spawn for self (local already fires)
    if (evt.ownerId === mpClient.clientId) return;

    const ent = mpState.players.get(evt.ownerId);
    if (!ent?.mesh) return;

    // spawn remote bullet locally (visual only)
    const p = ent.mesh.position.clone();
    const q = ent.mesh.quaternion.clone();
    bulletSystem.fire(p, q);
  };

  // ----------------------------------------------------------
  // 7) HUD control
  // ----------------------------------------------------------
  function showHUDOnly() {
    if (game.uiManager) game.uiManager.hidePause();
  }

  // ----------------------------------------------------------
  // 8) Ensure player exists for MP mode
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

  // ----------------------------------------------------------
  // 9) Patch game loop for Multiplayer
  // ----------------------------------------------------------
  game.animate = function () {
    if (!game.isRunning) return;
    requestAnimationFrame(game.animate.bind(game));

    if (game.isPaused) {
      game.renderer.render(game.scene, game.camera);
      return;
    }

    const dt = clamp(game.clock.getDelta(), 0.0, 0.05);

    // input
    if (game.inputManager?.update) game.inputManager.update(dt);

    // local player update
    if (game.playerController) game.playerController.update(dt);

    // respawn processing
    processRespawn();

    // rings update
    if (ringSystem && game.playerController?.mesh) {
      ringSystem.update(dt, game.playerController.mesh);
    }

    // bullets
    weaponSystem.update(dt);
    bulletSystem.update(dt);

    // send transform + fire (server authoritative event)
    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh);

      if (game.inputManager?.getAction("fire")) {
        mpClient.sendFire(game.playerController.mesh);
      }
    }

    // smooth remote players
    mpState.update(dt);

    // camera
    if (game.cameraSystem) game.cameraSystem.update(dt);

    // minimap
    if (game.minimap && game.playerController?.mesh) {
      game.minimap.update(
        game.playerController.mesh,
        mpState.getRemotePlayers().map((p) => p.mesh),
        ringSystem ? ringSystem.rings : [],
        ringSystem ? ringSystem.currentIndex : -1
      );
    }

    // UI update
    if (game.uiManager) {
      const hp = game.playerController ? (game.playerController.health ?? 100) : 100;
      const boost = game.playerController
        ? game.playerController.boostEnergy
        : (typeof PHYSICS_CONFIG !== "undefined" ? PHYSICS_CONFIG.boostMax : 100);

      game.uiManager.updateHealth(hp, 100);
      game.uiManager.updateBoost(boost, (typeof PHYSICS_CONFIG !== "undefined" ? (PHYSICS_CONFIG.boostMax ?? 100) : 100));
    }

    // death check -> respawn delay
    if (game.playerController && game.playerController.health <= 0 && !respawnPending) {
      triggerRespawn();
    }

    // render
    game.renderer.render(game.scene, game.camera);
  };

  console.log("✅ Multiplayer-main loaded. UI bridge enabled.");
});
