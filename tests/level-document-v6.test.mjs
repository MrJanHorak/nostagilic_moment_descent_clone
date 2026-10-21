import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import EditorDocument, { createDocument } from '../src/js/editor/EditorDocument.js';
import EditorDraftStore from '../src/js/editor/EditorDraftStore.js';
import { validateLevelDocument, validateLevelDraft } from '../src/js/core/levels/document/validateLevelDocument.js';
import { openingFrame, roomsOverlap, toWorld } from '../src/js/core/levels/document/RoomMath.js';
import { overlappingPairs } from '../src/js/core/levels/document/RoomOverlap.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import { traceShot } from '../src/js/utils/combatTrace.js';

function chain(prefab = 'straight-corridor', face = 'negativeZ', offset = [0, 8]) {
  const model = new EditorDocument(), middle = model.attachRoom('room-1', face, prefab, offset);
  const occupied = model.document.connections[0].b.port;
  const end = model.attachRoom(middle, occupied === 'positiveZ' ? 'negativeZ' : 'positiveZ', 'box-room');
  return { model, middle, end };
}
function aligned(model) {
  assert.equal(model.validation.valid, true, JSON.stringify(model.validation));
  for (const link of model.document.connections) assert.deepEqual(openingFrame(model.room(link.a.roomId), link.a).center, openingFrame(model.room(link.b.roomId), link.b).center);
}
function rejectsAtomically(model, action, message) {
  const before = JSON.stringify(model.document), past = model.past.length, future = JSON.stringify(model.future), dirty = model.dirty;
  assert.throws(action, message); assert.equal(JSON.stringify(model.document), before); assert.equal(model.past.length, past); assert.equal(JSON.stringify(model.future), future); assert.equal(model.dirty, dirty);
}

test('stretch preserves the anchor, both openings, linked door, world content, export/recovery and one-command undo', () => {
  const { model, middle, end } = chain();
  model.updateOpening('connection-1', 3, 3, [1, 1]);
  model.addContent(middle, 'relay', 'relay', [0, 0, 0]); model.setDoor('connection-2', 'relay-1');
  const pickup = model.addContent(middle, 'pickup', 'health', [0, 0, -3]);
  model.setSurface(middle, 'negativeY', 0x123456, 'panels');
  const before = model.export(), history = model.past.length, root = structuredClone(model.room('room-1'));
  const content = model.document.devices[0], world = toWorld(model.room(middle), content.position);
  const pickupWorld = toWorld(model.room(middle), model.document.entities.find(item => item.id === pickup).position);
  model.resizeRoom(middle, [24, 20, 80.5]); aligned(model);
  assert.equal(model.document.formatVersion, 6); assert.deepEqual(model.room('room-1'), root);
  assert.deepEqual(model.room(middle).position, [0, 0, -48.25]); assert.deepEqual(model.room(end).position, [0, 0, -96.5]);
  assert.deepEqual(toWorld(model.room(middle), model.document.devices[0].position), world);
  assert.deepEqual(toWorld(model.room(middle), model.document.entities.find(item => item.id === pickup).position), pickupWorld);
  assert.deepEqual(model.document.doors, JSON.parse(before).doors); assert.deepEqual(model.document.connections, JSON.parse(before).connections);
  assert.deepEqual(model.room(middle).surfaces, JSON.parse(before).rooms[1].surfaces); assert.equal(model.past.length, history + 1);
  const text = model.export(), imported = new EditorDocument(); imported.import(text); assert.equal(imported.export(), text);
  const memory = new Map(), storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  assert(new EditorDraftStore(() => storage).save(model.document));
  const store = new EditorDraftStore(() => storage); imported.restoreDraft(store.pending.document); assert.equal(imported.export(), text);
  model.undo(); assert.equal(model.export(), before); model.redo(); assert.equal(model.export(), text);
});

