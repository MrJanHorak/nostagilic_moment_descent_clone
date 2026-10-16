import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import sample from '../src/js/core/levels/documents/mine-link.v1.json' with { type: 'json' };
import { LevelDocumentError, parseLevelDocument, serializeLevelDocument, validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument, { prepareLevelDocument } from '../src/js/core/levels/document/compileLevelDocument.js';
import { AUTHORED_PICKUPS, EXIT_MARKER_MARGIN, LIMITS, PLAYER_RADIUS, enemyClearance } from '../src/js/core/levels/document/LevelContent.js';
import { portFrame, toWorld } from '../src/js/core/levels/document/RoomMath.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import EnemyFactory from '../src/js/entities/EnemyFactory.js';
import { enemyTypes } from '../src/js/entities/EnemyTypes.js';
import { powerupTypes } from '../src/js/entities/PowerUpManager.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

const clone = () => structuredClone(sample);
const v = (...values) => new THREE.Vector3(...values);
function valid(input) { const result = validateLevelDocument(input); assert.ok(result.valid, JSON.stringify(result.errors)); return result.document; }
function invalid(input, code) {
  const result = validateLevelDocument(input); assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result.errors));
  assert.ok(result.errors.every(error => error.path.startsWith('$') && error.message.length > 0));
  assert.ok(result.errors.length <= LIMITS.errors); return result.errors;
}

test('canonical level validation owns a deeply frozen JSON snapshot and export/import is deterministic', () => {
  const input = clone(), snapshot = valid(input), text = serializeLevelDocument(snapshot);
  assert.deepEqual(parseLevelDocument(text), snapshot); assert.equal(serializeLevelDocument(parseLevelDocument(text)), text);
  assert.equal(Object.isFrozen(input), false); input.rooms[0].position[0] = 100;
  assert.equal(snapshot.rooms[0].position[0], 0);
  assert.ok(Object.isFrozen(snapshot.rooms[0].position)); assert.ok(Object.isFrozen(snapshot.entities[0]));
  assert.equal(text.includes('isVector3'), false); assert.equal(text.includes('spawned'), false);
  assert.throws(() => snapshot.entities.push(snapshot.entities[0]), TypeError);
});

const structuralCases = [
  ['future versions', input => { input.formatVersion = 2; }, 'version'],
  ['unknown fields', input => { input.script = 'alert(1)'; }, 'field'],
  ['session state', input => { input.entities[0].health = 10; }, 'field'],
  ['invalid IDs', input => { input.rooms[0].id = '<room>'; }, 'id'],
  ['room count cap', input => { input.rooms = Array(65).fill(input.rooms[0]); }, 'array'],
  ['entity count cap', input => { input.entities = Array(257).fill(input.entities[0]); }, 'array'],
  ['nonfinite coordinates', input => { input.rooms[0].position[0] = Infinity; }, 'json'],
  ['fractional grid', input => { input.rooms[0].position[0] = 0.1; }, 'grid'],
  ['non-quarter room rotation', input => { input.rooms[0].yaw = 45; }, 'choice'],
  ['non-unit spawn quaternion', input => { input.playerSpawn.rotation = [0, 0, 0, 2]; }, 'number'],
  ['zero spawn quaternion', input => { input.playerSpawn.rotation = [0, 0, 0, 0]; }, 'rotation'],
  ['unknown enemies', input => { input.entities[0].type = 'interceptor'; }, 'choice'],
  ['unfinished pickups', input => { input.entities[2].type = 'weaponPickup'; }, 'choice'],
  ['invalid dimensions', input => { input.rooms[0].size[0] = -1; }, 'size'],
  ['corridor size policy', input => { input.rooms[0].prefab = 'straight-corridor'; }, 'size'],
  ['too-small openings', input => { input.connections[0].openingSize[0] = 0.5; }, 'number'],
  ['initial ammo beyond capacity', input => { input.combat.initialPulseAmmo = 101; }, 'ammo'],
  ['empty rooms', input => { input.rooms = []; }, 'rooms'],
];
for (const [name, mutate, code] of structuralCases) test(`level structure rejects ${name}`, () => { const input = clone(); mutate(input); invalid(input, code); });

