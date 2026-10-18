import { enemyTypes } from '../../../entities/EnemyTypes.js';

export const PLAYER_RADIUS = 0.5;
export const WALL_THICKNESS = 0.5;
export const DEVICE_RADIUS = 0.75;
export const EXIT_MARKER_MARGIN = 0.6;
export const GRID = 0.5;
/** @type {readonly import('../../../levelDocument.js').SurfacePattern[]} */
export const SURFACE_PATTERNS = Object.freeze(['plain', 'grid', 'panels', 'hazard']);
export const LIMITS = Object.freeze({ rooms: 64, connections: 128, entities: 256, text: 1_000_000, errors: 100 });
/** @type {readonly import('../../../levelDocument.js').Face[]} */
export const FACES = Object.freeze(['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']);
export const MATERIALS = Object.freeze({
  'industrial-blue': Object.freeze({ wall: 0x405a6b, floor: 0x344457, ceiling: 0x465467 }),
  'industrial-red': Object.freeze({ wall: 0x71604b, floor: 0x51443c, ceiling: 0x796658 }),
  'industrial-green': Object.freeze({ wall: 0x476550, floor: 0x344d40, ceiling: 0x56745d }),
});
// Shared with actual pickup creation, not a second copy of its model metadata.
export const AUTHORED_PICKUPS = Object.freeze({
  health: Object.freeze({ name: 'health', size: 0.5, color: 0x00ff00 }),
  pulseAmmo: Object.freeze({ name: 'pulseAmmo', size: 0.5, color: 0xffa64d }),
});
/** Conservative authoring clearance, deliberately larger than the animated body.
 * @param {import('../../../contracts.js').EnemyType} type */
export function enemyClearance(type) {
  const definition = enemyTypes.find(enemy => enemy.name === type);
  if (!definition) throw new RangeError(`Unknown enemy type: ${type}`);
  return definition.size * 4;
}
