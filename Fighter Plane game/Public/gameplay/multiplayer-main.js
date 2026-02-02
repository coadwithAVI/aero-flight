// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Mode Booting...");

  // Safe UI Bridge Access
  const safeUI = () => window.mpUIBridge || null;

  // 1. Initialize Game Core
  const game = new GameManager();
  game.init();
  
  // Start in paused/hidden state until MP connected
  game.isPaused = true;
  game.isRunning = true;
  if(game.renderer?.domElement) game.renderer.domElement.style.display = "none";
  
  window.game = game;

  if (!game.uiManager) game.uiManager = new UIManager();
  if (!game.procAudio && typeof ProceduralAudio !== "undefined") game.procAudio = new ProceduralAudio();

  // 2. Initialize Mobile Controls (With HTML Zones)
  if (typeof MobileControls !== "undefined") {
    console.log("📱 Initializing Mobile Controls...");
    // Passing the DOM elements we created in multiplayer.html
    game.mobileControls = new MobileControls(game.inputManager, {
        leftZone: document.getElementById('zoneLeft'),
        rightZone: document.getElementById('zoneRight')
    });
  }

  // 3. Multiplayer State System
  const mpState = new MPState(game.scene, {
    modelFactory: typeof ModelFactory !== "undefined" ? new ModelFactory() : null,
    debug: false
  });

  // 4. Client Connection Setup
  const mpClient = new MPClient({
    mpState,
    game,
    debug: true,
    
    onConnected: () => safeUI()?.onConnected?.(),
    
    onLobbyUpdate: (msg) => {
        game.isPaused = true;
        if(game.renderer?.domElement) game.renderer.domElement.style.display = "none";
        safeUI()?.onLobbyUpdate?.(msg);
    },
    
    onGameStart: (msg) => {
        console.log("🎮 Game Started!");
        game.isPaused = false;
        if(game.renderer?.domElement) game.renderer.domElement.style.display = "block";
        
        freshStartMatch(msg);
        safeUI()?.onGameStart?.(msg);
        
        // Play music
        game.procAudio?.playGameMusic?.();
    },
    
    onGameOver: (msg) => {
        console.log("🏁 Game Over");
        game.isPaused = true;
        safeUI()?.onGameOver?.(msg);
    },
    
    onEvent: (evt) => {
        // Live Score Updates
        if (evt.type === "SCORE" && evt.msg && mpClient.socket && evt.msg.id === mpClient.socket.id) {
           if(ringSystem) ringSystem._setActiveRing(evt.msg.rings);
        }
    }
  });

  window.mpClient = mpClient;
  mpClient.connect();

  // 5. Weapon & Bullet Systems
  const bulletSystem = new BulletSystem(game.scene);
  const weaponSystem = new WeaponSystem(
    game.playerController, 
    bulletSystem, 
    game.inputManager, 
    game.sfx,
    { 
      // Auto-aim targets remote players
      getTargets: () => mpState.getRemotePlayers().map(p => p.mesh) 
    }
  );

  // 6. Hit Detection (CRITICAL: Kill Logic)
  // Ensures bullets actually hit enemies and report to server
  const hitDetector = new MPHitDetection(mpClient, bulletSystem, mpState, {
      hitRadius: 6.0 // Slightly generous hitbox for better feel
  });

  // 7. Ring System Setup
  let ringSystem = null;
  function resetRingSystem(seed) {
      // Cleanup old rings
      if(ringSystem && ringSystem.rings) {
          ringSystem.rings.forEach(r => { if(r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh); });
      }
      
      const terrain = game.map?.terrainMesh; 
      if(terrain && typeof RingSystem !== "undefined") {
          ringSystem = new RingSystem(game.scene, terrain, { seed: seed || 123 });
          ringSystem.onRingClaim = (idx) => mpClient.claimRing(idx);
          // Force first ring active
          if(ringSystem._setActiveRing) ringSystem._setActiveRing(0);
      }
  }

  // 8. Spawn / Respawn Logic
  function freshStartMatch(msg) {
    // Create player if missing
    if(!game.playerController) {
        game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
        weaponSystem.player = game.playerController;
        if(game.cameraSystem) game.cameraSystem.setTarget(game.playerController);
    }
    
    // Reset stats
    game.playerController.health = 100;
    game.playerController.energy = 100;
    game.playerController.respawnInstant?.();
    
    // Clear old bullets
    bulletSystem.clearAll();
    // Generate map objects
    resetRingSystem(msg?.seed);
  }

  // 9. Main Game Loop
  game.animate = function () {
    requestAnimationFrame(game.animate);

    if (game.isPaused) {
        // Still render scene (frozen) if needed, or black screen
        if(game.renderer && game.renderer.domElement.style.display === "block") {
            game.renderer.render(game.scene, game.camera);
        }
        return;
    }

    const dt = Math.min(game.clock.getDelta(), 0.05);

    // Update Systems
    game.inputManager?.update?.(dt);
    game.playerController?.update?.(dt);
    weaponSystem.update(dt);
    bulletSystem.update(dt);
    
    // Update Remote Players
    mpState.update(dt);
    
    // Run Hit Detection (Kills)
    hitDetector.update(dt);

    // Update Rings
    if(ringSystem && game.playerController?.mesh) {
        ringSystem.update(dt, game.playerController.mesh);
    }

    // Network Sync (Send Position)
    if (game.playerController?.mesh) {
        mpClient.sendTransform(game.playerController.mesh.position, game.playerController.mesh.quaternion);
    }

    // Update UI (Health/Boost)
    // Connects data from PlayerController to HTML HUD
    if(game.playerController && safeUI()?.updateHUD) {
        safeUI().updateHUD(
            game.playerController.health, 
            game.playerController.energy,
            ringSystem ? ringSystem.currentIndex : 0
        );
    }

    // Camera & Render
    game.cameraSystem?.update?.(dt);
    game.renderer.render(game.scene, game.camera);
  };
});
