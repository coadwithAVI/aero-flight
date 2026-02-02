// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Booting (No Ghost Bullet + Health Fix)");

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeUI = () => window.mpUIBridge || null;

  // 1) Game Core
  const game = new GameManager();
  game.init();
  game.isPaused = true;
  game.isRunning = true;
  window.game = game;

  if (!game.uiManager) game.uiManager = new UIManager();
  if (!game.procAudio && typeof ProceduralAudio !== "undefined") game.procAudio = new ProceduralAudio();
  if (typeof MobileControls !== "undefined") game.mobileControls = new MobileControls(game.inputManager);

  if (game.renderer?.domElement) game.renderer.domElement.style.display = "none";

  // 2) MP State
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
      console.log("✅ ID:", mpClient.socket.id);
      if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);
      safeUI()?.onConnected?.();
    },

    onDisconnected: (reason) => {
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
      if (game.renderer?.domElement) game.renderer.domElement.style.display = "block";
      
      freshStartMatch(msg);
      
      game.isPaused = false;
      ringClaimBlockedUntil = performance.now() + 2000;
      safeUI()?.onGameStart?.(msg);
      if (game.uiManager) game.uiManager.hidePause?.();
    },

    onEvent: (evt) => {
      if (!evt) return;
      
      // SCORE Update
      if (evt.type === "SCORE" && evt.msg) {
        if (mpClient.socket && evt.msg.id === mpClient.socket.id) {
          if (ringSystem) {
             ringSystem.currentIndex = evt.msg.rings;
             ringSystem._setActiveRing(evt.msg.rings); 
          }
        }
      }

      // DAMAGE Update (Server confirmed hit)
      if (evt.type === "HIT" || evt.type === "DAMAGE") {
         if (evt.targetId === mpClient.socket?.id && game.playerController) {
             const dmg = evt.damage || 10;
             console.log(`⚠️ DAMAGE RECEIVED: ${dmg}`);
             game.playerController.health -= dmg;
             if(game.playerController.health < 0) game.playerController.health = 0;
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

  // 3) Systems
  const bulletSystem = new BulletSystem(game.scene);

  const weaponSystem = new WeaponSystem(
    game.playerController,
    bulletSystem,
    game.inputManager,
    game.sfx,
    {
      fireRate: 14,
      spread: 0.01,
      // Default Forward for your model (+Z)
      muzzleOffset: new THREE.Vector3(0, 0, 6.5), 
      camera: game.camera,
      screenAimAssist: true,
      getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
    }
  );

  // ✅ HIT DETECTION (My bullets hitting Enemy)
  const hitDetection = new MPHitDetection(mpClient, bulletSystem, mpState, {
      hitRadius: 8.0, 
      damage: 15
  });

  let ringSystem = null;

  if (typeof MinimapSystem !== "undefined" && !game.minimap) {
    game.minimap = new MinimapSystem(game);
  }

  function resetRingSystem(seed) {
    if (ringSystem?.rings) {
        ringSystem.rings.forEach(r => { if (r?.mesh?.parent) r.mesh.parent.remove(r.mesh); });
    }
    ringSystem = null;

    if (typeof RingSystem === "undefined") return;

    // Wait for Terrain
    setTimeout(() => {
        let terrain = game.map?.terrainMesh;
        if (!terrain) game.scene.traverse(o => { if (o.name === "Terrain") terrain = o; });

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
    }, 500);
  }

  function freshStartMatch(msg) {
    if (typeof PlayerController !== "undefined" && !game.playerController) {
        game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
        if (game.map?.terrainMesh) game.playerController.setTerrainMesh(game.map.terrainMesh);
        weaponSystem.player = game.playerController;
        if (!game.cameraSystem) game.cameraSystem = new CameraSystem(game.camera);
        game.cameraSystem.setTarget(game.playerController);
    }

    if (mpClient.socket?.id) mpState.setLocalId(mpClient.socket.id);

    if (game.playerController) {
      game.playerController.health = 100;
      game.playerController.score = 0;
      if (game.playerController.respawnInstant) game.playerController.respawnInstant();
      game.playerController.mesh.visible = true;
    }

    bulletSystem.clearAll();
    resetRingSystem(msg?.seed);
  }

  // ✅ TERRAIN CRASH LOGIC
  function checkTerrainCollision(dt) {
      if (!game.playerController || !game.playerController.mesh) return;
      if (!game.map) return;

      const p = game.playerController.mesh.position;
      let groundH = 0;
      
      // Map method or simple fallback
      if (game.map.getAltitudeAt) groundH = game.map.getAltitudeAt(p.x, p.z);
      else groundH = 10; 

      // Impact Threshold
      if (p.y < groundH + 2) {
          if (game.playerController.health > 0) {
             // Damage based on time (approx 20 HP per sec on ground)
             game.playerController.health -= (30 * dt); 
             if (game.playerController.health < 0) game.playerController.health = 0;
             
             // Bounce
             p.y = groundH + 3;
             game.playerController.speed *= 0.95;
          }
      }
  }

  // GAME LOOP
  game.animate = function () {
    if (!game.isRunning) return;
    requestAnimationFrame(game.animate);

    if (game.isPaused) {
      if (game.renderer?.domElement?.style.display !== "none") game.renderer.render(game.scene, game.camera);
      return;
    }

    const dt = clamp(game.clock.getDelta(), 0.0, 0.05);

    game.inputManager?.update?.(dt);
    game.playerController?.update?.(dt);
    
    // ✅ CRITICAL: Health & Collision Update
    checkTerrainCollision(dt);

    if (ringSystem && game.playerController?.mesh) {
        if (performance.now() > ringClaimBlockedUntil) ringSystem.update(dt, game.playerController.mesh);
    }

    weaponSystem.update(dt);
    bulletSystem.update(dt);
    if (hitDetection) hitDetection.update(dt);

    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh.position, game.playerController.mesh.quaternion);
      if (game.inputManager?.getAction?.("fire")) {
        mpClient.fire(game.playerController.mesh.position, game.playerController.mesh.quaternion);
      }
    }
    mpState.update(dt);

    if (game.minimap && game.playerController?.mesh) {
        const enemies = mpState.getRemotePlayers().map(p => p.mesh);
        game.minimap.update(game.playerController.mesh, enemies, ringSystem?.rings || [], ringSystem?.currentIndex);
    }

    // ✅ CRITICAL: UI UPDATE LOOP
    if (game.uiManager && game.playerController) {
        game.uiManager.update(
            game.playerController.speed || 0,
            game.playerController.health, // Ab ye value update hogi
            game.playerController.score || 0,
            game.playerController.boostEnergy || 100
        );
    }

    game.cameraSystem?.update?.(dt);
    game.renderer.render(game.scene, game.camera);
  };
});
