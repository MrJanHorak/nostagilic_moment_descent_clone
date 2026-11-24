import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import GameState from '../src/js/core/GameState.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import { MINE_BOMBER, advanceBomberAttack, blastDamage, createBomberAttack } from '../src/js/entities/BomberAttack.js';
import { DIFFICULTIES } from '../src/js/core/Difficulty.js';
import createCrossfireRelay from '../src/js/core/levels/CrossfireRelay.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const box = (min, max) => new THREE.Box3(v(...min), v(...max));

function fixture(t, authored = true) {
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  const scene = new THREE.Scene(), player = new THREE.Group();
  scene.add(player);
  const level = { currentLevel: authored ? { ...createCrossfireRelay(), powerupSpawns: [], enemySpawns: [] } : { kind: 'arena', enemySpawns: [] },
    solidColliders: [], tunnelWidth: 30, tunnelHeight: 20, isEndless: false };
  const enemies = new EnemyManager(scene, player, state, null, level);
  enemies.effectsManager.dynamicLights = false;
  const explosions = [];
  const effects = { createExplosion(position, _color, _explosive, radius) { explosions.push({ position: position.clone(), radius }); } };
  const bombs = enemies.projectileManager;
  t.after(() => { state.session.end(); enemies.resetLevel(); bombs.dispose(); enemies.effectsManager.dispose(); });
  /** Advance simulation time and bomb flight together. */
  const step = (seconds, frames = 1) => {
    for (let i = 0; i < frames; i++) { state.session.advance(seconds); bombs.updateProjectiles(seconds, player, state, effects); }
  };
  return { state, scene, player, level, enemies, bombs, explosions, step };
}

test('blast damage is full at the centre, falls to the edge factor at the rim and is zero outside', () => {
  assert.equal(blastDamage(0), MINE_BOMBER.blastDamage);
  assert.ok(Math.abs(blastDamage(MINE_BOMBER.blastRadius) - MINE_BOMBER.blastDamage * MINE_BOMBER.edgeFactor) < 1e-9);
  assert.ok(blastDamage(MINE_BOMBER.blastRadius / 2) < MINE_BOMBER.blastDamage && blastDamage(MINE_BOMBER.blastRadius / 2) > blastDamage(MINE_BOMBER.blastRadius));
  for (const distance of [MINE_BOMBER.blastRadius + 0.01, -1, Number.NaN, Infinity]) assert.equal(blastDamage(distance), 0);
});

test('every launch needs a full uninterrupted wind-up, then recovery; difficulty never removes the telegraph', () => {
  const state = createBomberAttack(0);
  const interval = MINE_BOMBER.intervalMs;
  let charged = -1, fired = -1;
  for (let now = 0; now <= 6000 && fired < 0; now += 50) {
    const event = advanceBomberAttack(state, now, true, interval);
    if (event === 'charge') charged = now;
    if (event === 'fire') fired = now;
  }
  assert.ok(charged >= 0 && fired - charged >= MINE_BOMBER.windupMs, 'the launch follows a complete wind-up');
  assert.equal(state.phase, 'recover');
  // Losing sight mid-charge cancels; the next launch needs a fresh full charge.
  const interrupted = createBomberAttack(0);
  let start = -1;
  for (let now = 0; now < 3000; now += 50) if (advanceBomberAttack(interrupted, now, true, interval) === 'charge') { start = now; break; }
  assert.equal(advanceBomberAttack(interrupted, start + 400, false, interval), null);
  assert.equal(interrupted.phase, 'idle');
  const enemies = new EnemyManager(new THREE.Scene(), new THREE.Group(), Object.assign(new GameState(), { difficulty: DIFFICULTIES.insane }), null, null);
  assert.ok(enemies.bomberInterval(100) >= MINE_BOMBER.windupMs + MINE_BOMBER.recoveryMs);
  enemies.projectileManager.dispose(); enemies.effectsManager.dispose();
});

test('authored bombers get the area-denial role and durability; legacy bombers keep the old behaviour', t => {
  const mine = fixture(t), legacy = fixture(t, false);
  const bomber = mine.enemies.spawnEnemy(v(0, 0, -12), 'bomber');
  assert.ok(bomber.bomberAttack, 'authored bomber has the charge/launch/recovery cycle');
  assert.equal(bomber.health, MINE_BOMBER.health);
  assert.ok(bomber.fireRate >= MINE_BOMBER.windupMs + MINE_BOMBER.recoveryMs);
  const old = legacy.enemies.spawnEnemy(v(0, 0, -12), 'bomber');
  assert.equal(old.bomberAttack, undefined); assert.equal(old.health, 50);
});

