// ==========================================
// PATH: multiplayer/mp-client.js
// ==========================================

/**
 * MPClient (FINAL - Socket.IO)
 *
 * Compatible with your server.js events:
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
 * - mp_error
 *
 * Send:
 * - mp_create_room
 * - mp_join_room
 * - mp_start_game
 * - mp_transform
 * - mp_input (optional)
 * - mp_fire
 * - mp_claim_ring
 *
 * Optional / future:
 * - mp_hit (client reported hit, server scores)
 * - mp_leave_room
 */

class MPClient {
  constructor(options = {}) {
    // --- Config ---
    this.serverUrl = options.serverUrl || undefined; // undefined => same origin
    this.debug = options.debug ?? true;

    // References
    this.mpState = options.mpState || null; // MPState(scene)
    this.game = options.game || null;       // GameManager optional

    // Socket
    this.socket = null;

    // Session
    this.clientId = null;
    this.roomId = null;
    this.isHost = false;
    this.seed = null;

    // Tick rate from server
    this.tickRate = 20;

    // Throttling
    this.transformSendRate = options.transformSendRate ?? 20; // per sec
    this._lastTransformSent = 0;

    this.fireSendRate = options.fireSendRate ?? 12; // per sec
    this._lastFireSent = 0;

    // Optional input send throttling
    this.inputSendRate = options.inputSendRate ?? 20;
    this._lastInputSent = 0;

    // callbacks
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
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2500
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
  // Lobby
  // ==========================================================

  createRoom(name = "Pilot") {
    if (!this.socket) return;
    this.socket.emit("mp_create_room", { name: String(name || "Pilot").substring(0, 12) });
  }

  joinRoom(roomId, name = "Wingman") {
    if (!this.socket) return;
    this.socket.emit("mp_join_room", {
      roomId: String(roomId || "").toUpperCase(),
      name: String(name || "Wingman").substring(0, 12)
    });
  }

  startGame() {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("mp_start_game", { roomId: this.roomId });
  }

  // Optional (future)
  leaveRoom() {
    if (!this.socket || !this.roomId) return;
    // server may not implement it, but safe to call
    this.socket.emit("mp_leave_room", { roomId: this.roomId });
    this.roomId = null;
    this.isHost = false;
  }

  // ==========================================================
  // Gameplay Send (semi authoritative)
  // ==========================================================

  /**
   * Send local player transform to server (throttled)
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

    const now = performance.now();
    const gap = 1000 / this.inputSendRate;
    if (now - this._lastInputSent < gap) return;
    this._lastInputSent = now;

    this.socket.emit("mp_input", {
      roomId: this.roomId,
      input: inputObj || {}
    });
  }

  /**
   * Fire request (server spawns bullet authoritative in room.bullets)
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

  /**
   * Claim ring
   */
  claimRing(ringIndex) {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("mp_claim_ring", { roomId: this.roomId, ringIndex });
  }

  /**
   * Optional future: hit report (client hit detection)
   * data:
   * { victimId, bulletId, damage, pos }
   */
  reportHit(data) {
    if (!this.socket || !this.roomId) return;
    if (!this.isConnected()) return;

    // server may or may not implement mp_hit
    this.socket.emit("mp_hit", {
      roomId: this.roomId,
      ...data
    });
  }

  // ==========================================================
  // Socket Events
  // ==========================================================

  _bindSocketEvents() {
    const s = this.socket;

    // -------------------------
    // Connect/disconnect
    // -------------------------
    s.on("connect", () => {
      if (this.debug) console.log("[MPClient] Connected:", s.id);
      this.onConnected();
    });

    s.on("disconnect", (reason) => {
      if (this.debug) console.warn("[MPClient] Disconnected:", reason);

      // socket reconnect can happen, so keep clientId if possible
      this.roomId = null;
      this.isHost = false;
      this.seed = null;

      this.onDisconnected(reason);
    });

    // -------------------------
    // Welcome / identity
    // -------------------------
    s.on("mp_welcome", (msg) => {
      this.clientId = msg?.id || s.id;
      if (this.mpState) this.mpState.setLocalId(this.clientId);

      if (this.debug) console.log("[MPClient] Welcome:", this.clientId);
    });

    // -------------------------
    // Room created
    // -------------------------
    s.on("mp_room_created", (msg) => {
      this.roomId = msg.roomId;
      this.isHost = !!msg.isHost;
      this.seed = msg.seed;

      if (this.debug) console.log("[MPClient] Room created:", this.roomId);

      this.onLobbyUpdate({
        type: "created",
        roomId: this.roomId,
        players: msg.players || [],
        hostId: msg.hostId,
        seed: msg.seed,
        isHost: this.isHost
      });
    });

    // -------------------------
    // Room joined
    // -------------------------
    s.on("mp_room_joined", (msg) => {
      this.roomId = msg.roomId;
      this.isHost = (msg.hostId === this.clientId);
      this.seed = msg.seed;

      if (this.debug) console.log("[MPClient] Room joined:", this.roomId);

      this.onLobbyUpdate({
        type: "joined",
        roomId: this.roomId,
        players: msg.players || [],
        hostId: msg.hostId,
        seed: msg.seed,
        isHost: this.isHost
      });
    });

    // -------------------------
    // Lobby update
    // -------------------------
    s.on("mp_lobby_update", (msg) => {
      if (this.debug) console.log("[MPClient] Lobby update:", msg);

      // keep local isHost in sync
      this.isHost = (msg.hostId === this.clientId);

      this.onLobbyUpdate({
        type: "update",
        roomId: msg.roomId,
        players: msg.players || [],
        hostId: msg.hostId,
        isHost: this.isHost
      });
    });

    // -------------------------
    // Game start
    // -------------------------
    s.on("mp_game_start", (msg) => {
      this.seed = msg.seed ?? this.seed;
      this.tickRate = msg.tickRate ?? this.tickRate;

      if (this.debug) console.log("[MPClient] Game started seed:", this.seed, "tickRate:", this.tickRate);

      this.onGameStart({
        seed: this.seed,
        tickRate: this.tickRate
      });
    });

    // -------------------------
    // State snapshot
    // -------------------------
    s.on("mp_state", (snapshot) => {
      if (this.mpState) {
        this.mpState.applyServerState({
          t: "STATE",
          ...snapshot
        });
      }

      this.onState(snapshot);
    });

    // -------------------------
    // Event messages (fire etc)
    // -------------------------
    s.on("mp_event", (evt) => {
      if (this.mpState) this.mpState.applyServerEvent(evt);
      this.onEvent(evt);
    });

    // -------------------------
    // Score update
    // -------------------------
    s.on("mp_score_update", (msg) => {
      this.onEvent({ t: "EVENT", type: "SCORE", ...msg });
    });

    // -------------------------
    // Game over
    // -------------------------
    s.on("mp_game_over", (msg) => {
      if (this.debug) console.log("[MPClient] Game Over:", msg);
      this.onGameOver(msg);
    });

    // -------------------------
    // Player left
    // -------------------------
    s.on("playerDisconnected", (id) => {
      if (this.mpState) this.mpState.removePlayer(id);
      this.onEvent({ t: "EVENT", type: "PLAYER_LEFT", id });
    });

    // -------------------------
    // Errors
    // -------------------------
    s.on("mp_error", (err) => {
      if (this.debug) console.warn("[MPClient] Error:", err);
      this.onError(err?.msg || "Unknown MP error");
    });
  }
}

// Global export
window.MPClient = MPClient;
