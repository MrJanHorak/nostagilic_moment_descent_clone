import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { segmentBoxFraction, segmentSphereFraction, traceShot, hasLineOfSight } from '../src/js/utils/combatTrace.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const box = (min, max) => new THREE.Box3(v(...min), v(...max));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function fixture(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game();
  game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  game.results = [];
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {},
    hideLevelSelect() {}, showPauseMenu() {}, hidePauseMenu() {}, createStartScreen() {},
    showCompletion() { game.results.push('completed'); }, showGameOver() { game.results.push('dead'); },
    showSessionError(error) { throw error; } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session);
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager);
  game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {});
  t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  game.startSession({ endless: false, levelIndex: 1 });
  game.updateSimulation(1 / 60);
  t.after(() => game.endSession());
  return game;
}

function shot(game, start, velocity, power = 5, options = {}) {
  const projectile = game.projectileManager.createProjectile(start, new THREE.Quaternion(), { power, trailType: null, ...options });
  projectile.velocity.copy(velocity);
  return projectile;
}

function hostile(game, start, velocity, power = 10) {
  const manager = game.enemyManager.projectileManager;
  const enemy = game.enemyManager.enemies[0];
  const projectile = manager.fireEnemyProjectile(enemy, game.spaceship.group);
  projectile.mesh.position.copy(start); projectile.velocity.copy(velocity); projectile.power = power;
  delete projectile.launchOrigin;
  return projectile;
}

test('finite traces handle zero travel, start overlap, parallel axes and sphere crossings', () => {
  const wall = box([0, -1, -1], [0.01, 1, 1]);
  near(segmentBoxFraction(v(-10), v(10), wall), 0.5);
  assert.equal(segmentBoxFraction(v(-1, 2), v(1, 2), wall), null);
  assert.equal(segmentBoxFraction(v(), v(), wall), 0);
  assert.equal(segmentBoxFraction(v(-2), v(-2), wall), null);
  near(segmentSphereFraction(v(-10), v(10), v(), 0.5), 0.475);
  assert.equal(segmentSphereFraction(v(), v(), v(), 0.5), 0);
  assert.equal(segmentSphereFraction(v(-10, 2), v(10, 2), v(), 0.5), null);
});

test('earliest hit wins regardless of target ordering; wall wins an exact tie', () => {
  const close = { isActive: true, collider: box([2, -1, -1], [3, 1, 1]) };
  const far = { isActive: true, collider: box([6, -1, -1], [7, 1, 1]) };
  assert.equal(traceShot(v(), v(10), { targets: [far, close] }).target, close);
  const wall = { box: close.collider };
  assert.equal(traceShot(v(), v(10), { colliders: [wall], targets: [close] }).kind, 'wall');
  close.isActive = false;
  assert.equal(traceShot(v(), v(10), { targets: [close] }), null);
});

test('real arena doorway admits shots; divider, lintel and pillar occlude them', (t) => {
  const game = fixture(t), colliders = game.levelManager.solidColliders;
  assert.equal(hasLineOfSight(v(0, 0, 6), v(0, 0, -20), colliders), true);
  for (const [start, end] of [[v(6, 0, 6), v(6, 0, -20)], [v(0, 4, 6), v(0, 4, -20)], [v(5, 0, -10), v(5, 0, -24)]]) {
    assert.equal(hasLineOfSight(start, end, colliders), false);
  }
});

test('fast player shot crosses a target between endpoints and applies one hit exactly once', (t) => {
  const game = fixture(t), enemy = game.enemyManager.enemies[0], initial = enemy.health;
  const projectile = shot(game, v(), v(0, 0, -1800));
  let disposed = 0; projectile.mesh.material.addEventListener('dispose', () => disposed++);
  game.updateSimulation(1 / 60);
  assert.equal(enemy.health, initial - 5);
  assert.equal(game.projectileManager.projectiles.length, 0);
  assert.equal(disposed, 1);
  game.updateSimulation(1 / 60);
  assert.equal(enemy.health, initial - 5);
});

test('wall before target blocks damage; a nearer target in front of the wall takes it', (t) => {
  const game = fixture(t), enemy = game.enemyManager.enemies[0], initial = enemy.health;
  game.levelManager.solidColliders.push({ box: box([-2, -2, -6], [2, 2, -5.99]) });
  shot(game, v(), v(0, 0, -1800)); game.updateSimulation(1 / 60);
  assert.equal(enemy.health, initial);
  shot(game, v(0, 0, -12), v(0, 0, -1800)); game.updateSimulation(1 / 60);
  assert.equal(enemy.health, initial - 5);
});

