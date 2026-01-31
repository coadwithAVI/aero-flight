// ==========================================
// PATH: multiplayer/mp-client.js
// ==========================================

/**
 * MPClient (Socket.IO version)
 * Compatible with updated server.js
 *
 * Server Events Used:
 * Receive:
 * - mp_welcome
 * - mp_room_created
 * - mp_room_joined
 * - mp_lobby_update
 * - mp_game_start
 * - mp_state
 * - mp_event
 * - mp_score_update
 * - mp_game_over
 * - playerDisconnected
 *
 * Send:
 * - mp_create_room
 * - mp_join_room
 * - mp_start_game
 * - mp_transform
 * - mp_input (optional)
 * - mp_fire
 * - mp_claim_ring
 */

class MPClient {
    constructor(options = {}) {
        // --- Config ---
        this.serverUrl = options.serverUrl || undefined; // undefined => same origin
        this.debug = options.debug ?? true;

        // References
        this.mpState = options.mpState || null; // new MPState(scene)
        this.game = options.game || null;       // GameManager optional reference

        // Socket instance
        this.socket = null;

        // Session
        this.clientId = null;
        this.roomId = null;
        this.isHost = false;
        this.seed = null;

        // Tick rate info from server
        this.tickRate = 20;

        // Throttling transforms
        this.transformSendRate = options.transformSendRate ?? 20; // per sec
        this._lastTransformSent = 0;

        // Fire rate throttle (client-side)
        this.fireSendRate = options.fireSendRate ?? 10;
        this._lastFireSent = 0;

        // Callbacks/hooks (UI integration)
        this.onConnected = options.onConnected || (() => {});
        this.onDisconnected = options.onDisconnected || (() => {});
        this.onLobbyUpdate = options.onLobbyUpdate || (() => {});
        this.onGameStart = options.onGameStart || (() => {});
        this.onGameOver = options.onGameOver || (() => {});
        this.onError = options.onError || ((msg) => console.warn(msg));
        this.onState = options.onState || (() => {});
        this.onEvent = options.onEvent || (() => {});
    }

    // ==========================================================
    // Connection
    // ==========================================================

    connect() {
        if (this.socket) return;

        if (typeof io === "undefined") {
            throw new Error("Socket.IO client not found. Add: <script src='/socket.io/socket.io.js'></script>");
        }

        this.socket = io(this.serverUrl, {
            transports: ["websocket", "polling"]
        });

        this._bindSocketEvents();

        if (this.debug) console.log("[MPClient] Connecting...");
    }

    disconnect() {
        if (!this.socket) return;
        this.socket.disconnect();
        this.socket = null;
        this.clientId = null;
        this.roomId = null;
        this.isHost = false;
        this.seed = null;
    }

    isConnected() {
        return !!(this.socket && this.socket.connected);
    }

    // ==========================================================
    // Lobby Controls
    // ==========================================================

    createRoom(name = "Pilot") {
        if (!this.socket) return;
        this.socket.emit("mp_create_room", { name });
    }

    joinRoom(roomId, name = "Wingman") {
        if (!this.socket) return;
        this.socket.emit("mp_join_room", { roomId, name });
    }

    startGame() {
        if (!this.socket || !this.roomId) return;
        this.socket.emit("mp_start_game", { roomId: this.roomId });
    }

    // ==========================================================
    // Gameplay Send
    // ==========================================================

    /**
     * Send current player transform to server (throttled)
     * @param {THREE.Object3D} playerMesh
     */
    sendTransform(playerMesh) {
        if (!this.socket || !this.roomId || !playerMesh) return;
        if (!this.isConnected()) return;

        const now = performance.now();
        const gap = 1000 / this.transformSendRate;
        if (now - this._lastTransformSent < gap) return;
        this._lastTransformSent = now;

        const p = playerMesh.position;
        const q = playerMesh.quaternion;

        this.socket.emit("mp_transform", {
            roomId: this.roomId,
            p: { x: p.x, y: p.y, z: p.z },
            q: { x: q.x, y: q.y, z: q.z, w: q.w }
        });
    }

    /**
     * Optional input send (future authoritative physics)
     * input example: {pitch, roll, yaw, boost, brake, fire}
     */
    sendInput(inputObj) {
        if (!this.socket || !this.roomId) return;
        if (!this.isConnected()) return;

        this.socket.emit("mp_input", {
            roomId: this.roomId,
            input: inputObj
        });
    }

