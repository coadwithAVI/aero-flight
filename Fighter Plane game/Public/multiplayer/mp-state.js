// ==========================================
// PATH: multiplayer/mp-state.js
// ==========================================

/**
 * MPState
 * Keeps local multiplayer state in sync with server.
 *
 * Responsibilities:
 * - Track remote players (create/update/remove)
 * - Track remote bullets (optional)
 * - Smooth/interpolate remote movement
 * - Provide helper methods for rendering systems
 *
 * Expected server messages (generic):
 * - STATE: { t:"STATE", tick, time, players:[], bullets:[] }
 * - EVENT: { t:"EVENT", type, ... }
 *
 * Player object expected shape (flexible):
 * {
 *   id: "abc",
 *   name: "Avi",
 *   p: {x,y,z},      // position
 *   q: {x,y,z,w},    // quaternion
 *   hp: 100,
 *   score: 0
 * }
 */

class MPState {
    constructor(scene, options = {}) {
        this.scene = scene;

        // Local identity
        this.localId = options.localId || null;

        // Remote players & bullets
        this.players = new Map(); // id -> PlayerEntity
        this.bullets = new Map(); // id -> BulletEntity (optional)

        // Tuning
        this.positionLerp = options.positionLerp ?? 0.18;  // smoothing factor
        this.rotationSlerp = options.rotationSlerp ?? 0.22;
        this.maxExtrapolateMs = options.maxExtrapolateMs ?? 250;
        this.entityTimeoutMs = options.entityTimeoutMs ?? 5000;

        // Snapshot timing
        this.lastSnapshotTick = 0;
        this.lastSnapshotAt = 0;

        // Optional model factory
        this.modelFactory = options.modelFactory || null;

        // Debug
        this.debug = options.debug ?? false;
    }

    // ==========================================================
    // Identity
    // ==========================================================

    setLocalId(id) {
        this.localId = id;
    }

    // ==========================================================
    // Server Updates
    // ==========================================================

    /**
     * Apply a full world snapshot from server
     * msg: { players:[], bullets:[], tick, time }
     */
    applyServerState(msg) {
        if (!msg) return;

        const now = performance.now();
        this.lastSnapshotAt = now;
        this.lastSnapshotTick = msg.tick ?? this.lastSnapshotTick;

        // --- Players ---
        if (Array.isArray(msg.players)) {
            const seen = new Set();

            for (const pdata of msg.players) {
                const id = pdata.id ?? pdata.clientId ?? pdata.pid;
                if (!id) continue;

                seen.add(id);

                // ignore local player if server includes it
                if (this.localId && id === this.localId) continue;

                this._upsertRemotePlayer(id, pdata, now);
            }

            // Remove players not seen (cleanup)
            this._cleanupMissingPlayers(seen, now);
        }

        // --- Bullets (optional) ---
        if (Array.isArray(msg.bullets)) {
            const seenB = new Set();
            for (const b of msg.bullets) {
                const bid = b.id ?? b.bid;
                if (!bid) continue;
                seenB.add(bid);
                this._upsertRemoteBullet(bid, b, now);
            }
            this._cleanupMissingBullets(seenB, now);
        }
    }

    /**
     * Apply server events like explosions, player killed, respawn etc.
     * msg: { type: "KILL"|"RESPAWN"|... }
     */
    applyServerEvent(msg) {
        if (!msg || !msg.type) return;

        switch (msg.type) {
            case "PLAYER_LEFT": {
                const id = msg.id;
                if (id) this.removePlayer(id);
                break;
            }

            case "RESPAWN": {
                // optional: reset remote player state
                const id = msg.id;
                const p = msg.p;
                const q = msg.q;
                const ent = this.players.get(id);
                if (ent && p) {
                    ent.targetPos.set(p.x, p.y, p.z);
                    ent.mesh.position.copy(ent.targetPos);
                }
                if (ent && q) {
                    ent.targetQuat.set(q.x, q.y, q.z, q.w);
                    ent.mesh.quaternion.copy(ent.targetQuat);
                }
                break;
            }

            default:
                break;
        }
    }

    // ==========================================================
    // Frame Update (Interpolation)
    // ==========================================================

    /**
     * Call every render tick (deltaTime from clock)
     * Smooths remote movement.
     */
    update(deltaTime) {
        const now = performance.now();

        // Update players
        for (const [id, ent] of this.players.entries()) {
            // Timeout cleanup
            if (now - ent.lastSeenAt > this.entityTimeoutMs) {
                this.removePlayer(id);
                continue;
            }

            // Position smoothing
            ent.mesh.position.lerp(ent.targetPos, this.positionLerp);

            // Rotation smoothing
            ent.mesh.quaternion.slerp(ent.targetQuat, this.rotationSlerp);

            // Optional name tag face camera? (future)
        }

        // Update bullets (optional)
        for (const [id, b] of this.bullets.entries()) {
            if (now - b.lastSeenAt > this.entityTimeoutMs) {
                this.removeBullet(id);
                continue;
            }

            // Smooth bullet movement
            b.mesh.position.lerp(b.targetPos, 0.35);
        }
    }

