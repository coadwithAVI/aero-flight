// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - Lobby BG + Fresh Start)
 *
 * Fixes:
 * ✅ Lobby paused: game won't start until host presses START
 * ✅ Lobby me canvas/game view hidden (no world behind UI)
 * ✅ START pressed -> fresh match reset
 * ✅ Lobby music + Game music using ProceduralAudio
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

  // ✅ Multiplayer should start PAUSED until server says start
  game.isPaused = true;
  game.isRunning = true;

  window.game = game;

  // Ensure UI exists
  if (!game.uiManager) game.uiManager = new UIManager();

  // ProceduralAudio (music)
  if (!game.procAudio && typeof ProceduralAudio !== "undefined") {
    game.procAudio = new ProceduralAudio();
  }

  // ✅ IMPORTANT FIX: Lobby me game canvas hide (so no world visible behind UI)
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

      // hide gameplay canvas again
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";

      game.procAudio?.playLobbyMusic?.();
      safeUI()?.onDisconnected?.(reason || "disconnected");
    },

    onLobbyUpdate: (msg) => {
      // stay paused in lobby
      game.isPaused = true;

      // hide canvas in lobby
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";

      game.procAudio?.playLobbyMusic?.();
      safeUI()?.onLobbyUpdate?.(msg);
    },

    onGameStart: (msg) => {
      console.log("🎮 Game Start:", msg);

      // show canvas now
      if (game.renderer?.domElement) {
        game.renderer.domElement.style.display = "block";
      }

      // ✅ Reset / fresh match
      freshStartMatch(msg);

      // unpause gameplay
      game.isPaused = false;

      // music
      game.procAudio?.playGameMusic?.();

      // UI hide
      safeUI()?.onGameStart?.(msg);

      showHUDOnly();
    },

    onGameOver: (msg) => {
      console.log("🏁 Game Over:", msg);

      game.isPaused = true;

      // hide canvas for lobby/end
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";

      game.procAudio?.playLobbyMusic?.();

      safeUI()?.onGameOver?.(msg);
    },

    onError: (txt) => {
      console.warn("MP ERROR:", txt);
      safeUI()?.onError?.(txt);
    }
  });

  // expose globally for multiplayer.html UI buttons
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

  function resetRingSystem(seed) {
    // destroy old rings
    try {
      if (ringSystem?.rings?.length) {
        ringSystem.rings.forEach(r => {
          if (r?.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh);
        });
      }
    } catch (e) {}

    ringSystem = null;

    if (typeof RingSystem === "undefined") {
      console.warn("❌ RingSystem not loaded. Add ring-system.js in multiplayer.html");
      return;
    }

    ringSeed = seed ?? 12345;

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
  // 6) Ensure player exists in MP mode
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
  // ✅ FRESH START MATCH RESET (MAIN FIX)
  // ----------------------------------------------------------
  function freshStartMatch(msg) {
    // spawn player controller
    ensureSpawnLocalPlayer();

    // reset player stats/position
    if (game.playerController) {
      game.playerController.health = 100;
      game.playerController.boostEnergy = (game.playerController.boostEnergy ?? 100);

      if (typeof game.playerController.respawnInstant === "function") {
        game.playerController.respawnInstant();
      } else if (game.playerController.mesh) {
        game.playerController.mesh.position.set(0, 250, 0);
        game.playerController.mesh.quaternion.set(0, 0, 0, 1);
      }

      if (game.playerController.mesh) game.playerController.mesh.visible = true;
    }

    // clear bullets
    bulletSystem.clearAll();

    // reset rings (fresh)
    resetRingSystem(msg?.seed);

    // reset respawn flags
    respawnPending = false;
    respawnAt = 0;

    // hide pause UI if any
    if (game.uiManager) game.uiManager.hidePause();

    console.log("✅ Fresh match reset done.");
  }

  // ----------------------------------------------------------
  // 7) HUD control
  // ----------------------------------------------------------
  function showHUDOnly() {
    if (game.uiManager) game.uiManager.hidePause();
  }

  // ----------------------------------------------------------
  // 8) Patch game loop for Multiplayer
  // ----------------------------------------------------------
  game.animate = function () {
    if (!game.isRunning) return;
    requestAnimationFrame(game.animate.bind(game));

    // even paused: render (but canvas is hidden in lobby anyway)
    if (game.isPaused) {
      if (game.renderer?.domElement?.style.display !== "none") {
        game.renderer.render(game.scene, game.camera);
      }
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
      const boost = game.playerController ? (game.playerController.boostEnergy ?? 100) : 100;

      game.uiManager.updateHealth(hp, 100);
      game.uiManager.updateBoost(boost, 100);
    }

    if (game.playerController && game.playerController.health <= 0 && !respawnPending) {
      triggerRespawn();
    }

    game.renderer.render(game.scene, game.camera);
  };

  console.log("✅ Multiplayer-main loaded: canvas hidden in lobby + fresh start enabled.");
});
