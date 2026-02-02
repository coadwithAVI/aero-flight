// ==========================================
// PATH: multiplayer/mp-client.js
// ==========================================

/**
 * MPClient (FINAL - Socket.IO) [UPDATED DEBUG SAFE]
 *
 * Fixes:
 * ✅ Debug logs for mp_game_start / mp_lobby_update
 * ✅ try/catch around callbacks (silent crash fix)
 * ✅ stable reconnect behavior
 *
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
 * - mp_hit (optional)
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

    // Debug timing
    this._lastStartAt = 0;

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
    if (this.debug) console.log("[MPClient] startGame emit mp_start_game:", this.roomId);
    this.socket.emit("mp_start_game", { roomId: this.roomId });
  }

  // Optional (future)
  leaveRoom() {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("mp_leave_room", { roomId: this.roomId });
    this.roomId = null;
    this.isHost = false;
  }

  // ==========================================================
  // Gameplay Send
  // ==========================================================

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

  reportHit(data) {
    if (!this.socket || !this.roomId) return;
    if (!this.isConnected()) return;

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
      try { this.onConnected(); } catch (e) { console.error("onConnected crash:", e); }
    });

    s.on("disconnect", (reason) => {
      if (this.debug) console.warn("[MPClient] Disconnected:", reason);

      // reset session state
      this.roomId = null;
      this.isHost = false;
      this.seed = null;

      try { this.onDisconnected(reason); } catch (e) { console.error("onDisconnected crash:", e); }
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

      if (this.debug) console.log("[MPClient] Room created:", this.roomId, "host:", this.isHost);

      try {
        this.onLobbyUpdate({
          type: "created",
          roomId: this.roomId,
          players: msg.players || [],
          hostId: msg.hostId,
          seed: msg.seed,
          isHost: this.isHost
        });
      } catch (e) {
        console.error("onLobbyUpdate crash:", e);
      }
    });

    // -------------------------
    // Room joined
    // -------------------------
    s.on("mp_room_joined", (msg) => {
      this.roomId = msg.roomId;
      this.isHost = (msg.hostId === this.clientId);
      this.seed = msg.seed;

      if (this.debug) console.log("[MPClient] Room joined:", this.roomId, "isHost:", this.isHost);

      try {
        this.onLobbyUpdate({
          type: "joined",
          roomId: this.roomId,
          players: msg.players || [],
          hostId: msg.hostId,
          seed: msg.seed,
          isHost: this.isHost
        });
      } catch (e) {
        console.error("onLobbyUpdate crash:", e);
      }
    });

    // -------------------------
    // Lobby update
    // -------------------------
    s.on("mp_lobby_update", (msg) => {
      if (this.debug) console.log("[MPClient] Lobby update:", msg);

      this.isHost = (msg.hostId === this.clientId);

      try {
        this.onLobbyUpdate({
          type: "update",
          roomId: msg.roomId,
          players: msg.players || [],
          hostId: msg.hostId,
          isHost: this.isHost
        });
      } catch (e) {
        console.error("onLobbyUpdate crash:", e);
      }
    });

    // -------------------------
    // Game start
    // -------------------------
    s.on("mp_game_start", (msg) => {
      console.log("✅ CLIENT RECEIVED mp_game_start", msg);

      this._lastStartAt = performance.now();

      this.seed = msg.seed ?? this.seed;
      this.tickRate = msg.tickRate ?? this.tickRate;

      if (this.debug) console.log("[MPClient] Game started seed:", this.seed, "tickRate:", this.tickRate);

      try {
        this.onGameStart({
          seed: this.seed,
          tickRate: this.tickRate,
          raw: msg
        });
      } catch (e) {
        console.error("❌ onGameStart crashed:", e);
      }
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

      try { this.onState(snapshot); } catch (e) { console.error("onState crash:", e); }
    });

    // -------------------------
    // Event messages
    // -------------------------
    s.on("mp_event", (evt) => {
      if (this.mpState) this.mpState.applyServerEvent(evt);
      try { this.onEvent(evt); } catch (e) { console.error("onEvent crash:", e); }
    });

    // -------------------------
    // Score update
    // -------------------------
    s.on("mp_score_update", (msg) => {
      try { this.onEvent({ t: "EVENT", type: "SCORE", ...msg }); } catch (e) { console.error("onEvent crash:", e); }
    });

    // -------------------------
    // Game over
    // -------------------------
    s.on("mp_game_over", (msg) => {
      console.log("❌ GAME OVER after(ms):", performance.now() - (this._lastStartAt || performance.now()), msg);
      if (this.debug) console.log("[MPClient] Game Over:", msg);

      try { this.onGameOver(msg); } catch (e) { console.error("onGameOver crash:", e); }
    });

    // -------------------------
    // Player left
    // -------------------------
    s.on("playerDisconnected", (id) => {
      if (this.mpState) this.mpState.removePlayer(id);
      try { this.onEvent({ t: "EVENT", type: "PLAYER_LEFT", id }); } catch (e) { console.error("onEvent crash:", e); }
    });

    // -------------------------
    // Errors
    // -------------------------
    s.on("mp_error", (err) => {
      if (this.debug) console.warn("[MPClient] Error:", err);
      try { this.onError(err?.msg || "Unknown MP error"); } catch (e) { console.error("onError crash:", e); }
    });
  }
}

// Global export
window.MPClient = MPClient;
