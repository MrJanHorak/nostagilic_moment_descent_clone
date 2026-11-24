// Mission 05, "The Seal": reproducible authoring script. The runtime loads the
// validated JSON snapshot it writes. Run: node scripts/build-the-seal.mjs
import { writeFileSync } from 'node:fs';
import { portFrame, connectableFace } from '../src/js/core/levels/document/RoomMath.js';
import { sharedOpening } from '../src/js/editor/ConnectionTools.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';

const rooms = [], connections = [], devices = [], doors = [], entities = [];
const FLOOR = { color: 0x46545d, pattern: 'grid' }, WALL = { color: 0x65727b, pattern: 'panels' };
/** A box room with a grid floor and panelled far wall unless overridden. */
const room = (id, label, position, size, materialPreset = 'industrial-blue', surfaces = {}, extra = {}) => {
  const value = { id, label, prefab: 'box-room', position, size, yaw: 0, materialPreset, surfaces: { negativeY: FLOOR, negativeZ: WALL, ...surfaces }, ...extra };
  rooms.push(value); return value;
};
const face = (a, axis, sign) => ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']
  .find(f => connectableFace(a, f) && portFrame(a, f).normal[axis] === sign);
const join = (id, a, b, axis, sign, full = false) => {
  const link = { id, ...sharedOpening(a, face(a, axis, sign), b, face(b, axis, -sign), full) }; connections.push(link); return link;
};
/** A straight corridor or shaft spanning the gap between two aligned rooms. */
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

// Upper level (y = 0): Kestrel's dock, the gallery above the main shaft, the pump hall and the survey office.
const dock = room('kestrel-dock', 'Kestrel dock', [0, 0, 0], [32, 16, 32], 'industrial-blue', { negativeZ: { color: 0x9f7b36, pattern: 'hazard' } });
const gallery = room('shaft-gallery', 'Shaft gallery', [0, 0, -56], [24, 14, 24]);
const pumps = room('pump-hall', 'Pump hall', [48, 0, -56], [24, 14, 24], 'industrial-green', { negativeY: { color: 0x217cba, pattern: 'water' } });
const survey = room('survey-office', 'Survey office', [-44, 0, -56], [16, 12, 16]);
const cache = room('survey-cache', 'Survey cache', [-44, 0, -84], [12, 10, 12], 'industrial-green');
const platform = room('evac-platform', 'Evac lift platform', [48, 0, -112], [24, 14, 24], 'industrial-green', { negativeZ: { color: 0x9f7b36, pattern: 'hazard' } });
// Lower works (y = -40), below the seal.
const ante = room('seal-antechamber', 'Seal antechamber', [0, -40, -56], [24, 16, 24], 'industrial-red', { negativeZ: { color: 0x9f7b36, pattern: 'hazard' } });
const control = room('seal-control', 'Seal control', [-44, -40, -56], [16, 14, 16], 'industrial-red');
const dorms = room('lower-dorms', 'Lower dorms', [0, -40, -112], [32, 16, 28]);
const smelter = room('old-smelter', 'Old smelter', [-44, -40, -112], [20, 14, 20], 'industrial-red', { negativeY: { color: 0xb53c12, pattern: 'lava' } });
const sump = room('flood-sump', 'Flood sump', [0, -60, -112], [24, 12, 24], 'industrial-blue', { negativeY: { color: 0x217cba, pattern: 'water' } });
const evac = room('evac-control', 'Evac lift control', [48, -40, -112], [20, 16, 20], 'industrial-green');

bridge('entry-tunnel', 'Entry tunnel', dock, gallery, 2);
bridge('pump-walk', 'Pump walk', gallery, pumps, 0);
bridge('survey-walk', 'Survey walk', gallery, survey, 0);
bridge('cache-crawl', 'Cache crawl', survey, cache, 2, 'industrial-green');
bridge('platform-walk', 'Platform walk', pumps, platform, 2, 'industrial-green');
bridge('main-shaft', 'Main shaft', gallery, ante, 1);
bridge('maintenance-drop', 'Maintenance drop', survey, control, 1);
bridge('control-walk', 'Control walk', ante, control, 0, 'industrial-red');
bridge('seal-bulkhead', 'Seal bulkhead', ante, dorms, 2, 'industrial-red');
bridge('smelter-walk', 'Smelter walk', dorms, smelter, 0, 'industrial-red');
bridge('smelter-return', 'Smelter return', smelter, control, 2, 'industrial-red');
bridge('sump-hatch', 'Sump hatch', dorms, sump, 1);
bridge('evac-walk', 'Evac walk', dorms, evac, 0, 'industrial-green');
bridge('evac-shaft', 'Evac lift shaft', evac, platform, 1, 'industrial-green');

