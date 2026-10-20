import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import { validateLevelDocument, serializeLevelDocument, parseLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import RelayController from '../src/js/core/RelayController.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import GameState from '../src/js/core/GameState.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { DOOR_OPEN_SECONDS } from '../src/js/core/SlidingDoor.js';

const v = (...xyz) => new THREE.Vector3(...xyz);
function modelFor(face = 'negativeZ', concealed = false) {
  const model = new EditorDocument(), room = model.attachRoom('room-1', face, 'box-room');
  model.updateContent('@spawn', 'room-1', [0, 0, 3], false);
  model.updateContent('exit-1', room, [0, 0, 0], false);
  model.setDoor(model.document.connections[0].id, '@shot', { sliding: true, concealed });
  return model;
}
function fixture(t, face = 'negativeZ', concealed = false) {
  const model = modelFor(face, concealed), level = compileLevelDocument(model.document), world = buildArena(level);
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  state.weaponInventory.pulse.ammo = 10;
  const controller = new RelayController(level, world.group, world.colliders, state.session);
  const scene = new THREE.Scene(), player = new THREE.Group(); player.position.fromArray(level.spawn); scene.add(world.group, player);
  const shots = new ProjectileManager(scene, player, null, state.session); shots.setCanvas({});
  let hits = 0;
  shots.setCombatWorld({ getColliders: () => world.colliders, getRules: () => level.combat,
    onWallHit: collider => { hits++; controller.hitDoor(collider); } });
  t.after(() => { controller.retire(); state.session.end(); shots.dispose(); disposeObject(world.group); });
  const tick = (delta = 1 / 60) => { state.session.advance(delta); controller.update(delta); shots.updateProjectiles(delta, player, state); };
  return { model, level, world, state, controller, player, shots, tick, hits: () => hits };
}

test('v8 shot/hidden doors round-trip immutably and reject ambiguous controls or old-format fields', () => {
  const model = modelFor('negativeZ', true), input = JSON.parse(model.export());
  const validated = parseLevelDocument(serializeLevelDocument(input));
  assert.equal(validated.formatVersion, 8); assert.deepEqual(validated.doors[0], input.doors[0]);
  assert(Object.isFrozen(validated.doors[0]));
  for (const mutate of [doc => doc.formatVersion = 7, doc => doc.doors[0].activation = 'touch',
    doc => doc.doors[0].deviceId = 'relay-1', doc => doc.doors[0].concealed = 'yes', doc => delete doc.doors[0].activation,
    doc => doc.doors[0].connectionId = 'missing', doc => doc.doors.push({ ...doc.doors[0], id: 'duplicate-door' })]) {
    const bad = structuredClone(input); mutate(bad); assert.equal(validateLevelDocument(bad).valid, false);
  }
});

test('progression solves a reachable shot door without treating a self-locked relay as reachable', () => {
  const model = modelFor(), relay = model.addContent('room-2', 'relay', '', [3, 0, 3]);
  assert.equal(model.validation.valid, true);
  model.setDoor('connection-1', relay, { sliding: true });
  assert.equal(model.validation.valid, false);
  model.setDoor('connection-1', '@shot'); assert.equal(model.validation.valid, true);
});

for (const face of ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']) {
  test(`sliding ${face} door keeps both panels/colliders aligned, blocks while closed and clears both directions`, t => {
    const { world, controller, level } = fixture(t, face), slide = controller.slides[0];
    const navigation = new RoomNavigation(level.sourceDocument), a = v(...level.sourceDocument.rooms[0].position), b = v(...level.sourceDocument.rooms[1].position);
    assert.equal(navigation.route(a, b, 0.5, controller.closedConnections), null);
    for (const [start, end] of [[a, b], [b, a]]) {
      assert(traceShot(start, end, { colliders: world.colliders }));
      const position = start.clone(); assert(moveSphere(position, end.clone().sub(start), 1, world.colliders, 0.5).collided);
    }
    assert(controller.hitDoor(slide.panels[0].collider));
    assert.equal(controller.hitDoor(slide.panels[1].collider), null);
    controller.update(DOOR_OPEN_SECONDS / 4); world.group.updateMatrixWorld(true);
    for (const panel of slide.panels) {
      const box = new THREE.Box3().setFromBufferAttribute(panel.mesh.geometry.getAttribute('position')).applyMatrix4(panel.mesh.matrixWorld);
      assert(box.min.distanceTo(panel.collider.box.min) < 1e-6 && box.max.distanceTo(panel.collider.box.max) < 1e-6);
      assert(panel.mesh.position.distanceTo(panel.origin) > 0);
    }
    assert(controller.closedConnections.has('connection-1'));
    controller.update(DOOR_OPEN_SECONDS);
    assert.equal(controller.closedConnections.size, 0); assert.equal(controller.revision, 1);
    assert(navigation.route(a, b, 0.5, controller.closedConnections));
    for (const panel of slide.panels) { assert.equal(panel.mesh.visible, false); assert.equal(world.colliders.includes(panel.collider), false); }
    for (const [start, end] of [[a, b], [b, a]]) assert.equal(traceShot(start, end, { colliders: world.colliders }), null);
    controller.update(100); assert.equal(controller.revision, 1);
  });
}

test('real player shots spend ammo, stop at the first wall and trigger a door only once', t => {
  const { shots, tick, controller, state, hits, player } = fixture(t);
  player.position.set(5, 0, 3); shots.fireProjectile(state, { requirePointerLock: false });
  for (let i = 0; i < 40; i++) tick();
  assert.equal(controller.slides[0].elapsed, -1, 'an ordinary wall cannot activate the nearby door');
  assert.equal(hits(), 1);
  player.position.x = 0; shots.fireProjectile(state, { requirePointerLock: false });
  const spent = shots.projectiles[0];
  for (let i = 0; i < 100; i++) tick();
  assert.equal(state.weaponInventory.pulse.ammo, 8); assert.equal(controller.closedConnections.size, 0);
  assert.equal(shots.isProjectileActive(spent), false); assert.equal(shots.moveProjectile(spent, 1), true);
  assert.equal(hits(), 2); assert.equal(controller.revision, 1); assert.equal(state.score, 0);
});

test('hostile shots cannot open doors; pause, retirement and stale sessions freeze door motion', t => {
  const { shots, player, tick, controller, world, state, hits } = fixture(t);
  const mesh = new THREE.Group(); mesh.position.set(0, 0, -12);
  shots.fireEnemyProjectile({ mesh, type: { name: 'fighter', size: 0.6, damage: 10, color: 0xff6600 } }, player);
  for (let i = 0; i < 100; i++) tick();
  assert.equal(hits(), 0); assert.equal(controller.slides[0].elapsed, -1); assert.equal(state.playerHealth, 100);
  const collider = controller.slides[0].panels[0].collider;
  assert.equal(controller.hitDoor({ ...collider }), null, 'a foreign collider with the same id has no authority');
  state.session.transition('paused'); assert.equal(controller.hitDoor(collider), null);
  state.session.transition('playing'); controller.hitDoor(collider); controller.update(0.1);
  const box = collider.box.clone(); state.session.transition('paused'); controller.update(1); assert(box.equals(collider.box));
  state.session.transition('playing'); controller.retire(); controller.update(1); assert(box.equals(collider.box));
  const stale = new RelayController(compileLevelDocument(modelFor().document), world.group, world.colliders, state.session);
  state.session.end(); state.session.begin(); state.session.transition('playing');
  assert.equal(stale.hitDoor(collider), null); stale.update(1); assert(box.equals(collider.box));
});

test('hidden faces use their own room colors and world UVs without shot lights', t => {
  const { model } = fixture(t, 'negativeZ', true);
  model.setSurface('room-1', 'negativeZ', 0x234567, 'panels'); model.setSurface('room-2', 'positiveZ', 0x345678, 'grid');
  const level = compileLevelDocument(model.document), world = buildArena(level), door = level.doors[0];
  t.after(() => disposeObject(world.group));
  assert.equal(door.solid.color, 0x234567); assert.equal(door.reverseStyle.color, 0x345678);
  const panel = world.group.getObjectByName(`${door.id}:-1`);
  assert.equal(panel.material[4].color.getHex(), 0x234567); assert.equal(panel.material[5].color.getHex(), 0x345678);
  assert.equal(panel.children.length, 1, 'the narrow seam is the only concealed decoration');
  const point = panel.geometry.getAttribute('position'), uv = panel.geometry.getAttribute('uv');
  assert.equal(uv.getX(0), (point.getX(0) + panel.position.x + door.solid.center[0]) / 4);
});

test('editor door controls undo atomically, retain v8 through opening edits, and preserve a hidden door on resize', () => {
  const model = modelFor('negativeZ', true), saved = model.export(), doorId = model.document.doors[0].id;
  model.setDoor('connection-1', ''); assert.equal(model.document.doors.length, 0); model.undo(); assert.equal(model.export(), saved);
  model.redo(); assert.equal(model.document.doors.length, 0); model.undo();
  model.fitOpening('connection-1'); assert.equal(model.document.formatVersion, 8);
  model.updateOpening('connection-1', 6, 6, [0, 0]);
  assert.equal(model.document.doors[0].id, doorId); assert.equal(model.document.doors[0].concealed, true);
  model.setDoor('connection-1', '@shot'); assert.equal(model.document.doors[0].concealed, true);
  const loaded = new EditorDocument(parseLevelDocument(model.export())); assert.equal(loaded.export(), model.export());
  const marked = new EditorDocument(); marked.attachRoom('room-1', 'negativeZ', 'box-room');
  const relay = marked.addContent('room-1', 'relay', '', [3, 0, 3]); marked.setDoor('connection-1', relay, { concealed: false });
  assert.equal(marked.document.formatVersion, 8); assert.equal(marked.validation.valid, true);
});

test('imported door ids that resemble panel names retain independent mesh ownership', t => {
  const model = modelFor(), room = model.attachRoom('room-2', 'positiveX', 'box-room');
  model.updateContent('exit-1', room, [0, 0, 0], false); model.setDoor('connection-2', '@shot');
  model.addContent('room-1', 'relay', '', [3, 0, 3]);
  const input = JSON.parse(model.export()); input.doors[0].id = 'door:-1'; input.doors[1].id = 'door';
  input.devices[0].id = 'door:1'; input.mission.requiredDeviceIds = ['door:1'];
  const level = compileLevelDocument(input), world = buildArena(level), state = new GameState();
  state.session.begin(); state.session.transition('playing');
  const controller = new RelayController(level, world.group, world.colliders, state.session);
  t.after(() => { controller.retire(); state.session.end(); disposeObject(world.group); });
  for (const slide of controller.slides) for (const panel of slide.panels) {
    assert(panel.mesh instanceof THREE.Mesh); assert.equal(panel.mesh.parent.name, slide.door.id);
  }
  const stationary = world.group.children.find(object => object.name === 'door:-1').position.clone();
  controller.hitDoor(controller.slides[1].panels[0].collider); controller.update(1);
  assert(world.group.children.find(object => object.name === 'door:-1').position.equals(stationary));
  assert.equal(controller.closedConnections.size, 1);
  assert.equal(controller.tryActivate(v(3, 0, 3)).id, 'door:1');
  assert.equal(world.group.children.find(object => object.name === 'door:1').material.color.getHex(), 0x45ff96);
});
