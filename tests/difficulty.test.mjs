import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DIFFICULTIES, DIFFICULTY_ORDER, getDifficulty, scaleAmmo, scaleEnemyHealth, scaleFireInterval, scaleIncomingDamage } from '../src/js/core/Difficulty.js';
import UserSettings from '../src/js/core/UserSettings.js';
import GameState from '../src/js/core/GameState.js';
import { MINE_FIGHTER, mineHealth } from '../src/js/entities/EnemyTactics.js';
import { enemyTypes } from '../src/js/entities/EnemyTypes.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

test('tiers are ordered, frozen, and Pilot is the exact authored balance', () => {
  assert.deepEqual(DIFFICULTY_ORDER, ['trainee', 'pilot', 'veteran', 'insane']);
  assert.deepEqual(DIFFICULTY_ORDER.map(id => DIFFICULTIES[id].rank), [0, 1, 2, 3]);
  assert.ok(Object.isFrozen(DIFFICULTIES) && DIFFICULTY_ORDER.every(id => Object.isFrozen(DIFFICULTIES[id])));
  const pilot = DIFFICULTIES.pilot;
  for (const health of [10, 20, 25, 40, 50, 100, 200]) assert.equal(scaleEnemyHealth(health, pilot), health);
  for (const damage of [5, 6, 10, 50]) assert.equal(scaleIncomingDamage(damage, pilot), damage);
  for (const interval of [MINE_FIGHTER.intervalMs, MINE_FIGHTER.intervalMs + MINE_FIGHTER.intervalVariationMs]) {
    assert.equal(scaleFireInterval(interval, pilot, MINE_FIGHTER.windupMs + MINE_FIGHTER.recoveryMs), interval);
  }
  for (const [initial, capacity] of [[80, 80], [120, 160], [40, 60]]) assert.deepEqual(scaleAmmo(initial, capacity, pilot), { initial, capacity });
  // Harder tiers are monotonically harder on every axis.
  for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
    const easier = DIFFICULTIES[DIFFICULTY_ORDER[i - 1]], harder = DIFFICULTIES[DIFFICULTY_ORDER[i]];
    assert.ok(harder.enemyHealth > easier.enemyHealth && harder.incomingDamage > easier.incomingDamage);
    assert.ok(harder.fireInterval < easier.fireInterval && harder.ammo < easier.ammo);
  }
});

test('unknown tier names fall back to Pilot and scaling stays bounded', () => {
  for (const value of [undefined, null, 'hard', 'PILOT', 3, {}, '__proto__', 'toString']) assert.equal(getDifficulty(value), DIFFICULTIES.pilot);
  assert.equal(scaleEnemyHealth(1, DIFFICULTIES.trainee), 1, 'a robot always keeps at least one hit point');
  assert.equal(scaleEnemyHealth(Infinity, DIFFICULTIES.insane), Infinity);
  assert.equal(scaleIncomingDamage(0, DIFFICULTIES.insane), 0);
  assert.equal(scaleIncomingDamage(-5, DIFFICULTIES.insane), -5);
  const telegraph = MINE_FIGHTER.windupMs + MINE_FIGHTER.recoveryMs;
  for (const id of DIFFICULTY_ORDER) assert.ok(scaleFireInterval(MINE_FIGHTER.intervalMs, DIFFICULTIES[id], telegraph) >= telegraph);
  assert.equal(scaleFireInterval(100, DIFFICULTIES.insane, telegraph), telegraph, 'every shot keeps its full warning and recovery');
  assert.deepEqual(scaleAmmo(80, 80, DIFFICULTIES.trainee), { initial: 120, capacity: 120 });
  assert.deepEqual(scaleAmmo(1, 10, DIFFICULTIES.insane), { initial: 1, capacity: 7 });
  assert.deepEqual(scaleAmmo(40, Infinity, DIFFICULTIES.veteran), { initial: 32, capacity: Infinity });
});

test('difficulty is a saved preference that rejects unknown values', () => {
  let stored = null;
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  const settings = new UserSettings(() => storage);
  assert.equal(settings.values.difficulty, 'pilot');
  settings.update({ difficulty: 'veteran' });
  assert.equal(new UserSettings(() => storage).values.difficulty, 'veteran');
  settings.update({ difficulty: 'nightmare' });
  assert.equal(settings.values.difficulty, 'veteran');
  stored = JSON.stringify({ version: 1, mouseSensitivity: 2 });
  assert.equal(new UserSettings(() => storage).values.difficulty, 'pilot', 'older saves gain the default tier');
});

test('incoming damage from every source scales with the run tier', () => {
  const state = new GameState();
  state.session.begin(); state.session.transition('playing');
  state.takeDamage(10); assert.equal(state.playerHealth, 90, 'Pilot is unchanged');
  state.difficulty = DIFFICULTIES.trainee; state.takeDamage(10); assert.equal(state.playerHealth, 85);
  state.difficulty = DIFFICULTIES.insane; state.takeDamage(10); assert.equal(state.playerHealth, 65);
  state.takeDamage(0); state.takeDamage(-4); assert.equal(state.playerHealth, 65);
});

function fixture(t) {
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
  return game;
}

function start(game, difficulty) {
  game.settings.update({ difficulty });
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'crossfire-relay') });
  game.updateSimulation(1 / 60);
  const level = game.levelManager.currentLevel;
  const health = Object.fromEntries(game.enemyManager.enemies.map(enemy => [enemy.type.name, enemy.health]));
  const fighter = game.enemyManager.enemies.find(enemy => enemy.type.name === 'fighter');
  return { level, health, fighterRate: fighter?.fireRate, ammo: game.gameState.weaponInventory.pulse.ammo, capacity: game.gameState.pulseAmmoCapacity };
}

test('a mission snapshots its tier at start: robot health, fighter cadence and ammunition', t => {
  const game = fixture(t);
  const base = (name) => mineHealth(/** @type {any} */ (enemyTypes.find(type => type.name === name)));
  const pilot = start(game, 'pilot');
  assert.deepEqual(pilot.health, { fighter: base('fighter'), scout: base('scout') });
  assert.equal(pilot.fighterRate, MINE_FIGHTER.intervalMs);
  assert.deepEqual([pilot.ammo, pilot.capacity], [pilot.level.combat.initialPulseAmmo, pilot.level.combat.maxPulseAmmo]);

  const insane = start(game, 'insane');
  assert.deepEqual(insane.health, { fighter: scaleEnemyHealth(base('fighter'), DIFFICULTIES.insane), scout: scaleEnemyHealth(base('scout'), DIFFICULTIES.insane) });
  assert.ok(insane.fighterRate < pilot.fighterRate && insane.fighterRate >= MINE_FIGHTER.windupMs + MINE_FIGHTER.recoveryMs);
  assert.deepEqual({ initial: insane.ammo, capacity: insane.capacity },
    scaleAmmo(pilot.level.combat.initialPulseAmmo, pilot.level.combat.maxPulseAmmo, DIFFICULTIES.insane));
  assert.equal(game.gameState.difficulty.id, 'insane');

  // Changing the preference mid-run does not alter the active encounter until a restart.
  game.settings.update({ difficulty: 'trainee' });
  assert.equal(game.gameState.difficulty.id, 'insane');
  assert.ok(game.enemyManager.enemies.every(enemy => enemy.health === insane.health[enemy.type.name]));
  game.restartLevel(); game.updateSimulation(1 / 60);
  assert.equal(game.gameState.difficulty.id, 'trainee');
  assert.ok(game.enemyManager.enemies.every(enemy => enemy.health < pilot.health[enemy.type.name]));
});
