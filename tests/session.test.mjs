import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import Game from '../src/js/main.js';
import GameSession from '../src/js/core/GameSession.js';
import GameState from '../src/js/core/GameState.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import LevelBlueprint from '../src/js/core/levels/LevelBlueprint.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import AudioManager from '../src/js/core/AudioManager.js';
import UIManager from '../src/js/ui/UIManager.js';

function globalForTest(t, key, value) {
  const before = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  t.after(() => before ? Object.defineProperty(globalThis, key, before) : delete globalThis[key]);
}

function playingSession() {
  const session = new GameSession();
  session.begin();
  session.transition('playing');
  return session;
}

function fixture(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(Math, 'random', () => 0.4);
  globalForTest(t, 'window', {}); // Audio is optional; no device needed for simulation tests.
  globalForTest(t, 'document', { pointerLockElement: null, exitPointerLock() {}, removeEventListener() {}, addEventListener() {} });
  const game = new Game();
  const messages = [], results = [];
  game.uiManager = {
    resetSessionUI() {}, hideStartScreen() {}, hideLevelSelect() {}, updateWeaponUI() {},
    updateHUD() {}, updateEnemyCount() {}, showPauseMenu() {}, hidePauseMenu() {},
    createStartScreen() { return true; }, createLevelSelect() {}, showGameOver() { results.push('dead'); },
    showCompletion: (hasNext) => results.push(hasNext), showSessionError: (error) => results.push(error),
    showMessage: (message) => messages.push(message),
  };
  game.camera = new THREE.PerspectiveCamera();
  game.scene.add(game.camera);
  game.spaceship = new Spaceship();
  game.spaceship.attachToCamera(game.camera);
  game.clock = { getDelta: () => 1 / 60 };
  game.inputManager = { clearKeys() {}, requestPointerLock: () => Promise.resolve(true), updateMovement() {} };
  game.levelManager = new LevelManager(game.scene, game.camera);
  game.levelManager.segmentCount = 2;
  game.levelManager.buffer = 1;
  game.levelManager.wallMaterial = new THREE.MeshBasicMaterial();
  game.levelManager.floorMaterial = new THREE.MeshBasicMaterial();
  game.levelManager.levels = [0, 1].map((index) => {
    const level = new LevelBlueprint(index, `Fixture ${index}`);
    level.addSegment({ type: 'straight', obstacles: 'none' });
    level.addEnemySpawn(new THREE.Vector3(0, 0, -15), 'scout');
    level.addPowerupSpawn(new THREE.Vector3(3, 0, -10), 'health');
    // A runtime that annotates these definitions will throw in this fixture.
    for (const spawn of [...level.enemySpawns, ...level.powerupSpawns]) Object.freeze(spawn);
    Object.freeze(level.enemySpawns);
    Object.freeze(level.powerupSpawns);
    return Object.freeze(level);
  });
  game.projectileManager = new ProjectileManager(game.scene, game.camera, game.audioManager, game.session);
  game.enemyManager = new EnemyManager(game.scene, game.camera, game.gameState, game.audioManager, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.camera, game.gameState, game.audioManager, game.uiManager, game.levelManager);
  game.enemyManager.powerUpManager = game.powerUpManager;
  game.gameState.setReferences(game.camera, game.audioManager, game.uiManager, game.activeAnimations, game);
  game.startSession({ endless: false, levelIndex: 0 });
  t.after(() => game.endSession());
  return { game, messages, results };
}

test('session clock freezes while paused and rejects invalid transitions', () => {
  const session = playingSession();
  let called = 0;
  session.schedule(1000, () => called++);
  session.advance(0.5);
  session.transition('paused');
  session.advance(100);
  assert.equal(session.timeMs, 500);
  assert.equal(called, 0);
  session.transition('playing');
  session.advance(0.5);
  assert.equal(called, 1);
  assert.throws(() => session.transition('loading'), /Invalid session transition/);
});

