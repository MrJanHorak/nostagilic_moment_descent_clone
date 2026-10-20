import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import ShipView from '../src/js/core/ShipView.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import UserSettings from '../src/js/core/UserSettings.js';
import createMissionMusic from '../src/js/core/MissionMusic.js';
import createCampaign from '../src/js/core/levels/Campaign.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { openingFrame } from '../src/js/core/levels/document/RoomMath.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import GameSession from '../src/js/core/GameSession.js';
import RelayController from '../src/js/core/RelayController.js';
import MissionObjective from '../src/js/core/MissionObjective.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import ExplorationMap from '../src/js/core/ExplorationMap.js';
import { toWorld } from '../src/js/core/levels/document/RoomMath.js';
import GameState from '../src/js/core/GameState.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import { hasLineOfSight, traceShot } from '../src/js/utils/combatTrace.js';

test('external camera retracts at a wall and leaves the flight/weapon pose and headlights fixed', () => {
  const ship = new Spaceship(), camera = new THREE.PerspectiveCamera(75, 1.6, 0.1, 1000);
  ship.attachCamera(camera); ship.group.position.set(4, 3, -8); ship.rotate(Math.PI / 2, 0, Math.PI / 2);
  const view = new ShipView(ship, camera), before = ship.group.matrix.clone();
  const pose = [ship.group.position.toArray(), ship.group.quaternion.toArray()];
  view.apply({ cameraView: 'external', headlights: false }); view.update();
  assert.equal(ship.model.visible, true); assert.equal(view.lights.visible, false);
  assert(camera.position.length() > 4);
  const world = camera.getWorldPosition(new THREE.Vector3());
  const halfway = world.clone().lerp(ship.group.position, 0.5);
  const box = new THREE.Box3().setFromCenterAndSize(halfway, new THREE.Vector3(0.5, 0.5, 0.5));
  view.update([box]);
  assert(camera.getWorldPosition(new THREE.Vector3()).distanceTo(ship.group.position) < halfway.distanceTo(ship.group.position));
  assert.deepEqual([ship.group.position.toArray(), ship.group.quaternion.toArray()], pose);
  assert.equal(view.lights.parent, ship.group); assert(before.elements.every(Number.isFinite));
  view.apply({ cameraView: 'hud', headlights: true }); view.update([box]);
  assert.deepEqual(camera.position.toArray(), [0, 0, 0]); assert.equal(ship.model.visible, false); assert.equal(view.lights.visible, true);
  view.apply({ cameraView: 'cockpit', headlights: true }); view.update([box]);
  assert.deepEqual(camera.position.toArray(), [0, 0, 0]); assert.equal(ship.model.visible, false);
  assert.deepEqual([ship.group.position.toArray(), ship.group.quaternion.toArray()], pose);
  disposeObject(ship.group);
});

test('ship view preferences round-trip, reject malformed values and keep old saves compatible', () => {
  let raw = '{"version":1,"mouseSensitivity":2}';
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  const settings = new UserSettings(() => storage);
  assert.equal(settings.values.cameraView, 'hud'); assert.equal(settings.values.headlights, true);
  settings.update({ cameraView: 'external', headlights: false, showHUD: false });
  settings.update({ cameraView: 'orbit', headlights: 'true', showHUD: 1 });
  assert.deepEqual(new UserSettings(() => storage).values, settings.values);
  assert.equal(settings.values.cameraView, 'external'); assert.equal(settings.values.headlights, false); assert.equal(settings.values.showHUD, false);
  settings.update({ cameraView: 'cockpit' });
  assert.equal(new UserSettings(() => storage).values.cameraView, 'cockpit');
});

test('survey discovers only entered rooms, retains visits and starts fresh per session', () => {
  for (const level of createCampaign()) {
    const document = level.sourceDocument, before = JSON.stringify(document), map = new ExplorationMap(document);
    assert.equal(map.visited.size, 0);
    for (const room of document.rooms) {
      const position = new THREE.Vector3(...toWorld(room, [0, 0, 0]));
      map.update(position);
      assert.equal(map.current, room.id);
      assert(map.visited.has(room.id));
      const corners = map.outlines.get(room.id);
      assert.equal(corners.length, 8);
      assert(corners.flat().every(Number.isFinite));
    }
    assert.equal(map.visited.size, document.rooms.length);
    map.update(new THREE.Vector3(9999, 9999, 9999));
    assert.equal(map.current, null); assert.equal(map.visited.size, document.rooms.length);
    assert.equal(new ExplorationMap(document).visited.size, 0);
    assert.equal(JSON.stringify(document), before);
  }
});

