/** Online play: the message format shared by the game server and the browser client.
 * Every message is one JSON text frame with a `t` (type) field. */

export const PROTOCOL_VERSION = 1;
/** Simulation steps per second on the server (the same fixed step as the client). */
export const TICK_RATE = 60;
/** A snapshot goes out every N steps: 60 / 3 = 20 per second. */
export const SNAPSHOT_EVERY = 3;
/** The fastest any pilot may fire, whatever their client sends. */
export const MIN_FIRE_INTERVAL_MS = 100;
/** The most a single input may turn the ship (radians per axis), against cheats and jumps. */
export const MAX_LOOK_PER_INPUT = 0.6;
export const MAX_PLAYERS = 8;
/** Co-op rooms are smaller: missions are built for up to four pilots. */
export const MAX_COOP_PLAYERS = 4;
export const ROOM_MODES = /** @type {const} */ (['anarchy', 'coop']);
export const MAX_MESSAGE_BYTES = 4096;
export const NAME_LIMIT = 16;
/** Room codes avoid letters that read alike (I/L/O, 0/1). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

import { cleanSignal } from '../core/TeamSignals.js';

const FLIGHT_KEYS = /** @type {const} */ (['left', 'right', 'up', 'down', 'forward', 'backward', 'yawLeft', 'yawRight', 'pitchUp', 'pitchDown', 'rollLeft', 'rollRight']);
const WEAPONS = new Set(['pulse', 'laser', 'missile', 'plasma']);

/** @param {() => number} random @returns {string} */
export function makeRoomCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  return code;
}

/** @param {unknown} value */
export function isRoomCode(value) {
  return typeof value === 'string' && value.length === ROOM_CODE_LENGTH && [...value].every(letter => ROOM_CODE_ALPHABET.includes(letter));
}

/** Letters, digits, spaces, - and _, trimmed to the limit; empty becomes "Pilot".
 * @param {unknown} value */
export function cleanName(value) {
  const name = typeof value === 'string' ? value.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, NAME_LIMIT) : '';
  return name || 'Pilot';
}

/** @param {unknown} value */
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** @typedef {{t: 'hello', protocol: number, name: string, room: string | null, mode: 'anarchy' | 'coop', map: string | null, lobby?: true}} HelloMessage */
/** @typedef {{t: 'input', seq: number, input: import('../contracts.js').FlightInput, look: [number, number], fire: boolean, weapon: string | null, interact: boolean, rtt?: number}} InputMessage */
/** @typedef {{t: 'ping', time: number}} PingMessage */
/** @typedef {{t: 'signal', signal: import('../core/TeamSignals.js').TeamSignal}} SignalMessage */
/** @typedef {HelloMessage | InputMessage | PingMessage | SignalMessage | {t: 'start'}} ClientMessage */

/** Parse and clean one client frame. Unknown fields are dropped and amounts clamped,
 * so the server never trusts a client's numbers.
 * @param {string} text @returns {{ok: true, message: ClientMessage} | {ok: false, error: string}} */
export function parseClientMessage(text) {
  if (typeof text !== 'string' || text.length > MAX_MESSAGE_BYTES) return { ok: false, error: 'too-large' };
  /** @type {any} */ let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'bad-json' }; }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'bad-message' };
  if (raw.t === 'hello') {
    if (raw.protocol !== PROTOCOL_VERSION) return { ok: false, error: 'protocol-mismatch' };
    const room = raw.room == null || raw.room === '' ? null : String(raw.room).toUpperCase();
    if (room !== null && !isRoomCode(room)) return { ok: false, error: 'bad-room-code' };
    // Creating a room may choose the mode and map; joining takes the room's.
    const mode = raw.mode === 'coop' ? 'coop' : 'anarchy';
    const map = typeof raw.map === 'string' && /^[a-z0-9-]{1,48}$/.test(raw.map) ? raw.map : null;
    return { ok: true, message: { t: 'hello', protocol: PROTOCOL_VERSION, name: cleanName(raw.name), room, mode, map, ...(raw.lobby === true ? { lobby: true } : {}) } };
  }
  if (raw.t === 'start') return { ok: true, message: { t: 'start' } };
  if (raw.t === 'input') {
    if (!Number.isSafeInteger(raw.seq) || raw.seq < 0) return { ok: false, error: 'bad-seq' };
    /** @type {Record<string, boolean | number>} */ const input = {};
    for (const key of FLIGHT_KEYS) {
      const value = raw.input?.[key];
      if (value === true) input[key] = true;
      else if (finite(value) && value > 0) input[key] = Math.min(1, value);
    }
    const clampLook = /** @param {unknown} value */ value => finite(value) ? Math.max(-MAX_LOOK_PER_INPUT, Math.min(MAX_LOOK_PER_INPUT, /** @type {number} */ (value))) : 0;
    const look = Array.isArray(raw.look) ? raw.look : [];
    return { ok: true, message: { t: 'input', seq: raw.seq, input, look: [clampLook(look[0]), clampLook(look[1])], fire: raw.fire === true,
      weapon: WEAPONS.has(raw.weapon) ? raw.weapon : null, interact: raw.interact === true,
      // The client's measured round trip, for lag compensation (clamped again by the server).
      ...(finite(raw.rtt) && raw.rtt >= 0 ? { rtt: Math.min(1000, Math.round(raw.rtt)) } : {}) } };
  }
  if (raw.t === 'signal') {
    const signal = cleanSignal(raw);
    return signal ? { ok: true, message: { t: 'signal', signal } } : { ok: false, error: 'bad-signal' };
  }
  if (raw.t === 'ping') return { ok: true, message: { t: 'ping', time: finite(raw.time) ? raw.time : 0 } };
  return { ok: false, error: 'unknown-type' };
}

/** Rounds a vector for the wire (millimetres are plenty). @param {{x: number, y: number, z: number}} v */
export const packVector = v => [Math.round(v.x * 1000) / 1000, Math.round(v.y * 1000) / 1000, Math.round(v.z * 1000) / 1000];
/** @param {{x: number, y: number, z: number, w: number}} q */
export const packQuaternion = q => [q.x, q.y, q.z, q.w].map(value => Math.round(value * 10000) / 10000);
