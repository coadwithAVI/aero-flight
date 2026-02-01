// ==========================================
// PATH: multiplayer/mp-protocol.js
// ==========================================

/**
 * MPProtocol (FINAL)
 *
 * Purpose:
 * - Standard message format for Multiplayer packets
 * - JSON encode/decode (safe)
 * - Versioning support
 * - Helpers for packet creation/validation
 *
 * Note:
 * - Your current multiplayer is Socket.IO events based (mp_state, mp_event etc.)
 * - This protocol file is still useful for future consistency and debugging
 * - You can optionally use it for chat/input packets as well.
 */

const MP_PROTOCOL = {
  VERSION: 1,

  // Generic packet types (t field)
  TYPE: {
    HELLO: "HELLO",
    WELCOME: "WELCOME",
    ROOM: "ROOM",
    LOBBY: "LOBBY",
    START: "START",
    STATE: "STATE",
    EVENT: "EVENT",
    SCORE: "SCORE",
    HIT: "HIT",
    GAME_OVER: "GAME_OVER",
    ERROR: "ERROR",
    PING: "PING",
    PONG: "PONG"
  },

  // Event types (when t:"EVENT")
  EVENT: {
    FIRE: "FIRE",
    EXPLOSION: "EXPLOSION",
    HIT: "HIT",
    KILL: "KILL",
    RESPAWN: "RESPAWN",
    PLAYER_LEFT: "PLAYER_LEFT",
    CLAIM_RING: "CLAIM_RING"
  }
};

class MPProtocol {
  constructor(options = {}) {
    this.version = options.version ?? MP_PROTOCOL.VERSION;
    this.debug = options.debug ?? false;
  }

  // ==========================================================
  // Encode / Decode
  // ==========================================================

  /**
   * Encode outgoing packet into string
   * @param {Object} msg
   * @returns {string}
   */
  encode(msg) {
    try {
      // Ensure object
      const safe = (msg && typeof msg === "object") ? msg : { t: "ERROR", msg: "Invalid packet" };

      // Add protocol version if missing
      if (safe.v == null) safe.v = this.version;

      return JSON.stringify(safe);
    } catch (e) {
      if (this.debug) console.warn("[MPProtocol] encode failed:", e);
      return JSON.stringify({ t: "ERROR", msg: "encode failed", v: this.version });
    }
  }

  /**
   * Decode incoming packet from string/ArrayBuffer/Blob
   * @param {string|ArrayBuffer|Blob} data
   * @returns {Object|null}
   */
  decode(data) {
    try {
      // string
      if (typeof data === "string") {
        return JSON.parse(data);
      }

      // ArrayBuffer
      if (data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(new Uint8Array(data));
        return JSON.parse(text);
      }

      // Blob
      if (typeof Blob !== "undefined" && data instanceof Blob) {
        // Blob decode is async, return null to avoid breaking sync pipeline
        if (this.debug) console.warn("[MPProtocol] Blob received, decode async not supported in sync decode()");
        return null;
      }

      return null;
    } catch (err) {
      if (this.debug) console.warn("[MPProtocol] decode failed:", err);
      return null;
    }
  }

  // ==========================================================
  // Validation
  // ==========================================================

  /**
   * Basic check: must have "t" as string
   */
  isValidPacket(msg) {
    return !!(msg && typeof msg === "object" && typeof msg.t === "string");
  }

  /**
   * Check protocol version compatibility (simple)
   */
  isCompatibleVersion(msg) {
    if (!msg || typeof msg !== "object") return false;
    if (msg.v == null) return true; // allow old packets without version
    return Number(msg.v) === Number(this.version);
  }

  // ==========================================================
  // Packet builder
  // ==========================================================

  packet(type, payload = {}) {
    return {
      v: this.version,
      t: type,
      ...payload
    };
  }

  // ==========================================================
  // Useful common packet creators
  // ==========================================================

  hello(name) {
    return this.packet(MP_PROTOCOL.TYPE.HELLO, { name });
  }

  ping(ts = performance.now()) {
    return this.packet(MP_PROTOCOL.TYPE.PING, { ts });
  }

  pong(ts) {
    return this.packet(MP_PROTOCOL.TYPE.PONG, { ts });
  }

  event(eventType, payload = {}) {
    return this.packet(MP_PROTOCOL.TYPE.EVENT, { type: eventType, ...payload });
  }

  hit(attackerId, victimId, damage, pos = null, bulletId = null) {
    return this.packet(MP_PROTOCOL.TYPE.HIT, {
      attackerId,
      victimId,
      damage,
      pos,
      bulletId
    });
  }
}

// Export globals
window.MP_PROTOCOL = MP_PROTOCOL;
window.MPProtocol = MPProtocol;
