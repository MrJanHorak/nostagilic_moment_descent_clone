import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, Mesh, Box3 } from 'three';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { FACES } from '../src/js/core/levels/document/LevelContent.js';
import { openingFrame, portFrame } from '../src/js/core/levels/document/RoomMath.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import RelayController from '../src/js/core/RelayController.js';
import GameSession from '../src/js/core/GameSession.js';

for (const yaw of [0, 90, 180, 270]) for (const face of FACES) {
  test(`v3 corner opening shares visible walls, sphere collision, shots and AI route: ${yaw}/${face}`, () => {
    const model = new EditorDocument(); model.updateRoom('room-1', { yaw });
    const next = model.attachRoom('room-1', face, 'box-room'), id = model.document.connections[0].id;
    model.anchorOpening(id, 4, 4, 'top-right');
    assert.equal(model.document.formatVersion, 3); assert.equal(model.validation.valid, true);
    const connection = model.document.connections[0], frame = openingFrame(model.room('room-1'), connection.a);
    assert.deepEqual(openingFrame(model.room(next), connection.b).center, frame.center);
    assert.notDeepEqual(frame.center, portFrame(model.room('room-1'), face).center);
    const level = compileLevelDocument(model.document), world = buildArena(level);
    try {
      const normal = new Vector3(...frame.normal), center = new Vector3(...frame.center);
      const start = center.clone().addScaledVector(normal, -2), end = center.clone().addScaledVector(normal, 2);
      const position = start.clone(); moveSphere(position, normal.clone().multiplyScalar(4), 1, world.colliders, 0.5);
      assert(position.distanceTo(end) < 1e-6, 'ship crosses shifted opening');
      assert.equal(traceShot(start, end, { colliders: world.colliders }), null);
      const oldCenter = new Vector3(...portFrame(model.room('room-1'), face).center);
      const blockedStart = oldCenter.clone().addScaledVector(normal, -2), blockedEnd = oldCenter.clone().addScaledVector(normal, 2);
      assert.equal(traceShot(blockedStart, blockedEnd, { colliders: world.colliders })?.kind, 'wall', 'old centered opening is closed');
      const route = new RoomNavigation(model.document).route(start, end, 0.5);
      assert(route && route[1].clone().sub(center).cross(normal).length() < 1e-6, 'AI approaches the shifted opening center');
      const bounds = new Map(world.colliders.map(collider => [collider.id, collider.box]));
      world.group.traverse(object => {
        if (object instanceof Mesh && bounds.has(object.name)) assert(new Box3().setFromObject(object).equals(bounds.get(object.name)), 'visible solid and collider agree');
      });
    } finally { disposeObject(world.group); }
    const reloaded = new EditorDocument(); reloaded.import(model.export()); assert.equal(reloaded.export(), model.export());
  });
}

test('offset validation rejects mismatched sides, off-grid, oversized and legacy offsets', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.anchorOpening('connection-1', 4, 4, 'top-left');
  const original = model.export();
  for (const mutate of [
    document => { document.connections[0].b.offset[0] += 0.5; },
    document => { document.connections[0].a.offset[0] = 0.1; },
    document => { document.connections[0].a.offset[0] = 32; document.connections[0].b.offset[0] = 32; },
    document => { document.connections[0].a.offset = [0]; },
    document => { document.formatVersion = 2; },
  ]) { const input = JSON.parse(original); mutate(input); assert.equal(validateLevelDocument(input).valid, false); }
  assert.throws(() => model.updateOpening('connection-1', 6, 6, [20, 0]), /inside both/);
  assert.equal(model.export(), original, 'rejected editing operation is atomic');
});

test('an offset corridor can meet a high corner of a larger room with different endpoint offsets', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'straight-corridor');
  model.updateRoom('room-2', { position: [4, 2, -16] });
  assert.equal(model.validation.valid, false);
  model.anchorOpening('connection-1', 6, 6, 'top-right');
  assert.equal(model.validation.valid, true);
  const connection = model.document.connections[0];
  assert.deepEqual(connection.a.offset, [4, 2]); assert.deepEqual(connection.b.offset, [0, 0]);
  assert.deepEqual(openingFrame(model.room('room-1'), connection.a).center, openingFrame(model.room('room-2'), connection.b).center);
});

