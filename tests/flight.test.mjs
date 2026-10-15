import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';
import SimulationStepper from '../src/js/core/SimulationStepper.js';

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

// Exercise Game's real movement/collision/frame pipeline with a quiet open space.
// Enemy AI/streaming are isolated here; their real managers run in session tests.
function flight() {
  const game = new Game();
  game.camera = new THREE.PerspectiveCamera();
  game.scene.add(game.camera);
  game.spaceship = new Spaceship();
  game.spaceship.attachCamera(game.camera);
  game.session.begin(); game.session.transition('playing');
  game.inputManager = new InputManager(game.camera, null, game.gameState);
  game.inputManager.game = game;
  const offset = () => assert.fail('flight moved the world');
  game.levelManager = { obstacles: [], tunnelWidth: Infinity, tunnelHeight: Infinity,
    updateLevel() {}, getLevelSegments: () => [], offsetLevel: offset };
  game.enemyManager = { setLevelSegments() {}, updateEnemies() {}, offsetEnemies: offset };
  game.projectileManager = { updateProjectiles() {}, getProjectiles: () => [], offsetProjectiles: offset };
  game.powerUpManager = { update() {}, offsetPowerUps: offset };
  game.isEndlessMode = false;
  game.uiManager = { updateHUD() {} };
  return game;
}

test('first-person camera inherits player pose and rendering never overwrites aim', (t) => {
  const game = flight();
  game.spaceship.group.position.set(2, 3, -7);
  game.spaceship.rotate(0.7, 2, 1);
  const orientation = game.spaceship.group.quaternion.clone();
  // No DOM or renderer needed to validate the animation path.
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => {};
  t.after(() => original === undefined ? delete globalThis.requestAnimationFrame : globalThis.requestAnimationFrame = original);
  game.clock = { getDelta: () => 0 };
  game.animate();
  assert.ok(game.camera.getWorldPosition(new THREE.Vector3()).equals(game.spaceship.group.position));
  near(game.camera.getWorldQuaternion(new THREE.Quaternion()).angleTo(orientation), 0, 1e-7);
  assert.ok(game.camera.position.equals(new THREE.Vector3()));
  assert.equal(game.spaceship.model.visible, false);
});

test('yawed forward thrust and inverted vertical thrust use the local frame', () => {
  const game = flight();
  game.spaceship.rotate(Math.PI / 2);
  game.inputManager.keyStates.KeyW = true;
  game.advanceFrame(1 / 60);
  assert.ok(game.spaceship.group.position.x < 0);
  near(game.spaceship.group.position.z, 0);
  game.spaceship.group.quaternion.identity();
  game.spaceship.rotate(0, 0, Math.PI);
  game.spaceship.velocity.set(0, 0, 0);
  game.inputManager.keyStates = { Space: true };
  game.advanceFrame(1 / 60);
  assert.ok(game.spaceship.velocity.y < 0);
  near(game.spaceship.velocity.x, 0);
});

test('diagonal thrust is normalized, opposing inputs cancel, and speed boost affects flight', () => {
  const ship = new Spaceship();
  ship.update(0.1, { forward: true, right: true, up: true });
  near(ship.velocity.length(), 0.8);
  ship.velocity.set(0, 0, 0);
  ship.update(0.1, { forward: true, backward: true });
  near(ship.velocity.length(), 0);
  const game = flight();
  game.gameState.speedMultiplier = 2;
  game.inputManager.keyStates.KeyW = true;
  for (let i = 0; i < 120; i++) game.advanceFrame(1 / 60);
  near(game.spaceship.velocity.length(), 12);
});

test('roll and pitch remain unrestricted, with quaternion normalization after repeated turns', () => {
  const game = flight();
  game.inputManager.keyStates = { KeyQ: true, ArrowUp: true, ArrowLeft: true };
  for (let i = 0; i < 600; i++) game.advanceFrame(1 / 60);
  near(game.spaceship.group.quaternion.length(), 1);
  assert.ok(game.spaceship.group.quaternion.angleTo(new THREE.Quaternion()) > 0.1);
  const ship = new Spaceship();
  ship.update(2, { pitchUp: true });
  near(new THREE.Vector3(0, 0, -1).applyQuaternion(ship.group.quaternion).z, -Math.cos(3));
});

test('30/60/120 FPS produce equivalent combined turns, thrust, coast, and simulation time', () => {
  const results = [30, 60, 120].map(fps => {
    const game = flight();
    game.inputManager.keyStates = { KeyW: true, KeyD: true, KeyE: true, ArrowRight: true };
    for (let i = 0; i < fps * 2; i++) game.advanceFrame(1 / fps);
    game.inputManager.clearKeys();
    for (let i = 0; i < fps; i++) game.advanceFrame(1 / fps);
    return game;
  });
  for (const game of results) {
    near(game.spaceship.group.position.distanceTo(results[0].spaceship.group.position), 0);
    near(game.spaceship.velocity.distanceTo(results[0].spaceship.velocity), 0);
    near(game.spaceship.group.quaternion.angleTo(results[0].spaceship.group.quaternion), 0, 1e-7);
    near(game.session.timeMs, 3000, 1e-7);
    assert.equal(game.session.steps, 180);
  }
});

