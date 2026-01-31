// ==========================================
// PATH: gameplay/ring-system.js
// ==========================================

/**
 * RingSystem (RAYCAST TERRAIN SAFE)
 * ✅ Rings never spawn inside mountains
 * ✅ Spawns at: terrainHitY + 30
 */

class RingSystem {
  constructor(scene, terrainMesh, options = {}) {
    this.scene = scene;
    this.terrainMesh = terrainMesh;

    this.ringCount = options.ringCount ?? 8;
    this.spawnRadiusMin = options.spawnRadiusMin ?? 1200;
    this.spawnRadiusMax = options.spawnRadiusMax ?? 3500;

    this.terrainClearance = options.terrainClearance ?? 30;

    this.ringRadius = options.ringRadius ?? 55;
    this.ringTube = options.ringTube ?? 6;
    this.triggerRadius = options.triggerRadius ?? 85;

    this.colorActive = options.colorActive ?? (WORLD_CONFIG?.colors?.ringActive ?? 0x00ff00);
    this.colorInactive = options.colorInactive ?? (WORLD_CONFIG?.colors?.ringInactive ?? 0x444444);
    this.colorClaimed = options.colorClaimed ?? 0x00d4ff;

    this.opacityInactive = options.opacityInactive ?? 0.35;
    this.opacityActive = options.opacityActive ?? 0.85;

    this.rings = [];
    this.currentIndex = 0;
    this.ringsClaimed = 0;

    this._checkTimer = 0;
    this._checkInterval = options.checkInterval ?? 0.05;

    // raycast helpers
    this._raycaster = new THREE.Raycaster();
    this._down = new THREE.Vector3(0, -1, 0);

    this._createRings();
    this._setActiveRing(0);
  }

  // ✅ real height by raycasting terrain
   _getTerrainY(x, z) {
    if (!this.terrainMesh) return (WORLD_CONFIG.waterLevel ?? 0);

    // ✅ MUST update world matrices before raycast
    this.terrainMesh.updateMatrixWorld(true);

    // cast from very high
    const origin = new THREE.Vector3(x, 5000, z);

    this._raycaster.set(origin, this._down);
    this._raycaster.far = 10000;

    const hits = this._raycaster.intersectObject(this.terrainMesh, true);

    if (hits && hits.length > 0) return hits[0].point.y;

    return (WORLD_CONFIG.waterLevel ?? 0);
  }

  _createRings() {
    if (!this.scene) return;

    this._ringGeo = new THREE.TorusGeometry(this.ringRadius, this.ringTube, 12, 30);

    for (let i = 0; i < this.ringCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: this.colorInactive,
        transparent: true,
        opacity: this.opacityInactive,
        roughness: 0.5,
        metalness: 0.1,
        emissive: new THREE.Color(0x001111),
        emissiveIntensity: 1.2
      });

      const mesh = new THREE.Mesh(this._ringGeo, mat);

      let x = 0, y = 0, z = 0;
      let tries = 0;
      const maxTries = 120;

      while (tries < maxTries) {
        tries++;

        const angle = Math.random() * Math.PI * 2;
        const r = this.spawnRadiusMin + Math.random() * (this.spawnRadiusMax - this.spawnRadiusMin);

        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;

        const terrainY = this._getTerrainY(x, z);

        // ✅ ALWAYS above terrain
        y = terrainY + this.terrainClearance;

        if (!Number.isFinite(y)) continue;

        // water safety
        const floor = (WORLD_CONFIG.waterLevel ?? 0) + 15;
        if (y < floor) y = floor;

        break;
      }

      // fallback
      if (tries >= maxTries) {
        x = 0;
        z = 0;
        y = (WORLD_CONFIG.waterLevel ?? 0) + 200;
      }

      mesh.position.set(x, y, z);

      // ✅ Vertical rings
      mesh.rotation.x = 0;
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.rotation.z = 0;

      mesh.name = `ring-${i}`;
      this.scene.add(mesh);

      this.rings.push({ mesh, claimed: false });
    }
  }

  _setActiveRing(index) {
    this.currentIndex = index;

    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (!ring || !ring.mesh) continue;

      if (ring.claimed) {
        ring.mesh.material.color.set(this.colorClaimed);
        ring.mesh.material.opacity = 0.18;
        ring.mesh.material.emissive.set(0x001122);
        ring.mesh.scale.set(1, 1, 1);
        continue;
      }

      if (i === this.currentIndex) {
        ring.mesh.material.color.set(this.colorActive);
        ring.mesh.material.opacity = this.opacityActive;
        ring.mesh.material.emissive.set(0x003300);
        ring.mesh.scale.set(1.1, 1.1, 1.1);
      } else {
        ring.mesh.material.color.set(this.colorInactive);
        ring.mesh.material.opacity = this.opacityInactive;
        ring.mesh.material.emissive.set(0x001111);
        ring.mesh.scale.set(1, 1, 1);
      }
    }
  }

  claimRing(index) {
    const ring = this.rings[index];
    if (!ring || !ring.mesh) return false;
    if (ring.claimed) return false;

    ring.claimed = true;
    this.ringsClaimed++;

    const next = index + 1;
    if (next >= this.rings.length) this._finishLap();
    else this._setActiveRing(next);

    return true;
  }

  _finishLap() {
    for (const ring of this.rings) {
      ring.claimed = false;
      if (ring.mesh) ring.mesh.visible = true;
    }
    this.ringsClaimed = 0;
    this._setActiveRing(0);
  }

  update(dt, playerMesh, mpClient = null) {
    if (!playerMesh) return;

    this._checkTimer += dt;
    if (this._checkTimer < this._checkInterval) return;
    this._checkTimer = 0;

    const ring = this.rings[this.currentIndex];
    if (!ring || !ring.mesh) return;
    if (ring.claimed) return;

    const d = playerMesh.position.distanceTo(ring.mesh.position);

    if (d <= this.triggerRadius) {
      const ok = this.claimRing(this.currentIndex);

      if (ok && mpClient && typeof mpClient.claimRing === "function") {
        mpClient.claimRing(this.currentIndex);
      }
    }
  }

  destroy() {
    for (const ring of this.rings) {
      if (ring.mesh && this.scene) this.scene.remove(ring.mesh);
    }
    this.rings = [];
  }
}

window.RingSystem = RingSystem;
