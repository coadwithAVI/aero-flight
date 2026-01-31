//Follow camera logic
// ==========================================
// PATH: engine/camera-system.js
// ==========================================

class CameraSystem {
    constructor(camera) {
        this.camera = camera;
        this.target = null;

        // Camera Settings
        this.followDistance = 30; // plane se kitna door (peeche)
        this.followHeight = 10;   // plane se kitna upar
        this.smoothSpeed = 0.1;   // reserved (future tuning)

        // ✅ Reusable vectors (performance)
        this._offset = new THREE.Vector3();
        this._idealOffset = new THREE.Vector3();
        this._idealPosition = new THREE.Vector3();
        this._lookAhead = new THREE.Vector3();
        this._idealLookAt = new THREE.Vector3();
    }

    setTarget(targetObject) {
        this.target = targetObject;

        if (this.target && this.target.mesh) {
            const targetMesh = this.target.mesh;

            // ✅ Camera should be BEHIND the plane => -followDistance
            this._offset.set(0, this.followHeight, -this.followDistance);
            this._offset.applyQuaternion(targetMesh.quaternion);

            this.camera.position.copy(targetMesh.position).add(this._offset);

            // ✅ Look slightly ahead (forward is +Z because we use translateZ(+))
            this._lookAhead.set(0, 0, 20);
            this._lookAhead.applyQuaternion(targetMesh.quaternion);

            this.camera.lookAt(targetMesh.position.clone().add(this._lookAhead));
        }
    }

    update(deltaTime) {
        if (!this.target || !this.target.mesh) return;

        const targetMesh = this.target.mesh;

        // ✅ (1) Ideal camera position
        this._idealOffset.set(0, this.followHeight, -this.followDistance);
        this._idealOffset.applyQuaternion(targetMesh.quaternion);

        this._idealPosition.copy(targetMesh.position).add(this._idealOffset);

        // ✅ (2) Ideal look-at position (ahead of plane)
        this._lookAhead.set(0, 0, 30);
        this._lookAhead.applyQuaternion(targetMesh.quaternion);

        this._idealLookAt.copy(targetMesh.position).add(this._lookAhead);

        // ✅ (3) Smooth follow (frame independent)
        const t = 1.0 - Math.pow(0.001, deltaTime); 
        this.camera.position.lerp(this._idealPosition, t);

        // ✅ (4) Smooth rotation (look at ahead)
        this.camera.lookAt(this._idealLookAt);
    }
}

window.CameraSystem = CameraSystem;