test('coasting damping is time-scaled independently of render rate', () => {
  for (const fps of [30, 60, 120]) {
    const ship = new Spaceship(); ship.velocity.z = -6;
    for (let i = 0; i < fps; i++) ship.update(1 / fps);
    near(ship.velocity.length(), 6 * Math.pow(0.96, 60));
  }
});

test('frame stalls are bounded, pause discards partial time, and terminal callbacks stop remaining steps', () => {
  const game = flight();
  game.advanceFrame(10);
  assert.equal(game.session.steps, 6);
  game.advanceFrame(1 / 120);
  game.session.transition('paused'); game.advanceFrame(10);
  game.session.transition('playing'); game.advanceFrame(1 / 120);
  assert.equal(game.session.steps, 6);
  game.advanceFrame(1 / 120);
  assert.equal(game.session.steps, 7);
  game.session.schedule(1, () => game.session.transition('dead'));
  game.advanceFrame(0.1);
  assert.equal(game.session.steps, 8);
  assert.equal(game.stepper.accumulator, 0);
  const stepper = new SimulationStepper();
  for (const bad of [-1, NaN, Infinity]) stepper.advance(bad, () => assert.fail('invalid frame advanced'));
});

test('mouse input rotates the root without pitch clamping and is ignored outside active capture', (t) => {
  const game = flight();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvas = {}; game.inputManager.canvas = canvas;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: canvas } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  game.inputManager.onMouseMove({ movementX: 0, movementY: -1000 });
  const orientation = game.spaceship.group.quaternion.clone();
  near(orientation.angleTo(new THREE.Quaternion()), 2);
  assert.ok(game.camera.quaternion.equals(new THREE.Quaternion()));
  game.session.transition('paused');
  game.inputManager.onMouseMove({ movementX: 100, movementY: 100 });
  assert.ok(game.spaceship.group.quaternion.equals(orientation));
  game.session.transition('playing'); document.pointerLockElement = null;
  game.inputManager.onMouseMove({ movementX: 100, movementY: 100 });
  assert.ok(game.spaceship.group.quaternion.equals(orientation));
});

test('shots and pickups use the authoritative root, ignoring visual camera shake', (t) => {
  t.mock.method(Math, 'random', () => 0.5); // Remove enemy weapon spread for the direction assertion.
  const game = flight();
  const root = game.spaceship.group;
  root.position.set(10, 4, -8); game.spaceship.rotate(Math.PI / 2);
  game.spaceship.viewEffects.position.set(3, 2, 1);
  game.gameState.playerVelocity = game.spaceship.velocity;
  game.spaceship.velocity.set(-2, 0, 0);
  const shots = new ProjectileManager(game.scene, root, null, game.session);
  const canvas = {};
  shots.setCanvas(canvas);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: canvas } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const shot = shots.fireProjectile(game.gameState);
  assert.ok(shot);
  near(shot.mesh.position.x, 8); near(shot.mesh.position.y, 4); near(shot.mesh.position.z, -8);
  assert.ok(shot.velocity.x < -15); near(shot.velocity.y, 0); near(shot.velocity.z, 0);
  assert.ok(root.position.equals(new THREE.Vector3(10, 4, -8)));
  const enemy = { type: { name: 'fighter', size: 0.6 }, mesh: new THREE.Object3D() };
  enemy.mesh.position.set(5, 4, -8);
  shots.fireEnemyProjectile(enemy, root);
  assert.ok(shots.enemyProjectiles[0].velocity.x > 0);
  near(shots.enemyProjectiles[0].velocity.y, 0);
  game.gameState.playerHealth = 50;
  const powers = new PowerUpManager(game.scene, root, game.gameState, null, { updateHUD() {}, showMessage() {} });
  powers.spawnPowerup(root.position.clone(), 'health');
  powers.update(1 / 60);
  assert.ok(game.gameState.playerHealth > 50);
  assert.equal(powers.powerups.length, 0);
  shots.clear(); powers.clear();
});

test('overlapping damage shakes restore the view and never move the player collider', () => {
  const game = flight();
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  const original = game.spaceship.group.position.clone();
  game.gameState.takeDamage(1);
  game.advanceFrame(0.1);
  game.gameState.takeDamage(1);
  for (let i = 0; i < 10; i++) game.advanceFrame(0.1);
  assert.ok(game.spaceship.group.position.equals(original));
  assert.ok(game.camera.position.equals(new THREE.Vector3()));
  assert.ok(game.spaceship.viewEffects.position.equals(new THREE.Vector3()));
  assert.equal(game.activeAnimations.length, 0);
});