test('a visible bomber charges, then lobs one bomb at where the player was', t => {
  const { enemies, bombs, player, state } = fixture(t);
  const bomber = enemies.spawnEnemy(v(0, 0, -12), 'bomber');
  bomber.mesh.lookAt(player.position);
  t.mock.method(enemies, 'canSeePlayer', () => true);
  const events = [];
  for (let i = 0; i < 240 && bombs.enemyProjectiles.length === 0; i++) {
    state.session.advance(1 / 60);
    const before = bomber.bomberAttack.phase;
    enemies.updateBomberAttack(bomber, state.session.timeMs);
    if (before !== bomber.bomberAttack.phase) events.push([bomber.bomberAttack.phase, state.session.timeMs]);
  }
  assert.equal(bombs.enemyProjectiles.length, 1);
  const windup = events.find(([phase]) => phase === 'windup'), recover = events.find(([phase]) => phase === 'recover');
  assert.ok(windup && recover && recover[1] - windup[1] >= MINE_BOMBER.windupMs - 1e-6);
  const bomb = bombs.enemyProjectiles[0].bomb;
  assert.ok(bomb.target.equals(player.position), 'the bomb aims at a fixed point, not a homing target');
  player.position.set(5, 0, 0);
  assert.ok(bomb.target.equals(v()), 'moving after launch does not move the landing point');
});

test('a bomb lands at its target, shows its blast radius while arming, then detonates once', t => {
  const { enemies, bombs, player, state, explosions, step } = fixture(t);
  player.position.set(0, 0, 0);
  const bomber = enemies.spawnEnemy(v(0, 0, -10), 'bomber');
  const projectile = bombs.fireBomb(bomber, v(0, 0, -2));
  player.position.set(MINE_BOMBER.blastRadius + 2, 0, -2); // out of the blast
  step(1 / 60, 90);
  assert.notEqual(projectile.bomb.armedAt, null, 'landed and arming');
  assert.ok(projectile.mesh.position.distanceTo(v(0, 0, -2)) < 1e-6);
  assert.ok(projectile.velocity.lengthSq() === 0);
  const marker = projectile.mesh.getObjectByName('bomb_blast_radius');
  assert.ok(marker && Math.abs(marker.scale.x - MINE_BOMBER.blastRadius) < 1e-9);
  const health = state.playerHealth;
  step(1 / 60, Math.ceil(MINE_BOMBER.armMs / (1000 / 60)) + 2);
  assert.equal(bombs.enemyProjectiles.length, 0);
  assert.equal(explosions.length, 1); assert.equal(explosions[0].radius, MINE_BOMBER.blastRadius);
  assert.equal(state.playerHealth, health, 'leaving the marked area avoids all damage');
  assert.equal(projectile.mesh.parent, null, 'the bomb and its attached marker leave the scene');
});

test('standing in the blast takes falloff damage; a wall between the bomb and the player blocks it', t => {
  const inside = fixture(t);
  const bomber = inside.enemies.spawnEnemy(v(0, 0, -10), 'bomber');
  inside.bombs.fireBomb(bomber, v(0, 0, -2));
  inside.player.position.set(2, 0, -2);
  inside.step(1 / 60, 200);
  const expected = blastDamage(2 - 0.5);
  assert.ok(Math.abs((100 - inside.state.playerHealth) - expected) < 1e-6, `took ${100 - inside.state.playerHealth}, expected ${expected}`);

  const shielded = fixture(t);
  shielded.level.solidColliders.push({ box: box([0.8, -3, -4], [1, 3, 0]) });
  const other = shielded.enemies.spawnEnemy(v(0, 0, -10), 'bomber');
  shielded.bombs.fireBomb(other, v(0, 0, -2));
  shielded.player.position.set(2, 0, -2);
  shielded.step(1 / 60, 200);
  assert.equal(shielded.explosions.length, 1);
  assert.equal(shielded.state.playerHealth, 100, 'cover inside the radius protects the player');
});

test('a wall in the flight path makes the bomb stick and arm on the near side', t => {
  const { enemies, bombs, level, step } = fixture(t);
  level.solidColliders.push({ box: box([-3, -3, -5.2], [3, 3, -5]) });
  const bomber = enemies.spawnEnemy(v(0, 0, -10), 'bomber');
  const projectile = bombs.fireBomb(bomber, v(0, 0, 0));
  step(1 / 60, 60);
  assert.notEqual(projectile.bomb.armedAt, null);
  assert.ok(projectile.mesh.position.z < -5.2, 'stays on the bomber side of the wall');
});

test('a bomb passes through the ship in flight, then lands and warns before it can hurt anyone', t => {
  const { enemies, bombs, player, state, explosions, step } = fixture(t);
  player.position.set(0, 0, -4);
  const bomber = enemies.spawnEnemy(v(0, 0, -10), 'bomber');
  const projectile = bombs.fireBomb(bomber, v(0, 0, 0));
  step(1 / 60, 75); // 8.8 units at 8 units/s: it passes the ship at z = -4 and lands at z = 0
  assert.equal(explosions.length, 0, 'no instant detonation on contact');
  assert.equal(state.playerHealth, 100);
  assert.notEqual(projectile.bomb.armedAt, null, 'it landed at its target behind the ship');
  // The pilot stays inside the marked sphere: the blast lands after the full arming time.
  step(1 / 60, Math.ceil(MINE_BOMBER.armMs / (1000 / 60)) + 2);
  assert.equal(explosions.length, 1);
  assert.ok(Math.abs((100 - state.playerHealth) - blastDamage(4 - 0.5)) < 1e-6);
});