for (const face of ['negativeZ', 'positiveX', 'positiveY', 'negativeY']) {
  test(`resize follows local corridor length in world orientation ${face}, retaining the chosen far anchor`, () => {
    const { model, middle, end } = chain('straight-corridor', face);
    const fixed = structuredClone(model.room(end)), before = model.export();
    model.resizeRoom(middle, [12, 14, 32.5], 'connection-2'); aligned(model);
    assert.deepEqual(model.room(end), fixed); assert.equal(model.document.playerSpawn.roomId, 'room-1');
    const level = compileLevelDocument(model.document), world = buildArena(level);
    try {
      const route = new RoomNavigation(level.sourceDocument).route(new Vector3(...model.room('room-1').position), new Vector3(...model.room(end).position), 0.5);
      assert(route); let start = new Vector3(...model.room('room-1').position);
      for (const point of route) { assert.equal(traceShot(start, point, { colliders: world.colliders, radius: 0.5 }), null); start = point; }
    } finally { disposeObject(world.group); }
    model.undo(); assert.equal(model.export(), before);
  });
}

test('ramp resize preserves affine content positions and fixed end offset in rotated shafts', () => {
  for (const face of ['negativeZ', 'positiveX', 'positiveY', 'negativeY']) {
    const { model, middle } = chain('offset-corridor', face, [4, 8]);
    model.addContent(middle, 'pickup', 'health', [0, 0, -3]);
    const item = model.document.entities.at(-1), oldWorld = toWorld(model.room(middle), item.position);
    model.resizeRoom(middle, [16, 12, 48.5]); aligned(model);
    assert.deepEqual(model.room(middle).endOffset, [4, 8]);
    assert.deepEqual(toWorld(model.room(middle), model.document.entities.at(-1).position), oldWorld);
    assert(compileLevelDocument(model.document).solids.some(solid => solid.vertices));
  }
});

test('resize rejects loop conflicts, blocked growth, clearance loss, invalid numbers and limits atomically', () => {
  const model = new EditorDocument();
  const east = model.attachRoom('room-1', 'positiveX', 'box-room'), northEast = model.attachRoom(east, 'negativeZ', 'box-room');
  const north = model.attachRoom(northEast, 'negativeX', 'box-room'); model.connect(north, 'positiveZ', 'room-1', 'negativeZ');
  rejectsAtomically(model, () => model.resizeRoom(east, [32, 12, 16]), /loop/);
  // Height expansion doesn't change the square's connection constraints.
  model.resizeRoom(east, [16, 24, 16]); aligned(model);
  const starter = new EditorDocument();
  for (const size of [[4, 4, 4], [NaN, 12, 16], [16.1, 12, 16], [257, 12, 16], [4, 4]]) rejectsAtomically(starter, () => starter.resizeRoom('room-1', size), /clearance|fit|4–256/);
  rejectsAtomically(starter, () => starter.resizeRoom('room-1', [20, 12, 16], 'missing'), /Choose an opening/);
  const branched = new EditorDocument(), right = branched.attachRoom('room-1', 'positiveX', 'box-room');
  const corner = branched.attachRoom(right, 'negativeZ', 'box-room'); branched.attachRoom(corner, 'negativeX', 'box-room');
  rejectsAtomically(branched, () => branched.resizeRoom('room-1', [16, 12, 64], 'center'), /overlap/);
});

test('format 6 supports wide corridors and larger openings with strict version, grid and safety boundaries', () => {
  const { model, middle } = chain(); model.resizeRoom('room-1', [256, 256, 16]); model.resizeRoom(middle, [256, 256, 80]);
  model.updateOpening('connection-1', 240, 240, [0, 0]); aligned(model);
  model.updateRoom(middle, { pitch: 0, roll: 0 }); model.setSurface(middle, 'positiveY', 1, 'plain'); assert.equal(model.document.formatVersion, 6);
  const valid = JSON.parse(model.export());
  for (const mutate of [input => input.formatVersion = 5, input => input.formatVersion = 13, input => input.rooms[0].size[0] = 256.5, input => input.rooms[0].size[0] = 10.25, input => input.rooms[0].position[0] = 0.1, input => input.rooms[0].position[0] = 4096.25, input => input.entities = Array(257).fill(input.entities[0]), input => input.connections[0].a.offset = [128.5, 0]]) {
    const input = structuredClone(valid); mutate(input); assert.equal(validateLevelDocument(input).valid, false);
  }
  assert.equal(validateLevelDraft(valid).valid, true);
  const old = createDocument(); old.rooms[0].position[0] = 0.25; assert.equal(validateLevelDraft(old).valid, false);
});

