// Anarchy arena "Foundry Ring": reproducible authoring script. The runtime loads
// the validated JSON it writes. Run: node scripts/build-foundry-ring.mjs
import { writeFileSync } from 'node:fs';
import { portFrame, connectableFace } from '../src/js/core/levels/document/RoomMath.js';
import { sharedOpening } from '../src/js/editor/ConnectionTools.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';

const rooms = [], connections = [], entities = [];
const GRID_FLOOR = { color: 0x46545d, pattern: 'grid' }, PANELS = { color: 0x65727b, pattern: 'panels' };
const room = (id, label, position, size, materialPreset, surfaces = {}) => {
  const value = { id, label, prefab: 'box-room', position, size, yaw: 0, materialPreset, surfaces: { negativeY: GRID_FLOOR, negativeZ: PANELS, ...surfaces } };
  rooms.push(value); return value;
};
const face = (a, axis, sign) => ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']
  .find(f => connectableFace(a, f) && portFrame(a, f).normal[axis] === sign);
const join = (id, a, b, axis, sign) => connections.push({ id, ...sharedOpening(a, face(a, axis, sign), b, face(b, axis, -sign), false) });
/** A corridor or shaft bridging two aligned rooms; wider (10) for dogfights. */
const bridge = (id, label, a, b, axis, materialPreset = a.materialPreset, width = 10) => {
  const sign = Math.sign(b.position[axis] - a.position[axis]);
  const start = portFrame(a, face(a, axis, sign)).center[axis], end = portFrame(b, face(b, axis, -sign)).center[axis];
  const position = [...a.position]; position[axis] = (start + end) / 2;
  rooms.push({ id, label, prefab: 'straight-corridor', position, size: [width, width, Math.abs(end - start)], yaw: 0, materialPreset, ...(axis === 0 ? { yaw: 90 } : axis === 1 ? { pitch: 90 } : {}) });
  join(`${id}-in`, a, passage(id), axis, sign); join(`${id}-out`, passage(id), b, axis, sign);
};
const passage = id => rooms.find(r => r.id === id);
const pickup = (id, type, roomId, position) => entities.push({ id, kind: 'pickup', type, roomId, position });

// Ground level: a central atrium and eight rooms on a 3x3 ring, 44 units apart.
const S = 44, LAVA = { color: 0xb53c12, pattern: 'lava' }, WATER = { color: 0x217cba, pattern: 'water' }, HAZARD = { color: 0x9f7b36, pattern: 'hazard' };
const atrium = room('atrium', 'Furnace atrium', [0, 0, 0], [28, 20, 28], 'industrial-red', { negativeZ: HAZARD });
const n = room('north-bay', 'North bay', [0, 0, -S], [20, 14, 20], 'industrial-blue');
const s = room('south-bay', 'South bay', [0, 0, S], [20, 14, 20], 'industrial-blue');
const e = room('east-bay', 'East bay', [S, 0, 0], [20, 14, 20], 'industrial-green', { negativeY: WATER });
const w = room('west-bay', 'West bay', [-S, 0, 0], [20, 14, 20], 'industrial-green', { negativeY: WATER });
const ne = room('ne-corner', 'Northeast smelter', [S, 0, -S], [18, 12, 18], 'industrial-red');
const nw = room('nw-corner', 'Northwest store', [-S, 0, -S], [18, 12, 18], 'industrial-blue');
const se = room('se-corner', 'Southeast store', [S, 0, S], [18, 12, 18], 'industrial-blue');
const sw = room('sw-corner', 'Southwest smelter', [-S, 0, S], [18, 12, 18], 'industrial-red');
// Upper catwalk above the north-south axis, and a lava pit under the atrium.
const un = room('north-gantry', 'North gantry', [0, 30, -S], [18, 12, 18], 'industrial-green');
const uc = room('crane-deck', 'Crane deck', [0, 30, 0], [22, 12, 22], 'industrial-green', { negativeY: HAZARD });
const us = room('south-gantry', 'South gantry', [0, 30, S], [18, 12, 18], 'industrial-green');
const pit = room('slag-pit', 'Slag pit', [0, -28, 0], [24, 12, 24], 'industrial-red', { negativeY: LAVA });

// Spokes from the atrium, and the outer ring through every corner.
bridge('north-spoke', 'North spoke', atrium, n, 2); bridge('south-spoke', 'South spoke', atrium, s, 2);
bridge('east-spoke', 'East spoke', atrium, e, 0); bridge('west-spoke', 'West spoke', atrium, w, 0);
bridge('ring-n-ne', 'Ring: north to northeast', n, ne, 0); bridge('ring-ne-e', 'Ring: northeast to east', ne, e, 2);
bridge('ring-e-se', 'Ring: east to southeast', e, se, 2); bridge('ring-se-s', 'Ring: southeast to south', se, s, 0);
bridge('ring-s-sw', 'Ring: south to southwest', s, sw, 0); bridge('ring-sw-w', 'Ring: southwest to west', sw, w, 2);
bridge('ring-w-nw', 'Ring: west to northwest', w, nw, 2); bridge('ring-nw-n', 'Ring: northwest to north', nw, n, 0);
// Vertical routes: two shafts to the gantries, a crane-deck drop into the atrium, a hatch to the pit.
bridge('north-shaft', 'North shaft', n, un, 1); bridge('south-shaft', 'South shaft', s, us, 1);
bridge('gantry-north', 'Gantry walk north', uc, un, 2, 'industrial-green', 8); bridge('gantry-south', 'Gantry walk south', uc, us, 2, 'industrial-green', 8);
bridge('crane-drop', 'Crane drop', atrium, uc, 1); bridge('pit-hatch', 'Pit hatch', atrium, pit, 1);

// Repairs in the corners, ammunition in the bays, the best supplies in exposed spots.
for (const corner of [ne, nw, se, sw]) pickup(`${corner.id}-repair`, 'health', corner.id, [0, 0, 0]);
for (const bay of [n, s, e, w]) pickup(`${bay.id}-ammo`, 'pulseAmmo', bay.id, [0, 0, 0]);
pickup('crane-repair', 'health', uc.id, [0, 0, 0]); pickup('pit-ammo', 'pulseAmmo', pit.id, [0, 2, 0]);
pickup('pit-repair', 'health', pit.id, [6, 2, 6]);
entities.push({ id: 'unused-exit', kind: 'exit', roomId: atrium.id, position: [9, -6, 9], radius: 1.5 });

const document = { formatVersion: 14, id: 'foundry-ring', name: 'Anarchy · Foundry Ring', rooms, connections, devices: [], doors: [], entities,
  playerSpawn: { roomId: atrium.id, position: [0, 0, 6], rotation: [0, 0, 0, 1] },
  mission: { type: 'relay-clear-and-exit', requiredEnemyIds: [], requiredDeviceIds: [], exitId: 'unused-exit' },
  combat: { pulseDamage: 10, initialPulseAmmo: 60, maxPulseAmmo: 150 } };
const result = validateLevelDocument(document);
if (!result.valid) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
writeFileSync(new URL('../src/js/core/levels/documents/foundry-ring.v14.json', import.meta.url), JSON.stringify(document, null, 2) + '\n');
console.log(`${rooms.length} spaces, ${connections.length} passages, ${connections.length - rooms.length + 1} independent loops`);
