import { WALL_THICKNESS } from './LevelContent.js';
import { boxCorners } from '../../../utils/BoxTopology.js';

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

/** Exact signed permutations keep connected planes on the half-unit grid.
 * Order is local roll Z, pitch X, then world yaw Y (Three.js YXZ).
 * @param {import('../../../levelDocument.js').Vec3} value
 * @param {Pick<import('../../../levelDocument.js').RoomDocument, 'yaw' | 'pitch' | 'roll'>} room
 * @returns {[number, number, number]} */
export function orient(value, room) {
  let [x, y, z] = value;
  switch (room.roll ?? 0) {
    case 90: [x, y] = [-y, x]; break;
    case 180: [x, y] = [-x, -y]; break;
    case 270: [x, y] = [y, -x]; break;
  }
  switch (room.pitch ?? 0) {
    case 90: [y, z] = [-z, y]; break;
    case 180: [y, z] = [-y, -z]; break;
    case 270: [y, z] = [z, -y]; break;
  }
  return rotate([x, y, z], room.yaw);
}

/** Inverse room transform, shared by picking and authored coordinate tools.
 * @param {import('../../../levelDocument.js').RoomDocument} room @param {number[]} world
 * @returns {[number, number, number]} */
export function toLocal(room, world) {
  const delta = /** @type {[number, number, number]} */ (world.map((value, axis) => value - room.position[axis]));
  const local = inverseOrient(delta, room), [x, y] = room.endOffset ?? [0, 0];
  return [local[0] + x * local[2] / room.size[2], local[1] + y * local[2] / room.size[2], local[2]];
}

/** @param {import('../../../levelDocument.js').Vec3} delta @param {import('../../../levelDocument.js').RoomDocument} room
 * @returns {[number, number, number]} */
export function inverseOrient(delta, room) {
  // A quarter-turn orientation is orthonormal: inverse = transpose.
  const axes = /** @type {const} */ ([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  return /** @type {[number, number, number]} */ (axes.map(axis => orient(axis, room).reduce((sum, value, index) => sum + value * delta[index], 0)));
}

/** The far end is local -Z. Positive offset moves that end right/up.
 * @param {import('../../../levelDocument.js').RoomDocument} room @param {import('../../../levelDocument.js').Vec3} local
 * @returns {[number, number, number]} */
export function shear(room, local) {
  const [x, y] = room.endOffset ?? [0, 0];
  return [local[0] - x * local[2] / room.size[2], local[1] - y * local[2] / room.size[2], local[2]];
}

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {import('../../../levelDocument.js').Vec3} local
 * @returns {[number, number, number]} */
export function toWorld(room, local) {
  const rotated = orient(shear(room, local), room);
  return [rotated[0] + room.position[0], rotated[1] + room.position[1], rotated[2] + room.position[2]];
}

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @returns {[number, number, number]} */
export function worldSize(room) {
  const offset = room.endOffset ?? [0, 0];
  const size = orient([room.size[0] + Math.abs(offset[0]), room.size[1] + Math.abs(offset[1]), room.size[2]], room);
  return [Math.abs(size[0]), Math.abs(size[1]), Math.abs(size[2])];
}

/** @param {import('../../../levelDocument.js').RoomDocument} room */
export function roomVertices(room) { return boxCorners([0, 0, 0], room.size).map(point => toWorld(room, point)); }

/** Physical side-plane normal lengths before normalization. Body clearance
 * uses these factors because shear does not preserve perpendicular distance.
 * @param {import('../../../levelDocument.js').RoomDocument} room */
export function clearanceScale(room) { const [x, y] = room.endOffset ?? [0, 0]; return [Math.hypot(1, x / room.size[2]), Math.hypot(1, y / room.size[2]), 1]; }

/** @param {import('../../../levelDocument.js').RoomDocument} room @param {import('../../../levelDocument.js').Face} face */
export function connectableFace(room, face) { return room.prefab !== 'offset-corridor' || face.endsWith('Z'); }

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {import('../../../levelDocument.js').Face} face */
export function portFrame(room, face) {
  const localAxis = face.endsWith('X') ? 0 : face.endsWith('Y') ? 1 : 2;
  const sign = face.startsWith('positive') ? 1 : -1;
  /** @type {[number, number, number]} */
  const localNormal = [0, 0, 0]; localNormal[localAxis] = sign;
  const primary = orient(localNormal, room), axis = primary.findIndex(value => value !== 0), direction = primary[axis];
  const offset = room.endOffset ?? [0, 0];
  const slanted = [...localNormal];
  if (localAxis < 2) slanted[2] = sign * (localAxis === 0 ? offset[0] : offset[1]) / room.size[2];
  const length = Math.hypot(...slanted), normal = orient(/** @type {[number, number, number]} */ (slanted.map(value => value / length)), room);
  const size = orient(room.size, room).map(Math.abs);
  const center = toWorld(room, /** @type {[number, number, number]} */ (localNormal.map((value, index) => value * room.size[index] / 2)));
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
  if (!sizeA.every((dimension, axis) => Math.abs(a.position[axis] - b.position[axis]) < (dimension + sizeB[axis]) / 2 - 1e-6)) return false;
  if (!a.endOffset && !b.endOffset) return true;
  const verticesA = roomVertices(a), verticesB = roomVertices(b);
  /** @param {number[]} x @param {number[]} y */
  const cross = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  /** @param {number[][]} vertices */
  const edges = vertices => [1, 3, 4].map(index => vertices[index].map((value, axis) => value - vertices[0][axis]));
  const edgesA = edges(verticesA), edgesB = edges(verticesB);
  const axes = [cross(edgesA[0], edgesA[1]), cross(edgesA[1], edgesA[2]), cross(edgesA[2], edgesA[0]),
    cross(edgesB[0], edgesB[1]), cross(edgesB[1], edgesB[2]), cross(edgesB[2], edgesB[0]), ...edgesA.flatMap(x => edgesB.map(y => cross(x, y)))];
  return axes.every(axis => {
    const length = Math.hypot(...axis); if (length < 1e-10) return true;
    /** @param {number[][]} vertices */
    const project = vertices => vertices.map(point => point.reduce((sum, value, index) => sum + value * axis[index] / length, 0));
    const x = project(verticesA), y = project(verticesB);
    return Math.min(Math.max(...x), Math.max(...y)) - Math.max(Math.min(...x), Math.min(...y)) > 1e-6;
  });
}

/** @param {import('../../../levelDocument.js').RoomDocument} room
 * @param {import('../../../levelDocument.js').Vec3} local @param {number} radius */
export function fitsInside(room, local, radius) {
  const scales = clearanceScale(room);
  return local.every((value, axis) => Math.abs(value) + radius * scales[axis] <= room.size[axis] / 2 - WALL_THICKNESS + 1e-6);
}

/** @param {import('../../../levelDocument.js').Vec3} a @param {import('../../../levelDocument.js').Vec3} b */
export function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
