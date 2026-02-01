// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

/**
 * MPHitDetection
 * Client-side bullet hit detection (Hybrid / Semi-authoritative)
 *
 * ✅ Bullets move smoothly on client
 * ✅ Client detects hit instantly (no lag feel)
 * ✅ Client reports hit to server: mp_hit
 * ✅ Server is final authority for damage/kills/respawn
 *
 * Requirements:
 * - mpClient (instance of MPClient)
 * - bulletSystem (BulletSystem instance)
 * - mpState (MPState instance)
 * - localPlayerMesh (THREE.Object3D)
 */

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;

    this.enabled = true;

    // tuning
    this.hitRadius = options.hitRadius ?? 4.0; // forgiving aim
    this.cooldownMs = options.cooldownMs ?? 80; // prevent spam same target

    // internal anti-spam map
    this._lastHitAt = new Map(); // key: bulletId|targetId -> time

    // temp vectors
    this._tmp = new THREE.Vector3();
  }

  setEnabled(v) {
    this.enabled = !!v;
  }

  /**
   * Call every frame in multiplayer game loop
   */
  update(dt) {
    if (!this.enabled) return;
    if (!this.mp || !this.mp.isConnected()) return;
    if (!this.bullets) return;
    if (!this.state) return;

    const localId = this.state.localId || this.mp.clientId;

    // We need bullets list from BulletSystem
    // BulletSystem should expose `bullets` array
    const list = this.bullets.bullets;
    if (!Array.isArray(list) || list.length === 0) return;

    // Remote player entities
    const remotes = this.state.getRemotePlayers ? this.state.getRemotePlayers() : [];
    if (!remotes.length) return;

    const now = performance.now();

    // For each bullet check against each remote player
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (!b) continue;

      // skip bullets without mesh/pos
      const bpos = b.mesh?.position || b.position;
      if (!bpos) continue;

      // ✅ optional owner check: only your bullets can report hits
      // if BulletSystem stores ownerId:
      if (b.ownerId && localId && b.ownerId !== localId) continue;

      // if BulletSystem stores `id`
      const bulletId = b.id ?? b._id ?? `idx${i}`;

      for (const rp of remotes) {
        if (!rp?.mesh || !rp.id) continue;

        // do not hit dead players (if state has alive flag)
        if (rp.alive === false) continue;

        // ignore if target is local player (safety)
        if (localId && rp.id === localId) continue;

        const tpos = rp.mesh.position;

        const dist = bpos.distanceTo(tpos);
        if (dist > this.hitRadius) continue;

        // anti-spam same bullet->same target
        const key = `${bulletId}|${rp.id}`;
        const last = this._lastHitAt.get(key) || 0;
        if (now - last < this.cooldownMs) continue;

        this._lastHitAt.set(key, now);

        // ✅ report hit to server
        this.mp.socket.emit("mp_hit", {
          roomId: this.mp.roomId,
          targetId: rp.id
        });

        // ✅ instant feedback: remove bullet locally
        // BulletSystem should support destroy bullet
        if (this.bullets.destroyBullet) {
          this.bullets.destroyBullet(b);
        } else {
          // fallback remove from scene + list
          if (b.mesh) {
            b.mesh.visible = false;
            if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
          }
          list.splice(i, 1);
        }

        // one bullet hits one target only
        break;
      }
    }
  }
}

window.MPHitDetection = MPHitDetection;
