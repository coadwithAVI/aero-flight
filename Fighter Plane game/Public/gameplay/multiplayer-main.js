// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - UI + AUDIO FIXED)
 *
 * Fixes:
 * ✅ Lobby paused: game won't start until host presses START
 * ✅ Uses mpUIBridge from multiplayer.html
 * ✅ Lobby music + Game music using ProceduralAudio
 * ✅ Audio unlock on user interaction supported
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

  // ✅ IMPORTANT: Multiplayer should start PAUSED until server says start
  game.isPaused = true;

  window.game = game;

  // Ensure UI exists
  if (!game.uiManager) game.uiManager = new UIManager();

  // ProceduralAudio (music)
  if (!game.procAudio && typeof ProceduralAudio !== "undefined") {
    game.procAudio = new ProceduralAudio();
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

      // try lobby music (will only work after unlock/click)
      game.procAudio?.playLobbyMusic?.();
    },

    onDisconnected: (reason) => {
      console.warn("❌ Disconnected:", reason);

      // back to lobby state
      game.isPaused = true;
      game.procAudio?.playLobbyMusic?.();

      safeUI()?.onDisconnected?.(reason || "disconnected");
    },

    onLobbyUpdate: (msg) => {
      // stay paused in lobby
      game.isPaused = true;

      // lobby music
      game.procAudio?.playLobbyMusic?.();

      safeUI()?.onLobbyUpdate?.(msg);
    },

    onGameStart: (msg) => {
      console.log("🎮 Game Start:", msg);

      // unpause gameplay
      game.isPaused = false;

      // switch music
      game.procAudio?.playGameMusic?.();

      // UI hide
      safeUI()?.onGameStart?.(msg);

      ensureSpawnLocalPlayer();
      ensureRingSystem(msg?.seed);
      showHUDOnly();
    },

    onGameOver: (msg) => {
      console.log("🏁 Game Over:", msg);

      // pause
      game.isPaused = true;

      // back to lobby music
      game.procAudio?.playLobbyMusic?.();

      safeUI()?.onGameOver?.(msg);
    },

    onError: (txt) => {
      console.warn("MP ERROR:", txt);
      safeUI()?.onError?.(txt);
    }
  });

  // ✅ expose globally for multiplayer.html UI buttons
  window.mpClient = mpClient;

  mpClient.connect();

  // ----------------------------------------------------------
  // 3) Systems for MP gameplay
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
  // 4) Rings system
  // ----------------------------------------------------------
  let ringSystem = null;
  let ringSeed = null;

  function ensureRingSystem(seed) {
    if (ringSystem) return;

    if (typeof RingSystem === "undefined") {
      console.warn("❌ RingSystem not loaded. Add ring-system.js in multiplayer.html");
      return;
    }

    ringSeed = seed ?? ringSeed ?? 12345;

    ringSystem = new RingSystem(game.scene, game.map?.terrainMesh, {
      ringCount: 8,
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

    if (game.procAudio) game.procAudio.stopBoost();
  }

  function processRespawn() {
    if (!respawnPending) return;
    if (performance.now() < respawnAt) return;

    respawnPending = false;

    if (!game.playerController) return;

    game.playerController.respawnInstant();
    game.playerController.health = 100;

    if (game.playerController.mesh) game.playerController.mesh.visible = true;
  }

  // ----------------------------------------------------------
  // 6) MP events handling (remote bullets)
  // ----------------------------------------------------------
  mpClient.onEvent = (evt) => {
    if (!evt || evt.type !== "FIRE") return;
    if (evt.ownerId === mpClient.clientId) return;

    const ent = mpState.players.get(evt.ownerId);
    if (!ent?.mesh) return;

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
  // 8) Ensure player exists in MP mode
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

    if (game.inputManager?.update) game.inputManager.update(dt);

    if (game.playerController) game.playerController.update(dt);

    processRespawn();

    if (ringSystem && game.playerController?.mesh) {
      ringSystem.update(dt, game.playerController.mesh);
    }

    weaponSystem.update(dt);
    bulletSystem.update(dt);

    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh);

      if (game.inputManager?.getAction("fire")) {
        mpClient.sendFire(game.playerController.mesh);
      }
    }

    mpState.update(dt);

    if (game.cameraSystem) game.cameraSystem.update(dt);

    if (game.minimap && game.playerController?.mesh) {
      game.minimap.update(
        game.playerController.mesh,
        mpState.getRemotePlayers().map((p) => p.mesh),
        ringSystem ? ringSystem.rings : [],
        ringSystem ? ringSystem.currentIndex : -1
      );
    }

    if (game.uiManager) {
      const hp = game.playerController ? (game.playerController.health ?? 100) : 100;
      const boost = game.playerController
        ? game.playerController.boostEnergy
        : (typeof PHYSICS_CONFIG !== "undefined" ? PHYSICS_CONFIG.boostMax : 100);

      game.uiManager.updateHealth(hp, 100);
      game.uiManager.updateBoost(boost, (typeof PHYSICS_CONFIG !== "undefined" ? (PHYSICS_CONFIG.boostMax ?? 100) : 100));
    }

    if (game.playerController && game.playerController.health <= 0 && !respawnPending) {
      triggerRespawn();
    }

    game.renderer.render(game.scene, game.camera);
  };

  console.log("✅ Multiplayer-main loaded: paused lobby + procedural music enabled.");
});