test('original music is deterministic stereo with bounded samples and a continuous, varying loop', () => {
  const context = { sampleRate: 8000, createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { sampleRate, length, numberOfChannels: channels, getChannelData: channel => data[channel] };
  } };
  const music = createMissionMusic(context), second = createMissionMusic(context);
  assert.equal(music.length / music.sampleRate, 40); assert.equal(music.numberOfChannels, 2);
  const left = music.getChannelData(0), right = music.getChannelData(1);
  assert.deepEqual(left, second.getChannelData(0)); assert.notDeepEqual(left, right);
  let peak = 0, energy = 0;
  for (const sample of left) { assert(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  assert(peak > 0.05 && peak < 0.7); assert(energy / left.length > 0.0001);
  assert(Math.abs(left[0] - left.at(-1)) < 0.05, 'loop boundary must not introduce a click');
  assert.notDeepEqual(left.slice(0, 20000), left.slice(160000, 180000), 'arrangement develops over the loop');
});

for (const level of createCampaign()) test(`${level.name}: valid round trip, gated progression and all physical portals traverse after activation`, () => {
  const document = level.sourceDocument;
  assert.equal(validateLevelDocument(JSON.parse(JSON.stringify(document))).valid, true);
  assert.equal(document.rooms.length, level.id === 'signal-breach' ? 10 : 7);
  const world = buildArena(level), session = new GameSession(); session.begin(); session.transition('playing');
  const relay = new RelayController(level, world.group, world.colliders, session), mission = new MissionObjective(level.mission);
  assert.equal(mission.ready, false); assert.equal(mission.tryComplete(new THREE.Vector3(...level.mission.exit.position)), false);
  const reachable = () => {
    const rooms = new Set([document.playerSpawn.roomId]), queue = [...rooms];
    for (let i = 0; i < queue.length; i++) for (const link of document.connections) {
      if (relay.closedConnections.has(link.id)) continue;
      const next = link.a.roomId === queue[i] ? link.b.roomId : link.b.roomId === queue[i] ? link.a.roomId : null;
      if (next && !rooms.has(next)) { rooms.add(next); queue.push(next); }
    }
    return rooms;
  };
  for (const device of document.devices) {
    assert(reachable().has(device.roomId), `Relay ${device.id} must be accessible before its door opens`);
    const runtime = level.devices.find(item => item.id === device.id);
    assert.equal(relay.tryActivate(new THREE.Vector3(...runtime.position))?.id, device.id);
    mission.recordDeviceActivation(device.id);
  }
  assert.equal(reachable().size, document.rooms.length);
  assert.equal(relay.closedConnections.size, 0);
  for (const connection of document.connections) {
    const room = document.rooms.find(room => room.id === connection.a.roomId), frame = openingFrame(room, connection.a);
    for (const direction of [-1, 1]) {
      const normal = new THREE.Vector3(...frame.normal).multiplyScalar(direction);
      const position = new THREE.Vector3(...frame.center).addScaledVector(normal, -1.25);
      const velocity = normal.clone().multiplyScalar(2.5);
      const result = moveSphere(position, velocity, 1, world.colliders);
      assert.equal(result.collided, false, `${connection.id} must have matching opening/collider geometry`);
      assert(position.distanceTo(new THREE.Vector3(...frame.center).addScaledVector(normal, 1.25)) < 1e-6);
    }
  }
  for (const id of level.mission.requiredEnemyIds) mission.recordDefeat(id, 'shot');
  assert.equal(mission.tryComplete(new THREE.Vector3(...level.mission.exit.position)), true);
  assert.equal(mission.tryComplete(new THREE.Vector3(...level.mission.exit.position)), false);
  disposeObject(world.group);
});

function signalEncounter(t) {
  t.mock.method(Math, 'random', () => 0.5);
  const level = createCampaign()[0], world = buildArena(level), scene = new THREE.Scene(), player = new THREE.Group();
  scene.add(world.group, player); player.position.fromArray(level.spawn);
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  state.weaponInventory.pulse.ammo = level.combat.initialPulseAmmo;
  const manager = new EnemyManager(scene, player, state, null, { currentLevel: level, solidColliders: world.colliders, isEndless: false });
  const shots = new ProjectileManager(scene, player, null, state.session); shots.setCanvas({});
  shots.setCombatWorld({ getColliders: () => world.colliders, getTargets: () => manager.enemies,
    getRules: () => level.combat, onTargetHit: (enemy, shot, point) => manager.hitEnemy(enemy, shot, point) });
  manager.updateEnemies(0);
  t.after(() => { state.session.end(); manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); shots.dispose(); disposeObject(world.group); });
  const tick = () => {
    state.session.advance(1 / 60); manager.updateEnemies(1 / 60);
    shots.updateProjectiles(1 / 60, player, state, manager.effectsManager);
    manager.projectileManager.updateProjectiles(1 / 60, player, state, manager.effectsManager);
  };
  return { level, world, player, state, manager, shots, tick };
}

