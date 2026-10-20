import { solidContact } from '../utils/sphereMovement.js';

/** @typedef {{kind: 'lava' | 'water', collider: import('../contracts.js').SolidCollider,
 * material: import('three').MeshStandardMaterial}} EnvironmentSurface */

export const LAVA_DAMAGE = 6;
export const LAVA_INTERVAL_MS = 500;

/** Per-world surface animation and contact damage. Mesh/material ownership stays
 * with the arena. A new attempt constructs a new controller, with no callbacks.
 */
export default class SurfaceEnvironment {
  /** @param {readonly EnvironmentSurface[]} surfaces */
  constructor(surfaces) {
    this.surfaces = surfaces;
    this.nextDamageAt = 0;
    /** @type {'lava' | 'water' | null} */ this.contact = null;
  }

  /** @param {import('./GameSession.js').default} session
   * @param {import('three').Vector3} position @param {number} radius
   * @returns {{damage: number, entered: 'lava' | 'water' | null}} */
  update(session, position, radius) {
    if (session.phase !== 'playing') return { damage: 0, entered: null };
    const now = session.timeMs;
    // Shared textures advance once per update; split panels must not accelerate
    // the animation. Derive everything from simulation time so pause is exact.
    const textures = new Set();
    for (const { material, kind } of this.surfaces) {
      if (material.map && !textures.has(material.map)) {
        textures.add(material.map);
        material.map.offset.set((now * (kind === 'lava' ? 0.000012 : 0.000035)) % 1, (now * 0.000018) % 1);
      }
      material.emissiveIntensity = kind === 'lava' ? 1.15 + Math.sin(now / 900) * 0.12 : 0.3;
    }
    const contacts = this.surfaces.filter(surface => solidContact(position, radius + 0.02, surface.collider));
    const contact = contacts.some(surface => surface.kind === 'lava') ? 'lava' : contacts.length ? 'water' : null;
    const entered = contact !== this.contact ? contact : null; this.contact = contact;
    // One global cadence per attempt prevents stacked damage on panel seams or
    // rapid re-entry. Long frames never replay a backlog of damage pulses.
    const damage = contact === 'lava' && now >= this.nextDamageAt ? LAVA_DAMAGE : 0;
    if (damage) this.nextDamageAt = now + LAVA_INTERVAL_MS;
    return { damage, entered };
  }
}
