import { WALL_THICKNESS } from './LevelContent.js';

/** @param {import('../../../levelDocument.js').Vec3} value @param {number} yaw
 * @returns {[number, number, number]} */
export function rotate(value, yaw) {
  const [x, y, z] = value;
  switch (yaw) {
    case 90: return [z, y, -x];
    case 180: return [-x, y, -z];
    case 270: return [-z, y, x];
    default: return [x, y, z];
  }
}

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {import('../../../levelDocument.js').Vec3} local
 * @returns {[number, number, number]} */
export function toWorld(room, local) {
  const rotated = rotate(local, room.yaw);
  return [rotated[0] + room.position[0], rotated[1] + room.position[1], rotated[2] + room.position[2]];
}

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @returns {[number, number, number]} */
export function worldSize(room) { const size = rotate(room.size, room.yaw); return [Math.abs(size[0]), Math.abs(size[1]), Math.abs(size[2])]; }

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {import('../../../levelDocument.js').Face} face */
export function portFrame(room, face) {
  const localAxis = face.endsWith('X') ? 0 : face.endsWith('Y') ? 1 : 2;
  const sign = face.startsWith('positive') ? 1 : -1;
  /** @type {[number, number, number]} */
  const localNormal = [0, 0, 0]; localNormal[localAxis] = sign;
  const normal = rotate(localNormal, room.yaw);
  const axis = normal.findIndex(value => value !== 0);
  const direction = normal[axis];
  const size = worldSize(room);
  /** @type {[number, number, number]} */
  const center = [...room.position]; center[axis] += direction * size[axis] / 2;
  // Openings use a canonical world-plane basis, including horizontal hatches.
  const u = axis === 0 ? 2 : 0, v = axis === 1 ? 2 : 1;
  return { center, normal, axis, direction, u, v, width: size[u], height: size[v] };
}

/** Offsets use the same canonical world-plane basis on both sides of a port.
 * @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {import('../../../levelDocument.js').PortReference} endpoint */
export function openingFrame(room, endpoint) {
  const frame = portFrame(room, endpoint.port), offset = endpoint.offset ?? [0, 0];
  frame.center[frame.u] += offset[0]; frame.center[frame.v] += offset[1];
  return frame;
}

/** @param {import('../../../levelDocument.js').RoomDocument} a @param {import('../../../levelDocument.js').RoomDocument} b */
export function roomsOverlap(a, b) {
  const sizeA = worldSize(a), sizeB = worldSize(b);
  return sizeA.every((dimension, axis) => Math.abs(a.position[axis] - b.position[axis]) < (dimension + sizeB[axis]) / 2 - 1e-6);
}

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {import('../../../levelDocument.js').Vec3} local @param {number} radius */
export function fitsInside(room, local, radius) {
  return local.every((value, axis) => Math.abs(value) + radius <= room.size[axis] / 2 - WALL_THICKNESS + 1e-6);
}

/** @param {import('../../../levelDocument.js').Vec3} a @param {import('../../../levelDocument.js').Vec3} b */
export function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
