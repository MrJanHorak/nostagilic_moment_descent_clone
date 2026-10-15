import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import createFlightArena from '../src/js/core/levels/FlightArena.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';
import disposeObject from '../src/js/utils/disposeObject.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const box = (min, max) => new THREE.Box3(v(...min), v(...max));
const near = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const free = (position, colliders, radius = 0.5) => {
  for (const collider of colliders) {
    assert.ok(collider.box.distanceToPoint(position) >= radius - 1e-6, `overlap with ${collider.id}`);
  }
};

function fixture(t) {
  t.mock.method(console, 'log', () => {});
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game();
  game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {},
    hideLevelSelect() {}, showPauseMenu() {}, hidePauseMenu() {}, createStartScreen() {},
    showSessionError(error) { throw error; } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session);
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager);
  game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {});
  t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  t.mock.method(console, 'log', () => {});
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  game.startSession({ endless: false, levelIndex: 0 });
  t.after(() => game.endSession());
  return game;
}

function drive(game, keys, seconds, fps = 60) {
  game.inputManager.keyStates = keys;
  for (let i = 0; i < Math.round(seconds * fps); i++) game.advanceFrame(1 / fps);
}

test('every arena solid has matching visible world geometry and one collider; spawn is clear', () => {
  const level = createFlightArena();
  const { group, colliders } = buildArena(level);
  assert.equal(colliders.length, level.solids.length);
  for (const collider of colliders) {
    const actual = new THREE.Box3().setFromObject(group.getObjectByName(collider.id));
    assert.ok(actual.equals(collider.box), collider.id);
  }
  free(v(...level.spawn), colliders);
  assert.ok(Object.isFrozen(level.solids[0].center));
  disposeObject(group);
});

test('fast sphere stops at a thin wall, removing only inward velocity', () => {
  const position = v(-5), velocity = v(600, 12);
  const result = moveSphere(position, velocity, 1 / 30, [box([0, -100, -100], [0.01, 100, 100])]);
  assert.equal(result.collided, true);
  assert.equal(result.limited, false);
  near(position.x, -0.5); near(position.y, 0.4);
  near(velocity.x, 0); near(velocity.y, 12);
});

test('sphere slides along a wall, leaves it freely, and handles simultaneous corner contacts', () => {
  const walls = [box([0, -10, -10], [1, 10, 10]), box([-10, 0, -10], [10, 1, 10])];
  const position = v(-1, -2), velocity = v(4, 3, 2);
  moveSphere(position, velocity, 1, walls);
  near(position.x, -0.5); near(position.y, -0.5); near(position.z, 2);
  near(velocity.x, 0); near(velocity.y, 0); near(velocity.z, 2);
  velocity.set(-2, -2, 0);
  moveSphere(position, velocity, 0.5, walls);
  assert.ok(position.x < -1.49 && position.y < -1.49, 'must not stick when leaving');
});

test('sphere uses rounded contacts at a box edge rather than an enlarged box footprint', () => {
  const position = v(-0.4, -0.4, -1), velocity = v(0, 0, 2);
  const result = moveSphere(position, velocity, 1, [box([0, 0, -10], [1, 1, 10])]);
  assert.equal(result.collided, false); near(position.z, 1);
});

test('shallow overlaps recover without NaNs or residual inward velocity', () => {
  const wall = box([0, -10, -10], [1, 10, 10]);
  for (const x of [-0.1, 0.1]) {
    const position = v(x), velocity = v(1);
    const result = moveSphere(position, velocity, 0, [wall]);
    assert.equal(result.unresolved, false);
    near(position.x, -0.5); near(velocity.x, 0);
  }
});

test('pathological travel has a bounded work budget and invalid numbers are rejected', () => {
  const position = v(), velocity = v(1e9);
  const result = moveSphere(position, velocity, 1, []);
  assert.equal(result.steps, 512); assert.equal(result.limited, true);
  assert.ok(position.x <= 64.0001); near(velocity.length(), 0);
  assert.throws(() => moveSphere(v(), v(), Infinity, []), /finite/);
  assert.throws(() => moveSphere(v(), v(), 1, [], 0), /positive radius/);
});