test('relay door collider and mesh occupy the shifted opening and retire with the world', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.anchorOpening('connection-1', 4, 4, 'bottom-right');
  const relay = model.addContent('room-1', 'relay', '', [0, 0, 0]); model.setDoor('connection-1', relay);
  const level = compileLevelDocument(model.document), world = buildArena(level), session = new GameSession();
  session.begin(); session.transition('playing'); const controller = new RelayController(level, world.group, world.colliders, session);
  try {
    const frame = openingFrame(model.room('room-1'), model.document.connections[0].a), normal = new Vector3(...frame.normal), center = new Vector3(...frame.center);
    const start = center.clone().addScaledVector(normal, -2), end = center.clone().addScaledVector(normal, 2);
    assert.equal(traceShot(start, end, { colliders: world.colliders })?.target.id, level.doors[0].id);
    assert.deepEqual(world.group.getObjectByName(level.doors[0].id).position.toArray(), frame.center);
    assert(controller.tryActivate(new Vector3(0, 0, 0)));
    assert.equal(traceShot(start, end, { colliders: world.colliders }), null);
  } finally { controller.retire(); session.end(); disposeObject(world.group); }
});

test('styles round trip by face and share bounded textures disposed once with the world', () => {
  const model = new EditorDocument(); model.setSurface('room-1', 'all', 0x3e80b0, 'grid');
  model.setSurface('room-1', 'negativeZ', 0xffa020, 'hazard');
  const level = compileLevelDocument(JSON.parse(model.export())), world = buildArena(level);
  const textures = new Set(), disposal = new Map();
  world.group.traverse(object => { if (object instanceof Mesh && object.material.map) textures.add(object.material.map); });
  assert.equal(textures.size, 2);
  for (const texture of textures) { disposal.set(texture, 0); texture.addEventListener('dispose', () => disposal.set(texture, disposal.get(texture) + 1)); }
  assert(level.solids.filter(solid => solid.id.includes('/negativeZ/')).every(solid => solid.pattern === 'hazard' && solid.color === 0xffa020));
  assert(level.solids.filter(solid => solid.id.includes('/positiveZ/')).every(solid => solid.pattern === 'grid' && solid.color === 0x3e80b0));
  disposeObject(world.group); assert([...disposal.values()].every(count => count === 1));
  const bad = JSON.parse(model.export()); bad.rooms[0].surfaces.negativeZ.image = 'https://example.com/file.png';
  assert.equal(validateLevelDocument(bad).valid, false);
  bad.rooms[0].surfaces.negativeZ = { color: -1, pattern: 'custom-script' }; assert.equal(validateLevelDocument(bad).valid, false);
  model.resetSurface('room-1', 'all'); assert.equal(model.document.rooms[0].surfaces, undefined);
});

test('content authoring maintains objective IDs, cascades relay doors, undo and legacy preservation', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  const enemy = model.addContent('room-2', 'enemy', 'scout', [0, 0, 0]);
  const pickup = model.addContent('room-1', 'pickup', 'pulseAmmo', [3, 0, 3]);
  const relay = model.addContent('room-1', 'relay', '', [0, 0, 0]); model.setDoor('connection-1', relay);
  model.updateContent('@spawn', 'room-1', [0, 0, 4], false, 90);
  model.updateContent('exit-1', 'room-2', [0, 0, -4], false);
  assert.equal(model.validation.valid, true);
  assert.deepEqual(model.document.mission.requiredEnemyIds, [enemy]);
  model.updateContent(enemy, 'room-2', [0, 0, 0], false); assert.deepEqual(model.document.mission.requiredEnemyIds, []);
  assert.throws(() => model.deleteContent('@spawn')); assert.throws(() => model.deleteContent('exit-1'));
  model.deleteContent(relay); assert.equal(model.document.doors.length, 0); assert.deepEqual(model.document.mission.requiredDeviceIds, []);
  assert.equal(model.validation.valid, true); model.undo(); assert.equal(model.document.doors.length, 1);
  model.deleteContent(pickup); assert(!model.document.entities.some(entity => entity.id === pickup));
  const legacy = readFileSync(new URL('../src/js/core/levels/documents/deep-relay.v2.json', import.meta.url), 'utf8');
  const old = new EditorDocument(); old.import(legacy); const before = old.export();
  old.setSurface(old.document.rooms[0].id, 'positiveY', 0x112233, 'panels');
  assert.equal(old.document.formatVersion, 3); assert.equal(old.validation.valid, true);
  old.undo(); assert.equal(old.export(), before, 'undo restores the exact v2 document');
});

test('v3 still rejects overlaps and impossible relay progression', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  const relay = model.addContent('room-2', 'relay', '', [0, 0, 0]); model.setDoor('connection-1', relay);
  assert.equal(model.validation.valid, false); assert(model.validation.errors.some(error => error.code === 'locked-route'));
  model.setDoor('connection-1', ''); model.updateRoom('room-2', { position: [0, 0, 0] });
  assert.equal(model.validation.valid, false); assert(model.validation.errors.some(error => error.code === 'overlap'));
});
