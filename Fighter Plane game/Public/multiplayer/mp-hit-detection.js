// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    
    // Hit Radius thoda bada rakha hai taaki lag mein bhi hit register ho
    this.hitRadius = options.hitRadius ?? 15.0; 
    this.damage = options.damage ?? 15;
    
    this._lastHitAt = new Map();
    this._logTimer = 0;
  }

  update(dt) {
    // ✅ FIX: 'isConnected' variable hai, function nahi. Brackets () hata diye.
    if (!this.mp.socket || !this.mp.isConnected) return;
    
    const localId = this.mp.socket.id;

    // Data Check
    const bullets = this.bullets?.bullets; 
    const remotes = this.state?.getRemotePlayers();

    // Debug Log (Har 3 sec) - Check karne ke liye ki code chal raha hai
    this._logTimer += dt;
    if (this._logTimer > 3.0) {
       // console.log(`[HitSystem] Active. Bullets: ${bullets?.length || 0}, Enemies: ${remotes?.length || 0}`);
       this._logTimer = 0;
    }

    if (!bullets || bullets.length === 0) return;
    if (!remotes || remotes.length === 0) return;

    // Collision Loop
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      
      // Sirf apni bullets check karein
      const isMine = (b.ownerId === "local") || (b.ownerId === localId);
      if (!isMine) continue; 
      if (b.remote) continue;
      if (!b.mesh) continue;

      const bPos = b.mesh.position;

      for (const rp of remotes) {
        if (rp.id === localId) continue; // Khud ko damage nahi dena
        if (!rp.mesh) continue;

        // Distance Check
        const dist = bPos.distanceTo(rp.mesh.position);
        
        // Hit Check
        if (dist < this.hitRadius) {
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();

           // Spam filter (Avoid multiple hits from same bullet instantly)
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 200)) continue;
           this._lastHitAt.set(key, now);

           console.log(`🎯 HIT CONFIRMED on ${rp.name || rp.id} (Dist: ${dist.toFixed(1)})`);

           // 1. Server ko signal bhejo
           this.mp.socket.emit("mp_hit", {
             roomId: this.mp.roomId,
             targetId: rp.id,
             damage: this.damage,
             bulletId: b.id
           });

           // 2. Bullet remove karo (Visual feedback)
           if(typeof this.bullets.removeBullet === 'function') {
               this.bullets.removeBullet(i);
           } else {
               if(b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
               bullets.splice(i, 1);
           }
           
           break; // Loop break (Ek bullet ek hi ko lagegi)
        }
      }
    }
  }
}

window.MPHitDetection = MPHitDetection;
