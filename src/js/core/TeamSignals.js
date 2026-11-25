/** Team signals for co-op (and Anarchy taunts): fixed quick-chat phrases and map
 * pings. Phrases are a fixed list, so there is no free text to moderate. */
import * as THREE from 'three';
import { traceShot } from '../utils/combatTrace.js';

/** Quick-chat phrases, sent by number (1–8 on the keyboard). */
export const QUICK_CHAT = Object.freeze([
  'Follow me', 'Wait for me', 'Need repairs', 'Robot here!', 'Relay here', 'On my way', 'Heading to extraction', 'Thanks!',
]);
/** A ping marks a point for this long. */
export const MARK_LIFETIME_MS = 8000;
/** Pings reach at most this far along your aim. */
export const MARK_RANGE = 80;
/** The fastest one pilot may signal (quick-chat or ping). */
export const SIGNAL_INTERVAL_MS = 750;

/** @typedef {{kind: 'quick', phrase: number} | {kind: 'mark', p: [number, number, number]}} TeamSignal */

/** Clean a signal from the network or input; null when it is not one.
 * @param {any} raw @returns {TeamSignal | null} */
export function cleanSignal(raw) {
  if (raw?.kind === 'quick') return Number.isInteger(raw.phrase) && raw.phrase >= 0 && raw.phrase < QUICK_CHAT.length ? { kind: 'quick', phrase: raw.phrase } : null;
  if (raw?.kind === 'mark' && Array.isArray(raw.p) && raw.p.length === 3 && raw.p.every(/** @param {unknown} v */ v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5)) {
    return { kind: 'mark', p: /** @type {[number, number, number]} */ (raw.p.map(/** @param {number} v */ v => Math.round(v * 100) / 100)) };
  }
  return null;
}

/** Where a pilot is aiming: the first wall along their nose, or MARK_RANGE ahead.
 * @param {THREE.Vector3} origin @param {THREE.Quaternion} quaternion
 * @param {readonly import('../contracts.js').SolidCollider[]} colliders @returns {[number, number, number]} */
export function aimPoint(origin, quaternion, colliders) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
  const end = origin.clone().addScaledVector(forward, MARK_RANGE);
  const hit = traceShot(origin, end, { colliders });
  // Stop just short of the wall so the marker sits in the room, not inside the rock.
  const point = hit ? origin.clone().lerp(hit.point, Math.max(0, (hit.fraction * MARK_RANGE - 0.4) / (hit.fraction * MARK_RANGE || 1))) : end;
  return [point.x, point.y, point.z];
}

/** Per-sender rate limit. */
export class SignalLimiter {
  constructor(intervalMs = SIGNAL_INTERVAL_MS) { this.intervalMs = intervalMs; /** @type {Map<string, number>} */ this.last = new Map(); }
  /** @param {string} id @param {number} now */
  allow(id, now) {
    if (now - (this.last.get(id) ?? -Infinity) < this.intervalMs) return false;
    this.last.set(id, now);
    return true;
  }
}
