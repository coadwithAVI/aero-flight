//3D Plane models/placeholders
/**
 * ModelFactory
 * Centralizes 3D mesh creation for the game.
 * Updated to feature SVX-57 (Su-57 style) and Advanced Enemy Jets.
 */
class ModelFactory {
    constructor() {
        // Shared Materials (Updated for Jet Fighters)
        this.materials = {
            // Player: Stealth Grey/Blue Camo theme
            playerBody: new THREE.MeshPhongMaterial({ color: 0x607d8b, flatShading: true }), // Blue-Grey Stealth
            playerDark: new THREE.MeshPhongMaterial({ color: 0x37474f, flatShading: true }), // Darker Grey
            playerCockpit: new THREE.MeshPhongMaterial({ color: 0xffd700, flatShading: true, shininess: 100 }), // Gold coated glass

            // Enemy: Aggressive Red/Black theme
            enemyBody: new THREE.MeshPhongMaterial({ color: 0xc0392b, flatShading: true }), // Dark Red
            enemyDark: new THREE.MeshPhongMaterial({ color: 0x2c3e50, flatShading: true }), // Dark Grey/Black accents
            enemyEngine: new THREE.MeshPhongMaterial({ color: 0xe67e22, flatShading: true }), // Orange engine glow
            
            metal: new THREE.MeshPhongMaterial({ color: 0x95a5a6, flatShading: true }) // Silver/Grey
        };
    }

    /**
     * Creates the Player's Plane (Style: Su-57 Felon)
     * Features: Flattened stealth fuselage, twin engines, canted vertical stabilizers.
     */
    createPlayerPlane() {
        const mesh = new THREE.Group();

        // 1. Central Fuselage (Blended Body)
        // Main body is flattened for stealth
        const fuselageGeo = new THREE.BoxGeometry(2, 0.7, 9);
        const fuselage = new THREE.Mesh(fuselageGeo, this.materials.playerBody);
        fuselage.position.set(0, 0, -1);
        fuselage.castShadow = true;
        mesh.add(fuselage);

        // 2. Nose Cone (Radome) - Sharper and longer
        const noseGeo = new THREE.CylinderGeometry(0.1, 1.2, 4.5, 4); // 4 segments for stealth diamond shape
        noseGeo.rotateX(-Math.PI / 2);
        noseGeo.rotateZ(Math.PI / 4); // Rotate to make it diamond cross-section
        const nose = new THREE.Mesh(noseGeo, this.materials.playerBody);
        nose.position.set(0, 0, 5); // Attached to front
        nose.castShadow = true;
        mesh.add(nose);

        // 3. Main Delta Wings (Large Surface Area)
        const wingGeo = new THREE.BoxGeometry(8.5, 0.15, 6);
        const leftWing = new THREE.Mesh(wingGeo, this.materials.playerBody);
        leftWing.position.set(0, -0.1, -1.5);
        // Using geometry vertices logic visually via scaling/rotation
        // Here we simulate the swept delta shape by rotating two wing segments
        const lWingShape = new THREE.Mesh(wingGeo, this.materials.playerBody);
        lWingShape.position.set(-2.8, 0, 0);
        lWingShape.rotation.y = -0.3; // Sweep back
        lWingShape.rotation.z = 0.05; // Dihedral
        lWingShape.castShadow = true;
        mesh.add(lWingShape);

        const rWingShape = new THREE.Mesh(wingGeo, this.materials.playerBody);
        rWingShape.position.set(2.8, 0, 0);
        rWingShape.rotation.y = 0.3; // Sweep back
        rWingShape.rotation.z = -0.05; // Dihedral
        rWingShape.castShadow = true;
        mesh.add(rWingShape);

        // 4. Twin Engines (Nacelles)
        const engineGeo = new THREE.BoxGeometry(1.2, 1, 6);
        
        const leftEngine = new THREE.Mesh(engineGeo, this.materials.playerBody);
        leftEngine.position.set(-1.2, -0.3, -2);
        mesh.add(leftEngine);

        const rightEngine = new THREE.Mesh(engineGeo, this.materials.playerBody);
        rightEngine.position.set(1.2, -0.3, -2);
        mesh.add(rightEngine);

        // Engine Nozzles (The glowing rings)
        const nozzleGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.5, 8);
        nozzleGeo.rotateX(Math.PI / 2);
        
        const leftNozzle = new THREE.Mesh(nozzleGeo, this.materials.playerDark);
        leftNozzle.position.set(-1.2, -0.3, -5.2);
        mesh.add(leftNozzle);

        const rightNozzle = new THREE.Mesh(nozzleGeo, this.materials.playerDark);
        rightNozzle.position.set(1.2, -0.3, -5.2);
        mesh.add(rightNozzle);

        // 5. Vertical Stabilizers (V-Tail - Iconic Su-57 feature)
        const finGeo = new THREE.BoxGeometry(2.5, 0.1, 3.5);
        
        const leftFin = new THREE.Mesh(finGeo, this.materials.playerDark);
        leftFin.position.set(-1.8, 1, -3);
        leftFin.rotation.z = Math.PI / 2.5; // Strong angle outward
        leftFin.rotation.y = -0.1;
        leftFin.castShadow = true;
        mesh.add(leftFin);