test('Signal Breach: safe arrival, doorway cover and a body-clear overhead approach into the hall', t => {
  const { level, world, player, manager, tick, state } = signalEncounter(t);
  const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter');
  const scout = manager.enemies.find(enemy => enemy.type.name === 'scout');
  assert(fighter.mesh.position.distanceTo(player.position) > 30, 'arrival begins outside pursuit/fire range');
  assert.equal(manager.canSeePlayer(scout), false, 'the optional scout cannot rush the arrival');
  for (let frame = 0; frame < 300; frame++) tick();
  assert.equal(state.playerHealth, 100);
  assert.deepEqual(fighter.mesh.position.toArray(), [0, 0, -36]);
  assert.equal(hasLineOfSight(fighter.mesh.position, new THREE.Vector3(0, 0, -7), world.colliders), true);
  assert.equal(hasLineOfSight(fighter.mesh.position, new THREE.Vector3(6, 0, -7), world.colliders), false, 'a side-step behind the arrival wall breaks the direct sightline');
  for (const target of [[0, 0, 0], [0, 21, 0], [0, 21, -32], [0, 0, -32]]) {
    const end = new THREE.Vector3(...target);
    assert.equal(traceShot(player.position, end, { colliders: world.colliders, radius: 0.5 }), null);
    const result = moveSphere(player.position, end.clone().sub(player.position), 1, world.colliders, 0.5);
    assert.equal(result.collided, false); assert(player.position.distanceTo(end) < 1e-6);
  }
  const mission = new MissionObjective(level.mission);
  mission.recordDeviceActivation('relay-signal');
  assert.equal(mission.ready, true, 'both routes support optional combat');
});

test('Signal Breach: the guard fires real damaging projectiles, takes three normal pulse shots and resets', t => {
  const { player, manager, state, shots, tick } = signalEncounter(t);
  player.position.set(0, 0, -15);
  const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter');
  for (let frame = 0; frame < 600 && state.playerHealth === 100; frame++) tick();
  assert.equal(state.playerHealth, 90, 'a waiting player must experience the ranged threat');
  for (let shot = 1; shot <= 3; shot++) {
    shots.fireProjectile(state, { requirePointerLock: false });
    for (let frame = 0; frame < 45; frame++) tick();
    assert.equal(fighter.isActive, shot < 3);
  }
  assert.equal(state.weaponInventory.pulse.ammo, 77);
  assert.equal(state.enemyKills.fighter, 1); assert.equal(state.score, 100);
  assert.equal(manager.enemies.length, 1, 'the optional branch remains independent');
  manager.resetLevel(); state.resetForSession(); manager.updateEnemies(0);
  assert.equal(state.playerHealth, 100);
  assert.equal(manager.enemies.length, 2);
  assert.equal(manager.enemies.find(enemy => enemy.type.name === 'fighter').health, 25);
  assert.equal(manager.projectileManager.enemyProjectiles.length, 0);
});
