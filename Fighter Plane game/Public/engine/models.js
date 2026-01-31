// ==========================================
// PATH: gameplay/model-factory.js
// ==========================================
/**
 * ModelFactory (Improved)
 * Better composite 3D models using simple geometry
 * (optimized + good looking + consistent scale)
 */

class ModelFactory {
    constructor() {
        // Shared Materials
        this.materials = {
            playerBody: new THREE.MeshPhongMaterial({ color: 0x3498db, flatShading: true }),
            playerWings: new THREE.MeshPhongMaterial({ color: 0x2980b9, flatShading: true }),
            playerCockpit: new THREE.MeshPhongMaterial({ color: 0x1f2a33, flatShading: true }),
            enemyBody: new THREE.MeshPhongMaterial({ color: 0xe74c3c, flatShading: true }),
            enemyDetail: new THREE.MeshPhongMaterial({ color: 0xb83227, flatShading: true }),
            metal: new THREE.MeshPhongMaterial({ color: 0x95a5a6, flatShading: true }),
            darkMetal: new THREE.MeshPhongMaterial({ color: 0x5f6a6a, flatShading: true }),
            glass: new THREE.MeshPhongMaterial({
                color: 0x0b2233,
                shininess: 120,
                transparent: true,
                opacity: 0.85
            })
        };
    }