test('ending a session invalidates its due callbacks, including during dispatch', () => {
  const session = playingSession();
  const calls = [];
  session.schedule(100, () => { calls.push('first'); session.end(); session.begin(); session.transition('playing'); });
  session.schedule(100, () => calls.push('stale'));
  session.advance(0.1);
  session.advance(100);
  assert.deepEqual(calls, ['first']);
  assert.equal(session.tasks.size, 0);
});

test('cancelling another due timer and scheduling a new one is bounded', () => {
  const session = playingSession();
  let calls = 0;
  session.schedule(100, () => { session.cancel(second); session.schedule(0, () => calls++); });
  const second = session.schedule(100, () => assert.fail('cancelled callback ran'));
  session.advance(0.1);
  assert.equal(calls, 0);
  session.advance(0);
  assert.equal(calls, 1);
});

test('restart clears combat state and callbacks without awarding cleanup kills', (t) => {
  const { game } = fixture(t);
  game.updateSimulation(0.01);
  const oldEnemy = game.enemyManager.enemies[0];
  const oldPickup = game.powerUpManager.powerups[0];
  game.projectileManager.createProjectile(new THREE.Vector3(), new THREE.Quaternion());
  game.enemyManager.projectileManager.fireEnemyProjectile(oldEnemy, game.camera);
  game.enemyManager.effectsManager.createHitEffect(new THREE.Vector3());
  game.session.schedule(100, () => assert.fail('old-session callback ran'));
  game.gameState.applyTimedModifier('weaponPower', 2, 15000, 'expired');
  game.gameState.score = 400;
  game.gameState.enemyKills.scout = 3;
  game.gameState.weaponPickups.laser = 2;
  game.gameState.addWeaponAmmo('laser', 40);
  game.gameState.playerHealth = 12;
  game.spaceship.velocity.set(2, 3, -4);
  game.spaceship.pitch = 1;
  const oldId = game.session.id;
  assert.equal(game.pauseGame(), true);
  assert.equal(game.restartLevel(), true);
  assert.ok(game.session.id > oldId);
  assert.equal(game.session.phase, 'playing');
  assert.equal(game.session.timeMs, 0);
  assert.equal(game.session.tasks.size, 0);
  assert.equal(game.gameState.playerHealth, 100);
  assert.equal(game.gameState.score, 0);
  assert.equal(game.gameState.weaponPower, 1);
  assert.equal(game.gameState.enemyKills.scout, 0);
  assert.equal(game.gameState.weaponPickups.laser, 0);
  assert.equal(game.gameState.weaponInventory.laser.unlocked, false);
  assert.deepEqual(game.spaceship.velocity.toArray(), [0, 0, 0]);
  assert.equal(game.spaceship.pitch, 0);
  assert.equal(oldEnemy.mesh.parent, null);
  assert.equal(oldPickup.mesh.parent, null);
  assert.equal(game.projectileManager.projectiles.length, 0);
  assert.equal(game.enemyManager.projectileManager.enemyProjectiles.length, 0);
  assert.equal(game.enemyManager.destroyedPredefinedEnemies.size, 0);
  assert.equal(game.enemyManager.effectsManager.hitEffects.length, 0);
  game.session.advance(0.2);
});

test('ten restart cycles preserve definitions, spawn the pickup again and leave no orphan scene objects', (t) => {
  const { game } = fixture(t);
  const definitions = JSON.stringify(game.levelManager.levels);
  for (let i = 0; i < 10; i++) {
    game.updateSimulation(0.01);
    assert.equal(game.enemyManager.enemies.length, 1);
    assert.equal(game.powerUpManager.powerups.length, 1);
    const pickup = game.powerUpManager.powerups[0];
    game.powerUpManager.removePowerup(pickup.id);
    game.restartGame();
    assert.equal(game.scene.children.length, 2, 'only the camera and one level segment remain');
    assert.equal(game.enemyManager.destroyedPredefinedEnemies.size, 0);
  }
  assert.equal(JSON.stringify(game.levelManager.levels), definitions);
  game.showMainMenu();
  assert.equal(game.session.phase, 'menu');
  assert.equal(game.scene.children.length, 1);
});

