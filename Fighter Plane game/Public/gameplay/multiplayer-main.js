// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Mode Booting...");

  const safeUI = () => window.mpUIBridge || null;

  // 1. Game Core
  const game = new GameManager();
  game.init();
  game.isPaused = true;
  game.isRunning = true;
  window.game = game;

  if (!game.uiManager) game.uiManager = new UIManager();
  if (!game.procAudio && typeof ProceduralAudio !== "undefined") game.procAudio = new ProceduralAudio();

  // 2. Mobile Controls (Standard Init)
  if (typeof MobileControls !== "undefined") {
    console.log("📱 Mobile Controls Detected");
    // Standard initialization - checks for touches automatically
    game.mobileControls = new MobileControls(game.inputManager);
  }

  // Hide canvas initially (Lobby visible)
  if (game.renderer?.domElement) {
    game.renderer.domElement.style.display = "none";
  }

  // 3. Multiplayer State
  const mpState = new MPState(game.scene, {
    modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null
  });

  // 4. Client
  const mpClient = new MPClient({
    mpState,
    game,
    debug: true,

    onConnected: () => safeUI()?.onConnected?.(),
    onLobbyUpdate: (msg) => {
      game.isPaused = true;
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";
      safeUI()?.onLobbyUpdate?.(msg);
    },
    onGameStart: (msg) => {
      game.isPaused = false;
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
      
      freshStartMatch(msg);
      safeUI()?.onGameStart?.(msg);
      game.procAudio?.playGameMusic?.();
    },
    onGameOver: (msg) => {
      game.isPaused = true;
      safeUI()?.onGameOver?.(msg);
    },
    onEvent: (evt) => {
      if (evt.type === "SCORE" && evt.msg && mpClient.socket && evt.msg.id === mpClient.socket.id) {
         if(ringSystem) ringSystem._setActiveRing(evt.msg.rings);
      }
    }
  });

  window.mpClient = mpClient;
  mpClient.connect();

  // 5. Weapon System
  const bulletSystem = new BulletSystem(game.scene);
  const weaponSystem = new WeaponSystem(
    game.playerController,
    bulletSystem,
    game.inputManager,
    game.sfx,
    { getTargets: () => mpState.getRemotePlayers().map(p => p.mesh) }
  );

  // 6. KILL LOGIC (Hit Detection)
  const hitDetector = new MPHitDetection(mpClient, bulletSystem, mpState, {
      hitRadius: 6.0,
      damage: 10
  });

  // 7. Ring System
  let ringSystem = null;
  function resetRingSystem(seed) {
    if(ringSystem && ringSystem.rings) {
        ringSystem.rings.forEach(r => { if(r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh); });
    }

    const terrain = game.map?.terrainMesh; 
    if(terrain && typeof RingSystem !== "undefined") {
        ringSystem = new RingSystem(game.scene, terrain, { seed: seed || 123 });
        ringSystem.onRingClaim = (idx) => mpClient.claimRing(idx);
        if(ringSystem._setActiveRing) ringSystem._setActiveRing(0);
    }
  }

  // 8. Respawn Logic
  function freshStartMatch(msg) {
    if(!game.playerController) {
        game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
        weaponSystem.player = game.playerController;
        if(game.cameraSystem) game.cameraSystem.setTarget(game.playerController);
    }
    game.playerController.health = 100;
    game.playerController.energy = 100;
    game.playerController.respawnInstant?.();
    
    bulletSystem.clearAll();
    resetRingSystem(msg?.seed);
  }

  // 9. Game Loop
  game.animate = function () {
    requestAnimationFrame(game.animate);

    if (game.isPaused) {
      if (game.renderer?.domElement?.style.display === "block") {
        game.renderer.render(game.scene, game.camera);
      }
      return;
    }

    const dt = Math.min(game.clock.getDelta(), 0.05);

    game.inputManager?.update?.(dt);
    game.playerController?.update?.(dt);
    weaponSystem.update(dt);
    bulletSystem.update(dt);
    mpState.update(dt);
    
    // EXECUTE KILL LOGIC
    hitDetector.update(dt);

    if(ringSystem && game.playerController?.mesh) {
        ringSystem.update(dt, game.playerController.mesh);
    }

    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh.position, game.playerController.mesh.quaternion);
    }

    game.cameraSystem?.update?.(dt);
    game.renderer.render(game.scene, game.camera);
  };
});
