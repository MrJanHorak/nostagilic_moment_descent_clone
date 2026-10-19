import { connectableFace, portFrame } from '../core/levels/document/RoomMath.js';
import { openingRules } from '../core/levels/document/LevelContent.js';

/** Shared clear rectangle of two opposing wall faces, independent of their
 * distance along the normal. The caller must align planes before connecting.
 * @param {import('../levelDocument.js').RoomDocument} a @param {import('../levelDocument.js').Face} portA
 * @param {import('../levelDocument.js').RoomDocument} b @param {import('../levelDocument.js').Face} portB
 * @param {number} [version] */
export function faceOverlap(a, portA, b, portB, version = 7) {
  if (a.id === b.id || !connectableFace(a, portA) || !connectableFace(b, portB)) throw new Error('Choose two different rooms and rectangular connectable faces.');
  const source = portFrame(a, portA), target = portFrame(b, portB), { margin } = openingRules(version);
  if (source.normal.some((value, axis) => value !== -target.normal[axis])) throw new Error('Choose opposing faces. Sloped side walls stay solid.');
  const ranges = [source.u, source.v].map((axis, index) => {
    const halfA = (index ? source.height : source.width) / 2, halfB = (index ? target.height : target.width) / 2;
    return { min: Math.max(source.center[axis] - halfA, target.center[axis] - halfB) + margin,
      max: Math.min(source.center[axis] + halfA, target.center[axis] + halfB) - margin };
  });
  if (ranges.some(range => range.max - range.min < 2 - 1e-6)) throw new Error('These faces have no shared area large enough for a passage. Move sideways or choose another face.');
  return { source, target, ranges, gap: (target.center[source.axis] - source.center[source.axis]) * source.direction };
}

/** @param {import('../levelDocument.js').RoomDocument} a @param {import('../levelDocument.js').Face} portA
 * @param {import('../levelDocument.js').RoomDocument} b @param {import('../levelDocument.js').Face} portB
 * @param {boolean} full @param {number[]} [point] */
export function sharedOpening(a, portA, b, portB, full, point) {
  const { source, target, ranges, gap } = faceOverlap(a, portA, b, portB);
  if (Math.abs(gap) > 1e-6) throw new Error('Faces must share the same plane. Choose Snap branch or Fit corridor end.');
  const { grid } = openingRules(7);
  const size = ranges.map(range => Math.min(full ? 255 : 6, Math.floor((range.max - range.min) / grid + 1e-6) * grid));
  const center = ranges.map((range, index) => {
    const axis = index ? source.v : source.u, desired = full || !point ? (range.min + range.max) / 2 : point[axis];
    const min = Math.ceil((range.min + size[index] / 2 - source.center[axis]) / grid - 1e-6) * grid + source.center[axis];
    const max = Math.floor((range.max - size[index] / 2 - source.center[axis]) / grid + 1e-6) * grid + source.center[axis];
    return Math.max(min, Math.min(max, Math.round((desired - source.center[axis]) / grid) * grid + source.center[axis]));
  });
  return { openingSize: /** @type {[number, number]} */ (size),
    a: { roomId: a.id, port: portA, offset: /** @type {[number, number]} */ (center.map((value, index) => value - source.center[index ? source.v : source.u])) },
    b: { roomId: b.id, port: portB, offset: /** @type {[number, number]} */ (center.map((value, index) => value - target.center[index ? target.v : target.u])) } };
}

/** @param {import('../levelDocument.js').LevelDocument} document @param {string} start */
export function connectedBranch(document, start) {
  const seen = new Set([start]), pending = [start];
  for (let i = 0; i < pending.length; i++) for (const link of document.connections) {
    const other = link.a.roomId === pending[i] ? link.b.roomId : link.b.roomId === pending[i] ? link.a.roomId : null;
    if (other && !seen.has(other)) { seen.add(other); pending.push(other); }
  }
  return seen;
}
