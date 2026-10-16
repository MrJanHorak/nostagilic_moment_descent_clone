import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { validateLevelDocument, serializeLevelDocument, parseLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument, { prepareLevelDocument } from '../src/js/core/levels/document/compileLevelDocument.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import RelayController from '../src/js/core/RelayController.js';
import MissionObjective from '../src/js/core/MissionObjective.js';
import GameState from '../src/js/core/GameState.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

const sample = JSON.parse(readFileSync(new URL('../src/js/core/levels/documents/relay-gate.v2.json', import.meta.url), 'utf8'));
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clone = () => structuredClone(sample);

function worldFixture(t, input = sample) {
  const level = compileLevelDocument(input), world = buildArena(level), state = new GameState();
  state.session.begin(); state.session.transition('playing');
  const controller = new RelayController(level, world.group, world.colliders, state.session);
  t.after(() => { controller.retire(); state.session.end(); disposeObject(world.group); });
  return { level, world, state, controller };
}

const invalidCases = [
  ['unknown version', input => { input.formatVersion = 3; }, 'version'],
  ['v1 door fields', input => { input.formatVersion = 1; input.mission.type = 'clear-and-exit'; }, 'field'],
  ['missing doors', input => { delete input.doors; }, 'array'],
  ['empty devices', input => { input.devices = []; }, 'relay'],
  ['wrong mission', input => { input.mission.type = 'clear-and-exit'; }, 'choice'],
  ['missing required devices', input => { delete input.mission.requiredDeviceIds; }, 'array'],
  ['unknown relay room', input => { input.devices[0].roomId = 'missing'; }, 'reference'],
  ['relay in wall', input => { input.devices[0].position[1] = 5.5; }, 'clearance'],
  ['relay overlaps pickup', input => { input.devices[0].position[1] = -2; }, 'placement-overlap'],
  ['global duplicate ID', input => { input.doors[0].id = input.entities[0].id; }, 'duplicate-id'],
  ['unknown door connection', input => { input.doors[0].connectionId = 'missing'; }, 'reference'],
  ['unknown door relay', input => { input.doors[0].deviceId = 'mine:fighter'; }, 'reference'],
  ['duplicate door occupancy', input => { input.doors.push({ ...input.doors[0], id: 'another-door' }); }, 'occupied-door'],
  ['wrong required kind', input => { input.mission.requiredDeviceIds = ['mine:fighter']; }, 'reference'],
  ['duplicate required relay', input => { input.mission.requiredDeviceIds.push('relay:ceiling'); }, 'duplicate-id'],
  ['unrequired relay', input => { input.mission.requiredDeviceIds = []; }, 'relay'],
  ['relay behind its own door', input => { input.devices[0].roomId = 'upper'; }, 'locked-route'],
  ['device count cap', input => { input.devices = Array.from({ length: 17 }, () => input.devices[0]); }, 'array'],
];
for (const [name, mutate, code] of invalidCases) test(`relay validation rejects ${name}`, () => {
  const input = clone(); mutate(input); const result = validateLevelDocument(input);
  assert.equal(result.valid, false); assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result.errors));
});

test('v2 round trips an owned immutable snapshot while v1 retains its original fields', () => {
  const input = clone(), result = validateLevelDocument(input); assert.equal(result.valid, true);
  input.devices[0].label = 'caller edit'; assert.equal(result.document.devices[0].label, 'Ceiling hatch relay');
  assert.ok(Object.isFrozen(result.document.doors[0]));
  const text = serializeLevelDocument(sample); assert.equal(serializeLevelDocument(parseLevelDocument(text)), text);
  const v1 = JSON.parse(readFileSync(new URL('../src/js/core/levels/documents/mine-link.v1.json', import.meta.url), 'utf8'));
  const old = parseLevelDocument(serializeLevelDocument(v1)); assert.equal(old.formatVersion, 1);
  assert.equal('devices' in old, false); assert.equal('doors' in old, false);
});

