import { openingFrame, toLocal, toWorld, distance } from '../core/levels/document/RoomMath.js';

/** Resize one piece and solve translations throughout its connection graph.
 * The caller stages/validates this copy before committing a single undo step.
 * @param {import('./DraftTypes.js').EditorLevelDocument} document
 * @param {string} roomId @param {number[]} size @param {string} anchor @param {boolean} [reconnect]
 */
export default function resizeRoom(document, roomId, size, anchor, reconnect = false) {
  if (size.length !== 3 || !size.every(value => Number.isFinite(value) && value >= 4 && value <= 256 && Number.isInteger(value * 2))) throw new Error('Width, height and length must be 4–256 units on the 0.5 unit grid.');
  const rooms = new Map(document.rooms.map(room => [room.id, room]));
  const room = rooms.get(roomId); if (!room) throw new Error('Select a room first.');
  const original = structuredClone(room);
  const connection = anchor === 'center' ? null : document.connections.find(value => value.id === anchor && [value.a, value.b].some(end => end.roomId === roomId));
  if (anchor !== 'center' && !connection) throw new Error('Choose an opening attached to this room, or its center.');
  const endpoint = connection && (connection.a.roomId === roomId ? connection.a : connection.b);
  room.size = /** @type {[number, number, number]} */ ([...size]);
  if (endpoint) {
    const other = connection.a.roomId === roomId ? connection.b : connection.a, neighbor = rooms.get(other.roomId);
    if (!neighbor) throw new Error('Repair missing connection rooms before resizing.');
    const before = reconnect ? openingFrame(neighbor, other).center : openingFrame(original, endpoint).center, after = openingFrame(room, endpoint).center;
    room.position = /** @type {[number, number, number]} */ (room.position.map((value, axis) => value + before[axis] - after[axis]));
  }
  // Content in the resized room stays at its world position. Attached branches
  // carry their own local content with them when translated.
  const content = [document.playerSpawn, ...document.entities, ...(document.formatVersion === 1 ? [] : document.devices)];
  for (const item of content) if (!reconnect && item.roomId === roomId) item.position = [...toLocal(room, toWorld(original, item.position))];
  const adjacency = new Map(document.rooms.map(value => [value.id, document.connections.filter(link => link.a.roomId === value.id || link.b.roomId === value.id)]));
  const visited = new Set([roomId]), pending = [roomId];
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index], source = rooms.get(id); if (!source) continue;
    for (const link of adjacency.get(id) ?? []) {
      const from = link.a.roomId === id ? link.a : link.b, to = link.a.roomId === id ? link.b : link.a;
      const neighbor = rooms.get(to.roomId); if (!neighbor) throw new Error('Repair missing connection rooms before resizing.');
      const start = openingFrame(source, from).center, end = openingFrame(neighbor, to).center;
      if (visited.has(neighbor.id)) {
        if (distance(start, end) > 1e-6) throw new Error('This connected loop cannot stretch by translation. Disconnect one branch before resizing.');
      } else {
        neighbor.position = /** @type {[number, number, number]} */ (neighbor.position.map((value, axis) => value + start[axis] - end[axis]));
        visited.add(neighbor.id); pending.push(neighbor.id);
      }
    }
  }
}
