import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { segmentBoxFraction, segmentSphereFraction, traceShot, hasLineOfSight } from '../src/js/utils/combatTrace.js';
import MissionObjective from '../src/js/core/MissionObjective.js';
import createCombatArena from '../src/js/core/levels/CombatArena.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';
import EnemyFactory from '../src/js/entities/EnemyFactory.js';
import { enemyTypes } from '../src/js/entities/EnemyTypes.js';
import disposeObject from '../src/js/utils/disposeObject.js';

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
    hideLevelSelect() {}, showPauseMenu() {}, hidePauseMenu() {}, createStartScreen() {}, showMessage() {},
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

test('finite arena keeps one light per enemy without losing emissive model geometry', t => {
  const game = fixture(t);
  assert.equal(game.enemyManager.enemies.length, 2);
  for (const enemy of game.enemyManager.enemies) {
    let lights = 0, emissiveMeshes = 0;
    enemy.mesh.traverse(child => {
      if (child.isLight) lights++;
      if (child.isMesh && child.material.emissive?.getHex()) emissiveMeshes++;
    });
    assert.equal(lights, 1);
    assert.ok(emissiveMeshes > 0);
  }
});

test('light reduction preserves meshes, colliders and body clearance; default factory retains legacy lights', () => {
  const factory = new EnemyFactory(new THREE.Scene());
  for (const [name, fullLights] of [['fighter', 4], ['scout', 3]]) {
    const type = enemyTypes.find(type => type.name === name);
    const full = factory.createEnemy(type, v(1, 2, 3));
    const reduced = factory.createEnemy(type, v(1, 2, 3), null, { accentLights: false });
    const counts = enemy => {
      let lights = 0, meshes = 0;
      enemy.mesh.traverse(child => { if (child.isLight) lights++; if (child.isMesh) meshes++; });
      return { lights, meshes };
    };
    assert.equal(counts(full).lights, fullLights);
    assert.equal(counts(reduced).lights, 1);
    assert.equal(counts(full).meshes, counts(reduced).meshes);
    assert.ok(full.collider.equals(reduced.collider));
    assert.equal(full.collisionRadius, reduced.collisionRadius);
    disposeObject(full.mesh); disposeObject(reduced.mesh);
  }
});

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