test('player muzzle cannot launch a shot through a wall or skip a close target', (t) => {
  const game = fixture(t);
  const canvas = {}; document.pointerLockElement = canvas; game.projectileManager.setCanvas(canvas);
  game.levelManager.solidColliders.push({ box: box([-2, -2, 4.9], [2, 2, 5]) });
  const projectile = game.projectileManager.fireProjectile(game.gameState);
  assert.equal(projectile.power, 5);
  game.updateSimulation(1 / 60);
  near(projectile.mesh.position.z, 5.05);
  assert.equal(game.projectileManager.projectiles.length, 0);
  game.levelManager.solidColliders.pop();
  const enemy = game.enemyManager.enemies[0];
  enemy.mesh.position.set(0, 0, 4.8); enemy.collider.setFromObject(enemy.mesh);
  const initial = enemy.health;
  game.projectileManager.fireProjectile(game.gameState);
  game.projectileManager.updateProjectiles(0);
  assert.equal(enemy.health, initial - 5);
});

test('enemy muzzle path also stops at a wall before its visible spawn point', (t) => {
  const game = fixture(t), enemy = game.enemyManager.enemies[0];
  game.levelManager.solidColliders.push({ box: box([-2, -2, -17.7], [2, 2, -17.69]) });
  enemy.mesh.lookAt(game.spaceship.group.position);
  const manager = game.enemyManager.projectileManager;
  const projectile = manager.fireEnemyProjectile(enemy, game.spaceship.group);
  manager.updateProjectiles(1 / 60, game.spaceship.group, game.gameState);
  assert.equal(manager.enemyProjectiles.length, 0);
  assert.ok(projectile.mesh.position.z < -17.7);
});

test('enemy shot sweeps through player once; a wall shields the player and blocks both factions', (t) => {
  const game = fixture(t), manager = game.enemyManager.projectileManager;
  hostile(game, v(0, 0, -4), v(0, 0, 1200));
  const initial = game.gameState.playerHealth;
  manager.updateProjectiles(1 / 60, game.spaceship.group, game.gameState);
  assert.equal(game.gameState.playerHealth, initial - 10);
  manager.updateProjectiles(1 / 60, game.spaceship.group, game.gameState);
  assert.equal(game.gameState.playerHealth, initial - 10);
  game.levelManager.solidColliders.push({ box: box([-2, -2, 0], [2, 2, 0.01]) });
  hostile(game, v(0, 0, -4), v(0, 0, 1200));
  manager.updateProjectiles(1 / 60, game.spaceship.group, game.gameState);
  assert.equal(game.gameState.playerHealth, initial - 10);
  assert.equal(manager.enemyProjectiles.length, 0);
});

test('travel is clipped to remaining lifetime; paused shots and damage stay frozen', (t) => {
  const game = fixture(t);
  const projectile = shot(game, v(0, 4, 0), v(0, 0, -1));
  game.session.advance(4);
  game.projectileManager.updateProjectiles(4);
  near(projectile.mesh.position.z, -3);
  assert.equal(game.projectileManager.projectiles.length, 0);
  const frozen = shot(game, v(), v(0, 0, -1800));
  hostile(game, v(0, 0, 0), v(0, 0, 1200));
  game.pauseGame(); const health = game.gameState.playerHealth;
  game.projectileManager.updateProjectiles(100);
  game.enemyManager.projectileManager.updateProjectiles(100, game.spaceship.group, game.gameState);
  near(frozen.mesh.position.length(), 0); assert.equal(game.gameState.playerHealth, health);
});

test('hidden enemies neither track nor fire; visible fighters pursue and fire after cooldown', (t) => {
  const game = fixture(t), fighter = game.enemyManager.enemies[0];
  fighter.mesh.position.set(6, 0, -14);
  const initial = fighter.mesh.position.clone();
  for (let i = 0; i < 180; i++) game.updateSimulation(1 / 60);
  assert.ok(fighter.mesh.position.equals(initial));
  assert.equal(game.enemyManager.projectileManager.enemyProjectiles.length, 0);
  fighter.mesh.position.set(0, 0, -14);
  for (let i = 0; i < 30; i++) game.updateSimulation(1 / 60);
  assert.ok(fighter.mesh.position.z > -14);
  assert.ok(game.enemyManager.projectileManager.enemyProjectiles.length > 0);
});