const semanticCases = [
  ['duplicate IDs across kinds', input => { input.entities[0].id = input.rooms[0].id; }, 'duplicate-id'],
  ['room overlap', input => { input.rooms[4].position[1] = 8; }, 'overlap'],
  ['unknown spawn room', input => { input.playerSpawn.roomId = 'missing'; }, 'reference'],
  ['unknown entity room', input => { input.entities[0].roomId = 'missing'; }, 'reference'],
  ['missing required enemy', input => { input.mission.requiredEnemyIds[0] = 'missing'; }, 'reference'],
  ['repeated required enemy', input => { input.mission.requiredEnemyIds.push(input.mission.requiredEnemyIds[0]); }, 'duplicate-id'],
  ['wrong exit kind', input => { input.mission.exitId = 'mine:fighter'; }, 'reference'],
  ['multiple exits', input => { input.entities.push({ ...input.entities[4], id: 'second-exit', position: [-3, 0, -3] }); }, 'exit'],
  ['occupied ports', input => { input.connections.push({ ...input.connections[0], id: 'duplicate-port' }); }, 'occupied-port'],
  ['self connection', input => { input.connections[0].b.roomId = 'bay'; }, 'connection'],
  ['misaligned ports', input => { input.rooms[4].position[1] = 12.5; }, 'alignment'],
  ['same-facing ports', input => { input.connections[0].b.port = 'negativeZ'; }, 'alignment'],
  ['opening exceeding face clearance', input => { input.connections[0].openingSize = [15, 6]; }, 'clearance'],
  ['unreachable rooms and required exit', input => { input.connections.pop(); }, 'unreachable'],
  ['player inside a wall', input => { input.playerSpawn.position[0] = 7.25; }, 'clearance'],
  ['enemy outside its room', input => { input.entities[0].position[1] = 5; }, 'clearance'],
  ['initial body overlap', input => { input.entities[0].roomId = 'bay'; input.entities[0].position = [0, 0, 4]; }, 'placement-overlap'],
];
for (const [name, mutate, code] of semanticCases) test(`level semantics reject ${name}`, () => { const input = clone(); mutate(input); invalid(input, code); });

test('non-JSON objects, accessors, sparse arrays and cycles fail without invoking getters', () => {
  for (const value of [undefined, () => {}, new Date(), new THREE.Vector3(), NaN]) invalid(value, 'json');
  const input = clone(); let getterCalls = 0;
  Object.defineProperty(input, 'trap', { enumerable: true, get() { getterCalls++; throw new Error('must not read'); } });
  invalid(input, 'json'); assert.equal(getterCalls, 0);
  const cyclic = clone(); cyclic.rooms[0].loop = cyclic; invalid(cyclic, 'json');
  const sparse = clone(); delete sparse.rooms[0]; invalid(sparse, 'json');
  const symbol = clone(); symbol[Symbol('hidden')] = 1; invalid(symbol, 'json');
  const instance = clone(); instance.playerSpawn.position = new THREE.Vector3(); invalid(instance, 'json');
});

test('parser caps text/tree work and reports useful validation errors without mutating the source', () => {
  for (const text of ['{', 'null', '{"formatVersion":99}', ' '.repeat(LIMITS.text + 1)]) {
    assert.throws(() => parseLevelDocument(text), error => error instanceof LevelDocumentError && error.errors.length > 0);
  }
  const input = clone(); input.entities[0].type = 'unknown'; const before = structuredClone(input);
  assert.throws(() => compileLevelDocument(input), error => error instanceof LevelDocumentError && error.message.includes('$.entities[0].type'));
  assert.deepEqual(input, before);
  const deep = clone(); let nested = deep;
  for (let i = 0; i < 20; i++) { nested.extra = {}; nested = nested.extra; }
  invalid(deep, 'limit');
  const huge = clone(); huge.extra = Array.from({ length: 50100 }, () => 1); invalid(huge, 'limit');
});

test('shared content clearance bounds actual enemy models and matches the two authored pickup models', () => {
  const factory = new EnemyFactory(new THREE.Scene());
  for (const type of enemyTypes) {
    const enemy = factory.createEnemy(type, v());
    assert.ok(enemy.collisionRadius <= enemyClearance(type.name), `${type.name}: ${enemy.collisionRadius}`); disposeObject(enemy.mesh);
  }
  for (const metadata of Object.values(AUTHORED_PICKUPS)) {
    const runtime = powerupTypes.find(type => type.name === metadata.name);
    assert.equal(runtime.size, metadata.size); assert.equal(runtime.color, metadata.color);
  }
  assert.equal(new Spaceship().radius, PLAYER_RADIUS);
});

