import { DEVICE_RADIUS } from './LevelContent.js';
import { distance, fitsInside, toWorld } from './RoomMath.js';

/** @param {Exclude<import('../../../levelDocument.js').LevelDocument, {formatVersion: 1}>} document
 * @param {(path: string, code: string, message: string) => void} issue
 * @param {Set<string>} ids
 * @param {{id: string, path: string, position: import('../../../levelDocument.js').Vec3, radius: number}[]} placements */
export default function validateRelaySemantics(document, issue, ids, placements) {
  const rooms = new Map(document.rooms.map(room => [room.id, room]));
  const devices = new Map(document.devices.map(device => [device.id, device]));
  const connections = new Set(document.connections.map(connection => connection.id));
  const occupied = new Set();
  const escape = 'escape' in document.mission ? document.mission.escape : undefined;
  for (const [key, values] of /** @type {const} */ ([['devices', document.devices], ['doors', document.doors]])) {
    for (const [index, value] of values.entries()) {
      if (ids.has(value.id)) issue(`$.${key}[${index}].id`, 'duplicate-id', `Duplicate ID: ${value.id}`);
      ids.add(value.id);
    }
  }
  for (const [index, device] of document.devices.entries()) {
    const path = `$.devices[${index}]`, room = rooms.get(device.roomId);
    if (!room) { issue(`${path}.roomId`, 'reference', `Unknown room: ${device.roomId}`); continue; }
    const radius = device.kind === 'reactor' ? 1.5 : DEVICE_RADIUS;
    if (!fitsInside(room, device.position, radius)) issue(`${path}.position`, 'clearance', 'Relay must fit inside its room');
    const position = toWorld(room, device.position);
    for (const other of placements) if (distance(position, other.position) < radius + other.radius - 1e-6) {
      issue(`${path}.position`, 'placement-overlap', `Relay ${device.id} overlaps ${other.id}`);
    }
    placements.push({ id: device.id, path: `${path}.position`, position, radius });
  }
  for (const [index, door] of document.doors.entries()) {
    if (!connections.has(door.connectionId)) issue(`$.doors[${index}].connectionId`, 'reference', `Unknown connection: ${door.connectionId}`);
    if (door.activation !== 'shot' && (!door.deviceId || !devices.has(door.deviceId))) issue(`$.doors[${index}].deviceId`, 'reference', `Unknown relay: ${door.deviceId}`);
    if (occupied.has(door.connectionId)) issue(`$.doors[${index}].connectionId`, 'occupied-door', 'Only one door may occupy a connection');
    occupied.add(door.connectionId);
  }
  const required = new Set();
  for (const [index, id] of document.mission.requiredDeviceIds.entries()) {
    if (required.has(id)) issue(`$.mission.requiredDeviceIds[${index}]`, 'duplicate-id', `Required relay repeated: ${id}`);
    if (!devices.has(id)) issue(`$.mission.requiredDeviceIds[${index}]`, 'reference', `Unknown required relay: ${id}`);
    required.add(id);
  }
  // Version 17 choice relays: optional by design, and never required, linked or the escape trigger.
  const choice = 'choice' in document.mission ? document.mission.choice : undefined;
  const choiceIds = new Set(choice?.deviceIds ?? []);
  for (const [j, id] of (choice?.deviceIds ?? []).entries()) {
    const path = `$.mission.choice.deviceIds[${j}]`;
    if (!devices.has(id)) issue(path, 'reference', `Unknown choice relay: ${id}`);
    else if (devices.get(id)?.kind === 'reactor') issue(path, 'choice', 'A reactor cannot be a choice');
    else if (required.has(id)) issue(path, 'choice', 'A choice relay cannot also be required');
    if (choice?.deviceIds.indexOf(id) !== j) issue(path, 'duplicate-id', `Choice relay repeated: ${id}`);
  }
  for (const [index, device] of document.devices.entries()) if (!required.has(device.id) && !choiceIds.has(device.id)) {
    issue(`$.devices[${index}].id`, 'relay', 'Every authored relay must be required by the mission');
  }
  // Solve monotonic unlocks: only relays reached with currently open doors may
  // unlock additional connections. A self-lock or cycle cannot bootstrap itself.
  const active = new Set();
  if (escape && !required.has(escape.triggerDeviceId)) issue('$.mission.escape.triggerDeviceId', 'reference', 'The escape trigger must identify a required relay');
  // Version 15 linked pairs: two different required relays (not reactors), each in one pair at most.
  const linked = new Set();
  for (const [index, link] of ('linkedRelays' in document.mission ? document.mission.linkedRelays ?? [] : []).entries()) {
    if (link.ids[0] === link.ids[1]) issue(`$.mission.linkedRelays[${index}].ids`, 'linked', 'A linked pair needs two different relays');
    for (const [j, id] of link.ids.entries()) {
      const path = `$.mission.linkedRelays[${index}].ids[${j}]`;
      if (!devices.has(id)) issue(path, 'reference', `Unknown linked relay: ${id}`);
      else if (devices.get(id)?.kind === 'reactor') issue(path, 'linked', 'A reactor cannot be linked; it is destroyed by fire');
      else if (!required.has(id)) issue(path, 'linked', 'Linked relays must be required relays');
      if (linked.has(id)) issue(path, 'duplicate-id', `Relay ${id} is in more than one linked pair`);
      linked.add(id);
    }
  }
  let reachable = new Set([document.playerSpawn.roomId]);
  for (let pass = 0; pass <= document.devices.length; pass++) {
    reachable = new Set([document.playerSpawn.roomId]);
    const pending = [...reachable];
    for (let i = 0; i < pending.length; i++) for (const connection of document.connections) {
      // A shot door can be opened from either adjacent reachable room, independently of relays.
      if (document.doors.some(door => door.connectionId === connection.id && door.activation !== 'shot' && !active.has(door.deviceId))) continue;
      const next = connection.a.roomId === pending[i] ? connection.b.roomId : connection.b.roomId === pending[i] ? connection.a.roomId : null;
      if (next && !reachable.has(next)) { reachable.add(next); pending.push(next); }
    }
    const before = active.size;
    for (const device of document.devices) if (reachable.has(device.roomId)) {
      if (device.id === escape?.triggerDeviceId && ([...required].some(id => id !== device.id && !active.has(id)) ||
        document.entities.some(entity => document.mission.requiredEnemyIds.includes(entity.id) && !reachable.has(entity.roomId)))) continue;
      active.add(device.id);
    }
    if (active.size === before) break;
  }
  for (const [index, device] of document.devices.entries()) if (!active.has(device.id)) {
    issue(`$.devices[${index}].roomId`, 'locked-route', `Relay ${device.id} is trapped behind locked doors`);
  }
  // Whichever choice is made, the exit must stay reachable.
  const exit = document.entities.find(entity => entity.id === document.mission.exitId);
  if (choice && exit) for (const [j, picked] of choice.deviceIds.entries()) {
    const open = new Set([...active].filter(id => !choiceIds.has(id) || id === picked));
    const seen = new Set([document.playerSpawn.roomId]), queue = [...seen];
    for (let i = 0; i < queue.length; i++) for (const connection of document.connections) {
      if (document.doors.some(door => door.connectionId === connection.id && door.activation !== 'shot' && !open.has(door.deviceId))) continue;
      const next = connection.a.roomId === queue[i] ? connection.b.roomId : connection.b.roomId === queue[i] ? connection.a.roomId : null;
      if (next && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
    if (!seen.has(exit.roomId)) issue(`$.mission.choice.deviceIds[${j}]`, 'locked-route', `Choosing ${picked} leaves the exit unreachable`);
  }
  for (const [index, room] of document.rooms.entries()) if (!reachable.has(room.id)) {
    issue(`$.rooms[${index}]`, 'locked-route', `Room ${room.id} cannot be reached by activating accessible relays`);
  }
}
