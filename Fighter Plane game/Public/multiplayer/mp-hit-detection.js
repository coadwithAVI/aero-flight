// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

/**
 * MPHitDetection
 * Handles client-side checking of bullets hitting remote players.
 */
class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    
    // Config
    this.hitRadius = options.hitRadius ?? 6.0; 
    this.damage = options.damage ?? 10;
    
    // Anti-spam map (prevent one bullet hitting multiple times instantly)
    this._lastHitAt = new Map();
  }

  update(dt) {
    if (!this.mp.isConnected()) return;
    
    // Ensure we know who "we" are
    const localId = this.mp.socket ? this.mp.socket.id : null;
    if (!localId) return;

    // Get arrays
    const bullets = this.bullets.bullets; // Access internal array of BulletSystem
    const remotes = this.state.getRemotePlayers();

    if (!bullets || !remotes) return;

    // Loop backwards so we can remove bullets safely
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      
      // 1. Ownership Check: Only check collisions for MY bullets
      // (Assuming local bullets have ownerId="local" or match socket ID)
      const isMine = (b.ownerId === "local") || (b.ownerId === localId);
      if (!isMine) continue; 

      // 2. Ignore bullets that are technically "remote" visuals
      if (b.remote) continue;

      const bPos = b.mesh.position;

      // Check against all enemies
      for (const rp of remotes) {
        if (rp.id === localId) continue; // Don't hit self
        if (!rp.mesh) continue;

        // 3. Collision Check (Distance)
        const dist = bPos.distanceTo(rp.mesh.position);
        
        if (dist < this.hitRadius) {
           
           // Anti-spam check (debounce hits)
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 500)) {
               continue;
           }
           this._lastHitAt.set(key, now);

           console.log(`💥 HIT! Bullet hit ${rp.name || rp.id}`);

           // 4. Report to Server
           // Server decides if they die, but we claim the hit
           this.mp.socket.emit("mp_hit", {
             roomId: this.mp.roomId,
             targetId: rp.id,
             damage: this.damage,
             bulletId: b.id
           });

           // 5. Visual Feedback: Destroy bullet instantly
           // Calls BulletSystem remove method
           if(typeof this.bullets.removeBullet === 'function') {
               this.bullets.removeBullet(i);
           } else {
               // Fallback manual removal
               if(b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
               bullets.splice(i, 1);
           }
           
           // Bullet hit one target, stop checking other targets for this bullet
           break; 
        }
      }
    }
  }
}

// Global Export
window.MPHitDetection = MPHitDetection;
