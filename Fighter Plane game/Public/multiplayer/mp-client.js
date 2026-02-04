// ==========================================
// PATH: multiplayer/mp-client.js
// ==========================================

class MPClient {
  constructor(opts = {}) {
    this.url = opts.url ?? "/";
    this.debug = !!opts.debug;

    // socket.io instance
    this.socket = null;

    // State Variables (Renamed to avoid collision with methods)
    this.connected = false; // Changed from isConnected to connected
    this.inRoom = false;    // Changed from isInRoom to inRoom

    this.playerId = null; // socket.id
    this.roomId = null;

    // store last used name
    this.playerName = opts.playerName ?? "Pilot";

    // game callbacks
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
      this.connected = true;
      this.playerId = s.id;
      this.log("Connected:", this.playerId);
      try { this.onConnect(); } catch (e) { console.error("onConnect crash:", e); }

      if (this._lastRoomToRejoin) {
        this.log("Auto rejoin room:", this._lastRoomToRejoin);
        this.joinRoom(this._lastRoomToRejoin, this.playerName);
      }
    });

    s.on("disconnect", (reason) => {
      this.connected = false;
      this.inRoom = false;
      this.log("Disconnected:", reason);
      try { this.onDisconnect(reason); } catch (e) { console.error("onDisconnect crash:", e); }
    });

    s.on("connect_error", (err) => {
      this.log("connect_error:", err?.message || err);
      try { this.onError(err); } catch (e) { console.error("onError crash:", e); }
    });

    // -------------------------
    // Room / Lobby
    // -------------------------
    s.on("mp_welcome", (msg) => {
      try { this.onWelcome(msg); } catch (e) { console.error("onWelcome crash:", e); }
    });

    s.on("mp_room_created", (msg) => {
      this.roomId = msg?.roomId ?? this.roomId;
      this.inRoom = true;
      this._lastRoomToRejoin = this.roomId;
      try { this.onRoomCreated(msg); } catch (e) { console.error("onRoomCreated crash:", e); }
    });

    s.on("mp_room_joined", (msg) => {
      this.roomId = msg?.roomId ?? this.roomId;
      this.inRoom = true;
      this._lastRoomToRejoin = this.roomId;
      try { this.onRoomJoin(msg); } catch (e) { console.error("onRoomJoin crash:", e); }
    });

    s.on("mp_room_left", (msg) => {
      this.inRoom = false;
      this.roomId = null;
      try { this.onRoomLeft(msg); } catch (e) { console.error("onRoomLeft crash:", e); }
    });

    s.on("mp_lobby_update", (msg) => {
      try { this.onLobbyUpdate(msg); } catch (e) { console.error("onLobbyUpdate crash:", e); }
    });

    s.on("playerDisconnected", (id) => {
      try { this.onPlayerLeft({ id }); } catch (e) { console.error("onPlayerLeft crash:", e); }
    });

    s.on("mp_player_join", (msg) => {
      try { this.onPlayerJoin(msg); } catch (e) { console.error("onPlayerJoin crash:", e); }
    });

    s.on("mp_player_left", (msg) => {
      try { this.onPlayerLeft(msg); } catch (e) { console.error("onPlayerLeft crash:", e); }
    });

    // -------------------------
    // Game Flow
    // -------------------------
    s.on("mp_game_start", (msg) => {
      try { this.onGameStart(msg); } catch (e) { console.error("onGameStart crash:", e); }
    });

    s.on("mp_game_over", (msg) => {
      try { this.onEvent({ t: "EVENT", type: "GAME_OVER", msg }); } catch (e) { console.error("onEvent crash:", e); }
    });

    // -------------------------
    // State Sync
    // -------------------------
    s.on("mp_state", (snapshot) => {
      if (this.mpState) {
        try { this.mpState.applyServerState(snapshot); } 
        catch (e) { console.error("mpState.applyServerState crash:", e); }
      }
      try { this.onState(snapshot); } catch (e) { console.error("onState crash:", e); }
    });

    // -------------------------
    // Event / Hit Handling
    // -------------------------
    s.on("mp_event", (evt) => {
      try { this.onEvent(evt); } catch (e) { console.error("onEvent crash:", e); }
    });

    s.on("mp_hit", (msg) => {
      const evt = { type: "HIT", msg: msg };
      try { this.onEvent(evt); } catch (e) { console.error("onHit crash:", e); }
    });

    s.on("mp_score_update", (msg) => {
      try { this.onEvent({ t: "EVENT", type: "SCORE", msg }); } catch (e) { console.error("onEvent crash:", e); }
    });

    // Errors
    s.on("mp_error", (msg) => {
      this.log("mp_error:", msg);
      try { this.onError(msg); } catch (e) { console.error("onError crash:", e); }
    });

    this.log("MPClient listeners bound.");
  }

  // -------------------------
  // SOCKET ACTIONS
  // -------------------------

  // ✅ CRITICAL FIX: This is now a function, and the property is 'this.connected'
  isConnected() { 
      return !!(this.socket && this.connected);
  }

  isInRoom() {
      return !!this.inRoom;
  }

  disconnect() {
    if (!this.socket) return;
    try { this.socket.disconnect(); } catch (e) {}
    this.socket = null;
    this.connected = false;
    this.inRoom = false;
    this.roomId = null;
  }

  setName(name) {
    if (typeof name === "string" && name.trim()) {
      this.playerName = name.trim().slice(0, 12);
    }
  }

  createRoom(name = null) {
    if (!this.socket) return;
    if (name) this.setName(name);
    this.socket.emit("mp_create_room", { name: this.playerName });
  }

  joinRoom(roomId, name = null) {
    if (!this.socket) return;
    const rid = String(roomId || "").toUpperCase();
    if (!rid) return;
    if (name) this.setName(name);
    this._lastRoomToRejoin = rid;
    this.socket.emit("mp_join_room", { roomId: rid, name: this.playerName });
  }

  leaveRoom(roomId = null) {
    if (!this.socket) return;
    const rid = (roomId || this.roomId);
    this._lastRoomToRejoin = null;
    this.socket.emit("mp_leave_room", { roomId: rid });
  }

  startGame(roomId = null) {
    if (!this.socket) return;
    const rid = (roomId || this.roomId);
    if (!rid) return;
    this.socket.emit("mp_start_game", { roomId: rid });
  }

  sendTransform(p, q, roomId = null) {
    if (!this.socket || !this.inRoom) return;
    const rid = (roomId || this.roomId);
    if (!rid) return;
    // Volatile for performance
    if(this.socket.volatile) {
        this.socket.volatile.emit("mp_transform", { roomId: rid, p, q });
    } else {
        this.socket.emit("mp_transform", { roomId: rid, p, q });
    }
  }

  fire(p = null, q = null, roomId = null) {
    if (!this.socket || !this.inRoom) return;
    const rid = (roomId || this.roomId);
    if (!rid) return;
    this.socket.emit("mp_fire", { roomId: rid, p, q });
  }

  reportHit(targetId, bulletId = null, roomId = null) {
    if (!this.socket || !this.inRoom) return;
    const rid = (roomId || this.roomId);
    if (!rid) return;
    this.socket.emit("mp_hit", { roomId: rid, targetId, bulletId });
  }

  claimRing(ringIndex, roomId = null) {
    if (!this.socket || !this.inRoom) return;
    const rid = (roomId || this.roomId);
    if (!rid) return;
    this.socket.emit("mp_claim_ring", { roomId: rid, ringIndex });
  }

  attachState(mpState) {
    this.mpState = mpState;
  }
}

window.MPClient = MPClient;