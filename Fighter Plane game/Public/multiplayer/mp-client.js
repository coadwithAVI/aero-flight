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
 * ✅ FIXED mp_state handler (no illegal syntax)
 * ✅ FIXED mp_score_update handler (no illegal syntax)
 *
 * Receive:
 * - mp_welcome
 * - mp_room_created
 * - mp_room_join
 * - mp_room_left
 * - mp_lobby_update
 * - mp_player_join
 * - mp_player_left
 * - mp_game_start
 * - mp_state
 * - mp_event
 * - mp_score_update
 *
 * Send:
 * - mp_create_room
 * - mp_join_room
 * - mp_leave_room
 * - mp_ready
 * - mp_input
 * - mp_fire
 */

class MPClient {
  constructor(opts = {}) {
    this.url = opts.url ?? "/";
    this.debug = !!opts.debug;

    // socket.io instance
    this.socket = null;

    // state
    this.isConnected = false;
    this.isInRoom = false;

    this.playerId = null;
    this.roomId = null;

    // game callbacks (set by GameManager)
    this.onWelcome = opts.onWelcome ?? (() => {});
    this.onRoomCreated = opts.onRoomCreated ?? (() => {});
    this.onRoomJoin = opts.onRoomJoin ?? (() => {});
    this.onRoomLeft = opts.onRoomLeft ?? (() => {});
    this.onLobbyUpdate = opts.onLobbyUpdate ?? (() => {});
    this.onPlayerJoin = opts.onPlayerJoin ?? (() => {});
    this.onPlayerLeft = opts.onPlayerLeft ?? (() => {});
    this.onGameStart = opts.onGameStart ?? (() => {});
    this.onState = opts.onState ?? (() => {});
    this.onEvent = opts.onEvent ?? (() => {});
    this.onDisconnect = opts.onDisconnect ?? (() => {});
    this.onConnect = opts.onConnect ?? (() => {});
    this.onError = opts.onError ?? ((e) => console.error(e));

    // attached shared state (MPState instance)
    this.mpState = opts.mpState ?? null;

    // reconnect safety
    this._hasBound = false;
    this._lastRoomToRejoin = null;
  }

  log(...args) {
    if (this.debug) console.log("[MPClient]", ...args);
  }

  connect() {
    if (this.socket) return;

    if (typeof io === "undefined") {
      console.error("Socket.IO client not found. Did you include /socket.io/socket.io.js ?");
      return;
    }

    this.log("Connecting to:", this.url);

    const s = io(this.url, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 400,
      reconnectionDelayMax: 2000,
      timeout: 10000
    });

    this.socket = s;

    if (this._hasBound) return;
    this._hasBound = true;

    // -------------------------
    // Connection
    // -------------------------
    s.on("connect", () => {
      this.isConnected = true;
      this.playerId = s.id;

      this.log("Connected:", this.playerId);

      try { this.onConnect(); } catch (e) { console.error("onConnect crash:", e); }

      // Auto rejoin if we were in a room
      if (this._lastRoomToRejoin) {
        this.log("Auto rejoin room:", this._lastRoomToRejoin);
        this.joinRoom(this._lastRoomToRejoin);
      }
    });

    s.on("disconnect", (reason) => {
      this.isConnected = false;
      this.isInRoom = false;

      this.log("Disconnected:", reason);

      try { this.onDisconnect(reason); } catch (e) { console.error("onDisconnect crash:", e); }
    });

    s.on("connect_error", (err) => {
      this.log("connect_error:", err?.message || err);
      try { this.onError(err); } catch (e) { console.error("onError crash:", e); }
    });

    // -------------------------
    // Welcome / room / lobby
    // -------------------------
    s.on("mp_welcome", (msg) => {
      this.log("mp_welcome:", msg);

      try { this.onWelcome(msg); } catch (e) { console.error("onWelcome crash:", e); }
    });

    s.on("mp_room_created", (msg) => {
      this.log("mp_room_created:", msg);

      this.roomId = msg?.roomId ?? this.roomId;
      this.isInRoom = true;
      this._lastRoomToRejoin = this.roomId;

      try { this.onRoomCreated(msg); } catch (e) { console.error("onRoomCreated crash:", e); }
    });

