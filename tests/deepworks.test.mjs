import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import { validateLevelDocument, parseLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { openingFrame } from '../src/js/core/levels/document/RoomMath.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import RelayController from '../src/js/core/RelayController.js';
import MissionObjective from '../src/js/core/MissionObjective.js';
import GameState from '../src/js/core/GameState.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PortalVisibility from '../src/js/core/PortalVisibility.js';
import createCampaign from '../src/js/core/levels/Campaign.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import disposeObject from '../src/js/utils/disposeObject.js';

const v = (...p) => new THREE.Vector3(...p);
function reactorModel() {
  const model = new EditorDocument(), core = model.addContent('room-1', 'reactor', '', [0, 0, -3]);
  model.updateContent('@spawn', 'room-1', [0, 0, 3], false); model.updateContent('exit-1', 'room-1', [4, 0, 0], false); model.setReactorIntegrity(core, 20); model.setEscape(core, 10);
  return { model, core };
}
function coreFixture(t) {
  const { model, core } = reactorModel(), level = compileLevelDocument(model.document), world = buildArena(level), state = new GameState();
  state.session.begin(); state.session.transition('playing'); state.weaponInventory.pulse.ammo = 60;
  const controller = new RelayController(level, world.group, world.colliders, state.session), mission = new MissionObjective(level.mission);
  const player = new THREE.Group(), scene = new THREE.Scene(); player.position.fromArray(level.spawn); scene.add(player, world.group);
  const shots = new ProjectileManager(scene, player, null, state.session); shots.setCanvas({});
  let destroyed = 0;
  shots.setCombatWorld({ getColliders: () => world.colliders, getRules: () => level.combat, onWallHit: collider => {
    const hit = controller.hitReactor(collider, level.combat.pulseDamage, id => mission.canActivateDevice(id));
    if (hit?.destroyed) { destroyed++; mission.recordDeviceActivation(hit.id, state.session.timeMs); }
  } });
  const tick = () => { state.session.advance(1 / 60); shots.updateProjectiles(1 / 60, player, state); controller.update(1 / 60); };
  t.after(() => { shots.dispose(); controller.retire(); state.session.end(); disposeObject(world.group); });
  return { model, core, level, world, state, controller, mission, player, shots, tick, destroyed: () => destroyed };
}

test('reactor editor integrity/countdown round-trips, undoes atomically, and preserves v12 when adding a field', () => {
  const { model, core } = reactorModel(), saved = model.export(); assert.equal(parseLevelDocument(saved).devices[0].kind, 'reactor');
  model.setReactorIntegrity(core, 40); model.undo(); assert.equal(model.export(), saved); model.redo(); assert.equal(model.document.devices[0].health, 40);
  assert.throws(() => model.setReactorIntegrity(core, NaN)); assert.throws(() => model.setReactorIntegrity(core, 0));
  const next = model.attachRoom('room-1', 'negativeZ', 'box-room'); model.updateContent('exit-1', next, [0, 0, 0], false);
  model.setDoor('connection-1', core, { forceField: true }); assert.equal(model.document.formatVersion, 12); assert.equal(model.validation.valid, true);
  model.deleteContent(core); assert.equal(model.document.mission.escape, undefined); model.undo(); assert.equal(model.document.devices[0].kind, 'reactor');
});

test('v12 rejects reactor health/type fields in old formats and invalid integrity or ambiguous health-only relays', () => {
  const { model } = reactorModel(), valid = JSON.parse(model.export());
  for (const mutate of [d => d.formatVersion = 11, d => d.devices[0].health = 0, d => d.devices[0].health = 1001,
    d => d.devices[0].health = 10.5, d => delete d.devices[0].health, d => delete d.devices[0].kind, d => d.devices[0].kind = 'turret']) {
    const bad = structuredClone(valid); mutate(bad); assert.equal(validateLevelDocument(bad).valid, false);
  }
});

test('swept player pulse impacts damage the core; only its destruction arms a single full countdown', t => {
  const f = coreFixture(t), collider = f.world.colliders.find(c => c.id === f.core);
  assert.equal(f.controller.tryActivate(v(0, 0, -3)), null, 'R cannot destroy a reactor');
  const body = f.player.position.clone(); assert(moveSphere(body, v(0, 0, -10), 1, [collider]).collided);
  for (let hit = 0; hit < 4; hit++) {
    f.shots.fireProjectile(f.state, { requirePointerLock: false }); for (let i = 0; i < 30; i++) f.tick();
    if (hit < 3) { assert.equal(f.mission.escapeDeadline, null); assert.equal(f.controller.reactors[0].health, 20 - (hit + 1) * 5); }
  }
  assert.equal(f.destroyed(), 1); assert.equal(f.state.weaponInventory.pulse.ammo, 56); assert.equal(f.state.score, 0);
  const deadline = f.mission.escapeDeadline; assert(deadline > f.state.session.timeMs); assert.equal(f.mission.ready, true);
  assert.equal(f.world.colliders.includes(collider), false); assert.equal(f.controller.hitReactor(collider, 100), null);
  f.shots.fireProjectile(f.state, { requirePointerLock: false }); for (let i = 0; i < 30; i++) f.tick();
  assert.equal(f.mission.escapeDeadline, deadline); assert.equal(f.destroyed(), 1);
});

test('interlocks, foreign colliders, enemy fire, pause and stale sessions cannot damage or detonate a core', t => {
  const f = coreFixture(t), collider = f.controller.reactors[0].collider;
  assert.equal(f.controller.hitReactor({ ...collider }, 20), null);
  assert.equal(f.controller.hitReactor(collider, 20, () => false).blocked, true); assert.equal(f.controller.reactors[0].health, 20);
  const enemy = new THREE.Group(); enemy.position.set(0, 0, -6);
  f.shots.fireEnemyProjectile({ mesh: enemy, type: { name: 'fighter', size: 0.6, damage: 10, color: 0xff6600 } }, f.player);
  for (let i = 0; i < 90; i++) f.tick(); assert.equal(f.controller.reactors[0].health, 20); assert.equal(f.state.playerHealth, 100);
  f.state.session.transition('paused'); assert.equal(f.controller.hitReactor(collider, 100), null);
  f.state.session.transition('playing'); f.state.session.end(); f.state.session.begin(); f.state.session.transition('playing');
  assert.equal(f.controller.hitReactor(collider, 100), null); assert.equal(f.mission.escapeDeadline, null);
});

test('the ordinary Attach control finds two free openings on a large wall, with one undo per attachment', () => {
  const model = new EditorDocument(); model.resizeRoom('room-1', [48, 16, 32]);
  const first = model.attachRoom('room-1', 'negativeZ', 'straight-corridor'), before = model.export(), count = model.past.length;
  const second = model.attachRoom('room-1', 'negativeZ', 'straight-corridor');
  assert.notEqual(first, second); assert.equal(model.validation.valid, true); assert.equal(model.past.length, count + 1);
  const level = compileLevelDocument(model.document), world = buildArena(level);
  try {
    for (const link of model.document.connections) {
      const frame = openingFrame(model.room('room-1'), link.a), start = v(...frame.center).add(v(0, 0, 2)), end = v(...frame.center).add(v(0, 0, -2));
      assert.equal(traceShot(start, end, { colliders: world.colliders }), null);
      assert.equal(moveSphere(start, v(0, 0, -4), 1, world.colliders).collided, false);
    }
  } finally { disposeObject(world.group); }
  model.undo(); assert.equal(model.export(), before);
});

test('the ordinary Connect control joins a second off-center corridor to an already used wall', () => {
  const model = new EditorDocument(); model.resizeRoom('room-1', [48, 16, 32]); model.attachRoom('room-1', 'negativeZ', 'straight-corridor');
  const second = model.attachRoom('room-1', 'negativeZ', 'straight-corridor'), link = model.document.connections.at(-1);
  model.disconnect(link.id); model.connect('room-1', 'negativeZ', second, 'positiveZ');
  assert.equal(model.validation.valid, true); assert.equal(model.document.connections.length, 2);
  const saved = model.export(), history = model.past.length;
  assert.throws(() => model.connect('room-1', 'negativeZ', second, 'positiveZ'));
  assert.equal(model.export(), saved); assert.equal(model.past.length, history);
});

function portalFixture(t, loop = false) {
  const model = new EditorDocument(), north = model.attachRoom('room-1', 'negativeZ', 'box-room'), east = model.attachRoom(north, 'positiveX', 'box-room');
  if (loop) { const south = model.attachRoom(east, 'positiveZ', 'box-room'); model.connect(south, 'negativeX', 'room-1', 'positiveX'); }
  const level = compileLevelDocument(model.document), world = buildArena(level), visibility = new PortalVisibility(level.sourceDocument, world.group);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); camera.position.set(0, 0, 3);
  t.after(() => disposeObject(world.group)); return { model, world, visibility, camera };
}
test('portal traversal keeps straight sightlines and culls a room around a bend, then follows the camera into it', t => {
  const { visibility, camera } = portalFixture(t); visibility.update(camera);
  assert(visibility.visibleRooms.has('room-1')); assert(visibility.visibleRooms.has('room-2')); assert.equal(visibility.visibleRooms.has('room-3'), false);
  assert(visibility.culledMeshes > 0);
  camera.position.set(0, 0, -16); camera.lookAt(16, 0, -16); visibility.update(camera); assert(visibility.visibleRooms.has('room-3'));
});
test('portal near-plane clipping survives crossings, loops terminate, outside cameras fail open and door state is preserved', t => {
  const { visibility, camera, world } = portalFixture(t, true);
  const mesh = world.group.children.find(m => m instanceof THREE.Mesh); mesh.visible = false;
  for (const z of [-7.9, -8, -8.1, -16]) { camera.position.set(0, 0, z); visibility.update(camera); assert(visibility.visibleRooms.has('room-2')); }
  camera.position.set(1000, 1000, 1000); visibility.update(camera); assert.equal(visibility.visibleRooms.size, 4);
  assert.equal(visibility.culledMeshes, 0); assert.equal(mesh.visible, false);
  for (const { mesh } of visibility.bindings) assert(mesh.layers.isEnabled(0));
});

