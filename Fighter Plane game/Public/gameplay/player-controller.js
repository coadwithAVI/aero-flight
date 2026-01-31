// ==========================================
// PATH: gameplay/player-controller.js
// ==========================================

/**
 * PlayerController
 * Handles:
 * - spawning player plane mesh
 * - flight movement & rotation
 * - speed/boost/brake
 * - boundaries / crash safety
 *
 * Requirements:
 * - PHYSICS_CONFIG, WORLD_CONFIG available globally
 * - InputManager instance passed in constructor
 */

class PlayerController {
    constructor(scene, inputManager) {
        this.scene = scene;
        this.input = inputManager;

        // Mesh
        this.mesh = null;

        // Player stats
        this.health = 100;

        // Flight state
        this.speed = PHYSICS_CONFIG.minSpeed;
        this.targetSpeed = PHYSICS_CONFIG.minSpeed;

        // Spawn values
        this.spawnPoint = new THREE.Vector3(0, 250, 0);

        // Movement tuning
        this._forward = new THREE.Vector3(0, 0, 1); // local +Z in three translateZ
        this._tempVec = new THREE.Vector3();

        // Create model
        this.initModel();
    }

    // ==========================================================
    // Model / Spawn
    // ==========================================================

    initModel() {
        // If you want to use ModelFactory later:
        // const factory = new ModelFactory();
        // this.mesh = factory.createPlayerPlane();

        // Placeholder plane (clean version)
        this.mesh = new THREE.Group();

        // Body (fuselage)
        const bodyGeo = new THREE.ConeGeometry(1.6, 7.5, 16);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x3498db, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        this.mesh.add(body);

        // Wings
        const wingGeo = new THREE.BoxGeometry(9, 0.25, 2.2);
        const wingMat = new THREE.MeshPhongMaterial({ color: 0x1f6aa5, flatShading: true });
        const wings = new THREE.Mesh(wingGeo, wingMat);
        wings.position.set(0, 0, 0.6);
        wings.castShadow = true;
        this.mesh.add(wings);

        // Tail
        const tailGeo = new THREE.BoxGeometry(3.2, 0.2, 1.4);
        const tail = new THREE.Mesh(tailGeo, wingMat);
        tail.position.set(0, 0.15, -2.8);
        this.mesh.add(tail);

        // Fin
        const finGeo = new THREE.BoxGeometry(0.2, 2, 1);
        const fin = new THREE.Mesh(finGeo, wingMat);
        fin.position.set(0, 1.0, -2.7);
        this.mesh.add(fin);

        // Cockpit
        const cockpitGeo = new THREE.BoxGeometry(1.2, 0.7, 2);
        const cockpitMat = new THREE.MeshPhongMaterial({ color: 0x2c3e50, shininess: 90 });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.position.set(0, 0.55, 0.2);
        this.mesh.add(cockpit);

        // Spawn
        this.respawnInstant();

        this.scene.add(this.mesh);
    }

    respawnInstant() {
        if (!this.mesh) return;
        this.health = 100;
        this.speed = PHYSICS_CONFIG.minSpeed;
        this.targetSpeed = PHYSICS_CONFIG.minSpeed;

        this.mesh.position.copy(this.spawnPoint);
        this.mesh.rotation.set(0, 0, 0);
        this.mesh.quaternion.set(0, 0, 0, 1);
    }

    // ==========================================================
    // Update Loop
    // ==========================================================

