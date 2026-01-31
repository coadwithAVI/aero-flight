//3D Plane models/placeholders
/**
 * ModelFactory
 * Centralizes 3D mesh creation for the game.
 * Replaces the simple placeholder geometry with slightly more detailed composite models.
 */
class ModelFactory {
    constructor() {
        // Shared Materials (for performance)
        this.materials = {
            playerBody: new THREE.MeshPhongMaterial({ color: 0x3498db, flatShading: true }), // Blue
            playerWings: new THREE.MeshPhongMaterial({ color: 0x2980b9, flatShading: true }), // Dark Blue
            playerCockpit: new THREE.MeshPhongMaterial({ color: 0x2c3e50, flatShading: true }), // Dark Grey
            enemyBody: new THREE.MeshPhongMaterial({ color: 0xe74c3c, flatShading: true }), // Red
            enemyDetail: new THREE.MeshPhongMaterial({ color: 0xc0392b, flatShading: true }), // Dark Red
            metal: new THREE.MeshPhongMaterial({ color: 0x95a5a6, flatShading: true }) // Grey
        };
    }

    /**
     * Creates the Player's Plane
     * Structure: Fuselage, Main Wings, Tail Plane, Cockpit, Propeller
     */
    createPlayerPlane() {
        const mesh = new THREE.Group();

        // 1. Fuselage (Body)
        const bodyGeo = new THREE.ConeGeometry(2, 10, 8); // Tip points up (Y)
        bodyGeo.rotateX(Math.PI / 2); // Rotate to point forward (Z)
        const body = new THREE.Mesh(bodyGeo, this.materials.playerBody);
        body.castShadow = true;
        body.receiveShadow = true;
        mesh.add(body);

        // 2. Main Wings
        const wingGeo = new THREE.BoxGeometry(12, 0.5, 3);
        const wings = new THREE.Mesh(wingGeo, this.materials.playerWings);
        wings.position.set(0, 0, 1); // Slightly back
        wings.castShadow = true;
        mesh.add(wings);

        // 3. Tail Plane (Horizontal Stabilizer)
        const tailGeo = new THREE.BoxGeometry(5, 0.5, 2);
        const tail = new THREE.Mesh(tailGeo, this.materials.playerWings);
        tail.position.set(0, 0, 4); // Back of the plane
        tail.castShadow = true;
        mesh.add(tail);

        // 4. Vertical Stabilizer (Fin)
        const finGeo = new THREE.BoxGeometry(0.5, 3, 2);
        const fin = new THREE.Mesh(finGeo, this.materials.playerWings);
        fin.position.set(0, 1, 4);
        mesh.add(fin);

        // 5. Cockpit
        const cockpitGeo = new THREE.BoxGeometry(1.5, 1.5, 2.5);
        const cockpit = new THREE.Mesh(cockpitGeo, this.materials.playerCockpit);
        cockpit.position.set(0, 1, 0);
        mesh.add(cockpit);

        // 6. Propeller (Visual only)
        const propGeo = new THREE.BoxGeometry(6, 0.5, 0.5);
        const propeller = new THREE.Mesh(propGeo, this.materials.metal);
        propeller.position.set(0, 0, -5); // Front tip
        
        // Save reference to propeller to animate it later if needed
        mesh.userData.propeller = propeller; 
        mesh.add(propeller);

        return mesh;
    }

    /**
     * Creates an Enemy Drone/Ship
     * Structure: Boxy aggressive shape
     */
    createEnemyShip() {
        const mesh = new THREE.Group();

        // 1. Main Body
        const bodyGeo = new THREE.BoxGeometry(4, 3, 6);
        const body = new THREE.Mesh(bodyGeo, this.materials.enemyBody);
        body.castShadow = true;
        mesh.add(body);

        // 2. Side Engines
        const engineGeo = new THREE.CylinderGeometry(1, 1, 6, 8);
        engineGeo.rotateX(Math.PI / 2);
        
        const leftEngine = new THREE.Mesh(engineGeo, this.materials.enemyDetail);
        leftEngine.position.set(-3, 0, 0);
        mesh.add(leftEngine);

        const rightEngine = new THREE.Mesh(engineGeo, this.materials.enemyDetail);
        rightEngine.position.set(3, 0, 0);
        mesh.add(rightEngine);

        return mesh;
    }
}