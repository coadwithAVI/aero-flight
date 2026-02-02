// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    this.hitRadius = options.hitRadius ?? 6.0;
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

      const bPos = b.mesh.position;

      for (const rp of remotes) {
        if (rp.id === localId) continue;
        if (!rp.mesh) continue;

        const dist = bPos.distanceTo(rp.mesh.position);
        
        if (dist < this.hitRadius) {
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 500)) continue;
           this._lastHitAt.set(key, now);

           console.log(`💥 HIT! Bullet hit ${rp.name || rp.id}`);

           this.mp.socket.emit("mp_hit", {
             roomId: this.mp.roomId,
             targetId: rp.id,
             damage: this.damage,
             bulletId: b.id
           });

           if(typeof this.bullets.removeBullet === 'function') {
               this.bullets.removeBullet(i);
           } else {
               if(b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
               bullets.splice(i, 1);
           }
           break; 
        }
      }
    }
  }
}

window.MPHitDetection = MPHitDetection;
