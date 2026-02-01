// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main (FINAL - STABLE)
 *
 * Goals achieved:
 * ✅ NO require/import (browser safe)
 * ✅ Works with Render deployment
 * ✅ Lobby: Create / Join + Host Start
 * ✅ Semi-authoritative movement:
 *    - client sends transforms
 *    - server ticks 20/s
 *    - MPState smooths remote players
 * ✅ Hybrid bullets:
 *    - local bullets smooth
 *    - server broadcast event for remote bullets
 * ✅ Race:
 *    - 1 lap = 4 rings
 *    - win = 2 laps (8 rings)
 * ✅ Respawn:
 *    - 3 sec delay
 *    - hp full
 *    - rings NOT reset
 *    - score stays
 */

window.addEventListener("load", () => {
  console.log("🌐 Multiplayer Mode Booting...");

  // ----------------------------------------------------------
  // 0) Helpers
  // ----------------------------------------------------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

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
      showLobbyUI();
    },

    onDisconnected: (reason) => {
      console.warn("❌ Disconnected:", reason);
      showError("Disconnected.");
      showLobbyUI();
    },

    onLobbyUpdate: (msg) => {
      // msg: {type, roomId, players, hostId, seed, isHost}
      renderLobby(msg);
    },

    onGameStart: (msg) => {
      console.log("🎮 Game Start:", msg);
      game.isPaused = false;
      hideLobbyUI();
      ensureSpawnLocalPlayer();
      ensureRingSystem(msg.seed);
      showHUDOnly();
    },

    onGameOver: (msg) => {
      console.log("🏁 Game Over:", msg);
      showEndScreen(msg);
    },

    onError: (txt) => {
      showError(txt);
    }
  });

  mpClient.connect();

  // ----------------------------------------------------------
  // 3) Multiplayer UI (Create/Join/Start/Leave)
  // ----------------------------------------------------------
  let lobbyUI = null;
  let lobbyRoomId = null;
  let lobbyPlayers = [];
  let amHost = false;

  function showLobbyUI() {
    if (lobbyUI) return;

    lobbyUI = document.createElement("div");
    lobbyUI.id = "mpLobbyUI";
    Object.assign(lobbyUI.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.75)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      fontFamily: "Rajdhani, Arial, sans-serif",
      color: "white"
    });

    lobbyUI.innerHTML = `
      <div style="
        width:min(520px,92vw);
        background:rgba(0,0,0,0.55);
        border:1px solid rgba(255,255,255,0.15);
        border-radius:16px;
        padding:18px;
        box-shadow:0 0 30px rgba(0,255,255,0.10);
      ">
        <div style="font-size:34px;font-weight:800;letter-spacing:2px;margin-bottom:8px;">
          MULTIPLAYER
        </div>
        <div style="opacity:.8;margin-bottom:14px;font-size:13px;">
          Create lobby or join via code. Host can start match.
        </div>

        <div style="display:grid;grid-template-columns:1fr;gap:10px;">
          <input id="mpName" placeholder="Name (IGN)" maxlength="12"
            style="padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);
            background:rgba(255,255,255,0.07);color:white;font-size:16px;outline:none"/>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button id="mpCreateBtn" style="${btnStylePrimary()}">CREATE</button>

            <div style="display:flex;gap:10px;">
              <input id="mpCode" placeholder="CODE" maxlength="4"
                style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);
                background:rgba(255,255,255,0.07);color:white;font-size:16px;outline:none;text-transform:uppercase"/>
              <button id="mpJoinBtn" style="${btnStyle()}">JOIN</button>
            </div>
          </div>

          <div id="mpError" style="min-height:20px;color:#ff6666;font-size:13px;"></div>

          <div style="margin-top:8px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.12);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div>
                <div style="font-weight:800;letter-spacing:2px;">LOBBY</div>
                <div id="mpRoomLine" style="opacity:.85;font-size:13px;">Not in room</div>
              </div>

              <div style="display:flex;gap:10px;">
                <button id="mpStartBtn" style="${btnStylePrimary()}">START</button>
                <button id="mpLeaveBtn" style="${btnStyleDanger()}">LEAVE</button>
              </div>
            </div>

            <div id="mpPlayers" style="margin-top:10px;font-family:Consolas, monospace;font-size:13px;opacity:.95"></div>
          </div>

          <div style="display:flex;gap:10px;margin-top:12px;">
            <button id="mpBackBtn" style="${btnStyle()}">BACK</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(lobbyUI);

    const $ = (id) => lobbyUI.querySelector(id);

    const nameInput = $("#mpName");
    const codeInput = $("#mpCode");
    const errorBox = $("#mpError");

    // defaults
    nameInput.value = localStorage.getItem("MP_NAME") || "Pilot";
    nameInput.addEventListener("input", () => {
      localStorage.setItem("MP_NAME", nameInput.value);
    });

    const createBtn = $("#mpCreateBtn");
    const joinBtn = $("#mpJoinBtn");
    const startBtn = $("#mpStartBtn");
    const leaveBtn = $("#mpLeaveBtn");
    const backBtn = $("#mpBackBtn");

    createBtn.onclick = () => {
      clearError();
      const name = (nameInput.value || "Pilot").trim();
      mpClient.createRoom(name);
    };

    joinBtn.onclick = () => {
      clearError();
      const name = (nameInput.value || "Wingman").trim();
      const code = String(codeInput.value || "").trim().toUpperCase();
      if (!code || code.length !== 4) return showError("Enter valid 4-letter code.");
      mpClient.joinRoom(code, name);
    };

    startBtn.onclick = () => {
      clearError();
      if (!amHost) return showError("Only host can start.");
      if (!lobbyRoomId) return showError("Not in room.");
      mpClient.startGame();
    };

    leaveBtn.onclick = () => {
      clearError();
      // easiest: reload multiplayer page (hard reset)
      window.location.reload();
    };

    backBtn.onclick = () => {
      window.location.href = "./index.html";
    };

    renderLobby(null);
  }

  function hideLobbyUI() {
    if (!lobbyUI) return;
    lobbyUI.remove();
    lobbyUI = null;
  }

  function renderLobby(msg) {
    if (!lobbyUI) return;

    if (msg?.roomId) lobbyRoomId = msg.roomId;
    if (msg?.players) lobbyPlayers = msg.players;
    if (typeof msg?.isHost === "boolean") amHost = msg.isHost;

    const roomLine = lobbyUI.querySelector("#mpRoomLine");
    const playersBox = lobbyUI.querySelector("#mpPlayers");
    const startBtn = lobbyUI.querySelector("#mpStartBtn");

    if (!lobbyRoomId) {
      roomLine.innerText = "Not in room";
      playersBox.innerHTML = "";
      startBtn.disabled = true;
      startBtn.style.opacity = 0.5;
      return;
    }

    roomLine.innerHTML = `Room Code: <b style="color:#00f0ff">${lobbyRoomId}</b> ${
      amHost ? "<span style='opacity:.7'>[HOST]</span>" : ""
    }`;

    startBtn.disabled = !amHost;
    startBtn.style.opacity = amHost ? 1 : 0.5;

    playersBox.innerHTML = (lobbyPlayers || [])
      .map((p) => {
        const hostTag = p.isHost ? " <span style='color:#00ff99'>(HOST)</span>" : "";
        return `<div>• ${escapeHtml(p.name || "Pilot")}${hostTag}</div>`;
      })
      .join("");
  }

  function showError(msg) {
    if (!lobbyUI) return;
    const err = lobbyUI.querySelector("#mpError");
    if (err) err.innerText = msg;
  }

  function clearError() {
    if (!lobbyUI) return;
    const err = lobbyUI.querySelector("#mpError");
    if (err) err.innerText = "";
  }

  function btnStyle() {
    return `
      padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);
      background:rgba(255,255,255,0.08);color:white;font-weight:900;letter-spacing:1px;
      cursor:pointer;transition:.15s;`;
  }
  function btnStylePrimary() {
    return `
      padding:12px 14px;border-radius:12px;border:1px solid rgba(0,255,255,0.25);
      background:rgba(0,255,255,0.15);color:#00f0ff;font-weight:900;letter-spacing:1px;
      cursor:pointer;transition:.15s;`;
  }
  function btnStyleDanger() {
    return `
      padding:12px 14px;border-radius:12px;border:1px solid rgba(255,0,80,0.25);
      background:rgba(255,0,80,0.12);color:#ff2f60;font-weight:900;letter-spacing:1px;
      cursor:pointer;transition:.15s;`;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
  }

  // ----------------------------------------------------------
  // 4) Systems for MP gameplay
  // ----------------------------------------------------------
  const bulletSystem = new BulletSystem(game.scene);

  const weaponSystem = new WeaponSystem(
    game.playerController, // will be set after spawn
    bulletSystem,
    game.inputManager,
    game.sfx,
    {
      fireRate: 14,          // mp faster feel
      spread: 0.01,          // accurate
      camera: game.camera,
      screenAimAssist: true,
      screenAimRadius: 0.75,     // ✅ wider angle (user request)
      screenAimStrength: 0.90,   // ✅ strong assist
      getTargets: () => mpState.getRemotePlayers().map((p) => p.mesh)
    }
  );

  // Map + terrain injection
  if (game.playerController && game.map?.terrainMesh) {
    game.playerController.setTerrainMesh(game.map.terrainMesh);
  }

  // ----------------------------------------------------------
  // 5) Rings (sequential + seeded)
  // ----------------------------------------------------------
  let ringSystem = null;
  let ringSeed = null;

  function ensureRingSystem(seed) {
    if (ringSystem) return;

    ringSeed = seed ?? ringSeed ?? 12345;

    ringSystem = new RingSystem(game.scene, game.map?.terrainMesh, {
      ringCount: 8,              // 2 laps * 4 rings
      terrainClearance: 30,
      seed: ringSeed
    });

    // IMPORTANT: Rings sequential (do not all appear)
    // depends on your ring-system.js logic. if not present, we'll just rely on currentIndex.

    ringSystem.onRingClaim = (ringIndex) => {
      if (!mpClient.roomId) return;
      mpClient.claimRing(ringIndex);
    };
  }

  // ----------------------------------------------------------
  // 6) Respawn system
  // ----------------------------------------------------------
  let respawnPending = false;
  let respawnAt = 0;

  function triggerRespawn() {
    if (!game.playerController) return;

    respawnPending = true;
    respawnAt = performance.now() + 3000;

    game.playerController.health = 0;
    game.playerController.mesh.visible = false;

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
  // 7) MP events handling (remote bullets smooth)
  // ----------------------------------------------------------
  // mp-state already receives mp_event via MPClient and calls mpState.applyServerEvent
  // We'll also spawn local smooth bullets for remote FIRE events
  mpClient.onEvent = (evt) => {
    if (!evt || evt.type !== "FIRE") return;

    // do not spawn for self (local already fires)
    if (evt.ownerId === mpClient.clientId) return;

    // remote shooter entity
    const ent = mpState.players.get(evt.ownerId);
    if (!ent?.mesh) return;

    // spawn remote bullet locally (visual only)
    const p = ent.mesh.position.clone();
    const q = ent.mesh.quaternion.clone();
    bulletSystem.fire(p, q);
  };

  // ----------------------------------------------------------
  // 8) HUD control
  // ----------------------------------------------------------
  function showHUDOnly() {
    // keep HUD, remove pause overlay if open
    if (game.uiManager) game.uiManager.hidePause();
  }

  // ----------------------------------------------------------
  // 9) Ensure player exists for MP mode
  // ----------------------------------------------------------
  function ensureSpawnLocalPlayer() {
    // If already exists -> ok
    if (game.playerController && game.playerController.mesh) {
      weaponSystem.player = game.playerController;
      return;
    }

    // If GameManager didn't spawn controller for some reason
    if (typeof PlayerController !== "undefined") {
      game.playerController = new PlayerController(game.scene, game.inputManager, game.camera);
      weaponSystem.player = game.playerController;

      if (game.map?.terrainMesh) game.playerController.setTerrainMesh(game.map.terrainMesh);

      if (!game.cameraSystem) game.cameraSystem = new CameraSystem(game.camera);
      game.cameraSystem.setTarget(game.playerController);
    }
  }

  // ----------------------------------------------------------
  // 10) Patch game loop for Multiplayer
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

    // local player
    if (game.playerController) game.playerController.update(dt);

    // Respawn processing
    processRespawn();

    // rings update
    if (ringSystem && game.playerController?.mesh) {
      ringSystem.update(dt, game.playerController.mesh);
    }

    // bullets
    weaponSystem.update(dt);
    bulletSystem.update(dt);

    // send local transform (smooth)
    if (game.playerController?.mesh) {
      mpClient.sendTransform(game.playerController.mesh);

      // Fire -> server authoritative event
      if (game.inputManager?.getAction("fire")) {
        mpClient.sendFire(game.playerController.mesh);
      }
    }

    // smooth remote
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

    // UI
    if (game.uiManager) {
      const hp = game.playerController ? (game.playerController.health ?? 100) : 100;
      const boost = game.playerController
        ? game.playerController.boostEnergy
        : (typeof PHYSICS_CONFIG !== "undefined" ? PHYSICS_CONFIG.boostMax : 100);

      game.uiManager.updateHealth(hp, 100);
      game.uiManager.updateBoost(boost, (typeof PHYSICS_CONFIG !== "undefined" ? (PHYSICS_CONFIG.boostMax ?? 100) : 100));
      // score not local here (server authoritative end screen)
    }

    // death check -> respawn delay
    if (game.playerController && game.playerController.health <= 0 && !respawnPending) {
      triggerRespawn();
    }

    // render
    game.renderer.render(game.scene, game.camera);
  };

  // ----------------------------------------------------------
  // 11) End Screen (simple)
  // ----------------------------------------------------------
  function showEndScreen(msg) {
    game.isPaused = true;

    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0,0,0,0.8)",
      display: "grid",
      placeItems: "center",
      zIndex: 10000,
      fontFamily: "Rajdhani, Arial",
      color: "white"
    });

    const winner = msg?.winner ? String(msg.winner) : "Unknown";

    box.innerHTML = `
      <div style="width:min(520px,92vw);background:rgba(0,0,0,0.55);
        border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:20px;">
        <div style="font-size:34px;font-weight:900;letter-spacing:2px;margin-bottom:8px;">MATCH OVER</div>
        <div style="opacity:.9;margin-bottom:18px;">Winner: <b style="color:#00f0ff">${escapeHtml(winner)}</b></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button id="mpReplayBtn" style="${btnStylePrimary()}">REPLAY</button>
          <button id="mpMenuBtn" style="${btnStyle()}">MAIN MENU</button>
        </div>
        <div style="opacity:.6;font-size:12px;margin-top:14px;font-family:Consolas, monospace;">
          (Replay will reconnect as new lobby)
        </div>
      </div>
    `;

    document.body.appendChild(box);

    box.querySelector("#mpReplayBtn").onclick = () => {
      // simplest stable replay (fresh state)
      window.location.reload();
    };

    box.querySelector("#mpMenuBtn").onclick = () => {
      window.location.href = "./index.html";
    };
  }
});
