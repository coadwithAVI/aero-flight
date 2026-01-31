// ==========================================
// PATH: gameplay/player-controller.js
// ==========================================

/**
 * PlayerController (FINAL)
 * ✅ Fix: Bank-to-Turn => A/D roll se actual turning (direction change) hoga
 * ✅ dt based movement
 * ✅ speed control boost/brake
 * ✅ world bounds + altitude clamp
 * ✅ optional gravity
 *
 * Requirements:
 * - PHYSICS_CONFIG, WORLD_CONFIG global
 * - InputManager instance (supports getAxes())
 */

class PlayerController {
    constructor(scene, inputManager) {
        this.scene = scene;
        this.input = inputManager;

        // Mesh
        this.mesh = null;

        // Stats
        this.health = 100;

        // Speed state
        this.speed = PHYSICS_CONFIG.minSpeed;
        this.targetSpeed = PHYSICS_CONFIG.minSpeed;

        // Spawn
        this.spawnPoint = new THREE.Vector3(0, 250, 0);

        // Internal reusable
        this._tmpVec = new THREE.Vector3();
        this._tmpQuat = new THREE.Quaternion();

        // Model
        this.initModel();
    }

    // ==========================================================
    // MODEL
    // ==========================================================
    initModel() {
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
    // UPDATE
    // ==========================================================
    update(deltaTime) {
        if (!this.mesh) return;

        // clamp dt for stability
        const dt = Math.min(deltaTime, 0.05);

        // ======================================================
        // 1) Speed Control (dt-based)
        // ======================================================
        const boosting = this.input.getAction("boost");
        const braking = this.input.getAction("brake");

        if (boosting) this.targetSpeed = PHYSICS_CONFIG.boostSpeed;
        else if (braking) this.targetSpeed = 0;
        else this.targetSpeed = PHYSICS_CONFIG.maxSpeed;

        this.targetSpeed = clamp(this.targetSpeed, 0, PHYSICS_CONFIG.boostSpeed);

        const speedDiff = this.targetSpeed - this.speed;
        const accel = speedDiff > 0 ? PHYSICS_CONFIG.acceleration : PHYSICS_CONFIG.deceleration;
        const scaledAccel = 1 - Math.pow(1 - accel, dt * 60);

        this.speed += speedDiff * scaledAccel;

        // Drag
        if (!boosting && PHYSICS_CONFIG.drag != null) {
            // Convert per-frame drag to dt-based
            // (drag=0.98 tuned at 60fps)
            const dragDt = Math.pow(PHYSICS_CONFIG.drag, dt * 60);
            this.speed *= dragDt;
        }

        // Stall drift
        if (this.speed > 0 && this.speed < PHYSICS_CONFIG.minSpeed) {
            this.mesh.position.y -= 10 * dt;
        }

        // ======================================================
        // 2) Inputs (Axes)
        // ======================================================
        let pitchInput = 0, rollInput = 0, yawInput = 0;

        if (this.input && typeof this.input.getAxes === "function") {
            const axes = this.input.getAxes();
            pitchInput = axes.pitch;
            rollInput = axes.roll;
            yawInput = axes.yaw;
        } else {
            pitchInput = (this.input.getAction("pitchUp") ? 1 : 0) - (this.input.getAction("pitchDown") ? 1 : 0);
            rollInput  = (this.input.getAction("rollLeft") ? 1 : 0) - (this.input.getAction("rollRight") ? 1 : 0);
            yawInput   = (this.input.getAction("yawLeft") ? 1 : 0) - (this.input.getAction("yawRight") ? 1 : 0);
        }

        // ======================================================
        // 3) Manual rotation
        // ======================================================
        const pitchChange = pitchInput * PHYSICS_CONFIG.pitchSpeed * dt * 60;
        const rollChange  = rollInput  * PHYSICS_CONFIG.rollSpeed  * dt * 60;
        const yawChange   = yawInput   * PHYSICS_CONFIG.yawSpeed   * dt * 60;

        this.mesh.rotateX(pitchChange);
        this.mesh.rotateZ(rollChange);
        this.mesh.rotateY(yawChange);

        // ======================================================
        // ✅ 4) BANK TO TURN (MAIN FIX)
        // ======================================================
        // rollAngle: right wing down => positive/negative depends on rotation direction
        const rollAngle = this.mesh.rotation.z;

        // speed ratio (0..1)
        const speedRatio = clamp(
            (this.speed - PHYSICS_CONFIG.minSpeed) /
            Math.max(0.0001, (PHYSICS_CONFIG.maxSpeed - PHYSICS_CONFIG.minSpeed)),
            0,
            1
        );

        // turning strength depends on speed
        const bankStrength = 0.01 + speedRatio * 0.045;   // tune this for more/less turning
        const autoYaw = -rollAngle * bankStrength * dt * 60;

        this.mesh.rotateY(autoYaw);

        // ======================================================
        // 5) Forward movement
        // ======================================================
        const moveAmount = this.speed * dt * 60;
        this.mesh.translateZ(moveAmount);

        // ======================================================
        // 6) World bounds + altitude clamp
        // ======================================================
        const floor = (WORLD_CONFIG.waterLevel ?? 0) + 5;
        const ceiling = WORLD_CONFIG.ceilingHeight ?? 1000;

        if (this.mesh.position.y < floor) this.mesh.position.y = floor;
        if (this.mesh.position.y > ceiling) this.mesh.position.y = ceiling;

        const ws = WORLD_CONFIG.worldSize ?? 10000;
        const half = ws * 0.5;

        this.mesh.position.x = clamp(this.mesh.position.x, -half, half);
        this.mesh.position.z = clamp(this.mesh.position.z, -half, half);

        // ======================================================
        // 7) Gravity (optional)
        // ======================================================
        if (PHYSICS_CONFIG.gravity && PHYSICS_CONFIG.gravity > 0) {
            this.mesh.position.y -= PHYSICS_CONFIG.gravity * dt * 60;
        }
    }

    // ==========================================================
    // HELPERS
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

// ==========================================================
// Utils
// ==========================================================
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

// Global export
window.PlayerController = PlayerController;
