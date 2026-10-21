// Reproducible authored showcase. Runtime loads the validated JSON snapshot.
import { writeFileSync } from 'node:fs';
import { portFrame, connectableFace } from '../src/js/core/levels/document/RoomMath.js';
import { sharedOpening } from '../src/js/editor/ConnectionTools.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';

const rooms = [], connections = [], devices = [], doors = [], entities = [];
const room = (id, position, size = [16, 16, 16], materialPreset = 'industrial-blue', extra = {}) => {
  const value = { id, prefab: 'box-room', position, size, yaw: 0, materialPreset,
    surfaces: { negativeY: { color: 0x46545d, pattern: 'grid' }, negativeZ: { color: 0x65727b, pattern: 'panels' } }, ...extra };
  rooms.push(value); return value;
};
const face = (a, axis, sign) => ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']
  .find(f => connectableFace(a, f) && portFrame(a, f).normal[axis] === sign);
const join = (id, a, b, axis, sign, full = false) => {
  const link = { id, ...sharedOpening(a, face(a, axis, sign), b, face(b, axis, -sign), full) }; connections.push(link); return link;
};
const bridge = (id, a, b, axis) => {
  const sign = Math.sign(b.position[axis] - a.position[axis]);
  const start = portFrame(a, face(a, axis, sign)).center[axis], end = portFrame(b, face(b, axis, -sign)).center[axis];
  const position = [...a.position]; position[axis] = (start + end) / 2;
  const gap = Math.abs(end - start), size = [8, 8, gap];
  const passage = room(id, position, size, a.materialPreset, { prefab: 'straight-corridor', ...(axis === 0 ? { yaw: 90 } : axis === 1 ? { pitch: 90 } : {}) });
  join(`${id}-in`, a, passage, axis, sign); join(`${id}-out`, passage, b, axis, sign); return passage;
};
const relay = (id, label, roomId, position) => { devices.push({ id, label, roomId, position }); return id; };
const door = (id, connectionId, control, extra = {}) => doors.push({ id, connectionId, ...(control === '@shot' ? { activation: 'shot' } : { deviceId: control }), ...extra });
const pickup = (id, type, roomId, position) => entities.push({ id, kind: 'pickup', type, roomId, position });
const enemy = (id, type, roomId, position) => entities.push({ id, kind: 'enemy', type, roomId, position });

const hub = room('arrival-concourse', [0, 0, 0], [48, 24, 48]);
const nl = room('north-transfer', [-12, 0, -48]), nr = room('north-service', [12, 0, -48]);
const west = room('power-control', [-48, 0, 0], undefined, 'industrial-green');
const east = room('freight-dock', [48, 0, 0]);
const south = room('extraction-quay', [0, 0, 48], [24, 16, 24], 'industrial-green');
const nw = room('coolant-pumps', [-48, 0, -48], undefined, 'industrial-green');
const ne = room('lava-foundry', [48, 0, -48], undefined, 'industrial-red');
ne.surfaces.negativeY = { color: 0xb53c12, pattern: 'lava' };
const sw = room('cargo-marshalling', [-48, 0, 48]);
const se = room('security-control', [48, 0, 48], undefined, 'industrial-red');
const core = room('reactor-vault', [0, 0, -96], [32, 24, 24], 'industrial-red');
core.surfaces.negativeZ = { color: 0x9f7b36, pattern: 'hazard' };
const upper = room('observation-deck', [0, 32, 0], [32, 16, 32]);
const upperEast = room('upper-freight', [48, 32, 0]);
const upperCore = room('reactor-overlook', [0, 32, -96], undefined, 'industrial-green', { roll: 90 });
const lower = room('coolant-reservoir', [0, -24, 0], [32, 16, 32]);
lower.surfaces.negativeY = { color: 0x217cba, pattern: 'water' };
const lowerEast = room('lower-freight', [48, -24, 0]);
const secretWest = room('hidden-repair-locker', [-80, 0, 0], undefined, 'industrial-green');
const secretEast = room('hidden-ammunition-store', [80, 0, -48], undefined, 'industrial-green');
const smelter = room('optional-heavy-testing', [-48, 8, 80], undefined, 'industrial-red');
const secretFar = room('hidden-survey-cache', [-56, 8, 112], undefined, 'industrial-green');

