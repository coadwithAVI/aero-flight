// ==========================================
// PATH: core/game-manager.js
// ==========================================

class GameManager {
    constructor() {
        // Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Systems
        this.map = null;
        this.inputManager = null;

        this.playerController = null;
        this.cameraSystem = null;

        this.bulletSystem = null;
        this.weaponSystem = null;

        this.enemyManager = null;
        this.enemyAI = null; // (optional)

        this.collisionSystem = null;

        this.uiManager = null;
        this.minimap = null;

        // Audio
        this.sfx = null;
        this.music = null;
        this.audioStarted = false;

        // State
        this.isRunning = false;
        this.isPaused = false;

        // Debug
        this.debug = !!GAME_CONFIG.debugMode;
    }

    // ==========================================================
    // INIT
    // ==========================================================
    init() {
        console.log(`🚀 Initializing Sky Pilot v${GAME_CONFIG.version}...`);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            WORLD_CONFIG.worldSize ?? 10000
        );

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: !!GAME_CONFIG.antialiasing
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        const dpr = Math.min(1.0, window.devicePixelRatio || 1);
        this.renderer.setPixelRatio(dpr * (GAME_CONFIG.resolutionScale ?? 1.0));

        if (GAME_CONFIG.shadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        document.body.appendChild(this.renderer.domElement);

        // Resize handler
        window.addEventListener("resize", () => this.onWindowResize(), false);

        // ✅ Initialize Systems (order matters)
        this.initSystems();

        // Start
        this.isRunning = true;
        this.animate();

        console.log("✅ GameManager Initialized.");
    }

    initSystems() {
        // UI
        this.uiManager = new UIManager();

        // Minimap
        this.minimap = new MinimapSystem();

        // Audio
        this.sfx = new SFXManager();
        this.music = new MusicManager();

        // Input (pass GameManager so input can unlock audio if needed)
        this.inputManager = new InputManager(this);

        // Backup interaction for audio unlock
        window.addEventListener("mousedown", () => this.startAudioContext(), { once: true });
        window.addEventListener("touchstart", () => this.startAudioContext(), { once: true });

        // Map
        this.map = new GameMap(this.scene);
        this.terrainMesh

        // Player
        this.playerController = new PlayerController(this.scene, this.inputManager);

        // Camera follow
        this.cameraSystem = new CameraSystem(this.camera);
        this.cameraSystem.setTarget(this.playerController);

        // Bullets + weapon
        this.bulletSystem = new BulletSystem(this.scene);
        this.weaponSystem = new WeaponSystem(this.playerController, this.bulletSystem, this.inputManager);

        // Enemies
        this.enemyManager = new EnemyManager(this.scene, this.playerController);

        // Collision
        this.collisionSystem = new CollisionSystem(this.playerController, this.bulletSystem, this.enemyManager, this.sfx);

        // Set initial camera
        if (this.playerController && this.playerController.mesh) {
            this.camera.position.set(0, 260, 80);
            this.camera.lookAt(this.playerController.mesh.position);
        }
    }

    // ==========================================================
    // AUDIO UNLOCK
    // ==========================================================
    startAudioContext() {
        if (this.audioStarted) return;

        this.audioStarted = true;

        if (this.sfx) this.sfx.init();
        if (this.music) this.music.playBGM();

        console.log("🔊 Audio Context Started");
    }

    // ==========================================================
    // RESIZE
    // ==========================================================
    onWindowResize() {
        if (!this.camera || !this.renderer) return;

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ==========================================================
    // MAIN LOOP
    // ==========================================================
    animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(() => this.animate());

        if (this.isPaused) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const dt = this.clock.getDelta();

        // ---- INPUT (no update needed if your InputManager doesn't have update())
        if (this.inputManager && typeof this.inputManager.update === "function") {
            this.inputManager.update(dt);
        }

        // ---- PLAYER
        if (this.playerController) {
            this.playerController.update(dt);
        }

        // ---- WEAPON + BULLETS
        if (this.weaponSystem) this.weaponSystem.update(dt);
        if (this.bulletSystem) this.bulletSystem.update(dt);

        // ---- ENEMIES
        if (this.enemyManager) this.enemyManager.update(dt);

        // ---- COLLISIONS
        if (this.collisionSystem) this.collisionSystem.update(dt);

        // ---- CAMERA
        if (this.cameraSystem) this.cameraSystem.update(dt);

        // ---- MINIMAP
        if (this.minimap && this.playerController && this.playerController.mesh) {
            this.minimap.update(
                this.playerController.mesh,
                this.enemyManager ? this.enemyManager.enemies : []
            );
        }

        // ---- UI UPDATE
        if (this.uiManager) {
            const baseSpeed = PHYSICS_CONFIG.baseSpeed ?? 2.2;
            const boosting = this.inputManager && this.inputManager.getAction("boost");
            const speedNow = boosting ? baseSpeed * (PHYSICS_CONFIG.boostMultiplier ?? 2.0) : baseSpeed;

            this.uiManager.update(
                speedNow,
                this.playerController ? (this.playerController.health ?? 100) : 100,
                this.enemyManager ? (this.enemyManager.score ?? 0) : 0,
                this.playerController ? (this.playerController.boostEnergy ?? (PHYSICS_CONFIG.boostMax ?? 100)) : (PHYSICS_CONFIG.boostMax ?? 100)
            );
        }

        // ---- SFX ENGINE PITCH
        if (this.sfx && this.audioStarted && this.inputManager) {
            const boosting = this.inputManager.getAction("boost");
            // 0.4 idle/normal, 1.0 boost
            this.sfx.updateEnginePitch(boosting ? 1.0 : 0.4);
        }

        // ---- RENDER
        this.renderer.render(this.scene, this.camera);
    }

    // ==========================================================
    // STATE HELPERS
    // ==========================================================
    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    stop() {
        this.isRunning = false;
    }
}

window.GameManager = GameManager;
