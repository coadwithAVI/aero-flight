// ==========================================
// PATH: gameplay/player-controller.js
// ==========================================

class PlayerController {
    constructor(scene, inputManager) {
        this.scene = scene;
        this.input = inputManager;

        this.mesh = null;
        this.health = 100;

        // speed state
        this.speed = PHYSICS_CONFIG.minSpeed;
        this.targetSpeed = PHYSICS_CONFIG.minSpeed;

        // spawn
        this.spawnPoint = new THREE.Vector3(0, 250, 0);

        // ✅ Desired angles (arcade smooth controls)
        this.desiredPitch = 0; // X
        this.desiredRoll = 0;  // Z

        // ✅ tuning
        this.maxPitch = 0.6;
        this.maxRoll = 0.9;

        this.pitchResponse = 0.12;
        this.rollResponse = 0.12;

        // ✅ turning from bank
        this.bankTurnStrength = 0.04;

        this.initModel();
    }

    initModel() {
        this.mesh = new THREE.Group();

        // Body
        const bodyGeo = new THREE.ConeGeometry(1.6, 7.5, 16);
        bodyGeo.rotateX(Math.PI / 2); // ✅ model forward alignment
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

        this.respawnInstant();
        this.scene.add(this.mesh);
    }

    respawnInstant() {
        if (!this.mesh) return;

        this.health = 100;
        this.speed = PHYSICS_CONFIG.minSpeed;
        this.targetSpeed = PHYSICS_CONFIG.minSpeed;

        this.desiredPitch = 0;
        this.desiredRoll = 0;

        this.mesh.position.copy(this.spawnPoint);
        this.mesh.rotation.set(0, 0, 0);
        this.mesh.quaternion.set(0, 0, 0, 1);
    }

    update(deltaTime) {
        if (!this.mesh) return;

        const dt = Math.min(deltaTime, 0.05);

        // ======================================================
        // 1) Speed
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

        // dt drag
        if (!boosting && PHYSICS_CONFIG.drag != null) {
            const dragDt = Math.pow(PHYSICS_CONFIG.drag, dt * 60);
            this.speed *= dragDt;
        }

        // ======================================================
        // 2) Inputs -> desired pitch/roll
        // ======================================================
        const pitchInput =
            (this.input.getAction("pitchUp") ? 1 : 0) -
            (this.input.getAction("pitchDown") ? 1 : 0);

        const rollInput =
            (this.input.getAction("rollRight") ? 1 : 0) -
            (this.input.getAction("rollLeft") ? 1 : 0);

        // desired angles
        this.desiredPitch = (-pitchInput) * this.maxPitch;
        this.desiredRoll = (rollInput) * this.maxRoll;

        // ======================================================
        // 3) Smooth stabilization (pitch + roll)
        // ======================================================
        const pitchT = 1 - Math.pow(0.001, dt * this.pitchResponse * 60);
        const rollT  = 1 - Math.pow(0.001, dt * this.rollResponse * 60);

        this.mesh.rotation.x = lerp(this.mesh.rotation.x, this.desiredPitch, pitchT);
        this.mesh.rotation.z = lerp(this.mesh.rotation.z, this.desiredRoll, rollT);

        // ======================================================
        // 4) Bank-to-turn (yaw)
        // ======================================================
        const rollAngle = this.mesh.rotation.z;

        const speedRatio = clamp(
            (this.speed - PHYSICS_CONFIG.minSpeed) /
            Math.max(0.0001, (PHYSICS_CONFIG.maxSpeed - PHYSICS_CONFIG.minSpeed)),
            0,
            1
        );

        const yawStrength = (0.01 + speedRatio * this.bankTurnStrength);
        this.mesh.rotateY(-rollAngle * yawStrength * dt * 60);

        // ======================================================
        // 5) Forward movement
        // ======================================================
        this.mesh.translateZ(this.speed * dt * 60);

        // ======================================================
        // 6) Bounds
        // ======================================================
        const floor = (WORLD_CONFIG.waterLevel ?? 0) + 5;
        const ceiling = WORLD_CONFIG.ceilingHeight ?? 1000;

        if (this.mesh.position.y < floor) this.mesh.position.y = floor;
        if (this.mesh.position.y > ceiling) this.mesh.position.y = ceiling;

        const ws = WORLD_CONFIG.worldSize ?? 10000;
        const half = ws * 0.5;
        this.mesh.position.x = clamp(this.mesh.position.x, -half, half);
        this.mesh.position.z = clamp(this.mesh.position.z, -half, half);

        // gravity optional
        if (PHYSICS_CONFIG.gravity && PHYSICS_CONFIG.gravity > 0) {
            this.mesh.position.y -= PHYSICS_CONFIG.gravity * dt * 60;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
    }

    getPosition() {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }

    getQuaternion() {
        return this.mesh ? this.mesh.quaternion : new THREE.Quaternion();
    }
}

// Utils
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}

window.PlayerController = PlayerController;