test('doorway allows travel both ways, including inverted flight, without global tunnel bounds', (t) => {
  const game = fixture(t);
  drive(game, { KeyW: true }, 4);
  assert.ok(game.spaceship.group.position.z < -15, 'cross into the second chamber');
  free(game.spaceship.group.position, game.levelManager.solidColliders);
  game.spaceship.velocity.set(0, 0, 0);
  game.spaceship.rotate(Math.PI, 0, Math.PI); // Turn back while inverted.
  drive(game, { KeyW: true }, 4);
  assert.ok(game.spaceship.group.position.z > 4, 'return through the opening');
  free(game.spaceship.group.position, game.levelManager.solidColliders);
  game.spaceship.group.position.set(9, 0, 3); // Old global bound was X=7.
  game.spaceship.velocity.set(0, 0, 0);
  game.advanceFrame(1 / 60);
  near(game.spaceship.group.position.x, 9);
});

test('solid divider and doorway lintel stop off-center and too-high traversal', () => {
  const { group, colliders } = buildArena(createFlightArena());
  for (const [x, y] of [[4, 0], [0, 3], [0, -3]]) {
    const position = v(x, y, 2), velocity = v(0, 0, -100);
    moveSphere(position, velocity, 0.2, colliders);
    assert.ok(position.z >= -7.0001, `${x}, ${y} passed a closed divider`);
    near(velocity.z, 0); free(position, colliders);
  }
  disposeObject(group);
});

test('all six outer boundaries block movement with matching sphere clearance', () => {
  const { group, colliders } = buildArena(createFlightArena());
  for (const [start, speed, axis, limit] of [
    [[0, 0, 4], [100, 0, 0], 'x', 9.5], [[0, 0, 4], [-100, 0, 0], 'x', -9.5],
    [[0, 0, 4], [0, 100, 0], 'y', 5.5], [[0, 0, 4], [0, -100, 0], 'y', -5.5],
    [[0, 0, 4], [0, 0, 100], 'z', 9.5], [[0, 0, -15], [0, 0, -100], 'z', -25.5],
  ]) {
    const position = v(...start), velocity = v(...speed);
    moveSphere(position, velocity, 0.5, colliders);
    near(position[axis], limit); near(velocity[axis], 0); free(position, colliders);
  }
  disposeObject(group);
});

test('sustained diagonal input slides against arena walls at equivalent 30/60/120 FPS', (t) => {
  const positions = [];
  for (const fps of [30, 60, 120]) {
    const game = fixture(t);
    game.spaceship.group.position.set(8, 0, 3);
    drive(game, { KeyD: true, KeyW: true }, 4, fps);
    near(game.spaceship.group.position.x, 9.5);
    assert.ok(game.spaceship.group.position.z < -6.5);
    free(game.spaceship.group.position, game.levelManager.solidColliders);
    positions.push(game.spaceship.group.position.clone());
  }
  for (const position of positions) near(position.distanceTo(positions[0]), 0, 1e-9);
});

test('arena stays fully loaded in both directions, and ten restarts dispose resources and reset pose', (t) => {
  const game = fixture(t);
  const definition = JSON.stringify(game.levelManager.currentLevel);
  for (let i = 0; i < 10; i++) {
    const arena = game.levelManager.levelSegments[0];
    const wall = arena.getObjectByName('floor');
    let disposed = 0; wall.geometry.addEventListener('dispose', () => disposed++);
    game.spaceship.group.position.set(0, 0, -24);
    game.levelManager.updateLevel();
    assert.equal(game.levelManager.levelSegments[0], arena);
    assert.equal(game.levelManager.segmentMap.size, 0);
    game.spaceship.group.position.set(0, 0, 8); game.spaceship.rotate(0.5, 1, 2);
    game.spaceship.velocity.set(1, 2, 3);
    game.restartGame();
    assert.equal(disposed, 1);
    assert.equal(arena.parent, null);
    assert.equal(game.scene.children.length, 2);
    assert.deepEqual(game.spaceship.group.position.toArray(), [0, 0, 6]);
    near(game.spaceship.velocity.length(), 0);
    assert.ok(game.spaceship.group.quaternion.equals(new THREE.Quaternion()));
    assert.equal(game.levelManager.solidColliders.length, 11);
    assert.equal(JSON.stringify(game.levelManager.currentLevel), definition);
  }
  game.showMainMenu();
  assert.equal(game.scene.children.length, 1);
  assert.equal(game.levelManager.solidColliders.length, 0);
});

test('quiet arena does not spawn enemies, award completion, or advance while paused', (t) => {
  const game = fixture(t);
  drive(game, {}, 10);
  assert.equal(game.session.phase, 'playing'); assert.equal(game.enemyManager.enemies.length, 0);
  assert.equal(game.gameState.score, 0);
  game.pauseGame(); const time = game.session.timeMs;
  drive(game, { KeyW: true }, 1);
  assert.equal(game.session.timeMs, time);
  assert.deepEqual(game.spaceship.group.position.toArray(), [0, 0, 6]);
});
