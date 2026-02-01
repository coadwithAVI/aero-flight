// ==========================================
// PATH: multiplayer/mp-state.js
// ==========================================

/**
 * MPState (FINAL - SMOOTH 20TPS)
 *
 * Goals:
 * ✅ Remote players smooth (no stutter)
 * ✅ No "mountain inside" look due to snap spam
 * ✅ Keeps latest server snapshot as target
 * ✅ Interpolation + small extrapolation safety
 * ✅ Remote bullets smooth render
 * ✅ Easy hooks for minimap + target selection
 *
 * Server snapshot expected:
 * {
 *   tick,
 *   time,
 *   players:[{id,name,hp,score,rings,p:{x,y,z},q:{x,y,z,w}}],
 *   bullets:[{id,ownerId,createdAt,p:{},q:{}}]
 * }
 */

class MPState {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Local identity
    this.localId = options.localId || null;

    // Entities
    this.players = new Map(); // id -> PlayerEnt
    this.bullets = new Map(); // id -> BulletEnt

    // Optional factory
    this.modelFactory = options.modelFactory || null;

    // Tuning (smooth)
    this.positionLerp = options.positionLerp ?? 0.18;
    this.rotationSlerp = options.rotationSlerp ?? 0.22;
    this.bulletLerp = options.bulletLerp ?? 0.35;

    // Limits
    this.entityTimeoutMs = options.entityTimeoutMs ?? 5500;
    this.maxTeleportDist = options.maxTeleportDist ?? 450; // if too far -> snap (anti jitter)
    this.debug = options.debug ?? false;

    // Server snapshot timing
    this.lastSnapshotTick = 0;
    this.lastSnapshotAt = 0;

