// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - Blink Fix + Fresh Match)
 *
 * Fixes:
 * ✅ Lobby paused (no gameplay until host START)
 * ✅ Canvas hidden in lobby (no world behind UI)
 * ✅ START spam protection (no double start)
 * ✅ Fresh match reset (player, bullets, rings)
 * ✅ Ring claim delay (prevents instant win -> blink -> back to lobby)
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

  // ✅ hide canvas in lobby
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

  // ✅ important: prevent start spam
  let gameStartedOnce = false;

  // ✅ prevent ring instant claim (blink fix)
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
      // stay paused in lobby
      game.isPaused = true;
      gameStartedOnce = false;

      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";

      game.procAudio?.playLobbyMusic?.();
      safeUI()?.onLobbyUpdate?.(msg);
    },

    onGameStart: (msg) => {
      // ✅ ignore duplicate mp_game_start
      if (gameStartedOnce) {
        console.warn("⚠️ Duplicate mp_game_start ignored.");
        return;
      }
      gameStartedOnce = true;

      console.log("🎮 Game Start:", msg);

      // show canvas now
      if (game.renderer?.domElement) {
        game.renderer.domElement.style.display = "block";
      }

      // ✅ block ring claim for first second (blink fix)
      ringClaimBlockedUntil = performance.now() + 1400;

      // fresh start reset
      freshStartMatch(msg);

      // unpause gameplay
      game.isPaused = false;

      // music
      game.procAudio?.playGameMusic?.();

      safeUI()?.onGameStart?.(msg);
      showHUDOnly();
    },

    onGameOver: (msg) => {
      console.warn("🏁 Game Over received:", msg);

      game.isPaused = true;
      gameStartedOnce = false;

      // hide canvas again
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

    // ✅ IMPORTANT: reset index if exists
    if (typeof ringSystem.currentIndex === "number") ringSystem.currentIndex = 0;

    ringSystem.onRingClaim = (ringIndex) => {
      // ✅ extra safety: do not claim during block window
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

    game.playerController.respawnInstant?.();
    game.playerController.health = 100;

    if (game.playerController.mesh) game.playerController.mesh.visible = true;
  }

  // ----------------------------------------------------------
  // 6) Ensure player exists
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
  // ✅ Fresh Start Reset
  // ----------------------------------------------------------
  function freshStartMatch(msg) {
    ensureSpawnLocalPlayer();

    // reset player
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

    // clear bullets
    bulletSystem.clearAll();

    // reset rings with new seed
    resetRingSystem(msg?.seed);

    // respawn flags reset
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
  // 8) Game loop patch
  // ----------------------------------------------------------
  game.animate = function () {
    if (!game.isRunning) return;

    requestAnimationFrame(game.animate);

    if (game.isPaused) {
      // render only if canvas visible
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
      // ✅ extra safety delay
      if (performance.now() > ringClaimBlockedUntil) {
        ringSystem.update(dt, game.playerController.mesh);
      }
    }

    weaponSystem.update(dt);
    bulletSystem.update(dt);

    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh);

      if (game.inputManager?.getAction?.("fire")) {
        mpClient.sendFire(game.playerController.mesh);
      }
    }

    mpState.update(dt);

    game.cameraSystem?.update?.(dt);

    game.renderer.render(game.scene, game.camera);
  };

  console.log("✅ Multiplayer-main loaded: blink fix + start lock + ring delay.");
});