test('ten shot-clear/extraction/restart cycles award completion only at the exit and restore the encounter', (t) => {
  const game = fixture(t), definition = JSON.stringify(game.levelManager.currentLevel);
  for (let i = 0; i < 10; i++) {
    for (const enemy of [...game.enemyManager.enemies]) {
      // Exercise real projectile ownership, tracing, damage, score, spawn IDs and completion.
      const start = enemy.mesh.position.clone().add(v(0, 0, 2));
      shot(game, start, v(0, 0, -600), 100);
      game.projectileManager.updateProjectiles(1 / 60);
    }
    assert.equal(game.session.phase, 'playing');
    assert.equal(game.gameState.score, 150);
    assert.equal(game.mission.ready, true);
    assert.equal(game.completeSession(), false);
    game.spaceship.group.position.copy(game.mission.exitPosition);
    game.updateSimulation(1 / 60);
    assert.equal(game.session.phase, 'completed');
    assert.equal(game.gameState.score, 1150);
    assert.equal(game.enemyManager.destroyedPredefinedEnemies.size, 2);
    assert.equal(game.completeSession(), false);
    assert.equal(game.results.length, i + 1);
    game.restartGame(); game.updateSimulation(1 / 60);
    assert.equal(game.session.phase, 'playing'); assert.equal(game.gameState.score, 0);
    assert.equal(game.enemyManager.enemies.length, 2);
    assert.equal(game.powerUpManager.powerups.length, 2);
    assert.equal(game.gameState.weaponInventory.pulse.ammo, 40);
    assert.equal(game.mission.ready, false);
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

function clearWithShots(game) {
  for (const enemy of [...game.enemyManager.enemies]) {
    shot(game, enemy.mesh.position.clone().add(v(0, 0, 2)), v(0, 0, -600), 100);
    game.projectileManager.updateProjectiles(1 / 60);
  }
}

test('objective accepts each required combat event once, filters cleanup/unknown IDs and requires full exit clearance', () => {
  const mission = new MissionObjective(createCombatArena().mission);
  assert.equal(mission.recordDefeat('combat:fighter', 'cleanup'), false);
  assert.equal(mission.recordDefeat('unknown', 'shot'), false);
  assert.equal(mission.tryComplete(v(0, 0, -24), 0.5), false);
  assert.equal(mission.recordDefeat('combat:fighter', 'shot'), true);
  assert.equal(mission.recordDefeat('combat:fighter', 'ram'), false);
  assert.equal(mission.recordDefeat('combat:scout', 'ram'), true);
  assert.equal(mission.canExit(v(0, 0, -22.99), 0.5), false);
  assert.equal(mission.tryComplete(v(0, 0, -23), 0.5), true);
  assert.equal(mission.tryComplete(v(0, 0, -24), 0.5), false);
  assert.deepEqual([...mission.defeats.values()], ['shot', 'ram']);
});

test('locked exit and direct completion cannot bypass the objective; marker unlocks after real shots', (t) => {
  const game = fixture(t);
  game.spaceship.group.position.copy(game.mission.exitPosition);
  game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'playing');
  assert.equal(game.completeSession(), false);
  const marker = game.levelManager.levelSegments[0].getObjectByName('arena:exit');
  assert.equal(marker.children[0].material.color.getHex(), 0xffb343);
  game.spaceship.group.position.set(0, 0, 6);
  clearWithShots(game); game.updateSimulation(1 / 60);
  assert.equal(marker.children[0].material.color.getHex(), 0x45ff96);
  assert.equal(game.gameState.score, 150);
  game.spaceship.group.position.copy(game.mission.exitPosition); game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'completed');
  game.updateSimulation(1); assert.equal(game.gameState.score, 1150);
});

test('ramming neutralizes a required drone without kill points or kill statistics', (t) => {
  const game = fixture(t), scout = game.enemyManager.enemies.find(e => e.type.name === 'scout');
  game.spaceship.group.position.copy(scout.mesh.position).add(v(0, 0, 1));
  game.updateSimulation(1 / 60);
  assert.equal(scout.isActive, false);
  assert.equal(game.mission.defeats.get('combat:scout'), 'ram');
  assert.equal(game.gameState.score, 0); assert.equal(game.gameState.enemyKills.scout, 0);
  assert.equal(game.gameState.playerHealth, 95);
  clearWithShots(game); assert.equal(game.mission.ready, true);
  game.spaceship.group.position.copy(game.mission.exitPosition); game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'completed'); assert.equal(game.gameState.score, 1100);
});

test('ordinary enemy cleanup neither advances objective nor awards points; fatal ramming cannot unlock the exit', (t) => {
  const game = fixture(t);
  game.enemyManager.removeEnemy(0);
  assert.equal(game.mission.defeats.size, 0); assert.equal(game.gameState.score, 0);
  const scout = game.enemyManager.enemies[0];
  game.gameState.playerHealth = 1;
  game.spaceship.group.position.copy(scout.mesh.position).add(v(0, 0, 1));
  game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'dead'); assert.equal(game.mission.ready, false);
  assert.equal(game.mission.defeats.size, 0);
  game.restartGame(); game.updateSimulation(1 / 60);
  assert.equal(game.enemyManager.enemies.length, 2); assert.equal(game.mission.defeats.size, 0);
});

test('authored exit and pickups are inside open space and definitions remain immutable', (t) => {
  const game = fixture(t), level = game.levelManager.currentLevel;
  const spots = [[v(...level.mission.exit.position), level.mission.exit.radius],
    ...level.powerupSpawns.map(spawn => [spawn.position, 0.55])];
  for (const [position, radius] of spots) for (const collider of game.levelManager.solidColliders) {
    assert.ok(collider.box.distanceToPoint(position) >= radius, collider.id);
  }
  assert.ok(Object.isFrozen(level.mission.exit.position));
  assert.ok(Object.isFrozen(level.powerupSpawns[0].position));
  assert.deepEqual(game.powerUpManager.powerups.map(p => p.spawnId).sort(), ['arena:ammo', 'arena:health']);
});

test('authored health waits when full, heals once and does not respawn before restart', (t) => {
  const game = fixture(t), powers = game.powerUpManager;
  const health = powers.powerups.find(p => p.spawnId === 'arena:health');
  game.spaceship.group.position.copy(health.mesh.position);
  powers.update(0); assert.ok(powers.powerups.includes(health));
  game.gameState.playerHealth = 60;
  powers.update(0); assert.equal(game.gameState.playerHealth, 85);
  powers.update(0); assert.equal(game.gameState.playerHealth, 85);
  assert.equal(powers.powerups.length, 1);
  game.restartGame(); game.updateSimulation(1 / 60);
  assert.equal(game.gameState.playerHealth, 100);
  assert.equal(powers.powerups.length, 2);
});