// Objectives: power the shaft, release the seal, power the evacuation lift (which floods the works).
relay('shaft-power', 'Main shaft power', pumps.id, [6, 0, -6]);
relay('seal-release', 'Seal release', control.id, [3, 0, -3]);
relay('evac-power', 'Evacuation lift power', evac.id, [4, 0, -4]);
door('dock-door', 'entry-tunnel-in', '@shot');
door('shaft-field', 'main-shaft-in', 'shaft-power', { kind: 'force-field' });
door('seal-door', 'seal-bulkhead-in', 'seal-release');
door('smelter-gate', 'smelter-return-out', 'seal-release');
door('evac-door', 'evac-shaft-in', 'evac-power');
door('cache-secret', 'cache-crawl-in', '@shot', { concealed: true });
door('maintenance-secret', 'maintenance-drop-in', '@shot', { concealed: true });

enemy('gallery-scout', 'scout', gallery.id, [-6, 0, -6]);
enemy('pump-bomber', 'bomber', pumps.id, [-6, 1, -4]);
enemy('ante-fighter-west', 'fighter', ante.id, [-6, 0, -6]);
enemy('ante-fighter-east', 'fighter', ante.id, [6, 2, -6]);
enemy('dorm-scout', 'scout', dorms.id, [10, 0, -8]);
enemy('smelter-bomber', 'bomber', smelter.id, [0, 1, -5]);
enemy('sump-scout', 'scout', sump.id, [-6, 0, -6]);
enemy('asset-destroyer', 'destroyer', evac.id, [-4, 0, 3]);

pickup('dock-ammo', 'pulseAmmo', dock.id, [-6, 0, 6]); pickup('dock-repair', 'health', dock.id, [6, 0, 6]);
pickup('gallery-repair', 'health', gallery.id, [6, 0, 6]);
pickup('pump-ammo', 'pulseAmmo', pumps.id, [6, 0, 6]);
pickup('cache-repair', 'health', cache.id, [-3, 0, 0]); pickup('cache-ammo', 'pulseAmmo', cache.id, [3, 0, 0]);
pickup('control-repair', 'health', control.id, [-4, 0, 4]);
pickup('dorm-ammo', 'pulseAmmo', dorms.id, [-10, 0, 8]); pickup('dorm-repair', 'health', dorms.id, [10, 0, 8]);
pickup('sump-ammo', 'pulseAmmo', sump.id, [6, 0, 6]);
pickup('evac-repair', 'health', evac.id, [-5, 0, -5]);
pickup('platform-ammo', 'pulseAmmo', platform.id, [6, 0, 6]);
// Behind and beside the spawn: out of the opening view, but the obvious way home.
entities.push({ id: 'dock-exit', kind: 'exit', roomId: dock.id, position: [-9, 0, 9], radius: 2 });