test('a cycle of relays behind closed doors cannot bootstrap unlock reachability', () => {
  const input = clone();
  input.devices.push({ id: 'relay:gallery', label: 'Gallery', roomId: 'gallery', position: [-3, 0, -3] });
  input.mission.requiredDeviceIds.push('relay:gallery');
  input.doors.push({ id: 'door:bay', connectionId: 'return-bay', deviceId: 'relay:ceiling' },
    { id: 'door:core', connectionId: 'core-gallery', deviceId: 'relay:gallery' });
  const result = validateLevelDocument(input); assert.equal(result.valid, false);
  assert.ok(result.errors.filter(error => error.code === 'locked-route').length >= 2);
});

test('a reachable two-relay chain unlocks its doors separately and makes the final room reachable', t => {
  const input = clone();
  input.rooms.push({ ...input.rooms[4], id: 'loft', position: [16, 24, 0] });
  input.connections.push({ id: 'upper-loft', a: { roomId: 'upper', port: 'positiveY' }, b: { roomId: 'loft', port: 'negativeY' }, openingSize: [6, 6] });
  input.devices.push({ id: 'relay:loft', label: 'Loft', roomId: 'upper', position: [2, 0, 3] });
  input.doors.push({ id: 'door:loft', connectionId: 'upper-loft', deviceId: 'relay:loft' });
  input.mission.requiredDeviceIds.push('relay:loft'); input.entities.find(entity => entity.kind === 'exit').roomId = 'loft';
  const { controller, world } = worldFixture(t, input);
  assert.equal(controller.closedConnections.size, 2);
  controller.tryActivate(v(19, 0, 3)); assert.equal(controller.closedConnections.has('return-upper'), false);
  assert.equal(controller.closedConnections.has('upper-loft'), true); assert.equal(world.group.getObjectByName('door:loft').visible, true);
  controller.tryActivate(v(18, 12, 3)); assert.equal(controller.closedConnections.size, 0); assert.equal(controller.revision, 2);
});

test('a failure after a relay marker is attached releases the complete staged world', t => {
  const original = THREE.Group.prototype.add, resources = new Map(), failure = new Error('relay marker failed');
  t.mock.method(THREE.Group.prototype, 'add', function (...objects) {
    const result = original.apply(this, objects);
    for (const object of objects) if (object instanceof THREE.Mesh) for (const resource of [object.geometry, object.material]) {
      if (!resources.has(resource)) { resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1)); }
    }
    if (objects.some(object => object.name === 'relay:ceiling')) throw failure;
    return result;
  });
  assert.throws(() => prepareLevelDocument(sample), error => error === failure);
  assert.ok(resources.size > 0); assert.ok([...resources.values()].every(count => count === 1));
});

test('door solids match their meshes and colliders on horizontal, rotated and vertical connections', t => {
  for (const connectionId of ['bay-core', 'core-gallery', 'return-upper']) {
    const input = clone(); input.doors[0].connectionId = connectionId;
    const { level, world } = worldFixture(t, input), door = level.doors[0];
    const mesh = world.group.getObjectByName(door.id), collider = world.colliders.find(collider => collider.id === door.id);
    assert.deepEqual(mesh.geometry.parameters, { width: door.solid.size[0], height: door.solid.size[1], depth: door.solid.size[2], widthSegments: 1, heightSegments: 1, depthSegments: 1 });
    assert.ok(new THREE.Box3().setFromObject(mesh).equals(collider.box));
    assert.ok(mesh.visible);
  }
});