test('sweep overlap results match exhaustive convex checks with rotated shapes and stable ordering', () => {
  const starter = createDocument().rooms[0];
  const rooms = Array.from({ length: 90 }, (_, i) => ({ ...starter, id: `r-${i}`, prefab: i % 2 ? 'offset-corridor' : 'box-room', endOffset: i % 2 ? [4, 8] : undefined, position: [(i % 9) * 10, (i % 3) * 8, Math.floor(i / 9) * 12], size: [8, 8, 16], yaw: (i % 4) * 90, pitch: (i % 3) * 90, roll: (i % 2) * 90 }));
  const expected = []; for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (roomsOverlap(rooms[i], rooms[j])) expected.push([i, j]);
  assert.deepEqual(overlappingPairs(rooms), expected);
});

test('numeric properties preserve connections and Snap repairs earlier displaced or centered-size drafts atomically', () => {
  const { model, middle, end } = chain();
  const original = model.export();
  model.applyRoomProperties(middle, { size: [16, 12, 48.5], position: [0, 0, -16], yaw: 0, pitch: 0, roll: 0, materialPreset: 'industrial-red' });
  aligned(model); assert.deepEqual(model.room('room-1').position, [0, 0, 0]); assert.deepEqual(model.room(end).position, [0, 0, -64.5]);
  assert.equal(model.room(middle).materialPreset, 'industrial-red'); model.undo(); assert.equal(model.export(), original);
  // Reproduce an old centered size change rather than using the safe command.
  model.updateRoom(middle, { size: [8, 8, 32] }); assert.equal(model.validation.valid, false);
  const broken = JSON.stringify(model.document), history = model.past.length;
  model.snapConnections(middle); aligned(model); assert.equal(model.past.length, history + 1);
  assert.deepEqual(model.room('room-1').position, [0, 0, 0]); assert.deepEqual(model.room(middle).position, [0, 0, -24]); assert.deepEqual(model.room(end).position, [0, 0, -48]);
  model.undo(); assert.equal(JSON.stringify(model.document), broken); model.redo(); aligned(model);
  model.updateRoom(middle, { position: [0.5, 0, -24] }); model.snapConnections(middle); aligned(model);
  rejectsAtomically(model, () => model.applyRoomProperties(middle, { size: [4, 4, 32] }), /Opening must fit/);
  for (const position of [[], [0, 0], [0, 0, -24, 1]]) rejectsAtomically(model, () => model.applyRoomProperties(middle, { size: [12, 12, 48], position }), /position grid/);
  const single = new EditorDocument(); rejectsAtomically(single, () => single.snapConnections('room-1'), /no connection/);
});

test('256 connected rooms validate, compile, navigate, export and recover; room 257 fails without mutation', t => {
  const model = new EditorDocument(); let last = 'room-1';
  // Exercise automatic promotion at the old boundary, without 256 UI snapshots.
  for (let i = 1; i < 65; i++) last = model.attachRoom(last, 'negativeZ', 'box-room');
  assert.equal(model.document.formatVersion, 6); assert.equal(model.document.rooms.length, 65);
  for (let i = 65; i < 256; i++) {
    const id = `room-${i + 1}`;
    model.document.rooms.push({ ...structuredClone(model.room(last)), id, position: [0, 0, -16 * i] });
    model.document.connections.push({ id: `connection-${i}`, a: { roomId: last, port: 'negativeZ' }, b: { roomId: id, port: 'positiveZ' }, openingSize: [6, 6] }); last = id;
  }
  const start = performance.now(), level = compileLevelDocument(model.document); t.diagnostic(`256-room validation + compile: ${(performance.now() - start).toFixed(1)} ms (functional timing only)`);
  assert.equal(level.sourceDocument.rooms.length, 256); assert.equal(level.sourceDocument.connections.length, 255);
  assert(new RoomNavigation(level.sourceDocument).route(new Vector3(0, 0, 0), new Vector3(0, 0, -4080), 0.5));
  const text = model.export(), imported = new EditorDocument(); imported.import(text); assert.equal(imported.export(), text);
  rejectsAtomically(model, () => model.attachRoom(last, 'negativeZ', 'box-room'), /256/);
  rejectsAtomically(model, () => model.duplicateRoom(last, 'negativeZ'), /256/);
  const excess = JSON.parse(text); excess.rooms.push({ ...excess.rooms.at(-1), id: 'extra-room' }); assert.equal(validateLevelDocument(excess).valid, false);
  excess.rooms = excess.rooms.slice(0, 256); excess.connections = Array(513).fill(excess.connections[0]); assert.equal(validateLevelDraft(excess).valid, false);
});