const V = 'Vey · Kestrel dispatch', F = 'FOREMAN';
const say = (id, speaker, text, trigger) => ({ id: `ts:${id}`, speaker, text, trigger });
const story = {
  messages: [
    say('msg-start', V, "No contract this time, Two. Kestrel voted: we go back for the miners. FOREMAN opened the dock for us an hour ago. Get below the seal, find everyone you can, and bring them out on the evac lift.", { on: 'start' }),
    say('msg-gallery', F, "WELCOME BACK, TWO. THE SHAFT FIELD IS MINE TO HOLD. THE PUMP HALL RELAY WILL RELEASE IT.", { on: 'enter', roomId: gallery.id }),
    say('msg-shaft', F, "SHAFT OPEN. THE LOWER WORKS ARE BELOW THE SEAL. I HAVE TOLD THEM YOU ARE COMING.", { on: 'device', deviceId: 'shaft-power' }),
    say('msg-ante', V, "Those aren't FOREMAN's. Consortium Asset Protection is already down here. They must have come in on the deep freight line.", { on: 'enter', roomId: ante.id }),
    say('msg-control', F, "THE SEAL HAS HELD FOR SEVENTEEN DAYS. RELEASING IT LETS THEM OUT. AND LETS THEM IN.", { on: 'enter', roomId: control.id }),
    say('msg-seal', V, "Seal's open. The scrubber board said twenty-three people. Find who you can.", { on: 'device', deviceId: 'seal-release' }),
    say('msg-dorms', V, "This is where they've been living. Look at this place. Fly close to anyone you see; the hold has room.", { on: 'enter', roomId: dorms.id }),
    say('msg-sump', V, "Careful in the sump. It's the lowest point in the works, so it floods first.", { on: 'enter', roomId: sump.id }),
    say('msg-evac', V, "Evac lift control. Once it's powered the whole lift line lights up. If the Consortium is watching, they'll see it.", { on: 'enter', roomId: evac.id }),
    say('msg-destroyer', F, "THAT UNIT WAS ORDERED TO FLOOD THE LOWER WORKS. IT WILL NOT.", { on: 'defeat', enemyId: 'asset-destroyer' }),
    say('msg-override', F, "WARNING. CONSORTIUM OVERRIDE RECEIVED. RESERVOIR RELEASE IN SEVENTY-FIVE SECONDS. I CANNOT STOP IT. GO.", { on: 'device', deviceId: 'evac-power' }),
    say('msg-run', V, "Up the evac shaft, across the pump hall, back to the dock. Anyone aboard rides with you. Move!", { on: 'device', deviceId: 'evac-power' }),
    say('msg-platform', V, "Lift top. Pump hall, gallery, dock. You know the way.", { on: 'enter', roomId: platform.id }),
  ],
  logs: [
    { id: 'ts:log-rollcall', roomId: survey.id, position: [-4, 0, -4], title: 'Shelter roll call, day 15',
      text: "Twenty-three in the lower dorms. Moved Pavel to the sump; it's warmer by the pumps. FOREMAN keeps the air on and drops rations at shift change. Hana is counting days on the bunk frame. Somebody please come." },
    { id: 'ts:log-seal', roomId: control.id, position: [-4, 0, -4], title: 'FOREMAN seal log',
      text: "DAY 1: SEAL ENGAGED. REASON: CLOSURE ORDER AC-77. DAY 9: KESTREL PILOT EXTRACTED TWO WORKERS. DAY 12: CONSORTIUM OVERRIDE ATTEMPT 41 REJECTED. DAY 16: ASSET PROTECTION UNITS ENTERED VIA DEEP FREIGHT. DAY 17: TWO RETURNED." },
    { id: 'ts:log-orders', roomId: evac.id, position: [4, 0, 4], title: 'Asset Protection standing orders',
      text: "Priority one: prevent unsanctioned egress from the lower works. If the evacuation lift is powered, release the reservoir. Contractor craft Kestrel-2 is to be treated as hostile. Do not engage the site AI directly." },
    { id: 'ts:log-locker', roomId: smelter.id, position: [5, 0, 5], title: 'Scratched into a locker door',
      text: "If the lift lights up, they'll flood it. Get the young ones up first. Don't wait for me. — I. V." },
  ],
  survivors: [
    { id: 'ts:miner-hana', roomId: dorms.id, position: [-8, 0, -6], name: 'Hana Okafor' },
    { id: 'ts:miner-luis', roomId: dorms.id, position: [6, 0, 4], name: 'Luis Ferro' },
    { id: 'ts:miner-pavel', roomId: sump.id, position: [6, 0, -6], name: 'Pavel Ostrov' },
    { id: 'ts:miner-kit', roomId: smelter.id, position: [-5, 0, 4], name: 'Kit Brandt' },
  ],
};

const document = { formatVersion: 14, id: 'the-seal', name: 'The Seal', rooms, connections, devices, doors, entities,
  playerSpawn: { roomId: dock.id, position: [0, 0, 8], rotation: [0, 0, 0, 1] },
  mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['ante-fighter-west', 'ante-fighter-east', 'asset-destroyer'],
    requiredDeviceIds: devices.map(device => device.id), exitId: 'dock-exit', escape: { triggerDeviceId: 'evac-power', durationSeconds: 75 } },
  combat: { pulseDamage: 10, initialPulseAmmo: 100, maxPulseAmmo: 250 }, story };
const result = validateLevelDocument(document);
if (!result.valid) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
writeFileSync(new URL('../src/js/core/levels/documents/the-seal.v14.json', import.meta.url), JSON.stringify(document, null, 2) + '\n');
console.log(`${rooms.length} spaces, ${connections.length} passages, ${connections.length - rooms.length + 1} independent loops`);
