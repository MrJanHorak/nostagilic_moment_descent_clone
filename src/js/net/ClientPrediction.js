/** Online play, client side: the pieces that make a networked ship feel local.
 * Nothing here touches sockets or the DOM, so it runs (and is tested) in Node.
 *
 * - InputHistory: the inputs sent but not yet acknowledged by the server.
 * - reconcileShip: put the ship where the server says it was, replay the
 *   unacknowledged inputs, and ease the result into place.
 * - ServerClock: an estimate of the server's match time on this machine.
 * - SnapshotInterpolator: other ships, drawn a little in the past and blended
 *   between snapshots so they move smoothly at 20 snapshots a second. */
import * as THREE from 'three';
import { MAX_LOOK_PER_INPUT } from './Protocol.js';
import { moveSphere } from '../utils/sphereMovement.js';

/** Other ships are drawn this far behind the newest server time (two snapshot gaps). */
export const INTERPOLATION_DELAY_MS = 100;
/** With no newer snapshot, other ships coast on their velocity for at most this long. */
export const MAX_EXTRAPOLATION_MS = 150;
/** A reconciled position further than this away is a jump (respawn, big lag): snap to it. */
export const SNAP_DISTANCE = 3;
/** Small position errors close by this fraction per snapshot, so corrections never jerk. */
export const POSITION_BLEND = 0.35;
/** Orientation errors below this (radians) are left alone: the client owns its aim. */
export const AIM_TOLERANCE = 0.03;
export const AIM_SNAP = 0.6;
export const AIM_BLEND = 0.2;
/** Unacknowledged inputs kept; beyond this the connection is hopeless and older ones are dropped. */
export const MAX_PENDING = 240;

/** @typedef {import('../contracts.js').FlightInput} FlightInput */
/** @typedef {{seq: number, input: FlightInput, look: [number, number], dt: number}} SentInput */
/** @typedef {{p: number[], q: number[], v: number[]}} ShipState */

/** Clamp a mouse turn to what the server accepts for one input. @param {number} value */
export const clampLook = value => Math.max(-MAX_LOOK_PER_INPUT, Math.min(MAX_LOOK_PER_INPUT, Number.isFinite(value) ? value : 0));

export class InputHistory {
  constructor() {
    /** @type {SentInput[]} */
    this.pending = [];
    this.nextSeq = 1; this.acked = 0;
  }

  /** Record one client step's input and return it numbered for sending.
   * @param {FlightInput} input @param {[number, number]} look @param {number} dt @returns {SentInput} */
  push(input, look, dt) {
    const entry = { seq: this.nextSeq++, input: { ...input }, look: /** @type {[number, number]} */ ([clampLook(look[0]), clampLook(look[1])]), dt };
    this.pending.push(entry);
    if (this.pending.length > MAX_PENDING) this.pending.splice(0, this.pending.length - MAX_PENDING);
    return entry;
  }

  /** Drop everything the server has applied. @param {number} ack */
  acknowledge(ack) {
    if (ack > this.acked) this.acked = ack;
    let drop = 0;
    while (drop < this.pending.length && this.pending[drop].seq <= this.acked) drop++;
    if (drop) this.pending.splice(0, drop);
    return this.pending;
  }

  clear() { this.pending.length = 0; }
}

const scratchShip = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), velocity: new THREE.Vector3() };

/** Server-reconcile the local ship.
 * Starts from the server's state at the last acknowledged input, replays every input
 * the server has not applied yet with the same flight model, and moves the live ship
 * toward that result: a jump snaps, a small error is blended out over a few snapshots,
 * and aim the server agrees with (within AIM_TOLERANCE) is left alone.
 * @param {import('../entities/Spaceship.js').default} ship the live local ship
 * @param {ShipState} server
 * @param {readonly SentInput[]} pending inputs after the acknowledged one
 * @param {{colliders?: any[] | null, speedMultiplier?: number, unsentLook?: readonly number[] | null}} [world]
 *   `unsentLook` is mouse turn already applied here but not yet sent; it is re-applied after the replay.
 * @returns {{error: number, aimError: number, snapped: boolean}} */