        const rightFin = new THREE.Mesh(finGeo, this.materials.playerDark);
        rightFin.position.set(1.8, 1, -3);
        rightFin.rotation.z = -Math.PI / 2.5; // Strong angle outward
        rightFin.rotation.y = 0.1;
        rightFin.castShadow = true;
        mesh.add(rightFin);

        // 6. Cockpit (Bubble Canopy)
        const cockpitGeo = new THREE.BoxGeometry(1, 0.7, 2.5);
        const cockpit = new THREE.Mesh(cockpitGeo, this.materials.playerCockpit);
        cockpit.position.set(0, 0.6, 1.5);
        // Tapering effect via rotation/position trick or just simple shape
        cockpit.rotation.x = -0.1; 
        mesh.add(cockpit);

        return mesh;
    }

    /**
     * Creates an Enemy Jet (Style: Heavy Interceptor with Missiles)
     * Structure: Sleek fuselage, swept wings, big intakes, weaponry.
     */
    createEnemyShip() {
        const mesh = new THREE.Group();

        // 1. Main Fuselage
        const bodyGeo = new THREE.CylinderGeometry(0.7, 1.1, 10, 8);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, this.materials.enemyBody);
        body.castShadow = true;
        mesh.add(body);

        // 2. Giant Air Intakes (Side mounted)
        const intakeGeo = new THREE.BoxGeometry(1.2, 1.4, 4);
        
        const leftIntake = new THREE.Mesh(intakeGeo, this.materials.enemyDark);
        leftIntake.position.set(-1.1, 0, 1);
        mesh.add(leftIntake);

        const rightIntake = new THREE.Mesh(intakeGeo, this.materials.enemyDark);
        rightIntake.position.set(1.1, 0, 1);
        mesh.add(rightIntake);

        // Intake Glow (Front face)
        const intakeFaceGeo = new THREE.PlaneGeometry(1.1, 1.3);
        const leftFace = new THREE.Mesh(intakeFaceGeo, this.materials.enemyDark); // Or black
        leftFace.position.set(-1.1, 0, 3.01);
        mesh.add(leftFace);
        const rightFace = new THREE.Mesh(intakeFaceGeo, this.materials.enemyDark);
        rightFace.position.set(1.1, 0, 3.01);
        mesh.add(rightFace);


        // 3. Aggressive Swept Wings
        const wingGeo = new THREE.BoxGeometry(6, 0.15, 4);
        
        const leftWing = new THREE.Mesh(wingGeo, this.materials.enemyBody);
        leftWing.position.set(-3, 0, 0);
        leftWing.rotation.y = -0.4; // Sweep back
        leftWing.castShadow = true;
        mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, this.materials.enemyBody);
        rightWing.position.set(3, 0, 0);
        rightWing.rotation.y = 0.4; // Sweep back
        rightWing.castShadow = true;
        mesh.add(rightWing);

        // 4. Missiles (Under wings - NEW ADDITION)
        const missileGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8);
        missileGeo.rotateX(Math.PI / 2);
        const missileMat = new THREE.MeshPhongMaterial({ color: 0xffffff }); // White missiles

        // Left Missiles
        const m1 = new THREE.Mesh(missileGeo, missileMat);
        m1.position.set(-3, -0.3, 0);
        mesh.add(m1);
        const m2 = new THREE.Mesh(missileGeo, missileMat);
        m2.position.set(-4.5, -0.3, -0.5);
        mesh.add(m2);

        // Right Missiles
        const m3 = new THREE.Mesh(missileGeo, missileMat);
        m3.position.set(3, -0.3, 0);
        mesh.add(m3);
        const m4 = new THREE.Mesh(missileGeo, missileMat);
        m4.position.set(4.5, -0.3, -0.5);
        mesh.add(m4);

        // 5. Tail Fin (Single tall fin)
        const tailGeo = new THREE.BoxGeometry(0.2, 3, 2.5);
        const tail = new THREE.Mesh(tailGeo, this.materials.enemyDark);
        tail.position.set(0, 1.5, -3.5);
        tail.rotation.x = -0.4; // Raked back
        mesh.add(tail);

        // Rear Stabilizers (Horizontal)
        const stabGeo = new THREE.BoxGeometry(4, 0.1, 2);
        const stab = new THREE.Mesh(stabGeo, this.materials.enemyBody);
        stab.position.set(0, 0.2, -4);
        mesh.add(stab);

        // 6. Cockpit
        const cockpitGeo = new THREE.CylinderGeometry(0.5, 0.8, 3, 8);
        cockpitGeo.rotateX(Math.PI / 2);
        const cockpit = new THREE.Mesh(cockpitGeo, this.materials.metal);
        cockpit.position.set(0, 0.9, 1);
        mesh.add(cockpit);

        // 7. Engine Exhaust
        const glowGeo = new THREE.CylinderGeometry(0.8, 0.6, 0.5, 12);
        glowGeo.rotateX(Math.PI / 2);
        const glow = new THREE.Mesh(glowGeo, this.materials.enemyEngine);
        glow.position.set(0, 0, -5.2);
        mesh.add(glow);

        return mesh;
    }
}
window.ModelFactory = ModelFactory;