test('closed hatch blocks bodies and shots both ways; one activation removes exactly its collision', t => {
  const { world, controller } = worldFixture(t), count = world.colliders.length;
  for (const [position, velocity, expected] of [[v(16, 0, 0), v(0, 30, 0), 5], [v(16, 12, 0), v(0, -30, 0), 7]]) {
    moveSphere(position, velocity, 1, world.colliders, 0.5); assert.ok(Math.abs(position.y - expected) < 1e-5);
  }
  for (const [a, b] of [[v(16, 0, 0), v(16, 12, 0)], [v(16, 12, 0), v(16, 0, 0)]]) assert.equal(traceShot(a, b, { colliders: world.colliders }).target.id, 'door:ceiling');
  assert.deepEqual(controller.tryActivate(v(19, 0, 3)), { id: 'relay:ceiling', label: 'Ceiling hatch relay' });
  assert.equal(world.colliders.length, count - 1); assert.equal(controller.closedConnections.size, 0); assert.equal(controller.revision, 1);
  assert.equal(world.group.getObjectByName('door:ceiling').visible, false);
  assert.equal(world.group.getObjectByName('relay:ceiling').material.color.getHex(), 0x45ff96);
  assert.equal(traceShot(v(16, 0, 0), v(16, 12, 0), { colliders: world.colliders }), null);
  const position = v(16, 0, 0); moveSphere(position, v(0, 12, 0), 1, world.colliders, 0.5); assert.equal(position.y, 12);
  assert.equal(controller.tryActivate(v(19, 0, 3)), null); assert.equal(controller.revision, 1);
});

test('relay interaction requires proximity, sight, active phase, current session and live ownership', t => {
  const { controller, state } = worldFixture(t);
  assert.equal(controller.tryActivate(v()), null);
  // Across a closed room wall within 2.5 units: range alone cannot activate.
  controller.devices[0].position.set(6.75, 0, 5);
  assert.equal(controller.tryActivate(v(9, 0, 5)), null);
  controller.devices[0].position.set(19, 0, 3);
  state.session.transition('paused'); assert.equal(controller.tryActivate(v(19, 0, 3)), null);
  state.session.transition('playing'); controller.retire(); assert.equal(controller.tryActivate(v(19, 0, 3)), null);
  const other = new RelayController(compileLevelDocument(sample), controller.root, controller.colliders, state.session);
  state.session.end(); state.session.begin(); state.session.transition('playing');
  assert.equal(other.tryActivate(v(19, 0, 3)), null); assert.equal(other.activatedIds.size, 0);
});

test('relay objective requires each combat and device event once before extraction', t => {
  const { level } = worldFixture(t), mission = new MissionObjective(level.mission), exit = v(...level.mission.exit.position);
  for (const id of mission.requiredIds) mission.recordDefeat(id, 'shot');
  assert.equal(mission.ready, false); assert.equal(mission.tryComplete(exit), false);
  assert.equal(mission.recordDeviceActivation('unknown'), false);
  assert.equal(mission.recordDeviceActivation('relay:ceiling'), true);
  assert.equal(mission.recordDeviceActivation('relay:ceiling'), false);
  assert.equal(mission.ready, true); assert.equal(mission.tryComplete(exit), true); assert.equal(mission.tryComplete(exit), false);
});

test('opening a hatch invalidates a waiting enemy route and permits remembered pursuit', t => {
  const { level, world, controller, state } = worldFixture(t), player = new THREE.Group(), scene = new THREE.Scene();
  player.position.fromArray(level.spawn); scene.add(world.group);
  const view = { currentLevel: level, solidColliders: world.colliders, tunnelWidth: 15, tunnelHeight: 12, isEndless: false, interaction: controller };
  const manager = new EnemyManager(scene, player, state, null, view);
  t.after(() => { manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); });
  manager.updateEnemies(0); const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter');
  player.position.set(16, 14, 4); manager.hitEnemy(fighter, { power: 1 }, fighter.mesh.position); player.position.set(500, 500, 500);
  manager.updateEnemies(1 / 60); assert.equal(manager.minePursuits.get(fighter).route, null);
  const navigation = new RoomNavigation(level.sourceDocument);
  assert.equal(navigation.route(fighter.mesh.position, v(16, 14, 4), fighter.collisionRadius, controller.closedConnections), null);
  controller.tryActivate(v(19, 0, 3));
  for (let frame = 0; frame < 2400; frame++) { state.session.advance(1 / 60); manager.updateEnemies(1 / 60); }
  assert.ok(fighter.mesh.position.distanceTo(v(16, 14, 4)) < 0.04);
  assert.equal(manager.minePursuits.get(fighter).revision, 1);
});