test('enemy body cannot follow a clear sight ray through an opening narrower than its envelope', (t) => {
  const game = fixture(t), fighter = game.enemyManager.enemies[0];
  fighter.mesh.position.set(0, 0, -13); game.spaceship.group.position.set(0, 0, 5);
  // Narrow the existing doorway to two units; a center ray still sees through it.
  game.levelManager.solidColliders.push(
    { box: box([-2.5, -3, -8.5], [-1, 3, -7.5]) },
    { box: box([1, -3, -8.5], [2.5, 3, -7.5]) },
  );
  for (let i = 0; i < 360; i++) game.updateSimulation(1 / 60);
  assert.ok(fighter.mesh.position.z < -8.5);
  for (const collider of game.levelManager.solidColliders) {
    assert.ok(collider.box.distanceToPoint(fighter.mesh.position) >= fighter.collisionRadius - 1e-6, collider.id);
  }
});

test('lethal projectile scoring/completion is latched and ten restarts restore the encounter', (t) => {
  const game = fixture(t), definition = JSON.stringify(game.levelManager.currentLevel);
  for (let i = 0; i < 10; i++) {
    for (const enemy of [...game.enemyManager.enemies]) {
      // Exercise real projectile ownership, tracing, damage, score, spawn IDs and completion.
      const start = enemy.mesh.position.clone().add(v(0, 0, 2));
      shot(game, start, v(0, 0, -600), 100);
      game.projectileManager.updateProjectiles(1 / 60);
    }
    assert.equal(game.session.phase, 'completed');
    assert.equal(game.gameState.score, 1150);
    assert.equal(game.enemyManager.destroyedPredefinedEnemies.size, 2);
    assert.equal(game.completeSession(), false);
    assert.equal(game.results.length, i + 1);
    game.restartGame(); game.updateSimulation(1 / 60);
    assert.equal(game.session.phase, 'playing'); assert.equal(game.gameState.score, 0);
    assert.equal(game.enemyManager.enemies.length, 2);
    assert.equal(game.projectileManager.projectiles.length, 0);
    assert.equal(game.enemyManager.projectileManager.enemyProjectiles.length, 0);
    assert.equal(JSON.stringify(game.levelManager.currentLevel), definition);
  }
});

test('multiple lethal enemy shots dispatch death once and stop remaining damage', (t) => {
  const game = fixture(t), manager = game.enemyManager.projectileManager;
  for (let i = 0; i < 3; i++) hostile(game, v(0, 0, -2), v(0, 0, 1200), 1000);
  manager.updateProjectiles(1 / 60, game.spaceship.group, game.gameState);
  assert.equal(game.session.phase, 'dead'); assert.deepEqual(game.results, ['dead']);
  assert.equal(manager.enemyProjectiles.length, 2);
  game.restartGame();
  assert.equal(manager.enemyProjectiles.length, 0);
});

test('finite encounter fires pulse from the real pose and blocks unfinished weapons before consuming ammo', (t) => {
  const game = fixture(t), manager = game.projectileManager, canvas = {};
  document.pointerLockElement = canvas; manager.setCanvas(canvas);
  game.gameState.weaponInventory.laser = { unlocked: true, ammo: 10 };
  game.gameState.currentWeapon = 'laser';
  assert.equal(manager.fireProjectile(game.gameState), undefined);
  assert.equal(game.gameState.weaponInventory.laser.ammo, 10);
  assert.equal(manager.projectiles.length, 0);
  game.gameState.currentWeapon = 'pulse';
  const fighter = game.enemyManager.enemies[0];
  // Keep the initial forward pose; five ordinary pulse shots travel through the doorway.
  for (let i = 0; i < 5; i++) manager.fireProjectile(game.gameState);
  for (let i = 0; i < 120; i++) game.updateSimulation(1 / 60);
  assert.equal(fighter.isActive, false);
  assert.equal(game.gameState.score, 100);
  assert.equal(game.enemyManager.destroyedPredefinedEnemies.size, 1);
  assert.equal(game.session.phase, 'playing'); // A second enemy still exists.
});
