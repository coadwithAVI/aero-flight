// ==========================================
// PATH: multiplayer/mp-protocol.js
// ==========================================

/**
 * MPProtocol
 * Standardizes Multiplayer network packet format.
 *
 * Current Version: JSON packets
 * (Later you can replace encode/decode with binary, and nothing else needs to change)
 *
 * Packet Format (Recommended):
 * {
 *   t: "TYPE",        // message type
 *   ...payload
 * }
 */

const MP_PROTOCOL = {
    VERSION: 1,

    // Client -> Server
    C2S: {
        HELLO: "HELLO",
        JOIN: "JOIN",
        LEAVE: "LEAVE",
        INPUT: "INPUT",
        CHAT: "CHAT",
        PING: "PING"
    },

    // Server -> Client
    S2C: {
        WELCOME: "WELCOME",
        ROOM_JOINED: "ROOM_JOINED",
        STATE: "STATE",
        EVENT: "EVENT",
        CHAT: "CHAT",
        KICK: "KICK",
        PONG: "PONG"
    }
};

class MPProtocol {
    /**
     * Encode outgoing packet
     * @param {Object} msg - packet object
     * @returns {String|ArrayBuffer}
     */
    encode(msg) {
        // Safe JSON encoding
        return JSON.stringify(msg);
    }

    /**
     * Decode incoming packet
     * @param {String|ArrayBuffer} data
     * @returns {Object|null}
     */
    decode(data) {
        try {
            if (typeof data === "string") return JSON.parse(data);

            if (data instanceof ArrayBuffer) {
                const text = new TextDecoder().decode(new Uint8Array(data));
                return JSON.parse(text);
            }

            // Some browsers may send Blob
            if (data instanceof Blob) {
                // Blob decode not synchronous
                console.warn("[MPProtocol] Blob received - convert on client side if needed");
                return null;
            }

            return null;
        } catch (err) {
            console.warn("[MPProtocol] decode failed:", err);
            return null;
        }
    }

    /**
     * Helper: Validate packet has correct format
     */
    isValidPacket(msg) {
        return !!(msg && typeof msg === "object" && typeof msg.t === "string");
    }

    /**
     * Helper: Create packet builder
     */
    packet(type, payload = {}) {
        return { t: type, ...payload };
    }
}

// Globals
window.MP_PROTOCOL = MP_PROTOCOL;
window.MPProtocol = MPProtocol;