function gameFixture(t) {
  t.mock.method(console, 'log', () => {}); t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {}, hideLevelSelect() {},
    showMessage() {}, showPauseMenu() {}, hidePauseMenu() {}, showCompletion() {}, showGameOver() {}, showSessionError(error) { throw error; } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session);
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'relay-gate') }); game.updateSimulation(1 / 60);
  t.after(() => { game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose(); });
  return game;
}

test('R activates through the game/input path once, respects pause/settings and preserves roll controls', t => {
  const game = gameFixture(t), controller = game.levelManager.interaction;
  game.spaceship.group.position.set(19, 0, 3);
  game.uiManager.settingsDialog = { isOpen: true };
  game.inputManager.onKeyDown({ code: 'KeyR' }); assert.equal(controller.activatedIds.size, 0);
  game.uiManager.settingsDialog = null;
  game.pauseGame(); game.inputManager.onKeyDown({ code: 'KeyR' }); assert.equal(controller.activatedIds.size, 0);
  game.resumeGame(); game.inputManager.onKeyDown({ code: 'KeyR', repeat: true }); assert.equal(controller.activatedIds.size, 0);
  game.inputManager.onKeyDown({ code: 'KeyE' }); assert.equal(controller.activatedIds.size, 0);
  game.inputManager.onKeyDown({ code: 'KeyR' }); assert.equal(controller.activatedIds.size, 1);
  assert.equal(game.mission.activatedDevices.size, 1); game.inputManager.onKeyDown({ code: 'KeyR' }); assert.equal(controller.revision, 1);
});

test('relay mission completes once and ten restarts restore the closed door, marker and objective', t => {
  const game = gameFixture(t), source = serializeLevelDocument(sample);
  const baseline = game.levelManager.solidColliders.length;
  for (let cycle = 0; cycle < 10; cycle++) {
    const controller = game.levelManager.interaction, root = game.levelManager.levelSegments[0];
    const door = root.getObjectByName('door:ceiling'); let disposed = 0; door.geometry.addEventListener('dispose', () => disposed++);
    for (const enemy of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(enemy, { power: 100 }, enemy.mesh.position);
    assert.equal(game.mission.ready, false);
    game.spaceship.group.position.set(19, 0, 3); assert.equal(game.interact(), true); assert.equal(game.mission.ready, true);
    game.pauseGame(); assert.equal(controller.closedConnections.size, 0); game.resumeGame();
    game.spaceship.group.position.set(16, 12, -4); game.updateSimulation(1 / 60);
    assert.equal(game.session.phase, 'completed'); assert.equal(game.gameState.score, 1150);
    game.updateSimulation(1); assert.equal(game.gameState.score, 1150);
    game.restartLevel(); game.updateSimulation(1 / 60);
    assert.equal(disposed, 1); assert.equal(controller.retired, true); assert.equal(controller.tryActivate(v(19, 0, 3)), null);
    assert.equal(game.levelManager.solidColliders.length, baseline); assert.equal(game.levelManager.interaction.closedConnections.size, 1);
    assert.equal(game.mission.activatedDevices.size, 0); assert.equal(game.mission.ready, false); assert.equal(game.gameState.score, 0);
    assert.equal(game.levelManager.levelSegments[0].getObjectByName('relay:ceiling').material.color.getHex(), 0x45e5ed);
    assert.equal(serializeLevelDocument(game.levelManager.currentLevel.sourceDocument), source);
  }
});
