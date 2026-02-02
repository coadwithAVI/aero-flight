// ==========================================
// PATH: multiplayer/mp-state.js
// ==========================================

class MPState {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.localId = options.localId || null; // Khud ki ID
    this.players = new Map(); 
    this.bullets = new Map(); 

    this.modelFactory = options.modelFactory || null;

    this.positionLerp = options.positionLerp ?? 0.18;
    this.rotationSlerp = options.rotationSlerp ?? 0.22;
    this.bulletLerp = options.bulletLerp ?? 0.35;

    this.entityTimeoutMs = options.entityTimeoutMs ?? 5500;
    this.maxTeleportDist = options.maxTeleportDist ?? 450; 
    this.debug = options.debug ?? false;

    this.lastSnapshotTick = 0;
    this.lastSnapshotAt = 0;
    this._tmpV = new THREE.Vector3();
  }

  setLocalId(id) {
    this.localId = id;
  }

  applyServerState(msg) {
    if (!msg) return;
    const now = performance.now();
    this.lastSnapshotTick = msg.tick ?? this.lastSnapshotTick;

    // ---- Players ----
    if (Array.isArray(msg.players)) {
      const seen = new Set();
      for (const pdata of msg.players) {
        const id = pdata?.id ?? pdata?.clientId;
        if (!id) continue;
        if (this.localId && id === this.localId) continue; // Khud ko ignore karo

        seen.add(id);
        this._upsertRemotePlayer(id, pdata, now);
      }
      this._cleanupMissingPlayers(seen, now);
    }

    // ---- Bullets ----
    if (Array.isArray(msg.bullets)) {
      const seenB = new Set();
      for (const b of msg.bullets) {
        const bid = b?.id ?? b?.bid;
        if (!bid) continue;

        // ✅ FIX: AGAR BULLET MERI HAI, TO USE MAT BANAO (No 3rd Line)
        if (this.localId && b.ownerId === this.localId) continue;

        seenB.add(bid);
        this._upsertRemoteBullet(bid, b, now);
      }
      this._cleanupMissingBullets(seenB, now);
    }
  }

  // ... (Baaki functions same rahenge) ...

  update(dt) {
    const now = performance.now();
    for (const [id, ent] of this.players.entries()) {
      if (now - ent.lastSeenAt > this.entityTimeoutMs) {
        this.removePlayer(id);
        continue;
      }
      ent.mesh.position.lerp(ent.targetPos, this.positionLerp);
      ent.mesh.quaternion.slerp(ent.targetQuat, this.rotationSlerp);
    }

    for (const [id, b] of this.bullets.entries()) {
      if (now - b.lastSeenAt > this.entityTimeoutMs) {
        this.removeBullet(id);
        continue;
      }
      b.mesh.position.lerp(b.targetPos, this.bulletLerp);
    }
  }

  _upsertRemotePlayer(id, pdata, now) {
    let ent = this.players.get(id);
    if (!ent) {
      ent = this._createRemotePlayerEntity(id, pdata);
      this.players.set(id, ent);
    }
    ent.lastSeenAt = now;

    const p = pdata.p || pdata.position;
    const q = pdata.q || pdata.quaternion;

    if (p) {
      this._tmpV.set(p.x, p.y, p.z);
      if (ent.mesh.position.distanceTo(this._tmpV) > this.maxTeleportDist) {
        ent.mesh.position.copy(this._tmpV);
        ent.targetPos.copy(this._tmpV);
      } else {
        ent.targetPos.copy(this._tmpV);
      }
    }
    if (q) {
      ent.targetQuat.set(q.x, q.y, q.z, q.w);
      if (!isFinite(ent.targetQuat.w)) ent.targetQuat.set(0, 0, 0, 1);
    }
    ent.hp = pdata.hp;
  }

  _createRemotePlayerEntity(id, pdata) {
    const mesh = this.modelFactory?.createPlayerPlane
        ? this.modelFactory.createPlayerPlane()
        : this._createFallbackRemotePlane();

    mesh.name = `remote-player-${id}`;
    this.scene.add(mesh);

    const p = pdata.p || { x: 0, y: 250, z: 0 };
    mesh.position.set(p.x, p.y, p.z);
    
    // Transparent Ghost Material
    mesh.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = obj.material.clone();
        obj.material.transparent = true;
        obj.material.opacity = 0.9;
        obj.material.color.setHex(0xff3333); // Enemy Red
      }
    });

    return {
      id,
      mesh,
      targetPos: new THREE.Vector3(p.x, p.y, p.z),
      targetQuat: new THREE.Quaternion(),
      lastSeenAt: performance.now()
    };
  }

  _cleanupMissingPlayers(seen, now) {
    for (const [id] of this.players.entries()) {
      if (!seen.has(id)) this.removePlayer(id);
    }
  }

  removePlayer(id) {
    const ent = this.players.get(id);
    if (ent) {
        this.scene.remove(ent.mesh);
        this.players.delete(id);
    }
  }

  _upsertRemoteBullet(id, bdata, now) {
    let ent = this.bullets.get(id);
    if (!ent) {
      ent = this._createRemoteBulletEntity(id, bdata);
      this.bullets.set(id, ent);
    }
    ent.lastSeenAt = now;
    ent.ownerId = bdata.ownerId;

    const p = bdata.p || bdata.position;
    if (p) {
      this._tmpV.set(p.x, p.y, p.z);
      if (ent.mesh.position.distanceTo(this._tmpV) > 180) {
        ent.mesh.position.copy(this._tmpV);
      }
      ent.targetPos.copy(this._tmpV);
    }
  }

  _createRemoteBulletEntity(id, bdata) {
    const geo = new THREE.SphereGeometry(0.8, 6, 6); // Thoda bada bullet
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red Enemy Bullet
    const mesh = new THREE.Mesh(geo, mat);

    const p = bdata.p || { x: 0, y: 0, z: 0 };
    mesh.position.set(p.x, p.y, p.z);
    this.scene.add(mesh);

    return {
      id,
      mesh,
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
    if (ent) {
        this.scene.remove(ent.mesh);
        this.bullets.delete(id);
    }
  }

  getRemotePlayers() { return Array.from(this.players.values()); }

  _createFallbackRemotePlane() {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 10), new THREE.MeshBasicMaterial({color:0xff0000}));
    body.rotateX(Math.PI/2);
    mesh.add(body);
    return mesh;
  }
}
window.MPState = MPState;