    /**
     * Send fire event to server (authoritative bullet spawn on server)
     * @param {THREE.Object3D} playerMesh
     */
    sendFire(playerMesh) {
        if (!this.socket || !this.roomId || !playerMesh) return;
        if (!this.isConnected()) return;

        const now = performance.now();
        const gap = 1000 / this.fireSendRate;
        if (now - this._lastFireSent < gap) return;
        this._lastFireSent = now;

        const p = playerMesh.position;
        const q = playerMesh.quaternion;

        this.socket.emit("mp_fire", {
            roomId: this.roomId,
            p: { x: p.x, y: p.y, z: p.z },
            q: { x: q.x, y: q.y, z: q.z, w: q.w }
        });
    }

    claimRing(ringIndex) {
        if (!this.socket || !this.roomId) return;
        this.socket.emit("mp_claim_ring", { roomId: this.roomId, ringIndex });
    }

    // ==========================================================
    // Event Binding
    // ==========================================================

    _bindSocketEvents() {
        const s = this.socket;

        s.on("connect", () => {
            if (this.debug) console.log("[MPClient] Connected:", s.id);
            this.onConnected();
        });

        s.on("disconnect", (reason) => {
            if (this.debug) console.warn("[MPClient] Disconnected:", reason);

            // keep clientId? socket may reconnect with new id.
            this.roomId = null;
            this.isHost = false;
            this.seed = null;

            this.onDisconnected(reason);
        });

        // Welcome / identity
        s.on("mp_welcome", (msg) => {
            this.clientId = msg?.id || s.id;
            if (this.mpState) this.mpState.setLocalId(this.clientId);

            if (this.debug) console.log("[MPClient] Welcome:", this.clientId);
        });

        // Create room response
        s.on("mp_room_created", (msg) => {
            this.roomId = msg.roomId;
            this.isHost = !!msg.isHost;
            this.seed = msg.seed;

            if (this.debug) console.log("[MPClient] Room created:", this.roomId);

            this.onLobbyUpdate({
                type: "created",
                roomId: this.roomId,
                players: msg.players,
                hostId: msg.hostId,
                seed: msg.seed,
                isHost: this.isHost
            });
        });

        // Join room response
        s.on("mp_room_joined", (msg) => {
            this.roomId = msg.roomId;
            this.isHost = (msg.hostId === this.clientId);
            this.seed = msg.seed;

            if (this.debug) console.log("[MPClient] Room joined:", this.roomId);

            this.onLobbyUpdate({
                type: "joined",
                roomId: this.roomId,
                players: msg.players,
                hostId: msg.hostId,
                seed: msg.seed,
                isHost: this.isHost
            });
        });

        // Lobby updates broadcast
        s.on("mp_lobby_update", (msg) => {
            if (this.debug) console.log("[MPClient] Lobby update:", msg);

            this.isHost = (msg.hostId === this.clientId);

            this.onLobbyUpdate({
                type: "update",
                roomId: msg.roomId,
                players: msg.players,
                hostId: msg.hostId,
                isHost: this.isHost
            });
        });

        // Game start
        s.on("mp_game_start", (msg) => {
            this.seed = msg.seed ?? this.seed;
            this.tickRate = msg.tickRate ?? this.tickRate;

            if (this.debug) console.log("[MPClient] Game started seed:", this.seed);

            this.onGameStart({
                seed: this.seed,
                tickRate: this.tickRate
            });
        });

        // State snapshot from server
        s.on("mp_state", (snapshot) => {
            if (this.mpState) {
                this.mpState.applyServerState({
                    t: "STATE",
                    ...snapshot
                });
            }
            this.onState(snapshot);
        });

        // Events (fire, explosion etc.)
        s.on("mp_event", (evt) => {
            if (this.mpState) this.mpState.applyServerEvent(evt);
            this.onEvent(evt);
        });

        // Score update (race rings etc.)
        s.on("mp_score_update", (msg) => {
            // msg: { id, rings }
            this.onEvent({ t: "EVENT", type: "SCORE", ...msg });
        });

        // Game over
        s.on("mp_game_over", (msg) => {
            if (this.debug) console.log("[MPClient] Game Over:", msg);
            this.onGameOver(msg);
        });

        // Errors
        s.on("mp_error", (err) => {
            if (this.debug) console.warn("[MPClient] Error:", err);
            this.onError(err?.msg || "Unknown MP error");
        });

        // Player disconnected
        s.on("playerDisconnected", (id) => {
            if (this.mpState) this.mpState.removePlayer(id);
            this.onEvent({ t: "EVENT", type: "PLAYER_LEFT", id });
        });
    }
}

// Global export (non module build)
window.MPClient = MPClient;
