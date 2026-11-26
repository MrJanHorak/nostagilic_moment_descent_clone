/** Server-side lag compensation. A pilot aims at what their screen shows: other
 * ships and robots as they were about one round trip plus the interpolation delay
 * ago. The server keeps a short history of where every pilot and robot was, and
 * checks each pilot's shots against targets rewound by that pilot's delay.
 *
 * The rewind is capped (MAX_REWIND_MS): a pilot with a worse connection gets no
 * extra help, and a client cannot claim a huge ping to shoot into the past. Walls,
 * explosions and enemy fire are never rewound. */
import { Box3 } from 'three';
import { INTERPOLATION_DELAY_MS } from './ClientPrediction.js';

/** The most a shot is ever rewound. */
export const MAX_REWIND_MS = 250;
/** History kept, a little more than the cap. */
const HISTORY_MS = MAX_REWIND_MS + 100;
/** The highest round trip a client may report. */
export const MAX_REPORTED_RTT_MS = 400;

/** How far to rewind a pilot's shots for a reported round trip.
 * @param {number | null | undefined} rttMs @returns {number} */
export function rewindFor(rttMs) {
  if (!Number.isFinite(rttMs) || /** @type {number} */ (rttMs) < 0) return 0;
  return Math.min(MAX_REWIND_MS, Math.min(MAX_REPORTED_RTT_MS, /** @type {number} */ (rttMs)) + INTERPOLATION_DELAY_MS);
}

/** @typedef {import('three').Vector3} Vector3 */
/** @typedef {{timeMs: number, pilots: Map<string, Vector3>, enemies: Map<object, Box3>}} Frame */

export default class LagHistory {
  constructor() {
    /** @type {Frame[]} */
    this.frames = [];
  }

  clear() { this.frames.length = 0; }

  /** Record where everything is after a simulation step.
   * @param {number} timeMs
   * @param {Iterable<{id: string, alive: boolean, ship?: {group: {position: Vector3}} | null}>} pilots
   * @param {Iterable<{isActive: boolean, collider: Box3}>} enemies */
  record(timeMs, pilots, enemies) {
    const last = this.frames.at(-1);
    // A new session restarts the clock: drop the old timeline.
    if (last && timeMs < last.timeMs) this.clear();
    /** @type {Frame} */ const frame = { timeMs, pilots: new Map(), enemies: new Map() };
    for (const pilot of pilots) if (pilot.alive && pilot.ship) frame.pilots.set(pilot.id, pilot.ship.group.position.clone());
    for (const enemy of enemies) if (enemy.isActive && enemy.collider) frame.enemies.set(enemy, enemy.collider.clone());
    this.frames.push(frame);
    while (this.frames.length > 2 && /** @type {Frame} */ (this.frames[0]).timeMs < timeMs - HISTORY_MS) this.frames.shift();
  }

  /** The two frames around a time, and how far between them.
   * @param {number} timeMs @returns {{a: Frame, b: Frame, t: number} | null} */
  bracket(timeMs) {
    const frames = this.frames, first = frames[0], last = frames.at(-1);
    if (!first || !last) return null;
    if (timeMs >= last.timeMs) return { a: last, b: last, t: 0 };
    if (timeMs <= first.timeMs) return { a: first, b: first, t: 0 };
    let i = frames.length - 1;
    while (i > 1 && /** @type {Frame} */ (frames[i - 1]).timeMs > timeMs) i--;
    const a = /** @type {Frame} */ (frames[i - 1]), b = /** @type {Frame} */ (frames[i]);
    return { a, b, t: (timeMs - a.timeMs) / Math.max(1e-6, b.timeMs - a.timeMs) };
  }

  /** Positions at a past time, for one shot's trace. Targets missing from the history
   * (just spawned or respawned) fall back to where they are now.
   * @param {number} timeMs */
  view(timeMs) {
    const span = this.bracket(timeMs);
    if (!span) return null;
    const { a, b, t } = span;
    return {
      /** @param {object} enemy @returns {Box3 | null} */
      enemyBox(enemy) {
        const from = a.enemies.get(enemy), to = b.enemies.get(enemy);
        if (!from || !to) return null;
        return new Box3(from.min.clone().lerp(to.min, t), from.max.clone().lerp(to.max, t));
      },
      /** @param {string} id @returns {Vector3 | null} */
      pilotPosition(id) {
        const from = a.pilots.get(id), to = b.pilots.get(id);
        if (!from || !to) return null;
        // A respawn teleports the ship: never interpolate across it.
        if (from.distanceToSquared(to) > 100) return to.clone();
        return from.clone().lerp(to, t);
      },
    };
  }
}
