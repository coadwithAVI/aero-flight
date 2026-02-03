// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    
    this.hitRadius = options.hitRadius ?? 30.0; 
    this.damage = options.damage ?? 15;
    
    this._lastHitAt = new Map();
  }

  update(dt) {
    if (!this.mp.socket || !this.mp.isConnected) return;
    const localId = this.mp.socket.id;

    const bullets = this.bullets?.bullets; 
    const remotes = this.state?.getRemotePlayers();

    if (!bullets || bullets.length === 0) return;
    if (!remotes || remotes.length === 0) return;

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      
      const isMine = (b.ownerId === "local") || (b.ownerId === localId);
      if (!isMine) continue; 
      if (b.remote) continue;
      if (!b.mesh) continue;

      const bPos = b.mesh.position;

      for (const rp of remotes) {
        if (rp.id === localId) continue;
        if (!rp.mesh) continue;

        const dist = bPos.distanceTo(rp.mesh.position);
        
        if (dist < this.hitRadius) {
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();

           // Spam filter (200ms)
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 200)) continue;
           this._lastHitAt.set(key, now);

           // LOG REMOVED: console.log(`🎯 HIT CONFIRMED...`);

           const currentRoom = this.mp.roomId;
           if (currentRoom) {
               const hitData = {
                   roomId: currentRoom,
                   targetId: rp.id, 
                   attackerId: localId,
                   damage: this.damage,
                   bulletId: b.id
               };

               // Send both event types for reliability
               this.mp.socket.emit("mp_event", {
                   type: "HIT",
                   ...hitData
               });
               
               this.mp.socket.emit("mp_hit", hitData);
           }

           // Remove bullet locally
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
