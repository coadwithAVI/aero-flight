// ==========================================
// PATH: core/game-manager.js
// ==========================================

/**
 * GameManager
 * Single source for:
 * - Scene / Camera / Renderer setup
 * - Main update/render loop
 * - Global pause/run control
 * - Audio unlock bootstrap
 * - Settings (localStorage) integration
 *
 * Other systems are attached from main files:
 *  - map: GameMap
 *  - inputManager: InputManager
 *  - playerController: PlayerController
 *  - enemyManager: EnemyManager
 *  - cameraSystem: CameraSystem
 *  - uiManager: UIManager
 *  - minimap: MinimapSystem
 *
 * Extra systems can be pushed into:
 *  - this.updateHooks (called every frame before render)
 */

class GameManager {
    constructor() {
        // Three core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Systems (attached later)
        this.map = null;
        this.inputManager = null;
        this.playerController = null;
        this.enemyManager = null;
        this.cameraSystem = null;
        this.uiManager = null;
        this.minimap = null;

        // Audio
        this.sfx = null;
        this.music = null;
        this.audioStarted = false;

        // Loop state
        this.isRunning = false;
        this.isPaused = false;

        // Hooks for multiplayer/singleplayer additional updates
        this.updateHooks = [];

        // Settings
        this.settings = this.loadSettings();

        // Internal bind
        this._animate = this._animate.bind(this);
    }

    // ==========================================================
    // SETTINGS
    // ==========================================================

    loadSettings() {
        const STORAGE_KEY = "SKY_PILOT_SETTINGS";

        const defaults = {
            masterVolume: GAME_CONFIG?.masterVolume ?? 1.0,
            musicVolume: GAME_CONFIG?.musicVolume ?? 0.7,
            sfxVolume: GAME_CONFIG?.sfxVolume ?? 1.0,
            sensitivity: GAME_CONFIG?.sensitivity ?? 1.0,
            invertY: GAME_CONFIG?.invertY ?? false
        };

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            return { ...defaults, ...parsed };
        } catch (e) {
            return defaults;
        }
    }

    applySettings() {
        // Input settings
        if (this.inputManager) {
            this.inputManager.sensitivity = this.settings.sensitivity ?? 1.0;
            this.inputManager.invertY = !!this.settings.invertY;
        }

        // Audio settings
        if (this.sfx && this.sfx.masterGain) {
            // master volume affects all sfx
            const master = this.settings.masterVolume ?? 1.0;
            const sfxVol = this.settings.sfxVolume ?? 1.0;
            this.sfx.masterGain.gain.value = 0.3 * master * sfxVol;
        }

        if (this.music && this.music.masterGain) {
            const master = this.settings.masterVolume ?? 1.0;
            const musicVol = this.settings.musicVolume ?? 0.7;
            this.music.masterGain.gain.value = 0.15 * master * musicVol;
        }
    }

    // ==========================================================
    // INIT
    // ==========================================================

    init() {
        console.log(`Initializing Sky Pilot v${GAME_CONFIG.version}...`);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            WORLD_CONFIG.worldSize
        );

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: GAME_CONFIG.antialiasing
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio * (GAME_CONFIG.resolutionScale ?? 1.0));

        if (GAME_CONFIG.shadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        document.body.appendChild(this.renderer.domElement);

        window.addEventListener("resize", () => this.onWindowResize());

        // UI + minimap by default
        this.uiManager = this.uiManager || new UIManager();
        this.minimap = this.minimap || new MinimapSystem();

        // Audio
        this.sfx = new SFXManager();
        this.music = typeof MusicManager !== "undefined" ? new MusicManager() : null;

        // Input
        this.inputManager = this.inputManager || new InputManager(this);

        // Apply settings (input + volumes)
        this.applySettings();

        // Unlock audio after first user interaction
        this.setupAudioUnlock();

        // Start loop
        this.isRunning = true;
        this.clock.start();
        requestAnimationFrame(this._animate);

        console.log("✅ GameManager initialized.");
    }

    setupAudioUnlock() {
        const unlock = () => {
            this.startAudioContext();
            window.removeEventListener("mousedown", unlock);
            window.removeEventListener("keydown", unlock);
            window.removeEventListener("touchstart", unlock);
        };

        window.addEventListener("mousedown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        window.addEventListener("touchstart", unlock, { once: true });
    }

    startAudioContext() {
        if (this.audioStarted) return;

        this.audioStarted = true;

        // init SFX
        if (this.sfx) this.sfx.init();

        // init music but don't auto play unless you want
        if (this.music && this.music.init) this.music.init();

        this.applySettings();

        console.log("🔊 Audio unlocked.");
    }

    // ==========================================================
    // CONTROL
    // ==========================================================

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }

    stop() {
        this.isRunning = false;
        console.log("🛑 Game stopped.");
    }

    // ==========================================================
    // LOOP
    // ==========================================================

    _animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(this._animate);

        if (this.isPaused) return;

        const dt = this.clock.getDelta();

        // 1) Input (optional per-frame logic)
        // NOTE: safe even if update doesn't exist
        if (this.inputManager && typeof this.inputManager.update === "function") {
            this.inputManager.update(dt);
        }

        // 2) Player update
        if (this.playerController) {
            this.playerController.update(dt);

            // Engine SFX pitch based on speed
            if (this.sfx && this.audioStarted) {
                const min = PHYSICS_CONFIG.minSpeed;
                const max = PHYSICS_CONFIG.maxSpeed;
                const ratio = (this.playerController.speed - min) / (max - min);
                const clamped = Math.max(0, Math.min(1, ratio));
                this.sfx.updateEnginePitch(clamped);
            }
        }

        // 3) Enemies
        if (this.enemyManager) {
            this.enemyManager.update(dt);
        }

        // 4) Camera
        if (this.cameraSystem) {
            this.cameraSystem.update(dt);
        }

        // 5) Extra hooks (WeaponSystem, BulletSystem, CollisionSystem, MPState etc.)
        for (let i = 0; i < this.updateHooks.length; i++) {
            try {
                this.updateHooks[i](dt);
            } catch (e) {
                console.warn("[GameManager] updateHook error:", e);
            }
        }

        // 6) Minimap (works with enemies array)
        if (this.minimap && this.playerController?.mesh) {
            const enemies = this.enemyManager ? this.enemyManager.enemies : [];
            this.minimap.update(this.playerController.mesh, enemies);
        }

        // 7) UI
        if (this.uiManager) {
            this.uiManager.update(
                this.playerController ? this.playerController.speed : 0,
                this.playerController ? (this.playerController.health ?? 100) : 100,
                this.enemyManager ? (this.enemyManager.score ?? 0) : 0
            );
        }

        // 8) Render
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ==========================================================
    // Hooks API
    // ==========================================================

    addUpdateHook(fn) {
        if (typeof fn !== "function") return;
        this.updateHooks.push(fn);
    }

    removeUpdateHook(fn) {
        const idx = this.updateHooks.indexOf(fn);
        if (idx !== -1) this.updateHooks.splice(idx, 1);
    }
}

// Global for non-module build
window.GameManager = GameManager;
