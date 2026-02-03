// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    
    // 🔥 HIT RADIUS: Isse bada rakha hai taaki hit aasani se ho (20-25 best hai)
    this.hitRadius = options.hitRadius ?? 25.0; 
    this.damage = options.damage ?? 15;
    
    this._lastHitAt = new Map();
    this._logTimer = 0;
  }

  update(dt) {
    // 1. Connection Check
    if (!this.mp.socket || !this.mp.isConnected()) return;
    const localId = this.mp.socket.id;

    // 2. Data Check
    const bullets = this.bullets?.bullets; 
    const remotes = this.state?.getRemotePlayers();

    // Debug: Har 3 sec mein bataye ki system chal raha hai
    this._logTimer += dt;
    if (this._logTimer > 3.0) {
       // console.log(`[HitSystem] Active. Bullets: ${bullets?.length || 0}, Enemies: ${remotes?.length || 0}`);
       this._logTimer = 0;
    }

    if (!bullets || bullets.length === 0) return;
    if (!remotes || remotes.length === 0) return;

    // 3. Collision Loop (Simple Distance Check)
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      
      // Sirf apni bullets check karein
      const isMine = (b.ownerId === "local") || (b.ownerId === localId);
      if (!isMine) continue; 
      if (b.remote) continue;
      if (!b.mesh) continue;

      const bPos = b.mesh.position;

      for (const rp of remotes) {
        if (rp.id === localId) continue; // Khud ko mat maaro
        if (!rp.mesh) continue;

        // ✅ SIMPLE DISTANCE CHECK (Sabse reliable)
        const dist = bPos.distanceTo(rp.mesh.position);
        
        // Debug: Agar goli paas se nikle (100 units) toh log karo
        if (dist < 100) {
            // console.log(`🔍 Bullet close to ${rp.name}: ${Math.round(dist)}m`);
        }

        // HIT CHECK
        if (dist < this.hitRadius) {
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();

           // Spam filter (200ms)
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 200)) continue;
           this._lastHitAt.set(key, now);

           console.log(`🎯 HIT CONFIRMED on ${rp.name || rp.id} (Dist: ${dist.toFixed(1)})`);

           // 1. Server ko batao
           this.mp.socket.emit("mp_hit", {
             roomId: this.mp.roomId,
             targetId: rp.id,
             damage: this.damage,
             bulletId: b.id
           });

           // 2. Bullet turant hatao (Visual feel ke liye)
           if(typeof this.bullets.removeBullet === 'function') {
               this.bullets.removeBullet(i);
           } else {
               if(b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
               bullets.splice(i, 1);
           }
           
           break; // Ek goli ek hi ko lagegi
        }
      }
    }
  }
}

window.MPHitDetection = MPHitDetection;