test('compiled world keeps authored IDs and transforms while every wall mesh matches its collider', () => {
  const level = compileLevelDocument(sample), { group, colliders } = buildArena(level);
  assert.equal(level.solids.length, 60); assert.equal(colliders.length, 60);
  assert.deepEqual(level.enemySpawns.find(enemy => enemy.id === 'mine:scout').position.toArray(), [17, 0, -16]);
  assert.deepEqual(level.mission.exit.position, [16, 12, -4]);
  assert.deepEqual(level.solids, compileLevelDocument(parseLevelDocument(serializeLevelDocument(sample))).solids);
  for (const collider of colliders) assert.ok(new THREE.Box3().setFromObject(group.getObjectByName(collider.id)).equals(collider.box), collider.id);
  assert.ok(group.getObjectByName('mine:exit')); assert.equal(group.getObjectByName('floor'), undefined);
  disposeObject(group);
});

test('every connected doorway and vertical hatch admits sphere movement and shots in both directions', () => {
  const document = valid(sample), { group, colliders } = buildArena(compileLevelDocument(document));
  for (const connection of document.connections) {
    const room = document.rooms.find(room => room.id === connection.a.roomId), frame = portFrame(room, connection.a.port);
    for (const direction of [-1, 1]) {
      const start = v(...frame.center).addScaledVector(v(...frame.normal), -direction * 2);
      const end = v(...frame.center).addScaledVector(v(...frame.normal), direction * 2);
      assert.equal(traceShot(start, end, { colliders }), null, connection.id);
      const position = start.clone(), velocity = end.clone().sub(start).multiplyScalar(10);
      moveSphere(position, velocity, 0.1, colliders, PLAYER_RADIUS);
      assert.ok(position.distanceTo(end) < 1e-5, `${connection.id} direction ${direction}`);
    }
    const blocked = v(...frame.center); blocked.setComponent(frame.u, blocked.getComponent(frame.u) + connection.openingSize[0] / 2 + 1);
    const start = blocked.clone().addScaledVector(v(...frame.normal), -2), end = blocked.clone().addScaledVector(v(...frame.normal), 2);
    assert.equal(traceShot(start, end, { colliders }).kind, 'wall');
    const position = start.clone(); moveSphere(position, end.clone().sub(start).multiplyScalar(10), 0.1, colliders, PLAYER_RADIUS);
    assert.ok(position.distanceTo(end) > 1, `${connection.id} frame must block movement`);
  }
  disposeObject(group);
});

test('right-angle corridor transforms compile consistently and spawn rotation combines local and room orientation', () => {
  const input = clone(); input.rooms = [{ id: 'hall', prefab: 'straight-corridor', position: [20, 4, -10], size: [8, 8, 16], yaw: 90, materialPreset: 'industrial-blue' }];
  input.connections = []; input.playerSpawn = { roomId: 'hall', position: [0, 0, 3], rotation: [0, 0, 0, 1] };
  input.entities = [{ id: 'exit', kind: 'exit', roomId: 'hall', position: [0, 0, -3], radius: 1.5 }];
  input.mission = { type: 'clear-and-exit', requiredEnemyIds: [], exitId: 'exit' };
  const level = compileLevelDocument(input);
  assert.deepEqual(level.spawn, [23, 4, -10]); assert.deepEqual(level.mission.exit.position, [17, 4, -10]);
  const forward = v(0, 0, -1).applyQuaternion(new THREE.Quaternion(...level.spawnRotation));
  assert.ok(forward.distanceTo(v(-1, 0, 0)) < 1e-6);
  assert.deepEqual(toWorld(input.rooms[0], [1, 0, 0]), [20, 4, -11]);
});

function gameFixture(t) {
  t.mock.method(console, 'log', () => {}); t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {}, hideLevelSelect() {}, showMessage() {},
    showCompletion() {}, showGameOver() {}, showPauseMenu() {}, hidePauseMenu() {}, showSessionError(error) { throw error; } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session); game.projectileManager.setCanvas({});
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  const index = game.levelManager.levels.findIndex(level => level.id === 'mine-link');
  assert.ok(index >= 0); assert.equal(game.startSession({ endless: false, levelIndex: index }), true); game.updateSimulation(1 / 60);
  t.after(() => { game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose(); });
  return game;
}

