import RelayController from '../src/js/core/RelayController.js';
import GameState from '../src/js/core/GameState.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import EditorDocument, { createDocument } from '../src/js/editor/EditorDocument.js';
import { faceOverlap } from '../src/js/editor/ConnectionTools.js';
import { openingFrame, orient, portFrame } from '../src/js/core/levels/document/RoomMath.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import wallOpenings from '../src/js/core/levels/document/WallOpenings.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import disposeObject from '../src/js/utils/disposeObject.js';

const v = point => new Vector3(...point);
function multipleFixture() {
  const model = new EditorDocument(); model.resizeRoom('room-1', [32, 16, 16]);
  const hall = model.attachAt('room-1', 'negativeZ', [-8, 0, -8], 'straight-corridor');
  const side = model.attachRoom(hall, 'positiveX', 'box-room'); return { model, hall, side };
}
function atomic(model, action, pattern) {
  const doc = JSON.stringify(model.document), past = model.past.length, future = JSON.stringify(model.future), dirty = model.dirty;
  assert.throws(action, pattern); assert.equal(JSON.stringify(model.document), doc); assert.equal(model.past.length, past); assert.equal(JSON.stringify(model.future), future); assert.equal(model.dirty, dirty);
}
function aligned(model) {
  assert.equal(model.validation.valid, true, JSON.stringify(model.validation));
  for (const link of model.document.connections) assert.deepEqual(openingFrame(model.room(link.a.roomId), link.a).center, openingFrame(model.room(link.b.roomId), link.b).center);
}

test('off-center loop closure cuts two distinct full shared openings through one large wall', () => {
  const { model, side } = multipleFixture(); model.fitOpening('connection-1'); const before = model.export(), history = model.past.length;
  const id = model.connectFaces(side, 'positiveZ', 'room-1', 'negativeZ', { full: true }); aligned(model);
  assert.equal(model.document.formatVersion, 7); assert.equal(model.past.length, history + 1);
  const link = model.document.connections.find(link => link.id === id); assert.deepEqual(link.openingSize, [15, 11]); assert.deepEqual(link.b.offset, [4, 0]);
  const level = compileLevelDocument(model.document), world = buildArena(level);
  try {
    for (const [x, y] of [[-8, 2.8], [4, 4.8]]) assert.equal(traceShot(v([x, y, -6]), v([x, y, -10]), { colliders: world.colliders, radius: 0.5 }), null);
    for (const x of [-15, -4, 14]) assert(traceShot(v([x, 0, -6]), v([x, 0, -10]), { colliders: world.colliders, radius: 0.05 }), 'solid wall between/outside openings must remain');
    const position = v([4, 0, -5]); moveSphere(position, v([0, 0, -4]), 2, world.colliders); assert(position.z < -12.9, 'real sphere must cross the full shared portal');
  } finally { disposeObject(world.group); }
  const text = model.export(), imported = new EditorDocument(); imported.import(text); assert.equal(imported.export(), text);
  model.undo(); assert.equal(model.export(), before); model.redo(); assert.equal(model.export(), text);
  atomic(model, () => model.connectFaces(side, 'positiveZ', 'room-1', 'negativeZ'), /overlaps another opening/);
});

test('multiple wall cutouts and navigation work through every global quarter-turn orientation', () => {
  const fixture = multipleFixture().model.document;
  for (const yaw of [0, 90, 180, 270]) for (const pitch of [0, 90, 180, 270]) for (const roll of [0, 90, 180, 270]) {
    const doc = structuredClone(fixture), rotation = { yaw, pitch, roll };
    for (const room of doc.rooms) Object.assign(room, rotation, { position: orient(room.position, rotation) });
    for (const link of doc.connections) for (const end of [link.a, link.b]) {
      const old = fixture.rooms.find(room => room.id === end.roomId), room = doc.rooms.find(room => room.id === end.roomId);
      const world = orient(openingFrame(old, end).center, rotation), frame = portFrame(room, end.port); end.offset = [world[frame.u] - frame.center[frame.u], world[frame.v] - frame.center[frame.v]];
    }
    const model = new EditorDocument(doc), id = model.connectFaces('room-3', 'positiveZ', 'room-1', 'negativeZ', { full: true }); aligned(model);
    const level = compileLevelDocument(model.document), world = buildArena(level), link = model.document.connections.find(link => link.id === id), frame = openingFrame(model.room(link.a.roomId), link.a);
    try {
      const center = v(frame.center), normal = v(frame.normal);
      assert.equal(traceShot(center.clone().addScaledVector(normal, -2), center.clone().addScaledVector(normal, 2), { colliders: world.colliders, radius: 0.5 }), null);
      assert(new RoomNavigation(level.sourceDocument).route(v(model.room('room-1').position), v(model.room('room-3').position), 0.5));
    } finally { disposeObject(world.group); }
  }
});