test('Deepworks has all editor element families, 48 reachable spaces, nine loops, same-wall lanes and three secrets', () => {
  const level = createCampaign().find(level => level.id === 'asterion-deepworks'), doc = level.sourceDocument;
  assert.equal(validateLevelDocument(doc).valid, true); assert.equal(doc.rooms.length, 48); assert.equal(doc.connections.length - doc.rooms.length + 1, 9);
  assert.equal(new Set(doc.entities.filter(e => e.kind === 'enemy').map(e => e.type)).size, 5);
  assert.equal(doc.doors.filter(d => d.concealed).length, 3); assert(doc.doors.some(d => d.kind === 'force-field'));
  assert(doc.rooms.some(r => r.endOffset?.[0])); assert(doc.rooms.some(r => r.endOffset?.[1])); assert(doc.rooms.some(r => r.roll));
  const north = doc.connections.filter(c => c.a.roomId === 'arrival-concourse' && c.a.port === 'negativeZ'); assert.equal(north.length, 2);
  assert.notDeepEqual(north[0].a.offset, north[1].a.offset); assert.equal(doc.mission.escape.triggerDeviceId, 'primary-reactor');
  const minimumShots = doc.entities.filter(e => e.kind === 'enemy').reduce((n, e) => n + ({ scout: 1, fighter: 3, bomber: 5, destroyer: 10, boss: 20 })[e.type], 15);
  assert(doc.combat.initialPulseAmmo > minimumShots, 'starting ammunition can defeat every robot and core before optional supplies');
});

test('every Deepworks portal stays visible from both approaches, including pitched, rolled and sheared spaces', t => {
  const level = createCampaign().find(level => level.id === 'asterion-deepworks'), world = buildArena(level);
  t.after(() => disposeObject(world.group));
  const visibility = new PortalVisibility(level.sourceDocument, world.group), camera = new THREE.PerspectiveCamera(65, 1.6, 0.1, 1000);
  for (const link of level.sourceDocument.connections) {
    const room = level.sourceDocument.rooms.find(r => r.id === link.a.roomId), frame = openingFrame(room, link.a), center = v(...frame.center), normal = v(...frame.normal);
    for (const sign of [-1, 1]) {
      camera.position.copy(center).addScaledVector(normal, sign * 2);
      // A vertical view needs a nonparallel up vector.
      camera.up.set(normal.y ? 1 : 0, normal.y ? 0 : 1, 0);
      camera.lookAt(center.clone().addScaledVector(normal, -sign * 8)); visibility.update(camera);
      const destination = sign < 0 ? link.b.roomId : link.a.roomId;
      assert(visibility.visibleRooms.has(destination), `${link.id}: ${destination} must remain visible across the opening`);
    }
  }
});