    s.on("mp_room_join", (msg) => {
      this.log("mp_room_join:", msg);

      this.roomId = msg?.roomId ?? this.roomId;
      this.isInRoom = true;
      this._lastRoomToRejoin = this.roomId;

      try { this.onRoomJoin(msg); } catch (e) { console.error("onRoomJoin crash:", e); }
    });

    s.on("mp_room_left", (msg) => {
      this.log("mp_room_left:", msg);

      this.isInRoom = false;
      this.roomId = null;

      try { this.onRoomLeft(msg); } catch (e) { console.error("onRoomLeft crash:", e); }
    });

    s.on("mp_lobby_update", (msg) => {
      this.log("mp_lobby_update:", msg);

      try { this.onLobbyUpdate(msg); } catch (e) { console.error("onLobbyUpdate crash:", e); }
    });

    s.on("mp_player_join", (msg) => {
      this.log("mp_player_join:", msg);

      try { this.onPlayerJoin(msg); } catch (e) { console.error("onPlayerJoin crash:", e); }
    });

    s.on("mp_player_left", (msg) => {
      this.log("mp_player_left:", msg);

      try { this.onPlayerLeft(msg); } catch (e) { console.error("onPlayerLeft crash:", e); }
    });

    // -------------------------
    // Game start
    // -------------------------
    s.on("mp_game_start", (msg) => {
      this.log("mp_game_start:", msg);

      try { this.onGameStart(msg); } catch (e) { console.error("onGameStart crash:", e); }
    });

    // -------------------------
    // State snapshot (FIXED)
    // -------------------------
    s.on("mp_state", (snapshot) => {
      // snapshot is the authoritative server state
      if (this.mpState) {
        try {
          // MPState expects {players, bullets, tick, ...}
          this.mpState.applyServerState(snapshot);
        } catch (e) {
          console.error("mpState.applyServerState crash:", e);
        }
      }

      try { this.onState(snapshot); } catch (e) { console.error("onState crash:", e); }
    });

    // -------------------------
    // Events
    // -------------------------
    s.on("mp_event", (evt) => {
      try { this.onEvent(evt); } catch (e) { console.error("onEvent crash:", e); }
    });

    // -------------------------
    // Score update (FIXED)
    // -------------------------
    s.on("mp_score_update", (msg) => {
      try { this.onEvent({ t: "EVENT", type: "SCORE", msg }); } catch (e) { console.error("onEvent crash:", e); }
    });

    this.log("MPClient listeners bound.");
  }

  disconnect() {
    if (!this.socket) return;

    try {
      this.socket.disconnect();
    } catch (e) {
      console.warn("socket.disconnect failed:", e);
    }

    this.socket = null;
    this.isConnected = false;
    this.isInRoom = false;
    this.roomId = null;
  }

  // -------------------------
  // ROOM API
  // -------------------------
  createRoom() {
    if (!this.socket) return;
    this.socket.emit("mp_create_room");
  }

  joinRoom(roomId) {
    if (!this.socket) return;

    this._lastRoomToRejoin = roomId;
    this.socket.emit("mp_join_room", { roomId });
  }

  leaveRoom() {
    if (!this.socket) return;

    this._lastRoomToRejoin = null;
    this.socket.emit("mp_leave_room");
  }

  setReady(isReady = true) {
    if (!this.socket) return;
    this.socket.emit("mp_ready", { ready: !!isReady });
  }

  // -------------------------
  // INPUT / ACTIONS
  // -------------------------
  sendInput(input) {
    if (!this.socket || !this.isInRoom) return;

    // input should already be compact (x,y,z + rot etc.)
    this.socket.emit("mp_input", input);
  }

  fire(payload) {
    if (!this.socket || !this.isInRoom) return;
    this.socket.emit("mp_fire", payload ?? {});
  }

  // -------------------------
  // Attach MPState
  // -------------------------
  attachState(mpState) {
    this.mpState = mpState;
  }
}

// Global export
window.MPClient = MPClient;
