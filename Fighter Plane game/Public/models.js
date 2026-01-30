/**
 * ✈️ SKY PILOT: ADVANCED MODEL MANAGER
 * High-quality procedural 3D assets.
 */

const ModelManager = {
    
    // --- 1. PRO FIGHTER JET (Sleek, V-Tail Design) ---
    createJet: function(color) {
        const jetGroup = new THREE.Group();
        
        // --- Materials ---
        // Main body paint (slightly metallic)
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.4, 
            metalness: 0.3,
            flatShading: true // Low-poly look
        });
        // Dark grey for cockpit frame / engine bits
        const darkMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            roughness: 0.8,
            flatShading: true
        });
        // Reflective glass canopy
        const glassMat = new THREE.MeshPhysicalMaterial({ 
            color: 0x88ccff,
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.9, // Glass-like transparency
            transparent: true,
            opacity: 0.7
        });
        // Glowing engine emission
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0x00d2ff 
        });

        // --- Geometry Construction ---

        // A. Fuselage (Main Body Center)
        const bodyGeo = new THREE.BoxGeometry(3, 2.5, 18);
        const fuselage = new THREE.Mesh(bodyGeo, bodyMat);
        jetGroup.add(fuselage);

        // B. Nose Cone (Sharp and long)
        const noseGeo = new THREE.ConeGeometry(2, 8, 8);
        noseGeo.rotateX(-Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.z = -13;
        // Flatten nose slightly
        nose.scale.set(1, 0.7, 1);
        jetGroup.add(nose);

        // C. Cockpit Canopy (Bubble shape)
        const cockpitGeo = new THREE.SphereGeometry(1.4, 12, 12);
        // Stretch and flatten
        cockpitGeo.scale(1, 0.6, 2.5);
        const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
        cockpit.position.set(0, 1.5, -3);
        jetGroup.add(cockpit);

        // D. Air Intakes (Side boxes)
        const intakeGeo = new THREE.BoxGeometry(1.5, 2, 6);
        const intakeL = new THREE.Mesh(intakeGeo, bodyMat);
        intakeL.position.set(-2.5, 0, -2);
        const intakeR = new THREE.Mesh(intakeGeo, bodyMat);
        intakeR.position.set(2.5, 0, -2);
        jetGroup.add(intakeL, intakeR);

        // E. Main Wings (Swept back delta shape)
        // Using a shape to create a custom wing profile would be best, 
        // but simpler is to use flattened, rotated boxes.
        const wingGeo = new THREE.BoxGeometry(12, 0.2, 8);
        const wingL = new THREE.Mesh(wingGeo, bodyMat);
        wingL.position.set(-7, 0, 2);
        wingL.rotation.y = -0.4; // Sweep back
        wingL.rotation.z = 0.1;  // Dihedral (slight upward angle)

        const wingR = new THREE.Mesh(wingGeo, bodyMat);
        wingR.position.set(7, 0, 2);
        wingR.rotation.y = 0.4;  // Sweep back
        wingR.rotation.z = -0.1; // Dihedral

        jetGroup.add(wingL, wingR);

        // F. V-Tail Stabilizers (Angled fins)
        const tailGeo = new THREE.BoxGeometry(0.3, 6, 4);
        // Shift center of rotation to the bottom of the fin
        tailGeo.translate(0, 3, 0); 

        const tailL = new THREE.Mesh(tailGeo, bodyMat);
        tailL.position.set(-1.5, 1, 8);
        tailL.rotation.z = 0.6; // Angle outwards (V-shape)
        tailL.rotation.x = -0.2; // Angle backwards

        const tailR = new THREE.Mesh(tailGeo, bodyMat);
        tailR.position.set(1.5, 1, 8);
        tailR.rotation.z = -0.6; // Angle outwards
        tailR.rotation.x = -0.2; // Angle backwards

        jetGroup.add(tailL, tailR);

        // G. Engine Exhausts & Glow
        const engineGeo = new THREE.CylinderGeometry(1, 1, 2, 12);
        engineGeo.rotateX(-Math.PI / 2);
        
        const engineL = new THREE.Mesh(engineGeo, darkMat);
        engineL.position.set(-1.5, 0, 10);
        const engineR = new THREE.Mesh(engineGeo, darkMat);
        engineR.position.set(1.5, 0, 10);
        jetGroup.add(engineL, engineR);

        // The glowing part (Crucial for boost visual)
        const glowGeo = new THREE.CylinderGeometry(0.8, 0.6, 0.5, 12);
        glowGeo.rotateX(-Math.PI / 2);
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(0, 0, 11.1);
        glow.name = "EngineGlow"; // This name is used in singleplayer.html to scale it
        
        // Add two glows for twin engines
        const glowL = glow.clone(); glowL.position.x = -1.5;
        const glowR = glow.clone(); glowR.position.x = 1.5;
        // Add them to a subgroup so we can scale them together
        const glowGroup = new THREE.Group();
        glowGroup.name = "EngineGlow"; // Name the group instead
        glowGroup.add(glowL, glowR);
        jetGroup.add(glowGroup);

        return jetGroup;
    },

    // --- 2. PRO GUIDE ARROW (Cone Front + Cylinder Back) ---
    createArrow: function() {
        const arrowGroup = new THREE.Group();
        
        // Material: Neon green, semi-transparent
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.6,
            wireframe: false // Set to true for a digital look
        });
        
        // A. The Head (Cone)
        const headGeo = new THREE.ConeGeometry(3, 6, 8);
        headGeo.rotateX(Math.PI / 2); // Point forward
        const head = new THREE.Mesh(headGeo, mat);
        head.position.z = -3; // Move slightly forward

        // B. The Shaft (Cylinder)
        const shaftGeo = new THREE.CylinderGeometry(1, 1, 8, 8);
        shaftGeo.rotateX(Math.PI / 2); // Align with Z axis
        const shaft = new THREE.Mesh(shaftGeo, mat);
        shaft.position.z = 4; // Move behind the head

        arrowGroup.add(head, shaft);

        // Optional: Add a subtle pulsing animation helper
        arrowGroup.userData = { pulseTimer: 0 };

        return arrowGroup;
    }
};

// Export to global window scope
window.ModelManager = ModelManager;
