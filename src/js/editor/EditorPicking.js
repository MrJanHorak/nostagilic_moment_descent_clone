import { GRID, WALL_THICKNESS, PLAYER_RADIUS, DEVICE_RADIUS, AUTHORED_PICKUPS, EXIT_MARKER_MARGIN, enemyClearance } from '../core/levels/document/LevelContent.js';
import { rotate } from '../core/levels/document/RoomMath.js';

export const FACE_LABELS = Object.freeze({ negativeX: 'Left wall', positiveX: 'Right wall', negativeY: 'Floor', positiveY: 'Ceiling', negativeZ: 'Forward wall', positiveZ: 'Rear wall' });
/** @typedef {'spawn' | 'exit' | 'enemy' | 'health' | 'pulseAmmo' | 'relay'} PlacementKind */
/** @typedef {{roomId: string, face?: import('../levelDocument.js').Face, contentId?: string, localPoint: number[], clientX: number, clientY: number}} ViewportTarget */

/** @param {import('../levelDocument.js').RoomDocument} room @param {number[]} world
 * @returns {[number, number, number]} */
export function toLocal(room, world) {
  return rotate(/** @type {[number, number, number]} */ (world.map((value, axis) => value - room.position[axis])), (360 - room.yaw) % 360);
}

/** Place just inside the clicked surface. The marker and committed operation
 * use this same grid/body clearance calculation; no invisible coordinate guess.
 * @param {import('../levelDocument.js').RoomDocument} room @param {number[]} point
 * @param {PlacementKind} kind @param {import('../contracts.js').EnemyType} [enemyType] @param {number} [exitRadius]
 * @returns {[number, number, number]} */
export function placementPosition(room, point, kind, enemyType = 'scout', exitRadius = 1.5) {
  if (point.length !== 3 || !point.every(Number.isFinite)) throw new Error('Choose a finite point inside the room.');
  const radius = kind === 'spawn' ? PLAYER_RADIUS : kind === 'exit' ? exitRadius + EXIT_MARKER_MARGIN : kind === 'enemy' ? enemyClearance(enemyType) : kind === 'relay' ? DEVICE_RADIUS : AUTHORED_PICKUPS[kind].size;
  const half = room.size.map(size => Math.floor((size / 2 - WALL_THICKNESS - radius) / GRID) * GRID);
  if (half.some(value => value < 0)) throw new Error('This item is too large for the selected room.');
  return /** @type {[number, number, number]} */ (point.map((value, axis) => Math.max(-half[axis], Math.min(half[axis], Math.round(value / GRID) * GRID))));
}