test('endless restart cycles keep segment tracking complete and cleanup bounded', (t) => {
  const { game } = fixture(t);
  for (let i = 0; i < 10; i++) {
    game.startSession({ endless: true });
    assert.equal(game.levelManager.segmentMap.size, 2);
    assert.equal(game.scene.children.length, 3);
    game.updateSimulation(0.1);
    assert.equal(game.scene.children.length, game.levelManager.segmentMap.size + 1);
  }
  game.endSession();
  assert.equal(game.scene.children.length, 1);
  assert.equal(game.levelManager.obstacles.length, 0);
});

test('legacy selection entry points also use the full session reset', (t) => {
  const { game } = fixture(t);
  game.gameState.playerHealth = 3;
  game.selectLevel(1);
  assert.equal(game.currentLevelIndex, 1);
  assert.equal(game.levelManager.currentLevelIndex, 1);
  assert.equal(game.gameState.playerHealth, 100);
  game.selectEndlessMode();
  assert.equal(game.levelManager.currentLevel, null);
  assert.equal(game.levelManager.isEndless, true);
});

test('completion awards once and the next mission becomes the restart target', (t) => {
  const { game, results } = fixture(t);
  game.updateSimulation(0.01);
  game.enemyManager.destroyEnemy(0);
  game.enemyManager.checkLevelCompletion();
  assert.equal(game.session.phase, 'completed');
  assert.equal(game.gameState.score, 1000);
  assert.equal(game.completeSession(), false);
  assert.deepEqual(results, [true]);
  assert.equal(game.nextMission(), true);
  assert.equal(game.currentLevelIndex, 1);
  assert.equal(game.levelManager.currentLevelIndex, 1);
  game.restartGame();
  assert.equal(game.currentLevelIndex, 1);
  game.updateSimulation(0.01);
  game.enemyManager.destroyEnemy(0);
  assert.deepEqual(results, [true, false]);
  assert.equal(game.nextMission(), false);
});

test('death and completion are mutually exclusive; restart resets health and terminal state', (t) => {
  const { game, results } = fixture(t);
  game.gameState.takeDamage(100);
  game.gameState.takeDamage(100);
  assert.equal(game.session.phase, 'dead');
  assert.equal(game.completeSession(), false);
  assert.deepEqual(results, ['dead']);
  game.restartGame();
  assert.equal(game.gameState.playerHealth, 100);
  assert.equal(game.completeSession(), true);
  game.gameState.takeDamage(100);
  assert.equal(game.session.phase, 'completed');
  assert.equal(game.gameState.playerHealth, 100);
});

test('buff expiry, pickup animation and projectile lifetimes freeze during pause', (t) => {
  const { game } = fixture(t);
  game.gameState.applyTimedModifier('weaponPower', 2, 1500, 'expired');
  const pickup = game.powerUpManager.spawnPowerup(new THREE.Vector3(4, 0, -5), 'health');
  const shot = game.projectileManager.createProjectile(new THREE.Vector3(0, 0, -5), new THREE.Quaternion());
  game.updateSimulation(1);
  const position = shot.mesh.position.clone(), age = pickup.age;
  game.pauseGame();
  game.updateSimulation(100);
  game.projectileManager.updateProjectiles(100);
  game.powerUpManager.update(100);
  assert.equal(game.session.timeMs, 1000);
  assert.equal(game.gameState.weaponPower, 2);
  assert.equal(pickup.age, age);
  assert.ok(shot.mesh.position.equals(position));
  game.resumeGame();
  game.updateSimulation(0.6);
  assert.equal(game.gameState.weaponPower, 1);
  game.updateSimulation(1.5);
  assert.equal(game.projectileManager.projectiles.length, 0);
});