    update(deltaTime) {
        if (!this.mesh) return;

        // ---- Pause shortcut ----
        if (this.input && this.input.getAction("pause")) {
            // GameManager should handle pause; controller doesn't own state
        }

        // Normalize dt (for stability)
        const dt = Math.min(deltaTime, 0.05); // max 50ms step

        // ======================================================
        // 1) Speed Control
        // ======================================================
        const boosting = this.input.getAction("boost");
        const braking = this.input.getAction("brake");

        if (boosting) this.targetSpeed = PHYSICS_CONFIG.boostSpeed;
        else if (braking) this.targetSpeed = 0;
        else this.targetSpeed = PHYSICS_CONFIG.maxSpeed;

        // Clamp target
        this.targetSpeed = Math.max(0, Math.min(PHYSICS_CONFIG.boostSpeed, this.targetSpeed));

        // Smooth speed change (fps independent)
        const speedDiff = this.targetSpeed - this.speed;

        // acceleration/deceleration tuned per frame -> convert to dt scaling
        // base approach: use exponential smoothing
        const accel = speedDiff > 0 ? PHYSICS_CONFIG.acceleration : PHYSICS_CONFIG.deceleration;

        // Convert old "per frame" approach to dt:
        // if accel=0.02 was tuned for 60fps, scale it:
        const scaledAccel = 1 - Math.pow(1 - accel, dt * 60);

        this.speed += speedDiff * scaledAccel;

        // Stall / min speed
        if (this.speed > 0 && this.speed < PHYSICS_CONFIG.minSpeed) {
            // drift down if too slow
            this.mesh.position.y -= 10 * dt;
        }

        // Apply drag when not boosting
        if (!boosting && PHYSICS_CONFIG.drag != null) {
            this.speed *= PHYSICS_CONFIG.drag;
        }

        // ======================================================
        // 2) Rotation Control (Pitch/Roll/Yaw)
        // ======================================================
        let pitchInput = 0, rollInput = 0, yawInput = 0;

        // Use getAxes if available
        if (this.input && typeof this.input.getAxes === "function") {
            const axes = this.input.getAxes();
            pitchInput = axes.pitch;
            rollInput = axes.roll;
            yawInput = axes.yaw;
        } else {
            // fallback
            pitchInput = (this.input.getAction("pitchUp") ? 1 : 0) - (this.input.getAction("pitchDown") ? 1 : 0);
            rollInput  = (this.input.getAction("rollLeft") ? 1 : 0) - (this.input.getAction("rollRight") ? 1 : 0);
            yawInput   = (this.input.getAction("yawLeft") ? 1 : 0) - (this.input.getAction("yawRight") ? 1 : 0);
        }

        // Apply rotation speeds (scaled with dt)
        const pitchChange = pitchInput * PHYSICS_CONFIG.pitchSpeed * dt * 60;
        const rollChange  = rollInput  * PHYSICS_CONFIG.rollSpeed  * dt * 60;
        const yawChange   = yawInput   * PHYSICS_CONFIG.yawSpeed   * dt * 60;

        this.mesh.rotateX(pitchChange);
        this.mesh.rotateZ(rollChange);
        this.mesh.rotateY(yawChange);

        // Arcade banking visual
        if (yawInput !== 0) {
            this.mesh.rotateZ(yawInput * -PHYSICS_CONFIG.turnBankingDelta * dt * 60);
        }

        // ======================================================
        // 3) Forward Movement
        // ======================================================

        // translateZ uses local axis (+Z)
        // Convert old per-frame speed to dt scaling
        const moveAmount = this.speed * dt * 60;
        this.mesh.translateZ(moveAmount);

        // ======================================================
        // 4) World Bounds / Altitude Clamp
        // ======================================================

        // Altitude limits
        const floor = (WORLD_CONFIG.waterLevel ?? 0) + 5;
        const ceiling = WORLD_CONFIG.ceilingHeight ?? 1000;

        if (this.mesh.position.y < floor) {
            this.mesh.position.y = floor;
        }
        if (this.mesh.position.y > ceiling) {
            this.mesh.position.y = ceiling;
        }

        // Optional: world size clamp
        const ws = WORLD_CONFIG.worldSize ?? 10000;
        const half = ws * 0.5;

        if (Math.abs(this.mesh.position.x) > half) {
            this.mesh.position.x = clamp(this.mesh.position.x, -half, half);
        }
        if (Math.abs(this.mesh.position.z) > half) {
            this.mesh.position.z = clamp(this.mesh.position.z, -half, half);
        }

        // ======================================================
        // 5) Gravity (optional)
        // ======================================================
        if (PHYSICS_CONFIG.gravity && PHYSICS_CONFIG.gravity > 0) {
            this.mesh.position.y -= PHYSICS_CONFIG.gravity * dt * 60;
        }
    }

    // ==========================================================
    // Helpers
    // ==========================================================

    getPosition() {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }

    getQuaternion() {
        return this.mesh ? this.mesh.quaternion : new THREE.Quaternion();
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
    }
}

// helper clamp
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

// Global export
window.PlayerController = PlayerController;
