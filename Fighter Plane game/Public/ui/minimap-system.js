// ==========================================
// PATH: ui/minimap-system.js
// ==========================================

/**
 * MinimapSystem (FINAL FIXED)
 * Radar overlay:
 * ✅ Player always center (green arrow)
 * ✅ Rotating radar (player faces UP)
 * ✅ Enemies (red dots)
 * ✅ Rings (cyan circles) + Active ring highlight (green)
 * ✅ Active ring edge indicator (green dot on border if ring out of range)
 */

class MinimapSystem {
    constructor(range = 3000) {
        this.range = range;
        this.size = 180;
        this.scale = (this.size / 2) / this.range;

        // Canvas
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.size;
        this.canvas.height = this.size;

        Object.assign(this.canvas.style, {
            position: "absolute",
            bottom: "20px",
            right: "20px",
            width: `${this.size}px`,
            height: `${this.size}px`,
            borderRadius: "50%",
            backgroundColor: "rgba(0, 20, 40, 0.6)",
            border: "2px solid rgba(100, 200, 255, 0.5)",
            boxShadow: "0 0 10px rgba(0, 255, 255, 0.2)",
            zIndex: "100"
        });

        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");
    }

    /**
     * @param {THREE.Object3D} playerMesh
     * @param {Array} enemies array of { mesh }
     * @param {Array} rings array of ring objects:
     *    - either { mesh, claimed }
     *    - OR direct THREE.Mesh
     * @param {number} activeRingIndex optional highlight
     */
    update(playerMesh, enemies = [], rings = [], activeRingIndex = -1) {
        if (!playerMesh) return;

        const ctx = this.ctx;
        const centerX = this.size / 2;
        const centerY = this.size / 2;

        // Clear
        ctx.clearRect(0, 0, this.size, this.size);

        // Radar rings
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(centerX, centerY, this.size * 0.25, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, this.size * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        // Player arrow (center)
        ctx.fillStyle = "#00ff00";
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 6);
        ctx.lineTo(centerX - 5, centerY + 5);
        ctx.lineTo(centerX + 5, centerY + 5);
        ctx.closePath();
        ctx.fill();

        // Rotation math
        const yaw = playerMesh.rotation.y;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);

        // Helper: world dx/dz -> minimap point
        const toMap = (dx, dz) => {
            const rotX = dx * cos - dz * sin;
            const rotZ = dx * sin + dz * cos;

            // ✅ SAME mapping for EVERYTHING:
            const mapX = centerX - rotX * this.scale; // horizontal flipped
            const mapY = centerY - rotZ * this.scale; // vertical flipped
            return { mapX, mapY, rotX, rotZ };
        };

        // ======================================================
        // ✅ Draw Rings first (background targets)
        // ======================================================
        if (rings && rings.length) {
            for (let i = 0; i < rings.length; i++) {
                const r = rings[i];
                const mesh = r?.mesh || r;
                if (!mesh) continue;

                // optional: hide claimed rings
                const claimed = !!r?.claimed;
                if (claimed) continue;

                const dx = mesh.position.x - playerMesh.position.x;
                const dz = mesh.position.z - playerMesh.position.z;

                // only draw if inside range
                if (dx * dx + dz * dz > this.range * this.range) continue;

                const { mapX, mapY } = toMap(dx, dz);

                const isActive = (i === activeRingIndex);

                ctx.lineWidth = isActive ? 2.5 : 2;
                ctx.strokeStyle = isActive
                    ? "rgba(0,255,0,0.95)"
                    : "rgba(0,255,255,0.85)";

                // ring circle
                ctx.beginPath();
                ctx.arc(mapX, mapY, isActive ? 7 : 6, 0, Math.PI * 2);
                ctx.stroke();

                // center dot
                ctx.fillStyle = isActive
                    ? "rgba(0,255,0,0.95)"
                    : "rgba(0,255,255,0.85)";
                ctx.beginPath();
                ctx.arc(mapX, mapY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ======================================================
        // ✅ Active Ring Edge Indicator (if out of radar range)
        // ======================================================
        if (rings && rings.length && activeRingIndex >= 0) {
            const activeRing = rings[activeRingIndex];
            const activeMesh = activeRing?.mesh || activeRing;

            if (activeMesh) {
                const dx = activeMesh.position.x - playerMesh.position.x;
                const dz = activeMesh.position.z - playerMesh.position.z;

                const distSq = dx * dx + dz * dz;
                const rangeSq = this.range * this.range;

                // Only show indicator if ring OUTSIDE radar
                if (distSq > rangeSq) {
                    const { rotX, rotZ } = (() => {
                        const rx = dx * cos - dz * sin;
                        const rz = dx * sin + dz * cos;
                        return { rotX: rx, rotZ: rz };
                    })();

                    // angle in minimap-space
                    const ang = Math.atan2(rotZ, rotX);

                    // dot position on edge
                    const edgeRadius = (this.size / 2) - 10;

                    // ✅ Apply SAME flip as mapX/mapY (minus sign)
                    const ix = centerX - Math.cos(ang) * edgeRadius;
                    const iy = centerY - Math.sin(ang) * edgeRadius;

                    // draw green dot
                    ctx.fillStyle = "rgba(0,255,0,0.95)";
                    ctx.beginPath();
                    ctx.arc(ix, iy, 6, 0, Math.PI * 2);
                    ctx.fill();

                    // outline
                    ctx.strokeStyle = "rgba(0,0,0,0.6)";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
        }

        // ======================================================
        // ✅ Draw Enemies (foreground threats)
        // ======================================================
        if (enemies && enemies.length) {
            enemies.forEach(enemy => {
                const emesh = enemy?.mesh || enemy;
                if (!emesh) return;

                const dx = emesh.position.x - playerMesh.position.x;
                const dz = emesh.position.z - playerMesh.position.z;

                if (dx * dx + dz * dz > this.range * this.range) return;

                const { mapX, mapY } = toMap(dx, dz);

                ctx.fillStyle = "#ff3333";
                ctx.beginPath();
                ctx.arc(mapX, mapY, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }
}

window.MinimapSystem = MinimapSystem;
