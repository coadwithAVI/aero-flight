// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    
    // Radius aur bada kar diya safe side ke liye
    this.hitRadius = options.hitRadius ?? 30.0; 
    this.damage = options.damage ?? 15;
    
    this._lastHitAt = new Map();
    this._logTimer = 0;
  }

  update(dt) {
    // 1. Connection Check
    if (!this.mp.socket || !this.mp.isConnected) return;
    const localId = this.mp.socket.id;

    // 2. Data Check
    const bullets = this.bullets?.bullets; 
    const remotes = this.state?.getRemotePlayers();

    // Debug: Har 3 sec mein status
    this._logTimer += dt;
    if (this._logTimer > 3.0) {
       // console.log(`[HitSystem] Active. Bullets: ${bullets?.length || 0}, Enemies: ${remotes?.length || 0}`);
       this._logTimer = 0;
    }

    if (!bullets || bullets.length === 0) return;
    if (!remotes || remotes.length === 0) return;

    // 3. Collision Loop
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

        // Simple Distance Check
        const dist = bPos.distanceTo(rp.mesh.position);
        
        // HIT DETECTED
        if (dist < this.hitRadius) {
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();

           // Spam filter (200ms)
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 200)) continue;
           this._lastHitAt.set(key, now);

           console.log(`🎯 HIT CONFIRMED on ${rp.name || rp.id} (Dist: ${dist.toFixed(1)})`);

           // ✅ FIX: "mp_hit" ki jagah "mp_event" use karenge
           // Kyunki server shayad mp_hit forward nahi kar raha
           const hitPayload = {
             type: "HIT",
             roomId: this.mp.roomId,
             msg: {
                 targetId: rp.id,
                 damage: this.damage,
                 bulletId: b.id,
                 attackerId: localId
             }
           };

           // METHOD 1: Generic Event (Recommended)
           this.mp.socket.emit("mp_event", hitPayload);
           
           // METHOD 2: Old Hit (Backup)
           this.mp.socket.emit("mp_hit", {
             roomId: this.mp.roomId,
             targetId: rp.id,
             damage: this.damage,
             bulletId: b.id
           });

           // Bullet remove visual
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