test('partially shared faces preserve exact eighth-unit centers, strict old-format gates and later v7 edits', () => {
  const doc = createDocument(); Object.assign(doc, { formatVersion: 6, devices: [], doors: [], mission: { ...doc.mission, type: 'relay-clear-and-exit', requiredDeviceIds: [] } });
  doc.rooms[0].size = [32, 16, 16]; doc.rooms.push({ ...doc.rooms[0], id: 'small', size: [8.5, 8.5, 8.5], position: [12, 0, -12.25] });
  const model = new EditorDocument(); model.restoreDraft(doc);
  model.connectFaces('small', 'positiveZ', 'room-1', 'negativeZ', { full: true }); aligned(model);
  const link = model.document.connections[0]; assert.deepEqual(link.openingSize, [7.25, 7.5]); assert.deepEqual(link.a.offset, [-0.125, 0]); assert.deepEqual(link.b.offset, [11.875, 0]);
  const before = model.export(), old = JSON.parse(before); old.formatVersion = 6; assert.equal(validateLevelDocument(old).valid, false);
  model.updateRoom('small', { pitch: 0, roll: 0 }); model.setSurface('small', 'negativeY', 0x123456, 'panels'); model.resizeRoom('small', [9, 9, 8.5]); model.snapConnections('small');
  assert.equal(model.document.formatVersion, 7); aligned(model);
  for (const mutate of [d => d.formatVersion = 9, d => d.connections[0].a.offset[0] = 0.1, d => d.connections[0].openingSize[0] = 7.1, d => d.connections[0].openingSize[0] = 255.125]) { const bad = JSON.parse(before); mutate(bad); assert.equal(validateLevelDocument(bad).valid, false); }
});

test('Fit corridor end closes a gapped loop while keeping the anchor and target rooms fixed', () => {
  const model = new EditorDocument(), east = model.attachRoom('room-1', 'positiveX', 'box-room');
  const north = model.attachRoom(east, 'negativeZ', 'straight-corridor'); model.resizeRoom(north, [8, 8, 32]);
  const corner = model.attachRoom(north, 'negativeZ', 'box-room'), west = model.attachRoom(corner, 'negativeX', 'box-room'), hall = model.attachRoom(west, 'positiveZ', 'straight-corridor');
  const before = model.export(), positions = model.document.rooms.map(room => [room.id, [...room.position]]);
  atomic(model, () => model.connectFaces(hall, 'positiveZ', 'room-1', 'negativeZ'), /share a plane/);
  atomic(model, () => model.connectFaces(hall, 'positiveZ', 'room-1', 'negativeZ', { mode: 'snap' }), /already share a route/);
  const id = model.connectFaces(hall, 'positiveZ', 'room-1', 'negativeZ', { mode: 'fit', full: true }); aligned(model);
  assert.deepEqual(model.room(hall).size, [8, 8, 32]);
  for (const [roomId, position] of positions) if (roomId !== hall) assert.deepEqual(model.room(roomId).position, position);
  const nav = new RoomNavigation(model.document), open = nav.route(v([0, 0, 0]), v(model.room(west).position), 0.5), closed = nav.route(v([0, 0, 0]), v(model.room(west).position), 0.5, new Set([id]));
  assert(open.length < closed.length, 'the original route must remain usable around the closed loop door');
  model.undo(); assert.equal(model.export(), before);
});

test('Snap moves only a separate branch and its content, then joins the existing target', () => {
  const doc = createDocument(); Object.assign(doc, { formatVersion: 6, devices: [], doors: [], mission: { ...doc.mission, type: 'relay-clear-and-exit', requiredDeviceIds: [] } });
  for (const [id, z] of [['branch', -24], ['tail', -40]]) doc.rooms.push({ ...doc.rooms[0], id, size: [8, 8, 16], position: [2, 0, z] });
  doc.connections = [{ id: 'old-link', a: { roomId: 'branch', port: 'negativeZ' }, b: { roomId: 'tail', port: 'positiveZ' }, openingSize: [6, 6] }];
  doc.entities.push({ id: 'health', kind: 'pickup', type: 'health', roomId: 'branch', position: [0, 0, 0] });
  const model = new EditorDocument(); model.restoreDraft(doc); const before = JSON.stringify(model.document);
  model.connectFaces('branch', 'positiveZ', 'room-1', 'negativeZ', { mode: 'snap' }); aligned(model);
  assert.deepEqual(model.room('room-1').position, [0, 0, 0]); assert.deepEqual(model.room('branch').position, [2, 0, -16]); assert.deepEqual(model.room('tail').position, [2, 0, -32]); assert.deepEqual(model.content('health').position, [0, 0, 0]);
  model.undo(); assert.equal(JSON.stringify(model.document), before);
});