function flyAxis(game, axis, target) {
  const keys = [['KeyA', 'KeyD'], ['ShiftLeft', 'Space'], ['KeyW', 'KeyS']][axis];
  for (let step = 0; step < 2400; step++) {
    if (game.session.phase !== 'playing') return;
    const error = target - game.spaceship.group.position.getComponent(axis), velocity = game.spaceship.velocity.getComponent(axis);
    if (Math.abs(error) < 0.08 && Math.abs(velocity) < 0.1) { game.inputManager.clearKeys(); return; }
    const control = error - velocity * 0.45;
    game.inputManager.keyStates = Math.abs(control) < 0.04 ? {} : { [keys[control < 0 ? 0 : 1]]: true };
    game.updateSimulation(1 / 60);
  }
  assert.fail(`Unable to fly axis ${axis} to ${target}: ${game.spaceship.group.position.toArray()}`);
}

test('document mission uses the real game path, flies its loop and hatch, completes once and restarts cleanly', t => {
  const game = gameFixture(t), authored = serializeLevelDocument(sample);
  assert.equal(game.enemyManager.enemies.length, 2); assert.equal(game.gameState.weaponInventory.pulse.ammo, 60);
  // Normal damage/objective path; navigation is real input and swept collision.
  for (const enemy of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(enemy, { power: 100 }, enemy.mesh.position);
  assert.equal(game.mission.ready, true);
  for (const [axis, target] of [[2, 0], [2, -16], [0, 16], [2, 0], [0, 0], [0, 16], [1, 12], [1, 0], [1, 12], [2, -4]]) flyAxis(game, axis, target);
  assert.equal(game.session.phase, 'completed'); assert.equal(game.gameState.score, 1150);
  game.updateSimulation(1); assert.equal(game.gameState.score, 1150);
  assert.equal(serializeLevelDocument(game.levelManager.currentLevel.sourceDocument), authored);
  game.restartLevel(); game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'playing'); assert.equal(game.gameState.score, 0); assert.equal(game.gameState.weaponInventory.pulse.ammo, 60);
  assert.equal(game.enemyManager.enemies.length, 2); assert.equal(game.mission.ready, false);
  assert.ok(game.spaceship.group.position.distanceTo(v(0, 0, 4)) < 1e-6); assert.equal(game.spaceship.velocity.length(), 0);
});

test('ten document-level restarts preserve spawn, immutable authoring data and wall resources', t => {
  const game = gameFixture(t), baseline = game.scene.children.length, source = serializeLevelDocument(sample);
  for (let i = 0; i < 10; i++) {
    const old = game.levelManager.levelSegments[0].children.find(child => child instanceof THREE.Mesh);
    let disposed = 0; old.geometry.addEventListener('dispose', () => disposed++);
    game.restartLevel(); game.updateSimulation(1 / 60);
    assert.equal(disposed, 1); assert.equal(game.levelManager.solidColliders.length, 60);
    assert.equal(game.scene.children.length, baseline); assert.equal(serializeLevelDocument(game.levelManager.currentLevel.sourceDocument), source);
  }
});

test('document start rejects invalid data before changing the current run or its catalog', t => {
  const game = gameFixture(t), id = game.session.id, group = game.levelManager.levelSegments[0];
  const catalog = [...game.levelManager.levels], input = clone(); input.connections.pop();
  assert.throws(() => game.startLevelDocument(input), LevelDocumentError);
  assert.equal(game.session.id, id); assert.equal(game.session.phase, 'playing'); assert.equal(group.parent, game.scene);
  assert.deepEqual(game.levelManager.levels, catalog); assert.equal(game.importedLevelIndex, null);
});