    // ==========================================================
    // Player Entities
    // ==========================================================

    _upsertRemotePlayer(id, pdata, now) {
        let ent = this.players.get(id);

        if (!ent) {
            ent = this._createRemotePlayerEntity(id, pdata);
            this.players.set(id, ent);
        }

        ent.lastSeenAt = now;

        // --- Apply data ---
        const p = pdata.p || pdata.position;
        if (p) ent.targetPos.set(p.x, p.y, p.z);

        const q = pdata.q || pdata.quaternion;
        if (q) ent.targetQuat.set(q.x, q.y, q.z, q.w);

        ent.hp = pdata.hp ?? ent.hp;
        ent.score = pdata.score ?? ent.score;
        ent.name = pdata.name ?? ent.name;
    }

    _createRemotePlayerEntity(id, pdata) {
        const mesh = this.modelFactory?.createPlayerPlane
            ? this.modelFactory.createPlayerPlane()
            : this._createFallbackRemotePlane();

        // Make remote player visually different
        mesh.traverse((obj) => {
            if (obj.isMesh && obj.material) {
                obj.material = obj.material.clone();
                obj.material.transparent = true;
                obj.material.opacity = 0.95;
                obj.material.emissive = new THREE.Color(0x111111);
            }
        });

        mesh.name = `remote-player-${id}`;
        this.scene.add(mesh);

        const p = pdata.p || pdata.position || { x: 0, y: 250, z: 0 };
        const q = pdata.q || pdata.quaternion || { x: 0, y: 0, z: 0, w: 1 };

        mesh.position.set(p.x, p.y, p.z);
        mesh.quaternion.set(q.x, q.y, q.z, q.w);

        return {
            id,
            mesh,
            name: pdata.name || "Pilot",
            hp: pdata.hp ?? 100,
            score: pdata.score ?? 0,
            targetPos: new THREE.Vector3(p.x, p.y, p.z),
            targetQuat: new THREE.Quaternion(q.x, q.y, q.z, q.w),
            lastSeenAt: performance.now()
        };
    }

    _cleanupMissingPlayers(seen, now) {
        for (const [id, ent] of this.players.entries()) {
            if (!seen.has(id)) {
                // if server omitted this player in snapshot -> remove
                this.removePlayer(id);
            }
        }
    }

    removePlayer(id) {
        const ent = this.players.get(id);
        if (!ent) return;

        this.scene.remove(ent.mesh);
        this.players.delete(id);

        if (this.debug) console.log("[MPState] Removed player:", id);
    }

    // ==========================================================
    // Bullets (optional)
    // ==========================================================

    _upsertRemoteBullet(id, bdata, now) {
        let ent = this.bullets.get(id);

        if (!ent) {
            ent = this._createRemoteBulletEntity(id, bdata);
            this.bullets.set(id, ent);
        }

        ent.lastSeenAt = now;

        const p = bdata.p || bdata.position;
        if (p) ent.targetPos.set(p.x, p.y, p.z);
    }

    _createRemoteBulletEntity(id, bdata) {
        const geo = new THREE.SphereGeometry(0.35, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const mesh = new THREE.Mesh(geo, mat);

        const p = bdata.p || bdata.position || { x: 0, y: 250, z: 0 };
        mesh.position.set(p.x, p.y, p.z);

        mesh.name = `remote-bullet-${id}`;
        this.scene.add(mesh);

        return {
            id,
            mesh,
            targetPos: new THREE.Vector3(p.x, p.y, p.z),
            lastSeenAt: performance.now()
        };
    }

    _cleanupMissingBullets(seen, now) {
        for (const [id, ent] of this.bullets.entries()) {
            if (!seen.has(id)) this.removeBullet(id);
        }
    }

    removeBullet(id) {
        const ent = this.bullets.get(id);
        if (!ent) return;

        this.scene.remove(ent.mesh);
        this.bullets.delete(id);
    }

    // ==========================================================
    // Fallback models
    // ==========================================================

    _createFallbackRemotePlane() {
        const mesh = new THREE.Group();

        const bodyGeo = new THREE.ConeGeometry(1.2, 6, 10);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x00bfff, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        mesh.add(body);

        const wingGeo = new THREE.BoxGeometry(7, 0.15, 2);
        const wingMat = new THREE.MeshPhongMaterial({ color: 0x0066aa, flatShading: true });
        const wings = new THREE.Mesh(wingGeo, wingMat);
        wings.position.set(0, 0, 0.5);
        mesh.add(wings);

        return mesh;
    }

    // ==========================================================
    // Helpers
    // ==========================================================

    getRemotePlayers() {
        // returns array of {id, mesh, ...}
        return Array.from(this.players.values());
    }
}

// Global fallback (non-modules)
window.MPState = MPState;
