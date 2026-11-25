// Team missions (Phase 4 step 5): reproducible authoring script for the co-op
// missions built around linked relays (level format v15). The runtime loads the
// validated JSON snapshots it writes. Run: node scripts/build-team-missions.mjs
import { writeFileSync } from 'node:fs';
import { portFrame, connectableFace } from '../src/js/core/levels/document/RoomMath.js';
import { sharedOpening } from '../src/js/editor/ConnectionTools.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';

const FLOOR = { color: 0x46545d, pattern: 'grid' }, WALL = { color: 0x65727b, pattern: 'panels' }, HAZARD = { color: 0x9f7b36, pattern: 'hazard' };

/** A fresh authoring kit (rooms, passages, relays, doors, content) for one mission. */
function kit() {
  const rooms = [], connections = [], devices = [], doors = [], entities = [];
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
  return { rooms, connections, devices, doors, entities, room, bridge, relay, door, pickup, enemy };
}

const V = 'Vey · Kestrel dispatch', F = 'FOREMAN';
const say = (prefix, id, speaker, text, trigger) => ({ id: `${prefix}:${id}`, speaker, text, trigger });

/** @param {any} document @param {string} file */
function write(document, file) {
  const result = validateLevelDocument(document);
  if (!result.valid) throw new Error(`${document.id}:\n` + result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
  writeFileSync(new URL(`../src/js/core/levels/documents/${file}`, import.meta.url), JSON.stringify(document, null, 2) + '\n');
  console.log(`${document.id}: ${document.rooms.length} spaces, ${document.connections.length} passages, ${document.connections.length - document.rooms.length + 1} loops`);
}

// ── Team 01 · Twin Valves ────────────────────────────────────────────────
// A pump station whose pressure core opens only when both valves turn together.
// West and east wings split the team; the core joins them; the drop is the exit.
{
  const k = kit();
  const drop = k.room('kestrel-drop', 'Kestrel drop', [0, 0, 0], [28, 14, 28], 'industrial-blue', { negativeZ: HAZARD });
  const westPumps = k.room('west-pumphouse', 'West pumphouse', [-52, 0, 0], [24, 14, 24], 'industrial-green', { negativeY: { color: 0x217cba, pattern: 'water' } });
  const eastPumps = k.room('east-pumphouse', 'East pumphouse', [52, 0, 0], [24, 14, 24], 'industrial-green', { negativeY: { color: 0x217cba, pattern: 'water' } });
  const westValve = k.room('west-valve-room', 'West valve room', [-52, 0, -48], [20, 12, 20]);
  const eastValve = k.room('east-valve-room', 'East valve room', [52, 0, -48], [20, 12, 20]);
  const core = k.room('pressure-core', 'Pressure core', [0, 0, -48], [24, 16, 24], 'industrial-red', { negativeZ: HAZARD });
  k.bridge('west-walk', 'West walk', drop, westPumps, 0);
  k.bridge('east-walk', 'East walk', drop, eastPumps, 0);
  k.bridge('west-riser', 'West riser', westPumps, westValve, 2, 'industrial-green');
  k.bridge('east-riser', 'East riser', eastPumps, eastValve, 2, 'industrial-green');
  k.bridge('west-core-line', 'West core line', westValve, core, 0, 'industrial-red');
  k.bridge('east-core-line', 'East core line', core, eastValve, 0, 'industrial-red');
  k.bridge('core-return', 'Core return', core, drop, 2, 'industrial-red');

  k.relay('west-valve', 'West valve', westValve.id, [4, 0, -4]);
  k.relay('east-valve', 'East valve', eastValve.id, [-4, 0, -4]);
  k.relay('core-release', 'Pressure release', core.id, [0, 0, -6]);
  k.door('west-core-gate', 'west-core-line-in', 'west-valve');
  k.door('east-core-gate', 'east-core-line-out', 'east-valve');
  k.door('return-gate', 'core-return-in', 'core-release', { kind: 'force-field' });

  k.enemy('west-scout', 'scout', westPumps.id, [6, 0, -6]);
  k.enemy('east-scout', 'scout', eastPumps.id, [-6, 0, -6]);
  k.enemy('west-guard', 'fighter', westValve.id, [-4, 1, 4]);
  k.enemy('east-guard', 'fighter', eastValve.id, [4, 1, 4]);
  k.enemy('core-bomber', 'bomber', core.id, [-6, 2, 4]);
  k.enemy('core-warden', 'destroyer', core.id, [5, 0, 2]);

  k.pickup('drop-ammo', 'pulseAmmo', drop.id, [-8, 0, 8]); k.pickup('drop-repair', 'health', drop.id, [8, 0, 8]);
  k.pickup('west-ammo', 'pulseAmmo', westPumps.id, [-6, 0, 6]); k.pickup('east-ammo', 'pulseAmmo', eastPumps.id, [6, 0, 6]);
  k.pickup('west-repair', 'health', westValve.id, [-6, 0, -6]); k.pickup('east-repair', 'health', eastValve.id, [6, 0, -6]);
  k.pickup('core-repair', 'health', core.id, [-8, 0, -8]);
  k.entities.push({ id: 'drop-exit', kind: 'exit', roomId: drop.id, position: [0, 0, 10], radius: 2 });

  const P = 'tv';
  const story = {
    messages: [
      say(P, 'msg-start', V, "Side job while the Seal survivors recover: Asterion's west pump station is leaking pressure into the lower works. The core only vents if both valves turn together. Split up: one of you west, one east.", { on: 'start' }),
      say(P, 'msg-west', F, "WEST VALVE. IT WILL HOLD FOR TEN SECONDS. THE EAST VALVE MUST TURN BEFORE IT LETS GO.", { on: 'enter', roomId: westValve.id }),
      say(P, 'msg-east', F, "EAST VALVE. THE CONSORTIUM BUILT THIS STATION SO NO ONE PILOT COULD OPEN IT. THEY DID NOT EXPECT FRIENDS.", { on: 'enter', roomId: eastValve.id }),
      say(P, 'msg-linked', V, "Both valves are open, and so are the core lines. Meet in the middle.", { on: 'device', deviceId: 'east-valve' }),
      say(P, 'msg-core', V, "That's a destroyer in the pressure core. Take it down together, then pull the release.", { on: 'enter', roomId: core.id }),
      say(P, 'msg-release', F, "PRESSURE VENTING. THE CORE WILL FLOOD WITH STEAM IN SIXTY SECONDS. THE RETURN LINE IS OPEN. GO HOME.", { on: 'device', deviceId: 'core-release' }),
    ],
    logs: [
      { id: `${P}:log-design`, roomId: westPumps.id, position: [6, 0, 6], title: 'Station design note',
        text: "Two-valve interlock per Consortium safety standard 12: no single operator may vent the core. Valves must be turned within ten seconds of each other. Lone technicians: request a partner or don't touch it." },
      { id: `${P}:log-shift`, roomId: eastValve.id, position: [6, 0, 6], title: 'Shift note',
        text: "Mara's on west, I'm on east, radio check every five minutes. If FOREMAN shuts the station again we turn them together and walk out through the core. — D." },
    ],
    survivors: [{ id: `${P}:miner-dario`, roomId: eastPumps.id, position: [-6, 0, 6], name: 'Dario Mensah' }],
  };
  write({ formatVersion: 15, id: 'team-twin-valves', name: 'Twin Valves', rooms: k.rooms, connections: k.connections, devices: k.devices, doors: k.doors, entities: k.entities,
    playerSpawn: { roomId: drop.id, position: [0, 0, 6], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['core-warden'], requiredDeviceIds: ['west-valve', 'east-valve', 'core-release'], exitId: 'drop-exit',
      escape: { triggerDeviceId: 'core-release', durationSeconds: 60 }, linkedRelays: [{ ids: ['west-valve', 'east-valve'], windowSeconds: 10 }] },
    combat: { pulseDamage: 10, initialPulseAmmo: 100, maxPulseAmmo: 250 }, story }, 'team-twin-valves.v15.json');
}

// ── Team 02 · Deep Freight ───────────────────────────────────────────────
// Where Asset Protection came in. Two cranes (north and south) lower the freight
// shaft together; two rail switches (west and east) unlock the deep line; the line
// release starts a 90-second escape up the maintenance lift to the dock.
{
  const k = kit();
  const dock = k.room('freight-dock', 'Freight dock', [0, 0, 0], [32, 16, 32], 'industrial-blue', { negativeZ: HAZARD });
  const north = k.room('north-crane', 'North crane', [0, 0, -52], [24, 14, 24], 'industrial-green');
  const south = k.room('south-crane', 'South crane', [0, 0, 52], [24, 14, 24], 'industrial-green');
  const hold = k.room('cargo-hold', 'Cargo hold', [0, -44, 0], [32, 16, 32], 'industrial-red');
  const rail = k.room('rail-control', 'Rail control', [-52, -44, 0], [20, 14, 20], 'industrial-red');
  const switches = k.room('switch-room', 'Switch room', [52, -44, 0], [20, 14, 20], 'industrial-red', { negativeY: { color: 0xb53c12, pattern: 'lava' } });
  const line = k.room('deep-line', 'Deep freight line', [0, -44, -52], [24, 16, 32], 'industrial-blue', { negativeZ: HAZARD });
  k.bridge('north-gantry', 'North gantry', dock, north, 2);
  k.bridge('south-gantry', 'South gantry', dock, south, 2);
  k.bridge('freight-shaft', 'Freight shaft', dock, hold, 1);
  k.bridge('rail-walk', 'Rail walk', hold, rail, 0, 'industrial-red');
  k.bridge('switch-walk', 'Switch walk', hold, switches, 0, 'industrial-red');
  k.bridge('freight-lock', 'Freight lock', hold, line, 2, 'industrial-red');
  k.bridge('maintenance-lift', 'Maintenance lift', line, north, 1, 'industrial-green');

  k.relay('crane-north', 'North crane', north.id, [0, 0, -6]);
  k.relay('crane-south', 'South crane', south.id, [0, 0, 6]);
  k.relay('rail-west', 'West rail switch', rail.id, [-4, 0, 4]);
  k.relay('rail-east', 'East rail switch', switches.id, [4, 0, 4]);
  k.relay('line-release', 'Line release', line.id, [0, 0, -10]);
  k.door('dock-door', 'north-gantry-in', '@shot');
  k.door('shaft-field', 'freight-shaft-in', 'crane-north', { kind: 'force-field' });
  k.door('lock-door', 'freight-lock-in', 'rail-west');
  k.door('lift-field', 'maintenance-lift-in', 'line-release', { kind: 'force-field' });

  k.enemy('north-scout', 'scout', north.id, [6, 0, 4]);
  k.enemy('south-bomber', 'bomber', south.id, [-6, 2, -4]);
  k.enemy('hold-fighter-west', 'fighter', hold.id, [-8, 0, -8]);
  k.enemy('hold-fighter-east', 'fighter', hold.id, [8, 2, -8]);
  k.enemy('rail-scout', 'scout', rail.id, [4, 0, -4]);
  k.enemy('switch-fighter', 'fighter', switches.id, [-4, 2, -4]);
  k.enemy('line-destroyer', 'destroyer', line.id, [0, 0, 4]);
  k.enemy('line-bomber', 'bomber', line.id, [-6, 3, -4]);

  k.pickup('dock-ammo', 'pulseAmmo', dock.id, [-8, 0, 8]); k.pickup('dock-repair', 'health', dock.id, [8, 0, 8]);
  k.pickup('north-ammo', 'pulseAmmo', north.id, [-6, 0, 6]); k.pickup('south-repair', 'health', south.id, [6, 0, -6]);
  k.pickup('hold-ammo', 'pulseAmmo', hold.id, [-10, 0, 10]); k.pickup('hold-repair', 'health', hold.id, [10, 0, 10]);
  k.pickup('rail-repair', 'health', rail.id, [-6, 0, -6]); k.pickup('switch-ammo', 'pulseAmmo', switches.id, [6, 3, -6]);
  k.pickup('line-repair', 'health', line.id, [8, 0, 10]);
  k.entities.push({ id: 'dock-exit', kind: 'exit', roomId: dock.id, position: [-10, 0, -2], radius: 2 });

  const P = 'df';
  const story = {
    messages: [
      say(P, 'msg-start', V, "This is where Asset Protection got in: the deep freight line. Close it for good. The cranes lower the freight shaft, but only both at once. Someone take north, someone take south.", { on: 'start' }),
      say(P, 'msg-shaft', F, "SHAFT LOWERED. THE CARGO HOLD IS STILL THEIRS.", { on: 'device', deviceId: 'crane-north' }),
      say(P, 'msg-hold', V, "Two rail switches, west and east. Same trick: together, inside eight seconds. The switch room floor is slag, so mind your shields.", { on: 'enter', roomId: hold.id }),
      say(P, 'msg-lock', F, "FREIGHT LOCK OPEN. THE DEEP LINE RUNS STRAIGHT TO THE CONSORTIUM YARD. I HAVE NEVER SEEN THE OTHER END.", { on: 'device', deviceId: 'rail-west' }),
      say(P, 'msg-line', V, "Line release is at the far end. Pull it and the whole line seals. Then the maintenance lift takes you straight up to the north crane.", { on: 'enter', roomId: line.id }),
      say(P, 'msg-release', F, "LINE SEALING. THE YARD WILL VENT THE TUNNEL IN NINETY SECONDS. THE LIFT IS OPEN. TAKE YOUR FRIENDS.", { on: 'device', deviceId: 'line-release' }),
      say(P, 'msg-destroyer', V, "That was their heavy unit. They'll know we're here now.", { on: 'defeat', enemyId: 'line-destroyer' }),
    ],
    logs: [
      { id: `${P}:log-manifest`, roomId: hold.id, position: [12, 0, 0], title: 'Freight manifest AC-77-14',
        text: "Cargo: 6 × Asset Protection units (fighter), 1 × heavy (destroyer), reservoir release charges. Destination: Asterion lower works. Authority: Closure Order AC-77. Note: site AI not to be informed." },
      { id: `${P}:log-yard`, roomId: line.id, position: [8, 0, -10], title: 'Yard dispatcher, private channel',
        text: "If anyone asks, the line was never here. If the Kestrel pilots come through it, we seal the yard end and they can find their own way home." },
    ],
    survivors: [
      { id: `${P}:miner-ilse`, roomId: rail.id, position: [6, 0, 6], name: 'Ilse Varga' },
      { id: `${P}:miner-tomas`, roomId: south.id, position: [-6, 0, 6], name: 'Tomas Reyes' },
    ],
  };
  write({ formatVersion: 15, id: 'team-deep-freight', name: 'Deep Freight', rooms: k.rooms, connections: k.connections, devices: k.devices, doors: k.doors, entities: k.entities,
    playerSpawn: { roomId: dock.id, position: [0, 0, 8], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['hold-fighter-west', 'hold-fighter-east', 'line-destroyer'],
      requiredDeviceIds: ['crane-north', 'crane-south', 'rail-west', 'rail-east', 'line-release'], exitId: 'dock-exit',
      escape: { triggerDeviceId: 'line-release', durationSeconds: 90 },
      linkedRelays: [{ ids: ['crane-north', 'crane-south'], windowSeconds: 12 }, { ids: ['rail-west', 'rail-east'], windowSeconds: 8 }] },
    combat: { pulseDamage: 10, initialPulseAmmo: 120, maxPulseAmmo: 250 }, story }, 'team-deep-freight.v15.json');
}
