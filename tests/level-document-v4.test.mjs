import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Euler, Mesh, Quaternion, Vector3 } from 'three';
import EditorDocument, { createDocument } from '../src/js/editor/EditorDocument.js';
import { faceLabel, snappedAngles, toLocal } from '../src/js/editor/EditorPicking.js';
import { FACES } from '../src/js/core/levels/document/LevelContent.js';
import { openingFrame, orient, portFrame, toWorld, worldSize } from '../src/js/core/levels/document/RoomMath.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import GameSession from '../src/js/core/GameSession.js';
import RelayController from '../src/js/core/RelayController.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import disposeObject from '../src/js/utils/disposeObject.js';

const angles = [0, 90, 180, 270];
const rotation = room => new Quaternion().setFromEuler(new Euler((room.pitch ?? 0) * Math.PI / 180, room.yaw * Math.PI / 180, (room.roll ?? 0) * Math.PI / 180, 'YXZ'));

test('all quarter-turn orientations share exact math, inverse picking, rendered bounds and spawn heading', () => {
  for (const yaw of angles) for (const pitch of angles) for (const roll of angles) {
    const model = new EditorDocument(); model.updateRoom('room-1', { position: [3, -2, 1], size: [16, 12, 20], yaw, pitch, roll });
    const room = model.room('room-1'), quaternion = rotation(room);
    const point = [2, -1, 3], world = toWorld(room, point);
    assert(new Vector3(...orient(point, room)).distanceTo(new Vector3(...point).applyQuaternion(quaternion)) < 1e-12);
    assert.deepEqual(toLocal(room, world), point);
    assert.deepEqual(snappedAngles(quaternion, room), { yaw, pitch, roll }, 'gimbal-equivalent orientation retains authored angles');
    assert.deepEqual(snappedAngles(new Quaternion(...quaternion.toArray().map(value => -value)), room), { yaw, pitch, roll });
    for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
      const changed = new Quaternion().setFromAxisAngle(axis, Math.PI / 2).multiply(quaternion);
      assert(Math.abs(rotation(snappedAngles(changed, room)).dot(changed)) > 1 - 1e-12, 'world-axis gizmo snap preserves actual orientation');
    }
    for (const face of FACES) {
      const frame = portFrame(room, face);
      assert.equal(frame.normal.filter(value => value !== 0).length, 1);
      assert.equal(Math.abs(frame.direction), 1);
      assert.equal(frame.center[frame.axis], room.position[frame.axis] + frame.direction * worldSize(room)[frame.axis] / 2);
    }
    model.updateContent('@spawn', 'room-1', model.document.playerSpawn.position, false, 90);
    const level = compileLevelDocument(model.document), arena = buildArena(level);
    try {
      assert(new Quaternion(...level.spawnRotation).angleTo(quaternion.clone().multiply(rotation({ yaw: 90 }))) < 1e-7);
      assert.deepEqual(level.spawn, toWorld(room, model.document.playerSpawn.position));
      const bounds = new Map(arena.colliders.map(collider => [collider.id, collider.box]));
      arena.group.traverse(object => {
        if (object instanceof Mesh && bounds.has(object.name)) assert(new Box3().setFromObject(object).equals(bounds.get(object.name)));
      });
    } finally { disposeObject(arena.group); }
  }
});

test('corridor attachment follows all six world normals from every room orientation', () => {
  for (const yaw of angles) for (const pitch of angles) for (const roll of angles) for (const face of FACES) {
    const model = new EditorDocument(); model.updateRoom('room-1', { yaw, pitch, roll });
    const source = portFrame(model.room('room-1'), face), id = model.attachRoom('room-1', face, 'straight-corridor');
    const corridor = model.room(id), connection = model.document.connections[0], end = portFrame(corridor, connection.b.port);
    assert.equal(portFrame(corridor, 'positiveZ').axis, source.axis, 'long local Z axis follows attachment normal');
    assert.deepEqual(source.center, end.center);
    assert(source.normal.every((value, axis) => value === -end.normal[axis]));
    assert.equal(worldSize(corridor)[source.axis], 16);
    assert.equal(model.validation.valid, true);
  }
});