test('document preparation is detached and game imports reuse one slot, reset sessions and preserve authoring data', t => {
  const game = gameFixture(t), initialLength = game.levelManager.levels.length;
  const prepared = prepareLevelDocument(sample); assert.equal(prepared.world.group.parent, null); assert.equal(prepared.world.claimed, false);
  disposeObject(prepared.world.group);
  const input = clone(); input.name = 'Imported mine'; input.playerSpawn.rotation = [0, 1, 0, 0];
  assert.equal(game.startLevelDocument(input), true); game.updateSimulation(1 / 60);
  assert.equal(game.levelManager.levels.length, initialLength + 1);
  assert.equal(game.currentLevelIndex, initialLength); assert.equal(game.levelManager.currentLevel.name, 'Imported mine');
  assert.ok(game.spaceship.group.quaternion.equals(new THREE.Quaternion(0, 1, 0, 0)));
  const snapshot = game.levelManager.currentLevel.sourceDocument; input.name = 'Caller edit'; assert.equal(snapshot.name, 'Imported mine');
  game.restartLevel(); assert.equal(game.levelManager.currentLevel.sourceDocument, snapshot);
  assert.equal(game.startLevelDocument(sample), true); assert.equal(game.levelManager.levels.length, initialLength + 1);
  assert.equal(game.currentLevelIndex, initialLength); assert.equal(game.gameState.weaponInventory.pulse.ammo, 60);
});

test('failed candidate construction releases attached resources while preserving the current run', t => {
  const game = gameFixture(t), id = game.session.id, current = game.levelManager.levelSegments[0], resources = new Map();
  const originalAdd = THREE.Group.prototype.add, failure = new Error('staging failed');
  t.mock.method(THREE.Group.prototype, 'add', function (...objects) {
    const result = originalAdd.apply(this, objects);
    for (const object of objects) if (object instanceof THREE.Mesh) for (const resource of [object.geometry, object.material]) {
      if (!resources.has(resource)) { resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1)); }
    }
    if (objects.some(object => object instanceof THREE.HemisphereLight)) throw failure;
    return result;
  });
  assert.throws(() => game.startLevelDocument(sample), error => error === failure);
  assert.equal(game.session.id, id); assert.equal(game.session.phase, 'playing'); assert.equal(current.parent, game.scene);
  assert.equal(game.importedLevelIndex, null); assert.ok(resources.size > 0); assert.ok([...resources.values()].every(count => count === 1));
});

test('a mounted candidate failure follows session recovery and releases its claimed world once', t => {
  const game = gameFixture(t), resources = new Map(), failure = new Error('mount failed');
  t.mock.method(console, 'error', () => {}); game.uiManager.showSessionError = () => {};
  t.mock.method(game.scene, 'add', group => {
    group.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      for (const resource of [child.geometry, child.material]) if (!resources.has(resource)) {
        resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
      }
    });
    throw failure;
  });
  assert.equal(game.startLevelDocument(sample), false); assert.equal(game.session.phase, 'error');
  assert.equal(game.levelManager.levelSegments.length, 0); assert.ok(resources.size > 0);
  assert.ok([...resources.values()].every(count => count === 1));
});

test('a failure during exit marker construction releases its partial subtree and preserves the current run', t => {
  const game = gameFixture(t), id = game.session.id, current = game.levelManager.levelSegments[0], resources = new Map();
  const originalAdd = THREE.Group.prototype.add, failure = new Error('marker failed');
  t.mock.method(THREE.Group.prototype, 'add', function (...objects) {
    const result = originalAdd.apply(this, objects);
    for (const object of objects) if (object instanceof THREE.Mesh) for (const resource of [object.geometry, object.material]) {
      if (!resources.has(resource)) { resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1)); }
    }
    if (objects.some(object => object.geometry instanceof THREE.TorusGeometry)) throw failure;
    return result;
  });
  assert.throws(() => game.startLevelDocument(sample), error => error === failure);
  assert.equal(game.session.id, id); assert.equal(current.parent, game.scene);
  assert.ok(resources.size > 120); assert.ok([...resources.values()].every(count => count === 1));
});

test('exit marker variants fit their declared visual clearance as the trigger radius changes', () => {
  for (const radius of [0.75, 1.5, 4]) {
    const input = clone(); input.entities[4].position = [0, 0, 0]; input.entities[4].radius = radius;
    const level = compileLevelDocument(input), { group } = buildArena(level);
    const marker = group.getObjectByName('mine:exit'), bounds = new THREE.Box3().setFromObject(marker);
    const center = v(...level.mission.exit.position), extent = bounds.getSize(v()).multiplyScalar(0.5);
    assert.ok(bounds.getCenter(v()).distanceTo(center) < 1e-5);
    assert.ok(extent.x <= radius + EXIT_MARKER_MARGIN && extent.y <= radius + EXIT_MARKER_MARGIN);
    disposeObject(group);
  }
});