test('door creation provides an accessible near-spawn relay, matching full-size collision and one-command undo', () => {
  const { model, side } = multipleFixture(), link = model.connectFaces(side, 'positiveZ', 'room-1', 'negativeZ', { full: true });
  const before = model.export(), history = model.past.length, relay = model.createRelayDoor(link); aligned(model);
  assert.equal(model.past.length, history + 1); assert(model.document.mission.requiredDeviceIds.includes(relay)); assert.equal(model.document.doors[0].deviceId, relay);
  const level = compileLevelDocument(model.document), door = level.doors[0].solid, world = buildArena(level), state = new GameState();
  state.session.begin(); state.session.transition('playing'); const controller = new RelayController(level, world.group, world.colliders, state.session);
  assert.deepEqual(door.size, [15, 11, 1]); assert(v(level.devices[0].position).distanceTo(v(level.spawn)) <= 2.5);
  try { assert.equal(traceShot(v([4, 0, -6]), v([4, 0, -10]), { colliders: world.colliders, radius: 0.05 }).target.id, door.id); assert.equal(controller.tryActivate(v(level.spawn)).id, relay); assert.equal(traceShot(v([4, 0, -6]), v([4, 0, -10]), { colliders: world.colliders, radius: 0.05 }), null); }
  finally { controller.retire(); state.session.end(); disposeObject(world.group); }
  model.undo(); assert.equal(model.export(), before); atomic(model, () => model.createRelayDoor('missing'), /real connection/);
});

test('multiple-cutout decomposition preserves area, walls and the bounded per-face opening count', () => {
  const holes = [{ size: [6, 4], offset: [-7, 0] }, { size: [5, 3], offset: [0, 4] }, { size: [4, 6], offset: [7, -2] }], rectangles = [];
  wallOpenings(32, 16, holes, (u0, u1, v0, v1) => rectangles.push([u0, u1, v0, v1]));
  assert.equal(rectangles.reduce((sum, [u0, u1, v0, v1]) => sum + (u1 - u0) * (v1 - v0), 0), 32 * 16 - 6 * 4 - 5 * 3 - 4 * 6);
  for (const [u0, u1, v0, v1] of rectangles) { assert(u1 > u0 && v1 > v0); assert(!holes.some(({ size: [w, h], offset: [u, v] }) => (u0 + u1) / 2 > u - w / 2 && (u0 + u1) / 2 < u + w / 2 && (v0 + v1) / 2 > v - h / 2 && (v0 + v1) / 2 < v + h / 2)); }
  const doc = createDocument(); Object.assign(doc, { formatVersion: 7, devices: [], doors: [], mission: { ...doc.mission, type: 'relay-clear-and-exit', requiredDeviceIds: [] } }); doc.rooms[0].size = [128, 16, 16];
  for (let i = 0; i < 9; i++) { const x = -48 + i * 12, id = `small-${i}`; doc.rooms.push({ ...doc.rooms[0], id, size: [8, 8, 16], position: [x, 0, -16] }); doc.connections.push({ id: `link-${i}`, a: { roomId: 'room-1', port: 'negativeZ', offset: [x, 0] }, b: { roomId: id, port: 'positiveZ' }, openingSize: [6, 6] }); }
  const bad = validateLevelDocument(doc); assert.equal(bad.valid, false); assert(bad.errors.some(issue => issue.message.includes('at most 8')));
  doc.rooms.pop(); doc.connections.pop(); assert.equal(validateLevelDocument(doc).valid, true);
});

test('shaped corridor end caps support separate portals with real convex collision', () => {
  const doc = createDocument(); Object.assign(doc, { formatVersion: 7, devices: [], doors: [], mission: { ...doc.mission, type: 'relay-clear-and-exit', requiredDeviceIds: [] } }); Object.assign(doc.rooms[0], { prefab: 'offset-corridor', size: [32, 16, 32], endOffset: [8, 16] });
  for (const [index, x] of [-12, 0].entries()) { const id = `child-${index}`; doc.rooms.push({ ...doc.rooms[0], id, prefab: 'box-room', endOffset: undefined, size: [8, 8, 16], position: [x, -8, 24] }); doc.connections.push({ id: `link-${index}`, a: { roomId: 'room-1', port: 'positiveZ', offset: [x + 4, 0] }, b: { roomId: id, port: 'negativeZ' }, openingSize: [7, 7] }); }
  for (const room of doc.rooms) if (room.prefab === 'box-room') delete room.endOffset;
  const level = compileLevelDocument(doc), world = buildArena(level);
  try { for (const x of [-12, 0]) assert.equal(traceShot(v([x, -8, 14]), v([x, -8, 18]), { colliders: world.colliders, radius: 0.5 }), null); }
  finally { disposeObject(world.group); }
  assert.throws(() => faceOverlap(doc.rooms[0], 'positiveX', doc.rooms[1], 'negativeX'), /rectangular/);
});

test('right-click attachment can add a smaller room on another area of the same large wall', () => {
  const model = new EditorDocument(); model.resizeRoom('room-1', [32, 16, 16]); model.attachAt('room-1', 'negativeZ', [-8, 0, -8], 'straight-corridor');
  const before = model.export(), history = model.past.length;
  const id = model.attachAt('room-1', 'negativeZ', [8, 0, -8], 'box-room'); aligned(model);
  assert.deepEqual(model.room(id).position, [8, 0, -16]); assert.equal(model.document.formatVersion, 7); assert.equal(model.past.length, history + 1);
  model.fitOpening('connection-2'); assert.deepEqual(model.document.connections[1].openingSize, [15, 11]);
  model.undo(); model.undo(); assert.equal(model.export(), before);
  atomic(model, () => model.attachAt('room-1', 'negativeZ', [-8, 0, -8], 'box-room'), /overlap/);
});
