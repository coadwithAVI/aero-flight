//Radar system
/**
 * MinimapSystem
 * A 2D Radar overlay that shows the position of enemies relative to the player.
 * Features:
 * - Rotating Radar: The player is always facing "Up" on the map.
 * - Range Limiting: Only shows enemies within a specific distance.
 */
class MinimapSystem {
    /**
     * @param {Number} range - The radius of detection in world units (default 2000)
     */
    constructor(range = 3000) {
        this.range = range;
        this.size = 180; // Diameter of the radar in pixels
        this.scale = (this.size / 2) / this.range; // Scale factor for converting world units to pixels

        // 1. Create Canvas Element
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        
        // 2. Style the Radar
        Object.assign(this.canvas.style, {
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            width: `${this.size}px`,
            height: `${this.size}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 20, 40, 0.6)', // Dark semi-transparent blue
            border: '2px solid rgba(100, 200, 255, 0.5)',
            boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)',
            zIndex: '100'
        });

        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Updates the radar rendering
     * @param {THREE.Object3D} playerMesh - The player's ship mesh
     * @param {Array} enemies - Array of enemy objects
     */
    update(playerMesh, enemies) {
        const ctx = this.ctx;
        const centerX = this.size / 2;
        const centerY = this.size / 2;

        // Clear previous frame
        ctx.clearRect(0, 0, this.size, this.size);

        // 1. Draw Radar Grid/Rings (Visual Polish)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.size * 0.25, 0, Math.PI * 2); // Inner ring
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.size * 0.45, 0, Math.PI * 2); // Outer ring
        ctx.stroke();

        // 2. Draw Player (Always in center, green arrow)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        // Draw a small triangle pointing UP
        ctx.moveTo(centerX, centerY - 5);
        ctx.lineTo(centerX - 4, centerY + 4);
        ctx.lineTo(centerX + 4, centerY + 4);
        ctx.closePath();
        ctx.fill();

        // 3. Draw Enemies
        // We need the player's rotation to rotate the world around them on the radar
        // Three.js rotation is in radians.
        // We specifically need the Y-axis rotation (Yaw).
        const playerRotation = playerMesh.rotation.y;
        const cos = Math.cos(playerRotation);
        const sin = Math.sin(playerRotation);

        enemies.forEach(enemy => {
            if (!enemy.mesh) return;

            // Get relative position (Enemy - Player)
            const dx = enemy.mesh.position.x - playerMesh.position.x;
            const dz = enemy.mesh.position.z - playerMesh.position.z;

            // Check distance quickly before doing math
            // (Using squared distance is faster than Math.sqrt)
            if (dx*dx + dz*dz > this.range * this.range) return;

            // Rotate coordinates based on player heading
            // This ensures if enemy is in front of player, it appears at the TOP of radar
            // Formula for rotating a point around origin (0,0):
            // x' = x cos θ - z sin θ
            // z' = x sin θ + z cos θ
            
            // Note: In 2D canvas, Y is Down, but in 3D, -Z is Forward.
            // Adjusting signs to match standard "Forward is Up" radar.
            const rotX = dx * cos - dz * sin;
            const rotZ = dx * sin + dz * cos;

            // Map to Canvas Coordinates
            // rotX is lateral distance, rotZ is forward/back distance
            const mapX = centerX + rotX * this.scale;
            const mapY = centerY + rotZ * this.scale;

            // Draw Enemy Dot
            ctx.fillStyle = '#ff3333'; // Red
            ctx.beginPath();
            ctx.arc(mapX, mapY, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}