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
 * IMPORTANT (Server compatibility):
 * ✅ server expects:
 * - mp_create_room: { name }
 * - mp_join_room: { roomId, name }
 * - mp_leave_room: { roomId }
 * - mp_start_game: { roomId }
 * - mp_transform: { roomId, p, q }
 * - mp_fire: { roomId, p, q }
 * - mp_claim_ring: { roomId, ringIndex }
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

    this.playerId = null; // socket.id
    this.roomId = null;

    // store last used name (for reconnect / join)
    this.playerName = opts.playerName ?? "Pilot";

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

        // 🔥 IMPORTANT: include name so server doesn't break + lobby shows correct name
        this.joinRoom(this._lastRoomToRejoin, this.playerName);
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

    // ✅ server emits mp_room_created
    s.on("mp_room_created", (msg) => {
      this.log("mp_room_created:", msg);

      this.roomId = msg?.roomId ?? this.roomId;
      this.isInRoom = true;
      this._lastRoomToRejoin = this.roomId;

      try { this.onRoomCreated(msg); } catch (e) { console.error("onRoomCreated crash:", e); }
    });

    // ✅ your server currently emits mp_room_joined (NOT mp_room_join)
    s.on("mp_room_joined", (msg) => {
      this.log("mp_room_joined:", msg);

      this.roomId = msg?.roomId ?? this.roomId;
      this.isInRoom = true;
      this._lastRoomToRejoin = this.roomId;

      try { this.onRoomJoin(msg); } catch (e) { console.error("onRoomJoin crash:", e); }
    });

    // (optional compatibility)
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

    // your server emits "playerDisconnected" not mp_player_left (but keep both)
    s.on("playerDisconnected", (id) => {
      this.log("playerDisconnected:", id);

      try { this.onPlayerLeft({ id }); } catch (e) { console.error("onPlayerLeft crash:", e); }
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

    // ✅ Game over from server
    s.on("mp_game_over", (msg) => {
      this.log("mp_game_over:", msg);

      // forward to UI/game as event
      try { this.onEvent({ t: "EVENT", type: "GAME_OVER", msg }); } catch (e) { console.error("onEvent crash:", e); }
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

    // ✅ FIX: Ye code add karein taaki HIT register ho sake
    s.on("mp_hit", (msg) => {
      // Server se hit aaya, isse game event mein convert karo
      const evt = {
         type: "HIT",
         msg: msg
      };
      try { this.onEvent(evt); } catch (e) { console.error("onHit crash:", e); }
    });

    // -------------------------
    // Score update
    // -------------------------
    s.on("mp_score_update", (msg) => {
      try { this.onEvent({ t: "EVENT", type: "SCORE", msg }); } catch (e) { console.error("onEvent crash:", e); }
    });

    // errors
    s.on("mp_error", (msg) => {
      this.log("mp_error:", msg);
      try { this.onError(msg); } catch (e) { console.error("onError crash:", e); }
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
  // ROOM API (SERVER COMPAT)
  // -------------------------

  setName(name) {
    if (typeof name === "string" && name.trim()) {
      this.playerName = name.trim().slice(0, 12);
    }
  }

  createRoom(name = null) {
    if (!this.socket) return;

    if (name) this.setName(name);

    // ✅ Server expects {name}
    this.socket.emit("mp_create_room", { name: this.playerName });
  }

  joinRoom(roomId, name = null) {
    if (!this.socket) return;

    const rid = String(roomId || "").toUpperCase();
    if (!rid) return;

    if (name) this.setName(name);

    this._lastRoomToRejoin = rid;

    // ✅ Server expects {roomId, name}
    this.socket.emit("mp_join_room", { roomId: rid, name: this.playerName });
  }

  leaveRoom(roomId = null) {
    if (!this.socket) return;

    const rid = (roomId || this.roomId);
    this._lastRoomToRejoin = null;

    // ✅ Server expects {roomId}
    this.socket.emit("mp_leave_room", { roomId: rid });
  }

  startGame(roomId = null) {
    if (!this.socket) return;

    const rid = (roomId || this.roomId);
    if (!rid) return;

    this.socket.emit("mp_start_game", { roomId: rid });
  }

  // (optional) server doesn't use ready, but keep for future
  setReady(isReady = true) {
    if (!this.socket) return;
    this.socket.emit("mp_ready", { ready: !!isReady });
  }

  // -------------------------
  // GAMEPLAY SEND (SERVER COMPAT)
  // -------------------------

  /**
   * Send transform to server (server expects mp_transform)
   * data: {roomId, p, q}
   */
  sendTransform(p, q, roomId = null) {
    if (!this.socket || !this.isInRoom) return;

    const rid = (roomId || this.roomId);
    if (!rid) return;

    this.socket.emit("mp_transform", {
      roomId: rid,
      p: p || null,
      q: q || null
    });
  }

  /**
   * Fire bullet (server expects roomId + p/q)
   */
  fire(p = null, q = null, roomId = null) {
    if (!this.socket || !this.isInRoom) return;

    const rid = (roomId || this.roomId);
    if (!rid) return;

    this.socket.emit("mp_fire", {
      roomId: rid,
      p: p || null,
      q: q || null
    });
  }

  /**
   * Client reports hit
   */
  reportHit(targetId, bulletId = null, roomId = null) {
    if (!this.socket || !this.isInRoom) return;
    const rid = (roomId || this.roomId);
    if (!rid) return;

    this.socket.emit("mp_hit", {
      roomId: rid,
      targetId,
      bulletId
    });
  }

  /**
   * Claim ring (server has sequential validation)
   */
  claimRing(ringIndex, roomId = null) {
    if (!this.socket || !this.isInRoom) return;

    const rid = (roomId || this.roomId);
    if (!rid) return;

    this.socket.emit("mp_claim_ring", {
      roomId: rid,
      ringIndex
    });
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
