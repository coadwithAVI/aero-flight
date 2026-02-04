// ==========================================
// PATH: config/config.multiplayer.js
// ==========================================

/**
 * Multiplayer Config (FINAL)
 * Central place to tune Multiplayer gameplay without rewriting logic.
 */

window.MP_CONFIG = {
  // ==========================================================
  // SERVER / NET
  // ==========================================================
  TICK_RATE: 20,                 // server updates per second (minecraft style)
  SNAPSHOT_BUFFER_MS: 120,       // interpolation delay for smooth remote movement
  TRANSFORM_SEND_RATE: 20,       // client -> server transform per second

  // Lobby
  ROOM_CODE_LEN: 4,              // 4-char code (A-Z 0-9 mix)
  MAX_PLAYERS: 8,

  // ==========================================================
  // RACE
  // ==========================================================
  RINGS_PER_LAP: 4,
  LAPS_TO_WIN: 2,
  TOTAL_RINGS_TO_WIN: 8,         // auto computed: RINGS_PER_LAP * LAPS_TO_WIN (kept explicit for clarity)

  // Rings behavior
  RING_COUNT: 8,                 // should match TOTAL_RINGS_TO_WIN
  RING_CLEARANCE: 35,            // ring height above terrain
  RING_MIN_DIST: 600,            // spacing
  RING_MAX_DIST: 1600,

  // ==========================================================
  // COMBAT
  // ==========================================================
  BULLET_DAMAGE: 5,              // ✅ MP bullet damage fixed
  KILL_SCORE: 10,                // killing score server calculates
  RING_SCORE: 100,               // per ring pass score

  // server anti-spam / anti cheat
  HIT_COOLDOWN_MS: 120,          // prevent rapid fake hit spam
  MAX_HIT_DISTANCE: 2200,        // ignore mp_hit if too far (anti cheat)
  MAX_SHOT_VALID_MS: 600,        // shot -> hit report max time window

  // ==========================================================
  // RESPAWN
  // ==========================================================
  RESPAWN_DELAY: 3.0,            // seconds
  RESPAWN_HP: 100,               // respawn hp full
  RESPAWN_SAFE_RADIUS: 800,      // spawn circle radius
  RESPAWN_MIN_SEP: 250,          // minimum separation from other players

  // ==========================================================
  // AIM ASSIST (Strong MP Aim)
  // ==========================================================
  AIM_ASSIST_ENABLED: true,

  // cone based assist (bigger angle)
  AIM_ASSIST_CONE_RAD: 0.42,     // ~24 degrees cone (strong)
  AIM_ASSIST_STRENGTH: 0.92,     // 0..1 (very strong)

  // screen magnet assist (for max hits)
  SCREEN_AIM_ASSIST: true,
  SCREEN_AIM_RADIUS: 0.85,       // 0..1 (bigger = more lock)
  SCREEN_AIM_STRENGTH: 0.92,     // strong blend

  // ==========================================================
  // SMOOTHING (REMOTE PLAYERS)
  // ==========================================================
  REMOTE_POSITION_LERP: 0.20,
  REMOTE_ROTATION_SLERP: 0.24,

  // ==========================================================
  // DEBUG
  // ==========================================================
  DEBUG_LOG: false
};

// normalize computed values
window.MP_CONFIG.TOTAL_RINGS_TO_WIN =
  window.MP_CONFIG.RINGS_PER_LAP * window.MP_CONFIG.LAPS_TO_WIN;

window.MP_CONFIG.RING_COUNT = window.MP_CONFIG.TOTAL_RINGS_TO_WIN;