test('refreshing a timed buff extends it and restarting prevents old expiry affecting the new run', (t) => {
  const { game, messages } = fixture(t);
  game.gameState.applyTimedModifier('weaponPower', 2, 1000, 'old expired');
  game.session.advance(0.7);
  game.gameState.applyTimedModifier('weaponPower', 2, 1000, 'refreshed expired');
  game.session.advance(0.4);
  assert.equal(game.gameState.weaponPower, 2);
  game.restartLevel();
  game.gameState.applyTimedModifier('weaponPower', 2, 2000, 'new expired');
  game.session.advance(1);
  assert.equal(game.gameState.weaponPower, 2);
  assert.deepEqual(messages, []);
});

test('identical-position enemy spawns have distinct stable IDs', (t) => {
  const { game } = fixture(t);
  const level = new LevelBlueprint(9, 'Shared position');
  level.addSegment({ type: 'straight', obstacles: 'none' });
  level.addEnemySpawn(new THREE.Vector3(0, 0, -15), 'scout');
  level.addEnemySpawn(new THREE.Vector3(0, 0, -15), 'scout');
  game.levelManager.levels = [level];
  game.startSession({ endless: false, levelIndex: 0 });
  game.updateSimulation(0.01);
  assert.equal(game.enemyManager.enemies.length, 2);
  game.enemyManager.destroyEnemy(0);
  assert.equal(game.session.phase, 'playing');
  game.enemyManager.destroyEnemy(0);
  assert.equal(game.session.phase, 'completed');
});

test('exiting to selection clears entities and leaves no simulation running behind menus', (t) => {
  const { game } = fixture(t);
  game.updateSimulation(0.1);
  game.session.schedule(100, () => assert.fail('menu callback ran'));
  game.showLevelSelection();
  game.updateSimulation(100);
  assert.equal(game.session.phase, 'menu');
  assert.equal(game.session.timeMs, 0);
  assert.equal(game.session.tasks.size, 0);
  assert.equal(game.enemyManager.enemies.length, 0);
  assert.equal(game.powerUpManager.powerups.length, 0);
  assert.equal(game.levelManager.obstacles.length, 0);
  assert.equal(game.scene.children.length, 1);
});

test('invalid mission selection preserves the current run; a load failure cleans it up', (t) => {
  const { game, results } = fixture(t);
  const id = game.session.id;
  assert.throws(() => game.startSession({ endless: false, levelIndex: 99 }), /Unknown mission/);
  assert.equal(game.session.id, id);
  t.mock.method(game.levelManager, 'loadLevel', () => { throw new Error('Load failed'); });
  t.mock.method(console, 'error', () => {});
  assert.equal(game.restartLevel(), false);
  assert.equal(game.session.phase, 'error');
  assert.equal(game.scene.children.length, 1);
  assert.equal(results.at(-1).message, 'Load failed');
});

test('focus, visibility and real pointer-lock loss pause once, with no toggle on repeated events', (t) => {
  const { game } = fixture(t);
  const input = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager);
  input.game = game;
  input.canvas = {};
  input.wasPointerLocked = true;
  input.keyStates.KeyW = true;
  input.onPointerlockChange();
  assert.equal(game.session.phase, 'paused');
  assert.deepEqual(input.keyStates, {});
  input.onBlur();
  assert.equal(game.session.phase, 'paused');
  game.resumeGame();
  document.hidden = true;
  input.onVisibilityChange();
  assert.equal(game.session.phase, 'paused');
});

test('a rejected capture request from an ended session does not notify the new one', async (t) => {
  const { game, messages } = fixture(t);
  let reject;
  const input = new InputManager(game.camera, null, game.gameState, game.uiManager);
  input.game = game;
  input.canvas = { requestPointerLock: () => new Promise((_resolve, fail) => { reject = fail; }) };
  const requested = input.requestPointerLock();
  game.restartLevel();
  reject(new Error('Old request denied'));
  assert.equal(await requested, false);
  assert.deepEqual(messages, []);
  assert.equal(game.session.phase, 'playing');
});

