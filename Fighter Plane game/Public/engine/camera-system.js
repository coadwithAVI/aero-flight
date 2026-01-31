//Follow camera logic
// ==========================================
// PATH: engine/camera-system.js
// ==========================================

class CameraSystem {
    constructor(camera) {
        this.camera = camera;
        this.target = null; // Kisko follow karna hai (Player)
        
        // Camera Settings
        this.followDistance = 30; // Plane se kitna door
        this.followHeight = 10;   // Plane se kitna upar
        this.smoothSpeed = 0.1;   // 0.1 = Slow/Smooth, 1.0 = Instant/Rigid
        
        // Internal State
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
    }

    setTarget(targetObject) {
        this.target = targetObject;
        
        // Jab pehli baar target set ho, toh camera ko seedha wahan teleport kar do
        // taaki game start hote hi camera door se udta hua na aaye
        if (this.target) {
            const targetPos = this.target.mesh.position;
            const offset = new THREE.Vector3(0, this.followHeight, this.followDistance);
            offset.applyQuaternion(this.target.mesh.quaternion);
            this.camera.position.copy(targetPos).add(offset);
            this.camera.lookAt(targetPos);
        }
    }

    update(deltaTime) {
        if (!this.target || !this.target.mesh) return;

        const targetMesh = this.target.mesh;

        // 1. Calculate Ideal Position (Kahan hona chahiye)
        // Hum plane ke local space mein offset calculate karte hain (Peeche aur Upar)
        const idealOffset = new THREE.Vector3(0, this.followHeight, this.followDistance);
        
        // Is offset ko plane ki rotation ke hisaab se world space mein convert karo
        idealOffset.applyQuaternion(targetMesh.quaternion);
        const idealPosition = targetMesh.position.clone().add(idealOffset);

        // 2. Calculate Look At Position (Kahan dekhna chahiye)
        // Hum plane ke thoda aage dekhte hain taaki player ko aage ka rasta dikhe
        const lookAhead = new THREE.Vector3(0, 0, -20); // Local forward is -Z usually in models
        lookAhead.applyQuaternion(targetMesh.quaternion);
        const idealLookAt = targetMesh.position.clone().add(lookAhead);

        // 3. Smooth Movement (Lerp)
        // Camera ko directly 'idealPosition' par teleport karne ki jagah, 
        // hum use dheere-dheere wahan le jaate hain.
        // DeltaTime use karte hain taaki FPS ka asar na pade.
        const t = 1.0 - Math.pow(0.001, deltaTime); // Frame-rate independent lerp factor

        this.camera.position.lerp(idealPosition, t);
        
        // 4. Smooth Rotation
        // LookAt ko bhi smooth kar sakte hain, par abhi simple rakhte hain
        this.camera.lookAt(targetMesh.position);
        this.camera.lookAt(idealLookAt);

        // Optional: Speed Effect (Shake/FOV)
        // Agar future mein boost logic add hoga, toh yahan FOV change kar sakte hain
    }
}