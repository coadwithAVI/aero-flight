// ==========================================
// PATH: gameplay/enemy-ai.js
// ==========================================

/**
 * EnemyAI (FINAL v4 - FIXED FOR +Z FORWARD)
 *
 * Fixes:
 * ✅ Correct turning towards target (your game uses +Z forward)
 * ✅ No more drifting away from rings
 * ✅ Close range overshoot fix (enemy never stops near player)
 * ✅ Speed multiplier works properly
 */

class EnemyAI {
    constructor(options = {}) {
        // behavior
        this.detectRange = options.detectRange ?? 5000;
        this.minDistance = options.minDistance ?? 220;

        // movement
        this.baseSpeed = options.baseSpeed ?? 120; // units/sec
        this.turnSpeed = options.turnSpeed ?? 2.6;
        this.patrolTurn = options.patrolTurn ?? 0.6;

        // altitude handling
        this.altitudeKeepStrength = options.altitudeKeepStrength ?? 0.55;
        this.altitudeOffsetRange = options.altitudeOffsetRange ?? 140;

        // terrain avoid
        this.terrainMesh = options.terrainMesh ?? null;
        this.terrainClearance = options.terrainClearance ?? 80; // how high above ground
        this.avoidLookAhead = options.avoidLookAhead ?? 220;     // forward ray distance

        this._raycaster = new THREE.Raycaster();
        this._down = new THREE.Vector3(0, -1, 0);
        this._forwardRayDir = new THREE.Vector3();
        this._avoidDir = new THREE.Vector3();
        this._hitPoint = new THREE.Vector3();

        // cached
        this._dir = new THREE.Vector3();
        this._forward = new THREE.Vector3(0, 0, 1); // ✅ +Z forward
        this._targetQuat = new THREE.Quaternion();
        this._tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
    }

    /**
     * @param {Object} enemy - must contain { mesh, speedMul }
     * @param {THREE.Vector3} targetPos
     * @param {number} dt
     */
    update(enemy, targetPos, dt) {
        if (!enemy?.mesh || !targetPos) return;

        const mesh = enemy.mesh;
        const delta = Math.min(dt, 0.05);

        // speed
        const speedMul = enemy.speedMul ?? enemy.speed ?? 1.0;
        const moveSpeed = this.baseSpeed * speedMul;

        // distance to target
        const dist = mesh.position.distanceTo(targetPos);

        // -------------------------------------------
        // Altitude keep (soft)
        // -------------------------------------------
        if (enemy.altOffset == null) {
            enemy.altOffset = (Math.random() * this.altitudeOffsetRange) - (this.altitudeOffsetRange * 0.5);
        }

        const desiredAlt = targetPos.y + enemy.altOffset;
        const altDiff = desiredAlt - mesh.position.y;
        mesh.position.y += altDiff * this.altitudeKeepStrength * delta;

        // ======================================================
        // 🏔 Terrain Avoidance (smooth)
        // ======================================================
        if (this.terrainMesh) {
            const fx = new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion);
            fx.normalize();

            // forward look point
            const lookX = mesh.position.x + fx.x * this.avoidLookAhead;
            const lookZ = mesh.position.z + fx.z * this.avoidLookAhead;

            const terrainYNow = this._getTerrainY(mesh.position.x, mesh.position.z);
            const terrainYForward = this._getTerrainY(lookX, lookZ);

            const minYNow = terrainYNow + this.terrainClearance;
            const minYForward = terrainYForward + this.terrainClearance;

            // if current too low -> push up
            if (mesh.position.y < minYNow) {
                mesh.position.y += (minYNow - mesh.position.y) * 0.12;
            }

            // if forward terrain is high -> climb early (avoid mountain)
            if (mesh.position.y < minYForward) {
                const climb = (minYForward - mesh.position.y);
                mesh.position.y += climb * 0.10;

                // small yaw drift to avoid straight collision
                mesh.rotateY((Math.random() > 0.5 ? 1 : -1) * 0.35 * dt);
            }
        }

        // -------------------------------------------
        // MAIN BEHAVIOR
        // -------------------------------------------
        // ✅ ALWAYS chase if targetPos is ring/player
        // (ring race mode should never do "too close circle strafe")
        if (dist <= this.detectRange) {
            this._turnTowards(mesh, targetPos, delta);
            mesh.translateZ(moveSpeed * delta);
        } else {
            // patrol only if target too far
            mesh.rotateY(this.patrolTurn * delta);
            mesh.translateZ(moveSpeed * 0.6 * delta);
        }}


    _getTerrainY(x, z) {
    if (!this.terrainMesh) return (WORLD_CONFIG.waterLevel ?? 0);

    this.terrainMesh.updateMatrixWorld(true);

    const origin = new THREE.Vector3(x, 5000, z);
    this._raycaster.set(origin, this._down);
    this._raycaster.far = 10000;

    const hits = this._raycaster.intersectObject(this.terrainMesh, true);
    if (hits && hits.length > 0) return hits[0].point.y;

    return (WORLD_CONFIG.waterLevel ?? 0);
    }


    /**
     * ✅ Correctly turns enemy so its +Z faces target
     */
    _turnTowards(mesh, targetPos, dt) {
        // direction vector from enemy to target
        this._dir.copy(targetPos).sub(mesh.position);

        // prevent NaN
        if (this._dir.lengthSq() < 0.0001) return;

        this._dir.normalize();

        // convert direction => yaw/pitch (for +Z forward)
        // yaw: angle in XZ plane
        const yaw = Math.atan2(this._dir.x, this._dir.z);

        // pitch: look up/down
        const pitch = -Math.asin(clamp(this._dir.y, -1, 1));

        this._tmpEuler.set(pitch, yaw, 0, "YXZ");
        this._targetQuat.setFromEuler(this._tmpEuler);

        // smooth rotation
        const slerpT = 1.0 - Math.pow(0.001, dt * this.turnSpeed * 60);
        mesh.quaternion.slerp(this._targetQuat, slerpT);
    }
}

// utils
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

window.EnemyAI = EnemyAI;
