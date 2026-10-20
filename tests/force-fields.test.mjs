import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import { validateLevelDocument, parseLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import RelayController from '../src/js/core/RelayController.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import GameState from '../src/js/core/GameState.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import { traceShot, hasLineOfSight } from '../src/js/utils/combatTrace.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { campaignDocuments } from '../src/js/core/levels/Campaign.js';
import ExplorationMap, { drawExploration } from '../src/js/core/ExplorationMap.js';

const v = (...xyz) => new THREE.Vector3(...xyz);
function modelFor(face = 'negativeZ') {
  const model = new EditorDocument(), room = model.attachRoom('room-1', face, 'box-room');
  model.updateContent('@spawn', 'room-1', [0, 0, 3], false); model.updateContent('exit-1', room, [0, 0, 0], false);
  const relay = model.addContent('room-1', 'relay', '', [2, 0, 3]);
  model.setDoor('connection-1', relay, { forceField: true }); return model;
}
function fixture(t, face = 'negativeZ') {
  const model = modelFor(face), level = compileLevelDocument(model.document), world = buildArena(level);
  const state = new GameState(); state.session.begin(); state.session.transition('playing'); state.weaponInventory.pulse.ammo = 10;
  const controller = new RelayController(level, world.group, world.colliders, state.session);
  t.after(() => { controller.retire(); state.session.end(); disposeObject(world.group); });
  return { model, level, world, state, controller };
}

test('v11 fields round-trip and reject old versions, shot activation, concealment and invalid kinds', () => {
  const model = modelFor(), input = JSON.parse(model.export());
  assert.equal(parseLevelDocument(model.export()).doors[0].kind, 'force-field');
  assert(Object.isFrozen(validateLevelDocument(input).document.doors[0]));
  for (const mutate of [d => d.formatVersion = 10, d => d.doors[0].kind = 'energy', d => d.doors[0].concealed = true,
    d => { delete d.doors[0].deviceId; d.doors[0].activation = 'shot'; }, d => delete d.doors[0].deviceId]) {
    const bad = structuredClone(input); mutate(bad); assert.equal(validateLevelDocument(bad).valid, false);
  }
  assert.equal(input.doors[0].kind, 'force-field');
});

for (const face of ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']) {
  test(`field on ${face} blocks bodies, shots, sight and routes from either side, then clears immediately`, t => {
    const { level, world, controller } = fixture(t, face), door = level.doors[0];
    const a = v(...level.sourceDocument.rooms[0].position), b = v(...level.sourceDocument.rooms[1].position);
    const nav = new RoomNavigation(level.sourceDocument), membrane = world.group.getObjectByName(door.id).children.find(child => child.material instanceof THREE.ShaderMaterial);
    assert.equal(controller.slides.length, 0);
    // The rendered surface must lie on the collision plane for vertical hatches too.
    const box = new THREE.Box3().setFromObject(membrane), axis = door.normalAxis;
    assert(Math.abs(box.getCenter(v()).getComponent(axis) - door.solid.center[axis]) < 1e-6);
    assert(box.getSize(v()).getComponent(axis) < 1e-6);
    assert.equal(nav.route(a, b, 0.5, controller.closedConnections), null);
    for (const [start, end] of [[a, b], [b, a]]) {
      assert.equal(traceShot(start, end, { colliders: world.colliders }).target.id, door.id);
      assert.equal(hasLineOfSight(start, end, world.colliders), false);
      const position = start.clone(); assert(moveSphere(position, end.clone().sub(start), 1, world.colliders, 0.5).collided);
    }
    assert.equal(controller.tryActivate(v(5, 0, 3)), null, 'remote control is out of reach');
    assert(controller.tryActivate(v(0, 0, 3))); assert.equal(controller.revision, 1);
    assert.equal(world.group.getObjectByName(door.id).visible, false); assert.equal(controller.closedConnections.size, 0);
    assert(nav.route(a, b, 0.5, controller.closedConnections));
    for (const [start, end] of [[a, b], [b, a]]) {
      assert.equal(traceShot(start, end, { colliders: world.colliders }), null);
      const position = start.clone(); assert.equal(moveSphere(position, end.clone().sub(start), 1, world.colliders, 0.5).collided, false);
    }
    assert.equal(controller.tryActivate(v(0, 0, 3)), null);
  });
}

test('real player and enemy projectiles are absorbed without opening the field or damaging a ship behind it', t => {
  const { level, world, state, controller } = fixture(t), scene = new THREE.Scene(), player = new THREE.Group();
  player.position.fromArray(level.spawn); scene.add(world.group, player);
  const shots = new ProjectileManager(scene, player, null, state.session); shots.setCanvas({}); t.after(() => shots.dispose());
  let hits = 0;
  shots.setCombatWorld({ getColliders: () => world.colliders, getRules: () => level.combat,
    onWallHit: collider => { hits++; assert.equal(controller.hitDoor(collider), null); } });
  shots.fireProjectile(state, { requirePointerLock: false }); const spent = shots.projectiles[0];
  const enemy = new THREE.Group(); enemy.position.set(0, 0, -12);
  shots.fireEnemyProjectile({ mesh: enemy, type: { name: 'fighter', size: 0.6, damage: 10, color: 0xff6600 } }, player);
  for (let i = 0; i < 100; i++) { state.session.advance(1 / 60); controller.update(1 / 60); shots.updateProjectiles(1 / 60, player, state); }
  assert.equal(shots.isProjectileActive(spent), false); assert.equal(hits, 1); assert.equal(state.weaponInventory.pulse.ammo, 9);
  assert.equal(controller.closedConnections.size, 1); assert.equal(state.playerHealth, 100); assert.equal(state.score, 0);
});

test('pause, retirement and stale sessions freeze shimmer and controls; a rebuilt attempt restores the field', t => {
  const { level, world, state, controller } = fixture(t), material = controller.fieldMaterials[0];
  controller.update(0.2); assert.equal(material.uniforms.time.value, 0.2);
  state.session.transition('paused'); controller.update(1); assert.equal(material.uniforms.time.value, 0.2);
  assert.equal(controller.tryActivate(v(0, 0, 3)), null);
  state.session.transition('playing'); controller.update(0.1); assert(Math.abs(material.uniforms.time.value - 0.3) < 1e-10);
  controller.retire(); controller.update(1); assert.equal(controller.tryActivate(v(0, 0, 3)), null);
  const stale = new RelayController(level, world.group, world.colliders, state.session);
  state.session.end(); state.session.begin(); state.session.transition('playing'); assert.equal(stale.tryActivate(v(0, 0, 3)), null);
  const freshWorld = buildArena(level), fresh = new RelayController(level, freshWorld.group, freshWorld.colliders, state.session);
  t.after(() => disposeObject(freshWorld.group));
  assert.equal(fresh.fieldMaterials[0].uniforms.time.value, 0); assert.equal(fresh.closedConnections.size, 1);
  assert(fresh.tryActivate(v(0, 0, 3))); assert.equal(fresh.closedConnections.size, 0);
});

test('editor rejects self-locked field controls atomically and preserves v11 through escape and surface edits', () => {
  const model = modelFor(), relay = model.document.devices[0].id, saved = model.export();
  const inaccessible = model.addContent('room-2', 'relay', '', [3, 0, 3]); const before = model.export(), history = model.past.length;
  assert.throws(() => model.checked(candidate => candidate.setDoor('connection-1', inaccessible, { forceField: true })));
  assert.equal(model.export(), before); assert.equal(model.past.length, history); model.undo(); assert.equal(model.export(), saved);
  assert.throws(() => model.setDoor('connection-1', '@shot')); assert.equal(model.export(), saved);
  model.setEscape(relay, 30); assert.equal(model.document.formatVersion, 11); assert.equal(model.validation.valid, true);
  model.setSurface('room-1', 'negativeY', 0xff5511, 'lava'); assert.equal(model.document.formatVersion, 11);
  model.deleteContent(relay); assert.equal(model.document.mission.escape, undefined); model.undo(); assert(model.document.mission.escape);
  model.setEscape(''); assert.equal(model.document.formatVersion, 11); model.undo(); assert(model.document.mission.escape);
  model.setDoor('connection-1', relay, { forceField: false, concealed: true }); assert.equal(model.document.doors[0].kind, undefined);
  model.undo(); assert.equal(model.document.doors[0].kind, 'force-field');
});

test('Vector Foundry includes a valid relay-controlled lift field without changing its extraction door', () => {
  const doc = campaignDocuments[1]; assert.equal(validateLevelDocument(doc).valid, true); assert.equal(doc.formatVersion, 11);
  assert.equal(doc.doors.find(d => d.id === 'lift-door').kind, 'force-field');
  assert.equal(doc.doors.find(d => d.id === 'extraction-door').kind, undefined);
});

test('map reveals field boundaries and controls only beside visited rooms, and changes their state after shutdown', () => {
  const model = modelFor(), third = model.attachRoom('room-2', 'negativeZ', 'box-room');
  model.updateContent('exit-1', third, [0, 0, 0], false);
  const second = model.addContent('room-2', 'relay', '', [3, 0, 3]); model.setDoor('connection-2', second, { forceField: true });
  const map = new ExplorationMap(parseLevelDocument(model.export())), closed = new Set(['connection-1', 'connection-2']); map.update(v(0, 0, 3));
  const labels = [], colors = [], ctx = { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    stroke() { colors.push(this.strokeStyle); }, setLineDash() {}, arc() {}, fill() {}, fillText(text) { labels.push(text); } };
  const render = () => { labels.length = colors.length = 0; drawExploration(ctx, map, v(0, 0, 3), v(0, 0, -1), closed, 800, 500); };
  render(); assert.deepEqual(labels, [model.document.devices[0].label]); assert.equal(colors.filter(c => c === '#65f4ff').length, 3);
  closed.delete('connection-1'); render(); assert.equal(colors.filter(c => c === '#45ff96').length, 3);
  map.update(v(...model.document.rooms[1].position)); render(); assert.equal(labels.length, 2); assert.equal(colors.filter(c => c === '#65f4ff').length, 3);
});