// Two distinct doorways on the SAME large forward wall.
for (const [id, target] of [['north-left-lane', nl], ['north-right-lane', nr]]) {
  const lane = room(id, [target.position[0], 0, -32], [8, 8, 16], 'industrial-blue', { prefab: 'straight-corridor' });
  join(`${id}-in`, hub, lane, 2, -1); join(`${id}-out`, lane, target, 2, -1);
}
bridge('north-cross-link', nl, nr, 0);
bridge('west-entry', hub, west, 0); bridge('east-entry', hub, east, 0); bridge('south-return', hub, south, 2);
bridge('west-north-loop', west, nw, 2); bridge('west-south-loop', west, sw, 2);
bridge('east-north-loop', east, ne, 2); bridge('east-south-loop', east, se, 2);
bridge('pump-transfer', nw, nl, 0); bridge('foundry-transfer', nr, ne, 0);
bridge('south-west-loop', sw, south, 0); bridge('south-east-loop', south, se, 0);
for (const [id, a] of [['core-left-approach', nl], ['core-right-approach', nr]]) {
  const lane = room(id, [a.position[0], 0, -70], [8, 8, 28], 'industrial-red', { prefab: 'straight-corridor' });
  join(`${id}-in`, a, lane, 2, -1); join(`${id}-out`, lane, core, 2, -1);
}
bridge('observation-lift', hub, upper, 1); bridge('upper-freight-link', upper, upperEast, 0);
bridge('freight-riser', east, upperEast, 1); bridge('reactor-escape-hatch', core, upperCore, 1);
bridge('overhead-return', upperCore, upper, 2);
bridge('reservoir-hatch', hub, lower, 1); bridge('lower-return-loop', lower, lowerEast, 0); bridge('coolant-riser', lowerEast, east, 1);
bridge('repair-access', west, secretWest, 0); bridge('ammunition-access', ne, secretEast, 0);
const ramp = room('smelter-ramp', [-48, 4, 64], [8, 8, 16], 'industrial-red', { prefab: 'offset-corridor', yaw: 180, endOffset: [0, 8] });
join('smelter-ramp-in', sw, ramp, 2, 1); join('smelter-ramp-out', ramp, smelter, 2, 1);
const diagonal = room('survey-diagonal', [-52, 8, 96], [8, 8, 16], 'industrial-green', { prefab: 'offset-corridor', yaw: 180, endOffset: [8, 0] });
join('survey-diagonal-in', smelter, diagonal, 2, 1); join('survey-diagonal-out', diagonal, secretFar, 2, 1);

relay('power-relay', 'Freight field power', west.id, [2, 0, 2]);
relay('coolant-relay', 'Reactor coolant bypass', nw.id, [2, 0, -2]);
relay('safety-relay', 'Reactor safety interlock', se.id, [2, 0, 2]);
devices.push({ id: 'primary-reactor', kind: 'reactor', label: 'Primary reactor', roomId: core.id, position: [0, 0, -4], health: 150 });
door('entry-shot-door', 'north-left-lane-in', '@shot');
door('freight-field', 'east-entry-in', 'power-relay', { kind: 'force-field' });
door('coolant-gate', 'core-left-approach-in', 'coolant-relay');
door('safety-gate', 'core-right-approach-in', 'safety-relay');
door('escape-hatch', 'reactor-escape-hatch-in', 'primary-reactor');
door('repair-secret', 'repair-access-in', '@shot', { concealed: true });
door('ammunition-secret', 'ammunition-access-in', '@shot', { concealed: true });
door('survey-secret', 'survey-diagonal-out', '@shot', { concealed: true });
enemy('transfer-guard', 'scout', nl.id, [0, 0, -3]); enemy('pump-guard', 'fighter', nw.id, [-3, 0, -3]);
enemy('dock-scout', 'scout', east.id, [3, 0, -3]); enemy('forge-bomber', 'bomber', ne.id, [0, 1, -3]);
enemy('security-destroyer', 'destroyer', se.id, [-3, 0, -3]); enemy('test-chamber-boss', 'boss', smelter.id, [0, 0, 0]);
enemy('vault-fighter', 'fighter', core.id, [-9, 0, -4]);
for (const [i, target] of [hub, west, nw, east, south, upper, lower, secretWest, secretEast, secretFar].entries()) {
  pickup(`repair-${i}`, 'health', target.id, [-4, 0, 3]); pickup(`ammunition-${i}`, 'pulseAmmo', target.id, [4, 0, 3]);
}
entities.push({ id: 'extraction', kind: 'exit', roomId: south.id, position: [0, 0, 4], radius: 2 });
const document = { formatVersion: 12, id: 'asterion-deepworks', name: 'Asterion Deepworks', rooms, connections, devices, doors, entities,
  playerSpawn: { roomId: hub.id, position: [0, 0, 12], rotation: [0, 0, 0, 1] },
  mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['transfer-guard', 'pump-guard', 'vault-fighter'],
    requiredDeviceIds: devices.map(d => d.id), exitId: 'extraction', escape: { triggerDeviceId: 'primary-reactor', durationSeconds: 120 } },
  combat: { pulseDamage: 10, initialPulseAmmo: 120, maxPulseAmmo: 300 } };
const result = validateLevelDocument(document); if (!result.valid) throw new Error(JSON.stringify(result.errors, null, 2));
writeFileSync(new URL('../src/js/core/levels/documents/asterion-deepworks.v12.json', import.meta.url), JSON.stringify(document, null, 2) + '\n');
console.log(`${rooms.length} spaces, ${connections.length} passages, ${connections.length - rooms.length + 1} independent loops`);
