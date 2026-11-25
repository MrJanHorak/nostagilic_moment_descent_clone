// Shared authoring kit for scripted missions (team missions, Act 2 and later).
import { writeFileSync } from 'node:fs';
import { portFrame, connectableFace } from '../../src/js/core/levels/document/RoomMath.js';
import { sharedOpening } from '../../src/js/editor/ConnectionTools.js';
import { validateLevelDocument } from '../../src/js/core/levels/document/validateLevelDocument.js';

export const FLOOR = { color: 0x46545d, pattern: 'grid' }, WALL = { color: 0x65727b, pattern: 'panels' }, HAZARD = { color: 0x9f7b36, pattern: 'hazard' };
export const WATER = { color: 0x217cba, pattern: 'water' }, LAVA = { color: 0xb53c12, pattern: 'lava' };

/** A fresh authoring kit (rooms, passages, relays, doors, content) for one mission. */
export function kit() {
  const rooms = [], connections = [], devices = [], doors = [], entities = [], generators = [];
  const room = (id, label, position, size, materialPreset = 'industrial-blue', surfaces = {}) => {
    const value = { id, label, prefab: 'box-room', position, size, yaw: 0, materialPreset, surfaces: { negativeY: FLOOR, negativeZ: WALL, ...surfaces } };
    rooms.push(value); return value;
  };
  const face = (a, axis, sign) => ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']
    .find(f => connectableFace(a, f) && portFrame(a, f).normal[axis] === sign);
  const join = (id, a, b, axis, sign) => { const link = { id, ...sharedOpening(a, face(a, axis, sign), b, face(b, axis, -sign), false) }; connections.push(link); return link; };
  const bridge = (id, label, a, b, axis, materialPreset = a.materialPreset) => {
    const sign = Math.sign(b.position[axis] - a.position[axis]);
    const start = portFrame(a, face(a, axis, sign)).center[axis], end = portFrame(b, face(b, axis, -sign)).center[axis];
    const position = [...a.position]; position[axis] = (start + end) / 2;
    const passage = { id, label, prefab: 'straight-corridor', position, size: [8, 8, Math.abs(end - start)], yaw: 0, materialPreset,
      ...(axis === 0 ? { yaw: 90 } : axis === 1 ? { pitch: 90 } : {}) };
    rooms.push(passage);
    join(`${id}-in`, a, passage, axis, sign); join(`${id}-out`, passage, b, axis, sign); return passage;
  };
  const relay = (id, label, roomId, position) => { devices.push({ id, label, roomId, position }); return id; };
  const door = (id, connectionId, control, extra = {}) => doors.push({ id, connectionId, ...(control === '@shot' ? { activation: 'shot' } : { deviceId: control }), ...extra });
  const pickup = (id, type, roomId, position) => entities.push({ id, kind: 'pickup', type, roomId, position });
  const enemy = (id, type, roomId, position) => entities.push({ id, kind: 'enemy', type, roomId, position });
  const reactor = (id, label, roomId, position, health) => { devices.push({ id, label, roomId, position, kind: 'reactor', health }); return id; };
  const generator = (id, roomId, position, enemyType, count, intervalSeconds, maxAlive = 2) => generators.push({ id, roomId, position, enemyType, count, intervalSeconds, maxAlive });
  /** The authored parts of a level document. */
  const parts = () => ({ rooms, connections, devices, doors, entities, ...(generators.length ? { generators } : {}) });
  return { rooms, connections, devices, doors, entities, generators, room, bridge, relay, reactor, door, pickup, enemy, generator, parts };
}

export const V = 'Vey · Kestrel dispatch';
export const F = 'FOREMAN';
export const say = (prefix, id, speaker, text, trigger) => ({ id: `${prefix}:${id}`, speaker, text, trigger });

/** @param {any} document @param {string} file */
export function write(document, file) {
  const result = validateLevelDocument(document);
  if (!result.valid) throw new Error(`${document.id}:\n` + result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
  writeFileSync(new URL(`../../src/js/core/levels/documents/${file}`, import.meta.url), JSON.stringify(document, null, 2) + '\n');
  console.log(`${document.id}: ${document.rooms.length} spaces, ${document.connections.length} passages, ${document.connections.length - document.rooms.length + 1} loops`);
}

