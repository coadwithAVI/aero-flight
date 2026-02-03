// ==========================================
// PATH: multiplayer/mp-hit-detection.js
// ==========================================

class MPHitDetection {
  constructor(mpClient, bulletSystem, mpState, options = {}) {
    this.mp = mpClient;
    this.bullets = bulletSystem;
    this.state = mpState;
    
    // Increased Hit Radius (Hitbox)
    this.hitRadius = options.hitRadius ?? 18.0; 
    this.damage = options.damage ?? 15;
    
    this._lastHitAt = new Map();
    
    // Debug Timer (Har second status check karega)
    this._debugTimer = 0;
  }

  // Helper: Point to Line Segment Distance (For Fast Bullets)
  _distToSegmentSquared(p, v, w) {
    const l2 = v.distanceToSquared(w);
    if (l2 === 0) return p.distanceToSquared(v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y) + (p.z - v.z) * (w.z - v.z)) / l2;
    t = Math.max(0, Math.min(1, t));
    const x = v.x + t * (w.x - v.x);
    const y = v.y + t * (w.y - v.y);
    const z = v.z + t * (w.z - v.z);
    // distance squared
    return (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2;
  }

  update(dt) {
    // 1. Connection Check
    if (!this.mp.socket || !this.mp.isConnected) return;
    const localId = this.mp.socket.id;

    // 2. Data Check
    const bullets = this.bullets?.bullets; 
    const remotes = this.state?.getRemotePlayers();

    if (!bullets || bullets.length === 0) return;
    if (!remotes || remotes.length === 0) {
        // Debug Log (Har 3 second mein ek baar bataye ki enemies nahi hain)
        this._debugTimer += dt;
        if(this._debugTimer > 3.0) {
            console.log("⚠️ No enemies found for hit detection.");
            this._debugTimer = 0;
        }
        return;
    }

    // 3. Collision Loop
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      
      // Sirf apni bullets check karein
      const isMine = (b.ownerId === "local") || (b.ownerId === localId);
      if (!isMine) continue; 
      if (b.remote) continue;
      if (!b.mesh) continue;

      const currentPos = b.mesh.position;
      
      // Calculate Previous Position (Backtrack using velocity)
      // Ye zaroori hai fast bullets ke liye taaki wo aar-paar na nikle
      const prevPos = currentPos.clone().sub(b.vel.clone().multiplyScalar(dt));

      for (const rp of remotes) {
        if (rp.id === localId) continue; // Khud ko mat maaro
        if (!rp.mesh) continue;

        const enemyPos = rp.mesh.position;

        // ✅ ADVANCED CHECK: Distance from Enemy Center to Bullet Path (Line Segment)
        const distSq = this._distToSegmentSquared(enemyPos, prevPos, currentPos);
        const radiusSq = this.hitRadius * this.hitRadius;

        if (distSq < radiusSq) {
           const key = `${b.id}-${rp.id}`;
           const now = Date.now();

           // Prevent double hits (Spam filter)
           if(this._lastHitAt.has(key) && (now - this._lastHitAt.get(key) < 200)) continue;
           this._lastHitAt.set(key, now);

           console.log(`🎯 BULLSEYE! Hit Player: ${rp.name || rp.id}`);

           // Server ko batao
           this.mp.socket.emit("mp_hit", {
             roomId: this.mp.roomId,
             targetId: rp.id,
             damage: this.damage,
             bulletId: b.id
           });

           // Bullet Remove Karo
           if(typeof this.bullets.removeBullet === 'function') {
               this.bullets.removeBullet(i);
           } else {
               if(b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
               bullets.splice(i, 1);
           }
           
           // Ek bullet ek hi ko lagegi
           break; 
        }
      }
    }
  }
}

window.MPHitDetection = MPHitDetection;
