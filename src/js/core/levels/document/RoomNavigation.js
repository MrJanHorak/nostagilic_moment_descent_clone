import { Vector3 } from 'three';
import { portFrame, worldSize } from './RoomMath.js';
import { WALL_THICKNESS } from './LevelContent.js';

// Keep turns inside the convex room interior, clear of the portal's frame.
const MARGIN = 0.1;

/** Routes for the validated, axis-aligned rectangular shells in format v1.
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
      const frame = portFrame(room.room, connection.a.port);
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
      if (point.every((value, axis) => Math.abs(value - room.position[axis]) <= size[axis] / 2 + 1e-6)) return id;
    }
    return null;
  }

  /** Clamp an observed player position to space the larger enemy can occupy.
   * @param {Vector3} position @param {number} radius @returns {Vector3 | null} */
  destination(position, radius) {
    const id = this.roomAt(position), entry = id === null ? null : this.rooms.get(id);
    if (!entry || !Number.isFinite(radius) || radius <= 0) return null;
    const inset = WALL_THICKNESS + radius + MARGIN;
    if (entry.size.some(size => size / 2 <= inset)) return null;
    return new Vector3(...position.toArray().map((value, axis) => {
      const half = entry.size[axis] / 2 - inset, center = entry.room.position[axis];
      return Math.max(center - half, Math.min(center + half, value));
    }));
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
    /** @type {Map<string, {from: string, approach: Vector3, departure: Vector3}>} */
    const previous = new Map();
    const queue = [from], visited = new Set(queue);
    for (let i = 0; i < queue.length && !visited.has(to); i++) {
      const current = queue[i];
      for (const edge of this.edges.get(current) ?? []) {
        const room = this.rooms.get(edge.to);
        if (blockedConnections?.has(edge.id) || visited.has(edge.to) || !room || room.size.some(size => size / 2 <= inset) ||
            Math.min(edge.width, edge.height) / 2 <= radius + MARGIN) continue;
        visited.add(edge.to); queue.push(edge.to);
        previous.set(edge.to, { from: current,
          approach: edge.center.clone().addScaledVector(edge.normal, -inset),
          departure: edge.center.clone().addScaledVector(edge.normal, inset) });
      }
    }
    if (!visited.has(to)) return null;
    /** @type {Vector3[][]} */
    const crossings = [];
    for (let current = to; current !== from;) {
      const edge = previous.get(current);
      if (!edge) return null;
      crossings.push([edge.approach, edge.departure]); current = edge.from;
    }
    return [first, ...crossings.reverse().flat(), last];
  }
}
