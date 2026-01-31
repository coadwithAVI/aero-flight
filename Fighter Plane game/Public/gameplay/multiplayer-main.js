// ==========================================
// PATH: gameplay/multiplayer-main.js
// ==========================================

/**
 * Multiplayer Main
 * - Initializes the 3D game in multiplayer mode
 * - Connects MPClient <-> server.js (Socket.IO)
 * - Uses MPState for remote player interpolation
 *
 * Requirements:
 * - multiplayer.html must include:
 *   <script src="/socket.io/socket.io.js"></script>
 * - MPClient, MPState already loaded
 */

let bulletSystem = null;
let weaponSystem = null;
let collisionSystem = null;

let mpState = null;
let mpClient = null;

// Simple UI elements
let lobbyUI = null;
let lobbyStatus = null;
let roomInput = null;
let nameInput = null;
let createBtn = null;
let joinBtn = null;
let startBtn = null;

window.addEventListener("load", () => {
    console.log("🌐 Multiplayer Mode Booting...");

    // ----------------------------------------------------------
    // 0) Setup Lobby UI
    // ----------------------------------------------------------
    setupLobbyUI();

    // ----------------------------------------------------------
    // 1) Create Game Manager + init
    // ----------------------------------------------------------
    const game = new GameManager();
    game.init();

    // ----------------------------------------------------------
    // 2) Build world systems
    // ----------------------------------------------------------
    game.map = new GameMap(game.scene);

    game.uiManager = new UIManager();

    // Player + controls
    game.playerController = new PlayerController(game.scene, game.inputManager);

    // Camera follow
    game.cameraSystem = new CameraSystem(game.camera);
    game.cameraSystem.setTarget(game.playerController);

    // Gameplay systems
    bulletSystem = new BulletSystem(game.scene);
    weaponSystem = new WeaponSystem(game.playerController, bulletSystem, game.inputManager);

    // Enemy is optional in MP mode (depends on your design)
    // If MP is PvP only -> enemyManager not needed.
    // We keep it OFF by default.
    // game.enemyManager = new EnemyManager(game.scene, game.playerController);

    // collisionSystem optional (for SP enemies). For MP bullets you may do server-hit auth later.
    // collisionSystem = new CollisionSystem(bulletSystem, game.enemyManager);

    // ----------------------------------------------------------
    // 3) Multiplayer State
    // ----------------------------------------------------------
    mpState = new MPState(game.scene, { debug: false });

    mpClient = new MPClient({
        mpState,
        debug: true,
        onConnected: () => setStatus("✅ Connected to server."),
        onDisconnected: (reason) => setStatus("❌ Disconnected: " + reason),
        onError: (msg) => setStatus("⚠️ " + msg),
        onLobbyUpdate: (info) => {
            renderLobbyPlayers(info.players || []);
            setStatus(`🏠 Room: ${info.roomId} | Host: ${info.isHost ? "YES" : "NO"}`);
            if (startBtn) startBtn.style.display = info.isHost ? "inline-block" : "none";
        },
        onGameStart: (info) => {
            setStatus(`🎮 Game Started! Seed=${info.seed}`);
            hideLobbyUI();
        },
        onGameOver: (info) => {
            setStatus(`🏁 Game Over! Winner: ${info.winner}`);
            showLobbyUI();
        }
    });

    mpClient.connect();

    // ----------------------------------------------------------
    // 4) Wire lobby buttons
    // ----------------------------------------------------------
    createBtn.onclick = () => {
        const name = (nameInput.value || "Pilot").trim();
        mpClient.createRoom(name);
    };

    joinBtn.onclick = () => {
        const room = (roomInput.value || "").trim().toUpperCase();
        const name = (nameInput.value || "Wingman").trim();
        if (!room) return setStatus("⚠️ Enter Room ID first.");
        mpClient.joinRoom(room, name);
    };

    startBtn.onclick = () => {
        mpClient.startGame();
    };

    // ----------------------------------------------------------
    // 5) Patch GameManager loop (multiplayer extra updates)
    // ----------------------------------------------------------
    const originalAnimate = game.animate.bind(game);

    game.animate = function () {
        if (!game.isRunning) return;

        requestAnimationFrame(game.animate.bind(game));
        if (game.isPaused) return;

        const deltaTime = game.clock.getDelta();

        // --- Local updates ---
        if (game.playerController) game.playerController.update(deltaTime);
        if (weaponSystem) weaponSystem.update(deltaTime);
        if (bulletSystem) bulletSystem.update(deltaTime);

        // --- Multiplayer: send local transform ---
        if (mpClient && game.playerController?.mesh) {
            mpClient.sendTransform(game.playerController.mesh);

            // If firing, tell server also
            if (game.inputManager && game.inputManager.getAction("fire")) {
                mpClient.sendFire(game.playerController.mesh);
            }
        }

        // --- Multiplayer: update remote entities smoothing ---
        if (mpState) mpState.update(deltaTime);

        // --- Camera ---
        if (game.cameraSystem) game.cameraSystem.update(deltaTime);

        // --- Minimap ---
        // minimap currently expects enemies only.
        // We'll show remote players as "enemies" too.
        if (game.minimap && game.playerController?.mesh) {
            const remoteAsEnemies = mpState ? mpState.getRemotePlayers().map(p => ({ mesh: p.mesh })) : [];
            game.minimap.update(game.playerController.mesh, remoteAsEnemies);
        }

        // --- UI ---
        if (game.uiManager) {
            game.uiManager.update(
                game.playerController ? game.playerController.speed : 0,
                game.playerController ? (game.playerController.health ?? 100) : 100,
                0 // score placeholder (use mp data later)
            );
        }

        // --- Render ---
        game.renderer.render(game.scene, game.camera);
    };

    // Start loop
    game.animate();
});