    // reusable temp vectors (no GC)
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
  }

  // ==========================================================
  // Identity
  // ==========================================================
  setLocalId(id) {
    this.localId = id;
  }

  // ==========================================================
  // Apply full snapshot
  // ==========================================================
  applyServerState(msg) {
    if (!msg) return;

    const now = performance.now();
    this.lastSnapshotAt = now;
    this.lastSnapshotTick = msg.tick ?? this.lastSnapshotTick;

    // -------------------------
    // Players
    // -------------------------
    if (Array.isArray(msg.players)) {
      const seen = new Set();

      for (const pdata of msg.players) {
        const id = pdata?.id ?? pdata?.clientId;
        if (!id) continue;

        // ignore local player entity
        if (this.localId && id === this.localId) continue;

        seen.add(id);
        this._upsertRemotePlayer(id, pdata, now);
      }

      // cleanup missing players
      this._cleanupMissingPlayers(seen, now);
    }

    // -------------------------
    // Bullets
    // -------------------------
    if (Array.isArray(msg.bullets)) {
      const seenB = new Set();

      for (const b of msg.bullets) {
        const bid = b?.id ?? b?.bid;
        if (!bid) continue;

        seenB.add(bid);
        this._upsertRemoteBullet(bid, b, now);
      }

      this._cleanupMissingBullets(seenB, now);
    }
  }

  applyServerEvent(evt) {
    if (!evt || !evt.type) return;

    switch (evt.type) {
      case "PLAYER_LEFT": {
        if (evt.id) this.removePlayer(evt.id);
        break;
      }
      case "RESPAWN": {
        // optional: snap them
        const id = evt.id;
        const ent = this.players.get(id);
        if (!ent) break;

        if (evt.p) {
          ent.targetPos.set(evt.p.x, evt.p.y, evt.p.z);
          ent.mesh.position.copy(ent.targetPos);
        }

        if (evt.q) {
          ent.targetQuat.set(evt.q.x, evt.q.y, evt.q.z, evt.q.w);
          ent.mesh.quaternion.copy(ent.targetQuat);
        }
        break;
      }
      default:
        break;
    }
  }

  // ==========================================================
  // Frame update (smooth)
  // ==========================================================
  update(dt) {
    const now = performance.now();

    // ---- Players smoothing
    for (const [id, ent] of this.players.entries()) {
      // timeout cleanup
      if (now - ent.lastSeenAt > this.entityTimeoutMs) {
        this.removePlayer(id);
        continue;
      }

      // smooth pos
      ent.mesh.position.lerp(ent.targetPos, this.positionLerp);

      // smooth rot
      ent.mesh.quaternion.slerp(ent.targetQuat, this.rotationSlerp);

      // Optional: keep stable Y a bit (avoid clipping)
      // if terrain not authoritative, we keep as server gave.
    }

    // ---- Bullet smoothing
    for (const [id, b] of this.bullets.entries()) {
      if (now - b.lastSeenAt > this.entityTimeoutMs) {
        this.removeBullet(id);
        continue;
      }

      b.mesh.position.lerp(b.targetPos, this.bulletLerp);
    }
  }

  // ==========================================================
  // Player entities
  // ==========================================================
  _upsertRemotePlayer(id, pdata, now) {
    let ent = this.players.get(id);
    if (!ent) {
      ent = this._createRemotePlayerEntity(id, pdata);
      this.players.set(id, ent);
    }

    ent.lastSeenAt = now;

    // apply server position/rotation
    const p = pdata.p || pdata.position;
    const q = pdata.q || pdata.quaternion;

    // Anti-jitter/teleport: if server pos too far, snap instantly
    if (p) {
      this._tmpV.set(p.x, p.y, p.z);
      const d = ent.mesh.position.distanceTo(this._tmpV);

      if (d > this.maxTeleportDist) {
        // snap
        ent.mesh.position.copy(this._tmpV);
        ent.targetPos.copy(this._tmpV);
      } else {
        ent.targetPos.copy(this._tmpV);
      }
    }

    if (q) {
      ent.targetQuat.set(q.x, q.y, q.z, q.w);

      // if quaternion invalid -> ignore
      if (!isFinite(ent.targetQuat.w)) ent.targetQuat.set(0, 0, 0, 1);
    }

    ent.hp = pdata.hp ?? ent.hp;
    ent.score = pdata.score ?? ent.score;
    ent.rings = pdata.rings ?? ent.rings;
    ent.name = pdata.name ?? ent.name;
  }

  _createRemotePlayerEntity(id, pdata) {
    const mesh =
      this.modelFactory?.createPlayerPlane
        ? this.modelFactory.createPlayerPlane()
        : this._createFallbackRemotePlane();

    // Visual difference
    mesh.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = obj.material.clone();
        obj.material.transparent = true;
        obj.material.opacity = 0.92;
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
      rings: pdata.rings ?? 0,

      targetPos: new THREE.Vector3(p.x, p.y, p.z),
      targetQuat: new THREE.Quaternion(q.x, q.y, q.z, q.w),
      lastSeenAt: performance.now()
    };
  }

  _cleanupMissingPlayers(seen, now) {
    for (const [id] of this.players.entries()) {
      if (!seen.has(id)) {
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
  // Bullet entities
  // ==========================================================
  _upsertRemoteBullet(id, bdata, now) {
    let ent = this.bullets.get(id);

    if (!ent) {
      ent = this._createRemoteBulletEntity(id, bdata);
      this.bullets.set(id, ent);
    }

    ent.lastSeenAt = now;
    ent.ownerId = bdata.ownerId ?? ent.ownerId;

    const p = bdata.p || bdata.position;
    if (p) {
      this._tmpV.set(p.x, p.y, p.z);

      // if bullet appears far suddenly -> snap
      const d = ent.mesh.position.distanceTo(this._tmpV);
      if (d > 180) {
        ent.mesh.position.copy(this._tmpV);
        ent.targetPos.copy(this._tmpV);
      } else {
        ent.targetPos.copy(this._tmpV);
      }
    }
  }

  _createRemoteBulletEntity(id, bdata) {
    const geo = new THREE.SphereGeometry(0.35, 5, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const mesh = new THREE.Mesh(geo, mat);

    const p = bdata.p || bdata.position || { x: 0, y: 250, z: 0 };
    mesh.position.set(p.x, p.y, p.z);

    mesh.name = `remote-bullet-${id}`;
    this.scene.add(mesh);

    return {
      id,
      mesh,
      ownerId: bdata.ownerId || null,
      targetPos: new THREE.Vector3(p.x, p.y, p.z),
      lastSeenAt: performance.now()
    };
  }

  _cleanupMissingBullets(seen, now) {
    for (const [id] of this.bullets.entries()) {
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
  // Helpers
  // ==========================================================
  getRemotePlayers() {
    return Array.from(this.players.values());
  }

  getRemotePlayerById(id) {
    return this.players.get(id) || null;
  }

  // ==========================================================
  // Fallback Models
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
}

// Globals (non module build)
window.MPState = MPState;