export function reconcileShip(ship, server, pending, { colliders = null, speedMultiplier = 1, unsentLook = null } = {}) {
  const group = ship.group;
  // Remember the live pose, then replay from the server's on the same ship object.
  const live = scratchShip;
  live.position.copy(group.position); live.quaternion.copy(group.quaternion); live.velocity.copy(ship.velocity);
  group.position.fromArray(server.p); group.quaternion.fromArray(server.q).normalize(); ship.velocity.fromArray(server.v);
  for (const step of pending) {
    ship.rotate(step.look[0], step.look[1]);
    ship.update(step.dt, step.input, speedMultiplier);
    if (colliders) moveSphere(group.position, ship.velocity, step.dt, colliders, ship.radius);
    else group.position.addScaledVector(ship.velocity, step.dt);
  }
  if (unsentLook && (unsentLook[0] || unsentLook[1])) ship.rotate(unsentLook[0], unsentLook[1]);
  const error = live.position.distanceTo(group.position);
  const aimError = live.quaternion.angleTo(group.quaternion);
  const snapped = error > SNAP_DISTANCE;
  if (!snapped) group.position.copy(live.position.lerp(group.position, POSITION_BLEND));
  // The replayed velocity is the better guess either way; it is not visible on its own.
  if (aimError > AIM_SNAP) { /* keep the replayed orientation */ } else if (aimError > AIM_TOLERANCE) group.quaternion.copy(live.quaternion.slerp(group.quaternion, AIM_BLEND));
  else group.quaternion.copy(live.quaternion);
  return { error, aimError, snapped };
}

/** An estimate of the server's match time here: the local clock plus a smoothed
 * offset taken from every snapshot's timeMs. A big backwards jump (a rematch
 * restarts the match clock) resets it. */
export class ServerClock {
  constructor() { /** @type {number | null} */ this.offset = null; this.lastServerTime = -Infinity; }
  /** @param {number} serverTimeMs @param {number} localNow */
  sample(serverTimeMs, localNow) {
    const offset = serverTimeMs - localNow;
    if (this.offset === null || serverTimeMs < this.lastServerTime - 1000) this.offset = offset;
    // Late snapshots pull gently; an early one (less delay than thought) is believed faster.
    else this.offset += (offset - this.offset) * (offset > this.offset ? 0.25 : 0.05);
    this.lastServerTime = serverTimeMs;
  }
  /** @param {number} localNow */
  now(localNow) { return this.offset === null ? 0 : localNow + this.offset; }
  reset() { this.offset = null; this.lastServerTime = -Infinity; }
}

/** @typedef {{t: number, p: THREE.Vector3, q: THREE.Quaternion, v: THREE.Vector3, alive: boolean}} PoseSample */

/** Buffered poses of the other ships, sampled INTERPOLATION_DELAY_MS in the past. */
export class SnapshotInterpolator {
  constructor(delayMs = INTERPOLATION_DELAY_MS) { this.delayMs = delayMs; /** @type {Map<string, PoseSample[]>} */ this.tracks = new Map(); }

  /** @param {string} id @param {number} serverTimeMs @param {{p: number[], q: number[], v: number[], alive: boolean}} state */
  push(id, serverTimeMs, state) {
    let track = this.tracks.get(id);
    if (!track) { track = []; this.tracks.set(id, track); }
    const last = track.at(-1);
    if (last && serverTimeMs <= last.t) { if (serverTimeMs < last.t - 1000) track.length = 0; else return; }
    track.push({ t: serverTimeMs, p: new THREE.Vector3().fromArray(state.p), q: new THREE.Quaternion().fromArray(state.q).normalize(),
      v: new THREE.Vector3().fromArray(state.v), alive: state.alive });
    if (track.length > 32) track.splice(0, track.length - 32);
  }

  /** @param {string} id */
  forget(id) { this.tracks.delete(id); }
  clear() { this.tracks.clear(); }

  /** Pose of one ship at `serverNow - delay`, blended between the two snapshots around
   * it. A respawn (dead then alive, or a long jump) is never blended across.
   * @param {string} id @param {number} serverNow
   * @param {{position: THREE.Vector3, quaternion: THREE.Quaternion}} out
   * @returns {{alive: boolean} | null} */
  sample(id, serverNow, out) {
    const track = this.tracks.get(id);
    if (!track?.length) return null;
    const t = serverNow - this.delayMs;
    let index = track.length - 1;
    while (index > 0 && track[index].t > t) index--;
    const a = track[index], b = track[index + 1];
    if (t <= a.t || !b) {
      out.position.copy(a.p); out.quaternion.copy(a.q);
      // Past the newest snapshot: coast briefly on the last known velocity.
      if (!b && a.alive && t > a.t) out.position.addScaledVector(a.v, Math.min(t - a.t, MAX_EXTRAPOLATION_MS) / 1000);
      // Drop history nobody will sample again.
      if (index > 1) track.splice(0, index - 1);
      return { alive: a.alive };
    }
    if (a.alive !== b.alive || a.p.distanceToSquared(b.p) > SNAP_DISTANCE * SNAP_DISTANCE * 4) {
      out.position.copy(b.p); out.quaternion.copy(b.q); return { alive: b.alive };
    }
    const k = (t - a.t) / (b.t - a.t);
    out.position.copy(a.p).lerp(b.p, k); out.quaternion.copy(a.q).slerp(b.q, k);
    if (index > 1) track.splice(0, index - 1);
    return { alive: a.alive };
  }
}