// ==========================================================
// ✅ Lobby UI (HTML-free)
// Creates overlay controls inside multiplayer.html automatically
// ==========================================================

function setupLobbyUI() {
    lobbyUI = document.createElement("div");
    lobbyUI.id = "lobby-ui";

    Object.assign(lobbyUI.style, {
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "14px 16px",
        background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "12px",
        color: "white",
        fontFamily: "Courier New, monospace",
        zIndex: 9999,
        display: "flex",
        gap: "10px",
        alignItems: "center",
        flexWrap: "wrap"
    });

    nameInput = document.createElement("input");
    nameInput.placeholder = "Name";
    styleInput(nameInput);

    roomInput = document.createElement("input");
    roomInput.placeholder = "Room ID";
    styleInput(roomInput);
    roomInput.style.width = "100px";
    roomInput.style.textTransform = "uppercase";

    createBtn = document.createElement("button");
    createBtn.innerText = "Create Room";
    styleButton(createBtn);

    joinBtn = document.createElement("button");
    joinBtn.innerText = "Join Room";
    styleButton(joinBtn);

    startBtn = document.createElement("button");
    startBtn.innerText = "Start Game";
    styleButton(startBtn);
    startBtn.style.display = "none";

    lobbyStatus = document.createElement("div");
    lobbyStatus.style.marginLeft = "10px";
    lobbyStatus.style.opacity = "0.95";
    lobbyStatus.style.minWidth = "250px";
    lobbyStatus.innerText = "Connecting...";

    const playerList = document.createElement("div");
    playerList.id = "lobby-players";
    playerList.style.width = "100%";
    playerList.style.marginTop = "6px";
    playerList.style.fontSize = "13px";
    playerList.style.opacity = "0.9";

    lobbyUI.appendChild(nameInput);
    lobbyUI.appendChild(roomInput);
    lobbyUI.appendChild(createBtn);
    lobbyUI.appendChild(joinBtn);
    lobbyUI.appendChild(startBtn);
    lobbyUI.appendChild(lobbyStatus);
    lobbyUI.appendChild(playerList);

    document.body.appendChild(lobbyUI);
}

function styleInput(el) {
    Object.assign(el.style, {
        padding: "10px",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.2)",
        outline: "none",
        background: "rgba(10,10,10,0.8)",
        color: "white",
        width: "140px"
    });
}

function styleButton(btn) {
    Object.assign(btn.style, {
        padding: "10px 12px",
        borderRadius: "10px",
        border: "none",
        cursor: "pointer",
        background: "#1abc9c",
        color: "black",
        fontWeight: "bold"
    });
}

function setStatus(text) {
    if (lobbyStatus) lobbyStatus.innerText = text;
    console.log("[Lobby]", text);
}

function renderLobbyPlayers(players) {
    const box = document.getElementById("lobby-players");
    if (!box) return;

    if (!players || players.length === 0) {
        box.innerText = "";
        return;
    }

    const lines = players.map(p => {
        const hostTag = p.isHost ? " 👑" : "";
        return `• ${p.name}${hostTag}`;
    });

    box.innerText = "Players:\n" + lines.join("\n");
}

function hideLobbyUI() {
    if (lobbyUI) lobbyUI.style.display = "none";
}

function showLobbyUI() {
    if (lobbyUI) lobbyUI.style.display = "flex";
}
