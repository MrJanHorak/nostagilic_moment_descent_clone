import { roomsOverlap, worldSize } from './RoomMath.js';

/** Sweep cached world bounds before exact convex tests. Preserve document order
 * for deterministic validation diagnostics, including touching/sloped rooms.
 * @param {readonly import('../../../levelDocument.js').RoomDocument[]} rooms */
export function overlappingPairs(rooms) {
  const bounds = rooms.map((room, index) => {
    const size = worldSize(room);
    return { room, index, min: size.map((value, axis) => room.position[axis] - value / 2), max: size.map((value, axis) => room.position[axis] + value / 2) };
  });
  const scores = [0, 1, 2].map(axis => bounds.length ? (Math.max(...bounds.map(b => b.max[axis])) - Math.min(...bounds.map(b => b.min[axis]))) / (bounds.reduce((sum, b) => sum + b.max[axis] - b.min[axis], 0) / bounds.length) : 0);
  const axis = scores.indexOf(Math.max(...scores));
  bounds.sort((a, b) => a.min[axis] - b.min[axis] || a.index - b.index);
  /** @type {typeof bounds} */ let active = [];
  /** @type {[number, number][]} */ const pairs = [];
  for (const next of bounds) {
    active = active.filter(previous => previous.max[axis] > next.min[axis] + 1e-6);
    for (const previous of active) {
      if ([0, 1, 2].every(i => Math.min(previous.max[i], next.max[i]) - Math.max(previous.min[i], next.min[i]) > 1e-6) && roomsOverlap(previous.room, next.room)) {
        pairs.push([Math.min(previous.index, next.index), Math.max(previous.index, next.index)]);
      }
    }
    active.push(next);
  }
  return pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** @param {readonly import('../../../levelDocument.js').RoomDocument[]} rooms */
export function overlappingRoomIds(rooms) { return new Set(overlappingPairs(rooms).flatMap(pair => pair.map(index => rooms[index].id))); }
