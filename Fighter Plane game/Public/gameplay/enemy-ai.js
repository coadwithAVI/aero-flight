// ==========================================
// PATH: gameplay/enemy-ai.js
// ==========================================

/**
 * EnemyAI
 * Flight AI for enemies.
 *
 * Behavior:
 * - Patrol when far
 * - Chase player when in range
 * - Avoid/strafe when too close
 */

class EnemyAI {
    constructor(options = {}) {
        // --- Behavior tuning ---
        this.detectRange = options.detectRange ?? 5000;   // start chasing
        this.minDistance = options.minDistance ?? 150;    // too close -> strafe / overshoot

        // --- Movement tuning ---
        this.baseSpeed = options.baseSpeed ?? 160;        // units/sec (dt-based)
        this.turnSpeed = options.turnSpeed ?? 2.4;        // slerp factor multiplier
        this.patrolTurn = options.patrolTurn ?? 0.6;

        // --- Altitude handling ---
        this.altitudeKeepStrength = options.altitudeKeepStrength ?? 0.6; // how strongly keeps altitude

        // Cached reusable objects
        this._lookMatrix = new THREE.Matrix4();
        this._targetQuat = new THREE.Quaternion();
        this._tempVec = new THREE.Vector3();
        this._forward = new THREE.Vector3(0, 0, 1);
    }

    /**
     * @param {Object} enemy  must contain { mesh, speed }
     * @param {THREE.Vector3} playerPos
     * @param {number} dt seconds
     */
    update(enemy, playerPos, dt) {
        if (!enemy || !enemy.mesh) return;
        if (!playerPos) return;

        const mesh = enemy.mesh;
        const delta = Math.min(dt, 0.05);

        // Dynamic speed per enemy (enemy.speed acts as multiplier)
        const speedMul = enemy.speed ?? 0.6;
        const moveSpeed = this.baseSpeed * speedMul;

        // distance to player
        const dist = mesh.position.distanceTo(playerPos);

        // --- altitude correction (soft) ---
        // keep around player's altitude +/- some randomness
        const desiredAlt = playerPos.y; // (targetPos actually)
        const altDiff = desiredAlt - mesh.position.y;
        mesh.position.y += altDiff * this.altitudeKeepStrength * delta;

        // --- behavior ---
        if (dist <= this.detectRange && dist > this.minDistance) {
            // ========== CHASE ==========
            this._chase(mesh, playerPos, delta);

            // move forward
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
            mesh.position.addScaledVector(forward, moveSpeed * delta);

        } else if (dist <= this.minDistance) {
            // ========== TOO CLOSE: STRAFE / OVERSHOOT ==========
            // Turn slightly away so it doesn't clip into player forever
            // Add sideways drift
            mesh.rotateY((Math.random() > 0.5 ? 1 : -1) * 0.9 * delta);
            mesh.rotateZ((Math.random() > 0.5 ? 1 : -1) * 0.7 * delta);

            mesh.translateZ(moveSpeed * 1.15 * delta);

        } else {
            // ========== PATROL ==========
            // simple circle patrol
            mesh.rotateY(this.patrolTurn * delta);
            mesh.translateZ(moveSpeed * 0.65 * delta);
        }
    }

    _chase(mesh, playerPos, dt) {
        // Build lookAt matrix
        // NOTE: lookAt(from, to, up)
        this._lookMatrix.lookAt(mesh.position, playerPos, new THREE.Vector3(0,1,0));
        this._targetQuat.setFromRotationMatrix(this._lookMatrix);

        // Smooth rotate
        const slerpT = 1.0 - Math.pow(0.001, dt * this.turnSpeed * 60);
        mesh.quaternion.slerp(this._targetQuat, slerpT);
    }
}

// Global export
window.EnemyAI = EnemyAI;