test('authored ammo refills pulse by 20 with a capacity cap and stays when full', (t) => {
  const game = fixture(t), powers = game.powerUpManager;
  const ammo = powers.powerups.find(p => p.spawnId === 'arena:ammo');
  game.spaceship.group.position.copy(ammo.mesh.position);
  game.gameState.weaponInventory.pulse.ammo = 80;
  powers.update(0); assert.ok(powers.powerups.includes(ammo));
  game.gameState.weaponInventory.pulse.ammo = 75;
  powers.update(0); assert.equal(game.gameState.weaponInventory.pulse.ammo, 80);
  powers.update(0); assert.equal(powers.powerups.length, 1);
  game.restartGame(); game.updateSimulation(1 / 60);
  game.gameState.weaponInventory.pulse.ammo = 0;
  game.spaceship.group.position.set(-3, 0, 1); powers.update(0);
  assert.equal(game.gameState.weaponInventory.pulse.ammo, 20);
});

test('authored pickups persist after twenty seconds and cannot be collected through a solid', (t) => {
  const game = fixture(t), powers = game.powerUpManager;
  game.session.advance(21); powers.update(21);
  assert.equal(powers.powerups.length, 2);
  const ammo = powers.powerups.find(p => p.spawnId === 'arena:ammo');
  game.spaceship.group.position.copy(ammo.mesh.position).add(v(0.6));
  game.levelManager.solidColliders.push({ box: box([-2.8, -2, 0], [-2.79, 2, 2]) });
  powers.update(0); assert.ok(powers.powerups.includes(ammo));
  game.levelManager.solidColliders.pop(); powers.update(0);
  assert.equal(game.gameState.weaponInventory.pulse.ammo, 60);
});

test('F fires once per press without capture, consumes ammo, and is disabled during pause/menu/death', (t) => {
  const game = fixture(t), manager = game.projectileManager;
  manager.setCanvas({});
  const key = { code: 'KeyF', repeat: false };
  game.inputManager.onKeyDown(key);
  assert.equal(manager.projectiles.length, 1); assert.equal(game.gameState.weaponInventory.pulse.ammo, 39);
  game.inputManager.onKeyDown({ ...key, repeat: true }); assert.equal(manager.projectiles.length, 1);
  game.pauseGame(); game.inputManager.onKeyDown(key); assert.equal(manager.projectiles.length, 1);
  game.resumeGame(); game.gameState.takeDamage(1000);
  game.inputManager.onKeyDown(key); assert.equal(manager.projectiles.length, 1);
  game.endSession(); game.inputManager.onKeyDown(key); assert.equal(manager.projectiles.length, 0);
});

test('empty pulse cannot fire or go negative; quiet flight practice restores unlimited ammo', (t) => {
  const game = fixture(t); game.projectileManager.setCanvas({});
  game.gameState.weaponInventory.pulse.ammo = 0;
  for (let i = 0; i < 3; i++) game.inputManager.onKeyDown({ code: 'KeyF' });
  assert.equal(game.projectileManager.projectiles.length, 0);
  assert.equal(game.gameState.weaponInventory.pulse.ammo, 0);
  game.selectLevel(0);
  assert.equal(game.mission, null); assert.equal(game.gameState.weaponInventory.pulse.ammo, Infinity);
  game.updateSimulation(1); assert.equal(game.powerUpManager.powerups.length, 0);
});

test('pause freezes ready-exit completion; resume completes once; death at the exit wins over extraction', (t) => {
  const game = fixture(t);
  clearWithShots(game); game.spaceship.group.position.copy(game.mission.exitPosition);
  game.pauseGame(); game.advanceFrame(1); game.updateMission();
  assert.equal(game.session.phase, 'paused'); assert.equal(game.mission.completed, false);
  game.resumeGame(); game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'completed'); assert.deepEqual(game.results, ['completed']);
  game.restartGame(); game.updateSimulation(1 / 60);
  const enemyShot = hostile(game, v(), v(), 1000);
  clearWithShots(game);
  game.spaceship.group.position.copy(game.mission.exitPosition);
  enemyShot.mesh.position.copy(game.mission.exitPosition).add(v(0, 0, 2)); enemyShot.velocity.set(0, 0, -600);
  game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'dead'); assert.equal(game.mission.completed, false);
  assert.equal(game.gameState.score, 150); assert.deepEqual(game.results, ['completed', 'dead']);
});