    // Utility: enable shadows for group
    _enableShadows(group) {
        group.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });
    }

    /**
     * Player Plane (Improved Jet)
     */
    createPlayerPlane() {
        const mesh = new THREE.Group();

        // ---------------------------
        // 1) Fuselage (Main body)
        // ---------------------------
        const fusGeo = new THREE.CylinderGeometry(1.6, 1.9, 11, 10, 1);
        fusGeo.rotateX(Math.PI / 2);
        const fuselage = new THREE.Mesh(fusGeo, this.materials.playerBody);
        fuselage.position.set(0, 0, 0);
        mesh.add(fuselage);

        // ---------------------------
        // 2) Nose Cone
        // ---------------------------
        const noseGeo = new THREE.ConeGeometry(1.6, 3.5, 10);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, this.materials.playerBody);
        nose.position.set(0, 0, -7);
        mesh.add(nose);

        // ---------------------------
        // 3) Cockpit / Canopy
        // ---------------------------
        const canopyGeo = new THREE.SphereGeometry(1.2, 10, 10);
        const canopy = new THREE.Mesh(canopyGeo, this.materials.glass);
        canopy.scale.set(1.2, 0.8, 1.8);
        canopy.position.set(0, 1.0, -1.5);
        mesh.add(canopy);

        // ---------------------------
        // 4) Main Wings (swept)
        // ---------------------------
        const wingGeo = new THREE.BoxGeometry(12, 0.25, 3.2);

        const leftWing = new THREE.Mesh(wingGeo, this.materials.playerWings);
        leftWing.position.set(-5.5, 0, 0.5);
        leftWing.rotation.y = 0.18; // sweep back
        mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, this.materials.playerWings);
        rightWing.position.set(5.5, 0, 0.5);
        rightWing.rotation.y = -0.18;
        mesh.add(rightWing);

        // Wing tips (slight upward vibe)
        const tipGeo = new THREE.BoxGeometry(1.2, 0.9, 0.6);
        const leftTip = new THREE.Mesh(tipGeo, this.materials.playerWings);
        leftTip.position.set(-11.3, 0.5, 0.4);
        leftTip.rotation.z = 0.35;
        mesh.add(leftTip);

        const rightTip = new THREE.Mesh(tipGeo, this.materials.playerWings);
        rightTip.position.set(11.3, 0.5, 0.4);
        rightTip.rotation.z = -0.35;
        mesh.add(rightTip);

        // ---------------------------
        // 5) Tail wings
        // ---------------------------
        const tailWingGeo = new THREE.BoxGeometry(4.8, 0.2, 1.8);

        const leftTail = new THREE.Mesh(tailWingGeo, this.materials.playerWings);
        leftTail.position.set(-2.3, 0.3, 5.2);
        leftTail.rotation.y = 0.12;
        mesh.add(leftTail);

        const rightTail = new THREE.Mesh(tailWingGeo, this.materials.playerWings);
        rightTail.position.set(2.3, 0.3, 5.2);
        rightTail.rotation.y = -0.12;
        mesh.add(rightTail);

        // ---------------------------
        // 6) Vertical stabilizer (fin)
        // ---------------------------
        const finGeo = new THREE.BoxGeometry(0.35, 3.2, 2);
        const fin = new THREE.Mesh(finGeo, this.materials.playerWings);
        fin.position.set(0, 1.8, 5.7);
        mesh.add(fin);

        // ---------------------------
        // 7) Engine Intake (fake)
        // ---------------------------
        const intakeGeo = new THREE.CylinderGeometry(0.65, 0.65, 2.3, 10);
        intakeGeo.rotateX(Math.PI / 2);

        const intakeLeft = new THREE.Mesh(intakeGeo, this.materials.darkMetal);
        intakeLeft.position.set(-1.2, -0.2, -0.2);
        mesh.add(intakeLeft);

        const intakeRight = new THREE.Mesh(intakeGeo, this.materials.darkMetal);
        intakeRight.position.set(1.2, -0.2, -0.2);
        mesh.add(intakeRight);

        // ---------------------------
        // 8) Engine Nozzle (rear)
        // ---------------------------
        const nozzleGeo = new THREE.CylinderGeometry(0.75, 1.05, 2.0, 10);
        nozzleGeo.rotateX(Math.PI / 2);
        const nozzle = new THREE.Mesh(nozzleGeo, this.materials.metal);
        nozzle.position.set(0, 0, 7.0);
        mesh.add(nozzle);

        // Save reference (so you can animate engine glow / trail)
        mesh.userData.engineNozzle = nozzle;

        this._enableShadows(mesh);

        // Make plane face forward Z
        // (We already aligned most shapes to Z forward)
        return mesh;
    }

    /**
     * Enemy Ship (Improved Drone Fighter)
     */
    createEnemyShip() {
        const mesh = new THREE.Group();

        // ---------------------------
        // 1) Main body (wedge)
        // ---------------------------
        const mainGeo = new THREE.BoxGeometry(5.2, 2.2, 7.0);
        const main = new THREE.Mesh(mainGeo, this.materials.enemyBody);
        mesh.add(main);

        // ---------------------------
        // 2) Nose wedge / aggressive front
        // ---------------------------
        const noseGeo = new THREE.ConeGeometry(1.6, 3.2, 10);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, this.materials.enemyBody);
        nose.position.set(0, 0.2, -5.2);
        mesh.add(nose);

        // ---------------------------
        // 3) Cockpit / sensor dome
        // ---------------------------
        const domeGeo = new THREE.SphereGeometry(1.0, 10, 10);
        const dome = new THREE.Mesh(domeGeo, this.materials.darkMetal);
        dome.scale.set(1.2, 0.7, 1.1);
        dome.position.set(0, 0.9, -1.0);
        mesh.add(dome);

        // ---------------------------
        // 4) Side Engine Pods
        // ---------------------------
        const podGeo = new THREE.CylinderGeometry(0.9, 0.9, 6.0, 10);
        podGeo.rotateX(Math.PI / 2);

        const leftPod = new THREE.Mesh(podGeo, this.materials.enemyDetail);
        leftPod.position.set(-3.8, 0, 0.2);
        mesh.add(leftPod);

        const rightPod = new THREE.Mesh(podGeo, this.materials.enemyDetail);
        rightPod.position.set(3.8, 0, 0.2);
        mesh.add(rightPod);

        // ---------------------------
        // 5) Wings/Fins
        // ---------------------------
        const finGeo = new THREE.BoxGeometry(7.5, 0.2, 2.2);
        const wings = new THREE.Mesh(finGeo, this.materials.enemyDetail);
        wings.position.set(0, -0.3, 0.5);
        wings.rotation.y = 0.12;
        mesh.add(wings);

        // ---------------------------
        // 6) Rear thrusters
        // ---------------------------
        const thrusterGeo = new THREE.CylinderGeometry(0.6, 0.85, 1.6, 10);
        thrusterGeo.rotateX(Math.PI / 2);

        const thrusterLeft = new THREE.Mesh(thrusterGeo, this.materials.metal);
        thrusterLeft.position.set(-3.8, 0, 4.0);
        mesh.add(thrusterLeft);

        const thrusterRight = new THREE.Mesh(thrusterGeo, this.materials.metal);
        thrusterRight.position.set(3.8, 0, 4.0);
        mesh.add(thrusterRight);

        // ---------------------------
        // 7) Belly cannon (small)
        // ---------------------------
        const cannonGeo = new THREE.BoxGeometry(0.6, 0.6, 2.0);
        const cannon = new THREE.Mesh(cannonGeo, this.materials.darkMetal);
        cannon.position.set(0, -0.9, -2.0);
        mesh.add(cannon);

        mesh.userData.cannon = cannon;

        this._enableShadows(mesh);
        return mesh;
    }
}
