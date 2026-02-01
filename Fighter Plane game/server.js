// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - STABLE)
 *
 * Features:
 * ✅ Lobby flow (Create/Join/Start) via mpUIBridge
 * ✅ Semi-authoritative: client sends transform (20/s)
 * ✅ MPState smooth interpolation (remote players)
 * ✅ Hybrid bullets: local bullets smooth + server event broadcast
 * ✅ Client hit detection -> mp_hit to server
 * ✅ Rings sequential spawn from seed (server seed)
 * ✅ Win condition: 2 laps (1 lap = 4 rings)
 * ✅ Respawn: 3 sec delay, HP full, rings stay, score stays
 * ✅ No enemies in MP
 * ✅ MP bullet damage fixed: 5
 */

(() => {
  const DEBUG = true;

  // -------------------------
  // MP Gameplay Config
  // -------------------------
  const MP_CONFIG = {
    SEND_TRANSFORM_RATE: 20,
    BULLET_DAMAGE: 5,
    RESPAWN_DELAY_SEC: 3,

    RINGS_PER_LAP: 4,
    TOTAL_LAPS_TO_WIN: 2,

    // ring spacing
    RING_CLEARANCE_Y: 60,
    RING_SPAWN_RADIUS: 5000,
    RING_MIN_DIST: 1400
  };

  // -------------------------
  // Globals
  // -------------------------
  let game = null;
  let mpClient = null;
  let mpState = null;

  let bulletSystem = null;
  let weaponSystem = null;

  // ring data
  let rings = []; // { mesh, claimedBy: null|id }
  let activeRingIndex = 0;
  let ringSeed = 1;

  // local stats
  const localStats = {
    kills: 0,
    deaths: 0,
    rings: 0,
    score: 0
  };

  // remote stats cache
  const remoteStats = new Map(); // id -> {name,kills,deaths,rings,score}

  // respawn
  let respawnTimer = 0;
  let isDead = false;

  // utility
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // -------------------------
  // Seeded RNG (deterministic rings)
  // -------------------------
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // -------------------------
  // Ring generation (sequential)
  // -------------------------
  function clearRings(scene) {
    for (const r of rings) {
      if (r?.mesh) scene.remove(r.mesh);
    }
    rings = [];
    activeRingIndex = 0;
  }

  function createRingMesh() {
    const g = new THREE.TorusGeometry(60, 6, 10, 28);
    const m = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  function makeRings(scene, terrainMesh, seed) {
    clearRings(scene);

    const rand = mulberry32(seed || 1);

    const ringCount = MP_CONFIG.RINGS_PER_LAP * MP_CONFIG.TOTAL_LAPS_TO_WIN; // total sequential rings
    const points = [];

    const safeY = (x, z) => {
      // if terrain exists and has height function use it; else fixed
      if (window.game?.map?.getHeightAt) {
        const y = window.game.map.getHeightAt(x, z);
        return y + MP_CONFIG.RING_CLEARANCE_Y;
      }
      return 250 + MP_CONFIG.RING_CLEARANCE_Y;
    };

    for (let i = 0; i < ringCount; i++) {
      // pick new point far enough
      let x = 0, z = 0;
      for (let tries = 0; tries < 70; tries++) {
        const ang = rand() * Math.PI * 2;
        const rad = 1200 + rand() * MP_CONFIG.RING_SPAWN_RADIUS;

        x = Math.cos(ang) * rad;
        z = Math.sin(ang) * rad;

        let ok = true;
        for (const p of points) {
          const dx = x - p.x;
          const dz = z - p.z;
          if (dx * dx + dz * dz < MP_CONFIG.RING_MIN_DIST * MP_CONFIG.RING_MIN_DIST) {
            ok = false;
            break;
          }
        }
        if (ok) break;
      }

      const y = safeY(x, z);

      const ring = {
        mesh: createRingMesh(),
        claimedBy: null,
        index: i
      };
      ring.mesh.position.set(x, y, z);

      // rotate slightly random
      ring.mesh.rotation.z = (rand() - 0.5) * 0.6;
      ring.mesh.rotation.y = (rand() - 0.5) * 0.6;

      scene.add(ring.mesh);

      rings.push(ring);
      points.push({ x, z });
    }

    // set active visuals
    setActiveRing(0);

    if (DEBUG) console.log("[MP] Rings generated:", rings.length, "seed:", seed);
  }

  function setActiveRing(i) {
    activeRingIndex = clamp(i, 0, rings.length - 1);

    for (let k = 0; k < rings.length; k++) {
      const r = rings[k];
      if (!r?.mesh) continue;
      const mat = r.mesh.material;
      if (!mat) continue;

      const active = (k === activeRingIndex);
      mat.color.setHex(active ? 0x00ff00 : 0x00ffff);
      mat.opacity = active ? 0.95 : 0.45;
    }
  }

  function tryClaimRingLocal(playerMesh) {
    if (!playerMesh) return false;
    if (!rings.length) return false;

    const ring = rings[activeRingIndex];
    if (!ring || ring.claimedBy) return false;

    const dist = playerMesh.position.distanceTo(ring.mesh.position);
    if (dist < 120) {
      return true;
    }
    return false;
  }

  // -------------------------
  // Hit detection (client report)
  // -------------------------
  function checkBulletHitsLocal() {
    if (!bulletSystem) return;

    // BulletSystem should keep internal bullets list (we will assume bulletSystem.bullets exists)
    const bullets = bulletSystem.bullets || [];
    if (!bullets.length) return;

    // check hit remote players only (NOT self)
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b?.mesh || !b.ownerId) continue;

      // only local bullets from me should report hits
      const localId = mpClient?.clientId;
      if (!localId) continue;
      if (b.ownerId !== localId) continue;

      // check remote players meshes
      const remotes = mpState?.getRemotePlayers ? mpState.getRemotePlayers() : [];
      for (const rp of remotes) {
        if (!rp?.mesh || !rp.id) continue;
        if (rp.id === localId) continue;

        const d = b.mesh.position.distanceTo(rp.mesh.position);
        if (d < 18) {
          // report hit
          mpClient.socket.emit("mp_hit", {
            roomId: mpClient.roomId,
            attackerId: localId,
            victimId: rp.id,
            damage: MP_CONFIG.BULLET_DAMAGE
          });

          // remove bullet locally
          if (bulletSystem.removeBullet) bulletSystem.removeBullet(b);
          else {
            // fallback remove
            game.scene.remove(b.mesh);
            bullets.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  // -------------------------
  // Respawn system
  // -------------------------
  function triggerDeath() {
    if (isDead) return;
    isDead = true;
    respawnTimer = MP_CONFIG.RESPAWN_DELAY_SEC;

    localStats.deaths++;

    if (game?.procAudio) game.procAudio.defeat?.();
    if (DEBUG) console.log("[MP] You died. Respawn in", respawnTimer, "sec");
  }

  function doRespawn() {
    if (!game?.playerController) return;

    // respawn at default spawn
    if (typeof game.playerController.respawnInstant === "function") {
      game.playerController.respawnInstant();
    } else if (game.playerController.mesh) {
      game.playerController.mesh.position.set(0, 250, 0);
      game.playerController.mesh.quaternion.set(0, 0, 0, 1);
    }

    // hp full
    game.playerController.health = 100;

    isDead = false;
    respawnTimer = 0;

    if (game?.procAudio) game.procAudio.medkit?.();

    if (DEBUG) console.log("[MP] Respawned (HP full). Rings/Score unchanged.");
  }

  // -------------------------
  // End stats screen helper
  // -------------------------
  function renderEndStats(statsArr, winnerName) {
    if (window.mpUIBridge?.onGameOver) {
      window.mpUIBridge.onGameOver({
        winner: winnerName,
        stats: statsArr
      });
    }
  }

  // -------------------------
  // Boot Game
  // -------------------------
  function initGame() {
    // create game
    game = new GameManager();
    game.init();
    game.procAudio = window.ProceduralAudio ? new ProceduralAudio() : null;

    window.game = game; // keep compatibility

    // Make camera system exist
    if (!game.cameraSystem) game.cameraSystem = new CameraSystem(game.camera);
    game.cameraSystem.setTarget(game.playerController);

    // bullets + weapons
    bulletSystem = new BulletSystem(game.scene);

    weaponSystem = new WeaponSystem(
      game.playerController,
      bulletSystem,
      game.inputManager,
      game.sfx,
      {
        fireRate: 12,
        spread: 0.012,

        camera: game.camera,
        screenAimAssist: true,
        screenAimRadius: 0.78,      // MP aim better
        screenAimStrength: 0.92,    // MP aim strong

        // MP has no enemies list, so targets = remote players meshes
        getTargets: () => {
          const arr = mpState?.getRemotePlayers?.() || [];
          return arr.map(e => e.mesh).filter(Boolean);
        }
      }
    );

    // MPState
    mpState = new MPState(game.scene, {
      modelFactory: new ModelFactory(),
      positionLerp: 0.20,
      rotationSlerp: 0.24,
      debug: false
    });

    // create MPClient
    mpClient = new MPClient({
      debug: false,
      mpState,
      game,
      transformSendRate: MP_CONFIG.SEND_TRANSFORM_RATE,
      fireSendRate: 10,

      onConnected: () => window.mpUIBridge?.onConnected?.(),
      onDisconnected: (reason) => window.mpUIBridge?.onDisconnected?.(reason),
      onLobbyUpdate: (msg) => window.mpUIBridge?.onLobbyUpdate?.(msg),
      onGameStart: (info) => window.mpUIBridge?.onGameStart?.(info),
      onGameOver: (msg) => {
        // server final msg -> includes winner + stats array
        const statsArr = Array.isArray(msg.stats) ? msg.stats : [];
        renderEndStats(statsArr, msg.winner);
      },
      onError: (t) => window.mpUIBridge?.onError?.(t)
    });

    window.mpClient = mpClient;

    // connect
    mpClient.connect();

    // patch animate loop
    patchGameLoop();
  }

  // -------------------------
  // Patch game.animate
  // -------------------------
  function patchGameLoop() {
    // Start running loop
    game.isRunning = true;

    game.animate = function () {
      if (!game.isRunning) return;
      requestAnimationFrame(game.animate.bind(game));

      const dt = Math.min(game.clock.getDelta(), 0.05);

      // input update
      if (game.inputManager?.update) game.inputManager.update(dt);

      // player update only if alive
      if (game.playerController && !isDead) {
        game.playerController.update(dt);
      }

      // respawn countdown
      if (isDead) {
        respawnTimer -= dt;
        if (respawnTimer <= 0) {
          doRespawn();
        }
      }

      // MP: update remote entities interpolation
      if (mpState) mpState.update(dt);

      // weapon update: allow shooting even if alive only
      if (weaponSystem && !isDead) weaponSystem.update(dt);

      // bullets update
      if (bulletSystem) bulletSystem.update(dt);

      // ✅ bullet hit report (client)
      checkBulletHitsLocal();

      // MP: transform sync
      if (mpClient && mpClient.isConnected() && mpClient.roomId && game.playerController?.mesh) {
        mpClient.sendTransform(game.playerController.mesh);
      }

      // MP: claim ring sequential
      if (!isDead && mpClient?.roomId && game.playerController?.mesh) {
        if (tryClaimRingLocal(game.playerController.mesh)) {
          const localId = mpClient.clientId;

          // claim local UI
          rings[activeRingIndex].claimedBy = localId;
          rings[activeRingIndex].mesh.visible = false;

          localStats.rings++;
          localStats.score += 100;

          // send server claim
          mpClient.claimRing(activeRingIndex);

          // next ring
          setActiveRing(activeRingIndex + 1);

          if (game.procAudio) game.procAudio.ring?.();
        }
      }

      // UI HUD (if UIManager exists)
      if (game.uiManager) {
        const hp = game.playerController?.health ?? 100;
        const boost = game.playerController?.boostEnergy ?? (PHYSICS_CONFIG.boostMax ?? 100);

        game.uiManager.updateHealth(hp, 100);
        game.uiManager.updateBoost(boost, (PHYSICS_CONFIG.boostMax ?? 100));
        game.uiManager.updateScore(localStats.score);
      }

      // minimap: show remote players + rings
      if (game.minimap && game.playerController?.mesh) {
        const remote = mpState?.getRemotePlayers?.() || [];
        game.minimap.update(
          game.playerController.mesh,
          remote.map(p => ({ mesh: p.mesh })),
          rings,
          activeRingIndex
        );
      }

      // render
      game.renderer.render(game.scene, game.camera);
    };

    game.animate();
  }

  // ==========================================================
  // SOCKET EVENTS EXTENSIONS (extra mp events)
  // ==========================================================
  function bindExtraServerEvents() {
    if (!mpClient?.socket) return;

    // server bullet event -> create smooth bullet locally
    mpClient.socket.on("mp_event", (evt) => {
      if (!evt) return;

      if (evt.type === "FIRE") {
        // other players firing SFX (optional)
        if (game?.procAudio) game.procAudio.shoot?.();
      }
    });

    // authoritative bullet spawn snapshot -> optionally spawn bullets visual
    mpClient.socket.on("mp_state", (snapshot) => {
      // remote bullets: create visual locally for smooth
      // NOTE: keep it simple -> spawn bullets for others only
      if (!snapshot?.bullets || !bulletSystem) return;

      const localId = mpClient.clientId;
      for (const b of snapshot.bullets) {
        if (!b?.p || !b?.q) continue;
        if (b.ownerId === localId) continue;

        // spawn remote bullet visual
        bulletSystem.fire(
          new THREE.Vector3(b.p.x, b.p.y, b.p.z),
          new THREE.Quaternion(b.q.x, b.q.y, b.q.z, b.q.w),
          b.ownerId // pass ownerId if supported
        );
      }
    });

    // server says you got hit
    mpClient.socket.on("mp_damage", (msg) => {
      // msg: { victimId, hp }
      const localId = mpClient.clientId;
      if (!localId) return;
      if (msg?.victimId !== localId) return;

      // apply hp
      if (game?.playerController) {
        game.playerController.health = msg.hp ?? game.playerController.health;
        if (game.playerController.health <= 0) {
          triggerDeath();
        }
      }
    });

    // score update -> update local ring index sync (optional)
    mpClient.socket.on("mp_score_update", (msg) => {
      // msg: { id, rings }
      // if my rings changed, we sync activeRingIndex from it
      if (!msg?.id) return;
      const localId = mpClient.clientId;

      if (msg.id === localId) {
        // sync active index
        const ringsPassed = msg.rings ?? 0;
        activeRingIndex = clamp(ringsPassed, 0, rings.length - 1);
        setActiveRing(activeRingIndex);
      }

      // store stats
      const s = remoteStats.get(msg.id) || {};
      s.rings = msg.rings ?? s.rings ?? 0;
      remoteStats.set(msg.id, s);
    });

    // server game over -> stats render
    mpClient.socket.on("mp_game_over", (msg) => {
      // msg: { winner, stats:[] }
      const statsArr = Array.isArray(msg.stats) ? msg.stats : [];
      renderEndStats(statsArr, msg.winner || "Pilot");
    });

    // replay redirect: server will send mp_replay_join { roomId }
    mpClient.socket.on("mp_replay_join", (msg) => {
      // easiest: reload page and join new code
      if (!msg?.roomId) return;

      sessionStorage.setItem("MP_AUTO_JOIN_CODE", msg.roomId);
      window.location.reload();
    });
  }

  // ==========================================================
  // AUTO JOIN (if replay)
  // ==========================================================
  function setupAutoJoin() {
    const code = sessionStorage.getItem("MP_AUTO_JOIN_CODE");
    if (!code) return;

    sessionStorage.removeItem("MP_AUTO_JOIN_CODE");

    // fill UI inputs (if exist)
    const nameInput = document.getElementById("inpName");
    const codeInput = document.getElementById("inpCode");
    if (codeInput) codeInput.value = code;

    // auto click join after connect
    const tryJoin = () => {
      if (!window.mpClient?.isConnected()) return false;
      const name = (nameInput?.value || "Pilot").trim();
      window.mpClient.joinRoom(code, name);
      return true;
    };

    const t = setInterval(() => {
      if (tryJoin()) clearInterval(t);
    }, 200);
  }

  // ==========================================================
  // Start
  // ==========================================================
  window.addEventListener("load", () => {
    if (DEBUG) console.log("🌐 Multiplayer Mode Booting...");

    initGame();

    // bind extra events after socket connect created
    const waitSocket = setInterval(() => {
      if (mpClient?.socket) {
        clearInterval(waitSocket);
        bindExtraServerEvents();
        setupAutoJoin();
      }
    }, 100);

    // unlock audio on click
    window.addEventListener("click", async () => {
      if (game?.procAudio) await game.procAudio.unlock?.();
    }, { once: true });
  });
})();
