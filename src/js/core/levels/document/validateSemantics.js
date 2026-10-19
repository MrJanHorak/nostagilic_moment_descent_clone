import { AUTHORED_PICKUPS, EXIT_MARKER_MARGIN, PLAYER_RADIUS, WALL_THICKNESS, enemyClearance } from './LevelContent.js';
import { connectableFace, distance, fitsInside, openingFrame, roomsOverlap, toWorld } from './RoomMath.js';
import validateRelaySemantics from './validateRelaySemantics.js';

/** @param {import('../../../levelDocument.js').LevelDocument} document
 * @param {(path: string, code: string, message: string) => void} issue */
export default function validateSemantics(document, issue) {
  const ids = new Set([document.id]);
  for (const [key, values] of /** @type {const} */ ([['rooms', document.rooms], ['connections', document.connections], ['entities', document.entities]])) {
    for (const [index, value] of values.entries()) {
      if (ids.has(value.id)) issue(`$.${key}[${index}].id`, 'duplicate-id', `Duplicate ID: ${value.id}`);
      ids.add(value.id);
    }
  }
  const rooms = new Map(document.rooms.map(room => [room.id, room]));
  const graph = new Map(document.rooms.map(room => [room.id, new Set(/** @type {string[]} */ ([]))]));
  /** @type {Set<string>} */ const occupied = new Set();
  for (const [index, connection] of document.connections.entries()) {
    const path = `$.connections[${index}]`, a = rooms.get(connection.a.roomId), b = rooms.get(connection.b.roomId);
    for (const [side, endpoint] of /** @type {const} */ ([['a', connection.a], ['b', connection.b]])) {
      if (!rooms.has(endpoint.roomId)) issue(`${path}.${side}.roomId`, 'reference', `Unknown room: ${endpoint.roomId}`);
      const key = `${endpoint.roomId}/${endpoint.port}`;
      if (occupied.has(key)) issue(`${path}.${side}`, 'occupied-port', `Port already connected: ${key}`);
      occupied.add(key);
    }
    if (!a || !b) continue;
    if (!connectableFace(a, connection.a.port) || !connectableFace(b, connection.b.port)) { issue(path, 'shape-port', 'Sloped corridors connect through their local -Z/+Z end faces only'); continue; }
    if (a.id === b.id) { issue(path, 'connection', 'A connection must join two distinct rooms'); continue; }
    const frameA = openingFrame(a, connection.a), frameB = openingFrame(b, connection.b);
    if (distance(frameA.center, frameB.center) > 1e-6 || frameA.normal.some((value, axis) => value !== -frameB.normal[axis])) {
      issue(path, 'alignment', `Connection ${connection.id}: ports must meet at one plane with opposite normals`); continue;
    }
    const [width, height] = connection.openingSize;
    if ([frameA, frameB].some((frame, side) => {
      const offset = (side === 0 ? connection.a : connection.b).offset ?? [0, 0];
      return Math.abs(offset[0]) + width / 2 > frame.width / 2 - WALL_THICKNESS - 0.25 || Math.abs(offset[1]) + height / 2 > frame.height / 2 - WALL_THICKNESS - 0.25;
    })) {
      issue(`${path}.openingSize`, 'clearance', 'Opening must fit both faces with wall/frame clearance'); continue;
    }
    graph.get(a.id)?.add(b.id); graph.get(b.id)?.add(a.id);
  }
  for (let i = 0; i < document.rooms.length; i++) {
    const a = document.rooms[i];
    for (let j = i + 1; j < document.rooms.length; j++) {
      const b = document.rooms[j];
      if (roomsOverlap(a, b)) {
        issue(`$.rooms[${j}].position`, 'overlap', `Rooms ${a.id} and ${b.id} overlap`);
      }
    }
  }
  const startRoom = rooms.get(document.playerSpawn.roomId);
  if (!startRoom) issue('$.playerSpawn.roomId', 'reference', `Unknown room: ${document.playerSpawn.roomId}`);
  else if (!fitsInside(startRoom, document.playerSpawn.position, PLAYER_RADIUS)) issue('$.playerSpawn.position', 'clearance', `Player spawn intersects ${startRoom.id}'s walls`);

  /** @type {Set<string>} */ const reachable = new Set();
  const pending = startRoom ? [startRoom.id] : [];
  while (pending.length) {
    const id = pending.pop(); if (id === undefined || reachable.has(id)) continue;
    reachable.add(id); for (const neighbor of graph.get(id) ?? []) if (!reachable.has(neighbor)) pending.push(neighbor);
  }
  for (const [index, room] of document.rooms.entries()) if (!reachable.has(room.id)) issue(`$.rooms[${index}]`, 'unreachable', `Room ${room.id} is not connected to the player spawn`);

  /** @type {{id: string, path: string, position: import('../../../levelDocument.js').Vec3, radius: number}[]} */
  const placements = startRoom ? [{ id: 'player spawn', path: '$.playerSpawn.position', position: toWorld(startRoom, document.playerSpawn.position), radius: PLAYER_RADIUS }] : [];
  for (const [index, entity] of document.entities.entries()) {
    const room = rooms.get(entity.roomId), path = `$.entities[${index}]`;
    if (!room) { issue(`${path}.roomId`, 'reference', `Unknown room: ${entity.roomId}`); continue; }
    const radius = entity.kind === 'enemy' ? enemyClearance(entity.type) : entity.kind === 'pickup' ? AUTHORED_PICKUPS[entity.type].size : entity.radius + EXIT_MARKER_MARGIN;
    if (!fitsInside(room, entity.position, radius)) issue(`${path}.position`, 'clearance', `Entity ${entity.id} does not fit inside ${room.id} with its clearance radius ${radius}`);
    if (!reachable.has(room.id)) issue(`${path}.roomId`, 'unreachable', `Entity ${entity.id} is unreachable from spawn`);
    placements.push({ id: entity.id, path: `${path}.position`, position: toWorld(room, entity.position), radius });
  }
  for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) {
    const a = placements[i], b = placements[j];
    if (distance(a.position, b.position) < a.radius + b.radius - 1e-6) issue(b.path, 'placement-overlap', `Placement ${b.id} overlaps ${a.id}`);
  }
  const entities = new Map(document.entities.map(entity => [entity.id, entity]));
  /** @type {Set<string>} */ const required = new Set();
  for (const [index, id] of document.mission.requiredEnemyIds.entries()) {
    if (required.has(id)) issue(`$.mission.requiredEnemyIds[${index}]`, 'duplicate-id', `Required enemy repeated: ${id}`);
    required.add(id);
    if (entities.get(id)?.kind !== 'enemy') issue(`$.mission.requiredEnemyIds[${index}]`, 'reference', `Required enemy does not identify an enemy: ${id}`);
  }
  if (entities.get(document.mission.exitId)?.kind !== 'exit') issue('$.mission.exitId', 'reference', 'Mission exitId must identify an exit entity');
  if (document.entities.filter(entity => entity.kind === 'exit').length !== 1) issue('$.entities', 'exit', 'Exactly one exit is required');
  if (document.formatVersion !== 1) validateRelaySemantics(document, issue, ids, placements);
}
