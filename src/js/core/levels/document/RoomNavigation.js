import { Vector3 } from 'three';
import { clearanceScale, fitsInside, inverseOrient, openingFrame, toLocal, toWorld, worldSize } from './RoomMath.js';
import { WALL_THICKNESS } from './LevelContent.js';

// Keep turns inside the convex room interior, clear of the portal's frame.
const MARGIN = 0.1;

/** Routes through validated convex room interiors and rectangular end ports.
 * This graph contains no mutable combat or perception state. */
export default class RoomNavigation {
  /** @param {import('../../../levelDocument.js').LevelDocument} document */
  constructor(document) {
    this.document = document;
    this.rooms = new Map(document.rooms.map(room => [room.id, { room, size: worldSize(room) }]));
    /** @type {Map<string, {id: string, to: string, center: Vector3, normal: Vector3, width: number, height: number}[]>} */
    this.edges = new Map(document.rooms.map(room => [room.id, []]));
    for (const connection of document.connections) {
      const room = this.rooms.get(connection.a.roomId);
      if (!room) continue; // The document validator owns reference diagnostics.
      const frame = openingFrame(room.room, connection.a);
      const center = new Vector3(...frame.center), normal = new Vector3(...frame.normal);
      const [width, height] = connection.openingSize;
      this.edges.get(connection.a.roomId)?.push({ id: connection.id, to: connection.b.roomId, center, normal, width, height });
      this.edges.get(connection.b.roomId)?.push({ id: connection.id, to: connection.a.roomId, center, normal: normal.clone().negate(), width, height });
    }
  }

  /** @param {Vector3} position @returns {string | null} */
  roomAt(position) {
    const point = position.toArray();
    for (const [id, { room, size }] of this.rooms) {
      if (point.every((value, axis) => Math.abs(value - room.position[axis]) <= size[axis] / 2 + 1e-6) && toLocal(room, point).every((value, axis) => Math.abs(value) <= room.size[axis] / 2 + 1e-6)) return id;
    }
    return null;
  }

  /** Clamp an observed player position to space the larger enemy can occupy.
   * @param {Vector3} position @param {number} radius @returns {Vector3 | null} */
  destination(position, radius) {
    const id = this.roomAt(position), entry = id === null ? null : this.rooms.get(id);
    if (!entry || !Number.isFinite(radius) || radius <= 0) return null;
    const scales = clearanceScale(entry.room), half = entry.room.size.map((size, axis) => size / 2 - WALL_THICKNESS - (radius + MARGIN) * scales[axis]);
    if (half.some(value => value <= 0)) return null;
    const local = toLocal(entry.room, position.toArray()).map((value, axis) => Math.max(-half[axis], Math.min(half[axis], value)));
    return new Vector3(...toWorld(entry.room, /** @type {[number, number, number]} */ (local)));
  }

  /** Shortest portal count, with stable document-order ties and body clearance.
   * Each crossing has an approach and departure point: never turn in a wall.
   * A starting body in a portal first finishes entering its containing room.
   * @param {Vector3} start @param {Vector3} target @param {number} radius
   * @param {ReadonlySet<string>} [blockedConnections]
   * @returns {Vector3[] | null} */
  route(start, target, radius, blockedConnections) {
    const from = this.roomAt(start), to = this.roomAt(target);
    const first = this.destination(start, radius), last = this.destination(target, radius);
    if (from === null || to === null || !first || !last) return null;
    const inset = WALL_THICKNESS + radius + MARGIN;
    /** @type {Map<string, {from: string, points: Vector3[]}>} */
    const previous = new Map();
    const queue = [from], visited = new Set(queue);
    for (let i = 0; i < queue.length && !visited.has(to); i++) {
      const current = queue[i];
      for (const edge of this.edges.get(current) ?? []) {
        const room = this.rooms.get(edge.to), source = this.rooms.get(current);
        if (blockedConnections?.has(edge.id) || visited.has(edge.to) || !room || room.size.some(size => size / 2 <= inset) ||
            Math.min(edge.width, edge.height) / 2 <= radius + MARGIN) continue;
        if (!source) continue;
        /** @param {import('../../../levelDocument.js').RoomDocument} shape @param {number} direction */
        const innerPoint = (shape, direction) => {
          if (!shape.endOffset) return edge.center.clone().addScaledVector(edge.normal, direction * inset);
          const local = toLocal(shape, edge.center.toArray()), normal = inverseOrient(edge.normal.toArray(), shape);
          local[2] += direction * normal[2] * inset;
          return new Vector3(...toWorld(shape, local));
        };
        const approach = innerPoint(source.room, -1), departure = innerPoint(room.room, 1);
        if (!fitsInside(source.room, toLocal(source.room, approach.toArray()), radius + MARGIN) || !fitsInside(room.room, toLocal(room.room, departure.toArray()), radius + MARGIN)) continue;
        visited.add(edge.to); queue.push(edge.to);
        previous.set(edge.to, { from: current, points: [approach, ...(source.room.endOffset || room.room.endOffset ? [edge.center.clone()] : []), departure] });
      }
    }
    if (!visited.has(to)) return null;
    /** @type {Vector3[][]} */
    const crossings = [];
    for (let current = to; current !== from;) {
      const edge = previous.get(current);
      if (!edge) return null;
      crossings.push(edge.points); current = edge.from;
    }
    return [first, ...crossings.reverse().flat(), last];
  }
}