test('difficulty scales blast damage; pause freezes the fuse; restart removes armed bombs', t => {
  const hard = fixture(t);
  hard.state.difficulty = DIFFICULTIES.veteran;
  const bomber = hard.enemies.spawnEnemy(v(0, 0, -10), 'bomber');
  hard.bombs.fireBomb(bomber, v(0, 0, -2)); hard.player.position.set(0, 0, -2);
  hard.step(1 / 60, 200);
  assert.ok(Math.abs((100 - hard.state.playerHealth) - MINE_BOMBER.blastDamage * DIFFICULTIES.veteran.incomingDamage) < 1e-6);

  const paused = fixture(t);
  const other = paused.enemies.spawnEnemy(v(0, 0, -10), 'bomber');
  const projectile = paused.bombs.fireBomb(other, v(0, 0, -2));
  paused.step(1 / 60, 70);
  assert.notEqual(projectile.bomb.armedAt, null);
  paused.state.session.transition('paused');
  for (let i = 0; i < 300; i++) paused.bombs.updateProjectiles(1 / 60, paused.player, paused.state, { createExplosion() {} });
  assert.equal(paused.bombs.enemyProjectiles.length, 1, 'no detonation while paused');
  paused.state.session.transition('playing');
  const marker = projectile.mesh.getObjectByName('bomb_blast_radius');
  paused.bombs.clear();
  assert.equal(paused.bombs.enemyProjectiles.length, 0);
  assert.equal(projectile.mesh.parent, null);
  assert.equal(marker.parent, projectile.mesh);
  paused.step(1 / 60, 120);
  assert.equal(paused.explosions.length, 0, 'a cleared bomb never detonates later');
});

import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

function drill(t) {
  t.mock.method(console, 'log', () => {}); t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {}, hideLevelSelect() {},
    showMessage() {}, showPauseMenu() {}, hidePauseMenu() {}, showCompletion() {}, showGameOver() {}, showSessionError(error) { throw error; } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session); game.projectileManager.setCanvas({});
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  t.after(() => { game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose(); });
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'bomber-drill') });
  return game;
}

test('Bomber Drill: a real bomber charges, lobs, lands a marked bomb and detonates; restart clears it', t => {
  const game = drill(t);
  const level = game.levelManager.currentLevel;
  assert.equal(level.name, 'Bomber Drill');
  game.updateSimulation(1 / 60);
  assert.deepEqual(game.enemyManager.enemies.map(enemy => enemy.type.name).sort(), ['bomber', 'bomber']);
  assert.ok(game.enemyManager.enemies.every(enemy => enemy.bomberAttack && enemy.health === MINE_BOMBER.health));
  const bombs = game.enemyManager.projectileManager;
  let charged = false, landed = null, exploded = false;
  for (let frame = 0; frame < 60 * 12 && !exploded; frame++) {
    game.updateSimulation(1 / 60);
    if (game.session.phase !== 'playing') break;
    charged ||= game.enemyManager.enemies.some(enemy => enemy.bomberAttack.phase === 'windup');
    const armed = bombs.enemyProjectiles.find(projectile => projectile.bomb?.armedAt !== null && projectile.bomb);
    if (armed && !landed) {
      landed = armed;
      assert.ok(armed.mesh.getObjectByName('bomb_blast_radius'), 'a landed bomb shows its blast radius');
      // Fly clear of the marked sphere before it goes off.
      const away = game.spaceship.group.position.clone().sub(armed.mesh.position).setY(0);
      game.spaceship.group.position.add(away.lengthSq() ? away.normalize().multiplyScalar(MINE_BOMBER.blastRadius + 1) : v(MINE_BOMBER.blastRadius + 1));
    }
    if (landed && !bombs.enemyProjectiles.includes(landed)) exploded = true;
  }
  assert.ok(charged, 'bombers visibly charge'); assert.ok(landed, 'a bomb landed and armed'); assert.ok(exploded, 'the bomb detonated');
  assert.equal(game.session.phase, 'playing');
  assert.ok(game.enemyManager.enemies.every(enemy => enemy.isActive), 'no bomber was hurt by its own bombs');
  game.restartLevel(); game.updateSimulation(1 / 60);
  assert.equal(bombs.enemyProjectiles.length, 0);
  assert.equal(game.gameState.playerHealth, 100);
  assert.deepEqual(game.enemyManager.enemies.map(enemy => enemy.bomberAttack.phase), ['idle', 'idle']);
});
