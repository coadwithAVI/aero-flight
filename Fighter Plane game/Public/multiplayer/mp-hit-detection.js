// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    // ✅ FIX: Hit radius ko 8 se badhakar 12 ya 14 karein for better detection
    this.hitRadius = options.hitRadius ?? 14.0; 
    this.damage = options.damage ?? 10;
    this._lastHitAt = new Map();
  }

  update(dt) {
    if (!this.mp.isConnected()) return;
    
    const localId = this.mp.socket ? this.mp.socket.id : null;
    if (!localId) return;

    const bullets = this.bullets.bullets; 
    const remotes = this.state.getRemotePlayers();

    if (!bullets || !remotes) return;

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      
      const isMine = (b.ownerId === "local") || (b.ownerId === localId);
      if (!isMine) continue; 
      if (b.remote) continue;

      // Bullet mesh check
      if (!b.mesh) continue;

      const bPos = b.mesh.position;

      for (const rp of remotes) {
        if (rp.id === localId) continue;
        if (!rp.mesh) continue;

        // Distance check
        const dist = bPos.distanceTo(rp.mesh.position);
        
        if (dist < this.hitRadius) {
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();
           // Spam prevention (0.5 sec delay same bullet-player pair)
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 500)) continue;
           this._lastHitAt.set(key, now);

           console.log(`💥 HIT DETECTED on ${rp.name || rp.id} (Dist: ${dist.toFixed(1)})`);

           // Server ko batao
           this.mp.socket.emit("mp_hit", {
             roomId: this.mp.roomId,
             targetId: rp.id,
             damage: this.damage,
             bulletId: b.id
           });

           // Bullet remove karo (Visual feedback ke liye instant remove)
           if(typeof this.bullets.removeBullet === 'function') {
               this.bullets.removeBullet(i);
           } else {
               if(b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
               bullets.splice(i, 1);
           }
           break; // Ek bullet ek hi ko lagegi
        }
      }
    }
  }
}

window.MPHitDetection = MPHitDetection;
