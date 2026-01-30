/**
 * ✈️ SKY PILOT: MODEL MANAGER
 * Handles creation of 3D objects (Jets, Arrows, etc.)
 */

const ModelManager = {
    
    // --- 1. PRO JET MODEL ---
    createJet: function(color) {
        const jetGroup = new THREE.Group();
        
        // Materials
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.3, 
            metalness: 0.5 
        });
        const darkMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            roughness: 0.8 
        });
        const glassMat = new THREE.MeshStandardMaterial({ 
            color: 0x00aaff, 
            roughness: 0.0, 
            metalness: 1.0, 
            opacity: 0.7, 
            transparent: true 
        });
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0x00d2ff 
        });

        // A. Fuselage (Main Body)
        const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1, 3, 25, 8), bodyMat);
        fuselage.rotation.x = -Math.PI / 2;
        jetGroup.add(fuselage);

        // B. Nose Cone
        const nose = new THREE.Mesh(new THREE.ConeGeometry(1, 5, 8), bodyMat);
        nose.rotation.x = -Math.PI / 2;
        nose.position.z = -15; // Front
        jetGroup.add(nose);

        // C. Cockpit
        const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 6), glassMat);
        cockpit.position.set(0, 2, -5);
        jetGroup.add(cockpit);

        // D. Main Wings (Tapered)
        const wingGeo = new THREE.BoxGeometry(20, 0.5, 8);
        const posAttr = wingGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            // Sweep wings back based on distance from center
            if (Math.abs(x) > 5) {
                posAttr.setZ(i, posAttr.getZ(i) + 4);
            }
        }
        wingGeo.computeVertexNormals();
        const wings = new THREE.Mesh(wingGeo, bodyMat);
        wings.position.set(0, 0, 2);
        jetGroup.add(wings);

        // E. Tail Stabilizers
        const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 5), bodyMat);
        vStab.position.set(0, 3, 10);
        vStab.rotation.x = -0.3; // Angle back
        jetGroup.add(vStab);

        const hStab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 4), bodyMat);
        hStab.position.set(0, 0, 10);
        jetGroup.add(hStab);

        // F. Engine Exhaust (For Boost Effect)
        const engine = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.5, 1, 8), darkMat);
        engine.rotation.x = -Math.PI / 2;
        engine.position.z = 12.5;
        jetGroup.add(engine);

        // Glow (Crucial for Boost visual)
        const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.5, 2, 8), glowMat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.z = 13.5;
        glow.name = "EngineGlow"; // Used in update loop
        jetGroup.add(glow);

        return jetGroup;
    },

    // --- 2. GUIDE ARROW ---
    createArrow: function() {
        const arrowGroup = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.8 
        });
        
        const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 10, 4), mat);
        cone.rotation.x = Math.PI / 2; // Point forward
        
        arrowGroup.add(cone);
        return arrowGroup;
    }
};

// Export to window
window.ModelManager = ModelManager;
