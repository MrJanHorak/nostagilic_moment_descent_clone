import { GRID, WALL_THICKNESS, PLAYER_RADIUS, DEVICE_RADIUS, AUTHORED_PICKUPS, EXIT_MARKER_MARGIN, enemyClearance } from '../core/levels/document/LevelContent.js';
import { clearanceScale, portFrame } from '../core/levels/document/RoomMath.js';
import { Euler, Quaternion } from 'three';
export { toLocal } from '../core/levels/document/RoomMath.js';

export const FACE_LABELS = Object.freeze({ negativeX: 'Left wall', positiveX: 'Right wall', negativeY: 'Floor', positiveY: 'Ceiling', negativeZ: 'Forward wall', positiveZ: 'Rear wall' });
/** @typedef {'spawn' | 'exit' | 'enemy' | 'health' | 'pulseAmmo' | 'relay' | 'reactor'} PlacementKind */
/** @typedef {{roomId: string, face?: import('../levelDocument.js').Face, contentId?: string, connectionId?: string, localPoint: number[], clientX: number, clientY: number}} ViewportTarget */

/** Labels describe the world-facing surface even in a pitched/rolled room.
 * @param {import('../levelDocument.js').RoomDocument} room @param {import('../levelDocument.js').Face} face */
export function faceLabel(room, face) {
  const frame = portFrame(room, face);
  const worldFace = /** @type {import('../levelDocument.js').Face} */ (`${frame.direction < 0 ? 'negative' : 'positive'}${'XYZ'[frame.axis]}`);
  return `${room.endOffset && !face.endsWith('Z') && room.endOffset[face.endsWith('X') ? 0 : 1] ? 'Sloped ' : ''}${FACE_LABELS[worldFace]}`;
}

/** Euler extraction is ambiguous at 90° pitch. Match the snapped quaternion
 * against the finite orientations, preferring the author's existing angles.
 * @param {Quaternion} rotation @param {import('../levelDocument.js').RoomDocument} [previous] */
export function snappedAngles(rotation, previous) {
  let best = { yaw: 0, pitch: 0, roll: 0 }, bestDot = -1, bestCost = Infinity;
  for (const yaw of [0, 90, 180, 270]) for (const pitch of [0, 90, 180, 270]) for (const roll of [0, 90, 180, 270]) {
    const quaternion = new Quaternion().setFromEuler(new Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180, 'YXZ'));
    const dot = Math.abs(rotation.dot(quaternion));
    const cost = [yaw - (previous?.yaw ?? 0), pitch - (previous?.pitch ?? 0), roll - (previous?.roll ?? 0)].reduce((sum, delta) => sum + Math.min(Math.abs(delta), 360 - Math.abs(delta)), 0);
    if (dot > bestDot + 1e-8 || (Math.abs(dot - bestDot) <= 1e-8 && cost < bestCost)) {
      best = { yaw, pitch, roll }; bestDot = dot; bestCost = cost;
    }
  }
  return best;
}

/** Place just inside the clicked surface. The marker and committed operation
 * use this same grid/body clearance calculation; no invisible coordinate guess.
 * @param {import('../levelDocument.js').RoomDocument} room @param {number[]} point
 * @param {PlacementKind} kind @param {import('../contracts.js').EnemyType} [enemyType] @param {number} [exitRadius]
 * @returns {[number, number, number]} */
export function placementPosition(room, point, kind, enemyType = 'scout', exitRadius = 1.5) {
  if (point.length !== 3 || !point.every(Number.isFinite)) throw new Error('Choose a finite point inside the room.');
  const radius = kind === 'spawn' ? PLAYER_RADIUS : kind === 'exit' ? exitRadius + EXIT_MARKER_MARGIN : kind === 'enemy' ? enemyClearance(enemyType) : kind === 'reactor' ? 1.5 : kind === 'relay' ? DEVICE_RADIUS : AUTHORED_PICKUPS[kind].size;
  const scales = clearanceScale(room);
  const half = room.size.map((size, axis) => Math.floor((size / 2 - WALL_THICKNESS - radius * scales[axis]) / GRID) * GRID);
  if (half.some(value => value < 0)) throw new Error('This item is too large for the selected room.');
  return /** @type {[number, number, number]} */ (point.map((value, axis) => Math.max(-half[axis], Math.min(half[axis], Math.round(value / GRID) * GRID))));
}