for (const face of ['negativeY', 'positiveY']) test(`vertical three-space route: visible hatches, collision, shots, navigation and relay door (${face})`, () => {
  const model = new EditorDocument(), shaft = model.attachRoom('room-1', face, 'straight-corridor');
  assert.equal(model.document.formatVersion, 4);
  const onward = FACES.find(port => portFrame(model.room(shaft), port).normal[1] === (face === 'positiveY' ? 1 : -1));
  const last = model.attachRoom(shaft, onward, 'box-room');
  const relay = model.addContent('room-1', 'relay', 'relay', [0, 0, 0]);
  model.setDoor('connection-1', relay);
  model.setSurface(shaft, 'positiveX', 0x887766, 'panels');
  model.anchorOpening('connection-2', 4, 4, 'top-right');
  assert.equal(model.document.formatVersion, 4, 'v3 editing operations preserve v4');
  const level = compileLevelDocument(model.document), world = buildArena(level), session = new GameSession();
  session.begin(); session.transition('playing');
  const controller = new RelayController(level, world.group, world.colliders, session);
  try {
    for (const connection of model.document.connections) {
      const frame = openingFrame(model.room(connection.a.roomId), connection.a), center = new Vector3(...frame.center), normal = new Vector3(...frame.normal);
      const start = center.clone().addScaledVector(normal, -2), end = center.clone().addScaledVector(normal, 2);
      if (connection.id === 'connection-1') {
        assert.equal(traceShot(start, end, { colliders: world.colliders })?.kind, 'wall');
        const position = start.clone(); moveSphere(position, normal.clone().multiplyScalar(4), 1, world.colliders);
        assert(position.distanceTo(end) > 2, 'closed hatch stops the player');
        assert.equal(controller.tryActivate(new Vector3(0, 0, 0))?.id, relay);
      }
      const position = start.clone(); moveSphere(position, normal.clone().multiplyScalar(4), 1, world.colliders);
      assert(position.distanceTo(end) < 1e-6, 'ship crosses actual floor/ceiling passage');
      assert.equal(traceShot(start, end, { colliders: world.colliders }), null);
      assert(new RoomNavigation(model.document).route(start, end, 0.5));
    }
    const shaftRoom = model.room(shaft), center = new Vector3(...shaftRoom.position);
    assert.equal(traceShot(center, center.clone().add(new Vector3(6, 0, 0)), { colliders: world.colliders })?.kind, 'wall', 'shaft side remains solid');
    const route = new RoomNavigation(model.document).route(new Vector3(0, 0, 0), new Vector3(...model.room(last).position), 0.5);
    assert(route && route.length >= 5, 'AI route crosses both vertical portals');
    const imported = new EditorDocument(); imported.import(model.export());
    assert.equal(imported.export(), model.export()); assert.deepEqual(compileLevelDocument(imported.document).solids, level.solids);
  } finally { controller.retire(); session.end(); disposeObject(world.group); }
});

test('vertical click attachment, world-facing labels and duplication preserve local authoring', () => {
  const model = new EditorDocument(), shaft = model.attachAt('room-1', 'negativeY', [2, -6, -1], 'straight-corridor');
  const room = model.room(shaft);
  assert.deepEqual(room.position, [2, -14, -1]);
  assert.equal(faceLabel(room, 'negativeZ'), 'Ceiling');
  assert.equal(faceLabel(room, 'positiveZ'), 'Floor');
  model.placeAt(shaft, [0, 0, 0], 'health'); model.setSurface(shaft, 'negativeZ', 0x123456, 'hazard');
  const duplicate = model.duplicateRoom(shaft, 'positiveX');
  assert.equal(model.room(duplicate).pitch, 90);
  assert.deepEqual(model.room(duplicate).surfaces, model.room(shaft).surfaces);
  const original = model.document.entities.find(entity => entity.roomId === shaft), copied = model.document.entities.find(entity => entity.roomId === duplicate);
  assert(original && copied && original.id !== copied.id); assert.deepEqual(copied.position, original.position);
  assert.equal(model.validation.valid, true);
});

test('legacy formats retain their bytes; orientation upgrades and undo/recovery are bounded and transactional', () => {
  const model = new EditorDocument(), before = model.export();
  model.updateRoom('room-1', { pitch: 0, roll: 0 }); assert.equal(model.export(), before); assert.equal(model.past.length, 0);
  model.updateRoom('room-1', { pitch: 270, roll: 90 }); assert.equal(model.document.formatVersion, 4);
  const after = model.export(); model.undo(); assert.equal(model.export(), before); model.redo(); assert.equal(model.export(), after);
  const imported = new EditorDocument(); imported.import(after); assert.equal(imported.export(), after);
  imported.attachRoom('room-1', 'negativeZ', 'box-room');
  imported.updateRoom('room-2', { pitch: 90 }); assert.equal(imported.validation.valid, false);
  const recovered = new EditorDocument(); recovered.restoreDraft(imported.document); assert.deepEqual(recovered.document, imported.document);
  assert.throws(() => recovered.export(), /ports/);
  for (const formatVersion of [1, 2, 3]) {
    const input = JSON.parse(after); input.formatVersion = formatVersion;
    assert.equal(validateLevelDocument(input).valid, false, 'pitch/roll fields are gated by version');
  }
  for (const value of [45, -90, 360, NaN, null, '90']) for (const axis of ['pitch', 'roll']) {
    const input = JSON.parse(after); input.rooms[0][axis] = value;
    assert.equal(validateLevelDocument(input).valid, false);
  }
  for (const values of [{ pitch: 45 }, { roll: -90 }, { pitch: NaN }, { roll: 360 }]) {
    assert.throws(() => model.updateRoom('room-1', values), /Yaw, pitch and roll/); assert.equal(model.export(), after);
  }
  const input = createDocument(); input.formatVersion = 9; assert.equal(validateLevelDocument(input).valid, false);
});