test('gameplay lifetimes and boss bursts require no native timer or independent animation loop', (t) => {
  const { game } = fixture(t);
  globalForTest(t, 'setTimeout', () => assert.fail('native gameplay timer scheduled'));
  globalForTest(t, 'requestAnimationFrame', () => assert.fail('independent animation loop scheduled'));
  t.mock.method(Math, 'random', () => 0.1);
  game.enemyManager.spawnEnemy(new THREE.Vector3(0, 0, 10), 'boss');
  game.projectileManager.createProjectile(new THREE.Vector3(0, 0, -5), new THREE.Quaternion());
  game.powerUpManager.spawnPowerup(new THREE.Vector3(4, 0, -5), 'speedBoost');
  game.gameState.applyTimedModifier('weaponPower', 2, 1000, 'expired');
  game.updateSimulation(3);
  assert.ok(game.session.tasks.size > 0, 'boss burst is queued on the session clock');
  game.restartLevel();
  assert.equal(game.session.tasks.size, 0);
});

test('removing one projectile preserves geometry shared by other projectiles and future sessions', (t) => {
  const { game } = fixture(t);
  const first = game.projectileManager.createProjectile(new THREE.Vector3(), new THREE.Quaternion());
  const second = game.projectileManager.createProjectile(new THREE.Vector3(), new THREE.Quaternion());
  let disposed = 0;
  second.mesh.geometry.addEventListener('dispose', () => disposed++);
  game.projectileManager.removeProjectile(first);
  assert.equal(disposed, 0);
  game.restartLevel();
  assert.equal(disposed, 0, 'projectile geometry is manager-owned');
});

test('effect lights expire without a mesh queue, and clearing removes active and pooled effects', (t) => {
  const { game } = fixture(t);
  const effects = game.enemyManager.effectsManager;
  effects.createExplosion(new THREE.Vector3(), 0xff0000, false);
  game.session.advance(0.3);
  effects.update(0.3);
  assert.equal(effects.activeExplosionLights.length, 0);
  effects.createHitEffect(new THREE.Vector3());
  effects.update(0);
  effects.createExplosion(new THREE.Vector3(), 0xff0000, true);
  game.endSession();
  assert.equal(game.scene.children.length, 1);
  assert.equal(Object.keys(effects.objectPool.pools).length, 0);
});

test('presentation-only UI timers are cancelled when leaving a session', (t) => {
  const callbacks = new Map();
  globalForTest(t, 'setTimeout', (callback) => { const id = callbacks.size + 1; callbacks.set(id, callback); return id; });
  globalForTest(t, 'clearTimeout', (id) => callbacks.delete(id));
  const ui = Object.create(UIManager.prototype);
  ui.presentationTimers = new Set();
  let removed = 0;
  ui.transientElements = new Set([{ remove() { removed++; } }]);
  ui.hudElements = {};
  ui.presentationSchedule(() => assert.fail('old UI callback'), 500);
  ui.resetSessionUI();
  assert.equal(callbacks.size, 0);
  assert.equal(removed, 1);
});

test('late audio completion does not clear the newer music handle', () => {
  const audio = new AudioManager();
  audio.initialized = true;
  audio.sounds.backgroundMusic = { buffer: {}, playing: new Set() };
  audio.musicGain = {};
  audio.context = {
    currentTime: 0,
    createBufferSource: () => ({ playbackRate: {}, connect() {}, start() {}, stop() {} }),
    createGain: () => ({ gain: {}, connect() {} }),
  };
  const old = audio.playSound('backgroundMusic', { isMusic: true });
  audio.stopAllSounds();
  const current = audio.playSound('backgroundMusic', { isMusic: true });
  old.source.onended();
  assert.equal(audio.music, current);
  assert.equal(audio.sounds.backgroundMusic.playing.size, 1);
});
