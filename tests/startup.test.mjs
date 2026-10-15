import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import Game from '../src/js/main.js';
import AudioManager from '../src/js/core/AudioManager.js';
import GameState from '../src/js/core/GameState.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import LevelBlueprint from '../src/js/core/levels/LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from '../src/js/core/levels/SegmentTypes.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';
import RuntimeDiagnostics from '../src/js/utils/RuntimeDiagnostics.js';

function globalForTest(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => previous
    ? Object.defineProperty(globalThis, name, previous)
    : delete globalThis[name]);
}

// Presentation callbacks are not driven by these synchronous simulation fixtures.
function presentationClock(t) {
  const callbacks = [];
  globalForTest(t, 'setTimeout', (callback) => { callbacks.push(callback); return callbacks.length; });
  globalForTest(t, 'requestAnimationFrame', (callback) => { callbacks.push(callback); return callbacks.length; });
  globalForTest(t, 'cancelAnimationFrame', () => {});
  return callbacks;
}

class AudioContextFixture {
  sampleRate = 8000;
  currentTime = 0;
  state = 'running';
  destination = {};
  createBuffer(_channels, length, sampleRate) {
    const samples = new Float32Array(Math.floor(length));
    return { sampleRate, getChannelData: () => samples };
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
      connect() {},
    };
  }
  createBufferSource() {
    return {
      playbackRate: { value: 1 }, connect() {}, start() {},
      stop() { this.onended?.(); },
    };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}

function audioBrowser(t, Context = AudioContextFixture) {
  t.mock.method(console, 'log', () => {});
  globalForTest(t, 'window', { AudioContext: Context });
}

function startupFixture(t, AudioContext) {
  audioBrowser(t, AudioContext);
  const game = new Game();
  const events = [];
  game.uiManager = {
    hideStartScreen: () => events.push('hide-start'),
    hideLevelSelect: () => events.push('hide-levels'),
    updateWeaponUI() {}, updateHUD() {}, updateEnemyCount() {}, showMessage() {},
    resetSessionUI() {}, showPauseMenu() {}, hidePauseMenu() {}, showGameOver() {},
    showCompletion() {}, showSessionError(error) { throw error; },
  };
  game.inputManager = {
    clearKeys: () => events.push('clear-keys'),
    requestPointerLock: () => { events.push('request-lock'); return Promise.resolve(true); },
    updateMovement() {},
  };
  game.camera = new THREE.PerspectiveCamera();
  game.scene.add(game.camera);
  game.spaceship = new Spaceship();
  game.spaceship.attachToCamera(game.camera);
  game.levelManager = new LevelManager(game.scene, game.camera);
  game.levelManager.segmentCount = 2;
  game.levelManager.buffer = 1;
  game.levelManager.wallMaterial = new THREE.MeshBasicMaterial();
  game.levelManager.floorMaterial = new THREE.MeshBasicMaterial();
  game.projectileManager = new ProjectileManager(game.scene, game.camera, game.audioManager, game.session);
  game.enemyManager = new EnemyManager(game.scene, game.camera, game.gameState, game.audioManager, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.camera, game.gameState, null, game.uiManager, game.levelManager);
  game.gameState.setReferences(game.camera, game.audioManager, game.uiManager, game.activeAnimations, game);
  return { game, events };
}

test('sound registration is inert when audio is unavailable', () => {
  const audio = new AudioManager();
  assert.equal(audio.createSound('test', () => assert.fail('must not generate without a context')), null);
  assert.equal(audio.playSound('test'), null);
});

test('audio defaults are immediately playable without fetching missing assets', (t) => {
  audioBrowser(t);
  const requests = t.mock.fn(() => assert.fail('default audio must not fetch placeholder URLs'));
  globalForTest(t, 'fetch', requests);
  const audio = new AudioManager();
  assert.equal(audio.init(), true);
  assert.equal(Object.keys(audio.sounds).length, 9);
  for (const sound of Object.values(audio.sounds)) assert.ok(sound.buffer);
  assert.ok(audio.playSound('shoot'));
  assert.equal(requests.mock.callCount(), 0);
  const originalContext = audio.context;
  assert.equal(audio.init(), true);
  assert.equal(audio.context, originalContext, 'repeat init must reuse the context');
});

test('registering a custom sound stops prior instances before replacing its buffer', (t) => {
  audioBrowser(t);
  const audio = new AudioManager();
  audio.init();
  let stopped = 0;
  audio.sounds.hit = { playing: new Set([{ source: { stop: () => stopped++ } }]) };
  const buffer = audio.createSound('hit', (ctx) => ctx.createBuffer(1, 20, ctx.sampleRate));
  assert.equal(stopped, 1);
  assert.equal(audio.sounds.hit.buffer, buffer);
  assert.equal(audio.sounds.hit.playing.size, 0);
  assert.ok(audio.playSound('hit'));
});

test('a failed audio initialization clears partial state and can be retried', (t) => {
  audioBrowser(t, class extends AudioContextFixture {
    createGain() { throw new Error('No audio device'); }
  });
  t.mock.method(console, 'warn', () => {});
  const audio = new AudioManager();
  assert.equal(audio.init(), false);
  assert.equal(audio.initialized, false);
  assert.equal(audio.context, null);
  assert.deepEqual(audio.sounds, {});
  window.AudioContext = AudioContextFixture;
  assert.equal(audio.init(), true);
  assert.ok(audio.playSound('engine'));
});

test('starting the game registers sounds and reaches gameplay synchronously', (t) => {
  const { game, events } = startupFixture(t);
  game.gameState.weaponInventory.laser = { unlocked: true, ammo: 20 };
  game.startGame();
  assert.equal(game.gameState.isGameStarted, true);
  assert.equal(game.gameState.isPaused, false);
  assert.equal(game.gameState.isGameOver, false);
  assert.equal(game.gameState.weaponInventory.laser.unlocked, false);
  for (const id of ['empty', 'hit', 'bump', 'weaponSwitch']) assert.ok(game.audioManager.sounds[id].buffer);
  assert.deepEqual(events, ['clear-keys', 'hide-start', 'hide-levels', 'request-lock']);
});

test('starting again does not stack looping audio sources', (t) => {
  const { game } = startupFixture(t);
  game.startGame();
  game.startGame();
  assert.equal(game.audioManager.sounds.engine.playing.size, 1);
  assert.equal(game.audioManager.sounds.backgroundMusic.playing.size, 1);
});

test('the game starts when Web Audio is unsupported', (t) => {
  const { game, events } = startupFixture(t);
  delete window.AudioContext;
  game.startGame();
  assert.equal(game.audioManager.initialized, false);
  assert.equal(game.gameState.isGameStarted, true);
  assert.ok(events.includes('request-lock'));
});

test('an unexpected sound-registration failure does not strand startup', (t) => {
  const { game, events } = startupFixture(t);
  t.mock.method(console, 'warn', () => {});
  t.mock.method(game.audioManager, 'createSound', () => { throw new Error('Buffer creation failed'); });
  game.startGame();
  assert.equal(game.gameState.isGameStarted, true);
  assert.ok(events.includes('hide-start'));
  assert.ok(events.includes('request-lock'));
});

test('initialization failures reject instead of reporting success', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const game = new Game();
  t.mock.method(game, 'initScene', () => { throw new Error('Scene failed'); });
  await assert.rejects(game.init(), /Scene failed/);
});

test('power-up offsets accept an empty collection and move real pickups once', (t) => {
  presentationClock(t);
  const powers = new PowerUpManager(new THREE.Scene(), new THREE.PerspectiveCamera());
  powers.offsetPowerUps(new THREE.Vector3());
  const pickup = powers.spawnPowerup(new THREE.Vector3(2, 3, 4), 'health');
  powers.offsetPowerUps(new THREE.Vector3(1, -2, 3));
  assert.deepEqual(pickup.mesh.position.toArray(), [3, 1, 7]);
  powers.offsetPowerUps(new THREE.Vector3());
  assert.deepEqual(pickup.mesh.position.toArray(), [3, 1, 7]);
  powers.removePowerup(pickup.id);
});

test('authored pickups preserve their type through spawning and collection', (t) => {
  presentationClock(t);
  t.mock.method(Math, 'random', () => 0.99);
  const camera = new THREE.PerspectiveCamera();
  const state = new GameState();
  state.playerHealth = 50;
  state.session.begin();
  state.session.transition('playing');
  const blueprint = new LevelBlueprint(1, 'Pickup fixture');
  blueprint.addPowerupSpawn(new THREE.Vector3(), 'health');
  const ui = { updateHUD() {}, showMessage() {} };
  const powers = new PowerUpManager(new THREE.Scene(), camera, state, null, ui, { currentLevel: blueprint });
  powers.spawnPredefinedPowerUps();
  assert.equal(powers.powerups[0].type.name, 'health');
  powers.update();
  assert.equal(state.playerHealth, 75);
  assert.equal(powers.powerups.length, 0);
});

test('unknown authored pickup types produce a useful error', () => {
  const powers = new PowerUpManager(new THREE.Scene(), new THREE.PerspectiveCamera());
  assert.throws(() => powers.spawnPowerup(new THREE.Vector3(), 'invalid'), /Unknown power-up type: invalid/);
  assert.equal(powers.powerups.length, 0);
});

test('enemy projectiles receive the real camera and audio dependencies', () => {
  const camera = new THREE.PerspectiveCamera();
  const audio = new AudioManager();
  const enemies = new EnemyManager(new THREE.Scene(), camera, new GameState(), audio);
  assert.equal(enemies.projectileManager.camera, camera);
  assert.equal(enemies.projectileManager.audioManager, audio);
});

test('game over stops session loops once and releases pointer lock', (t) => {
  const { game } = startupFixture(t);
  game.startGame();
  let released = false;
  globalForTest(t, 'document', { pointerLockElement: {}, exitPointerLock: () => { released = true; } });
  game.gameState.gameOver();
  game.gameState.gameOver();
  assert.equal(game.gameState.isGameOver, true);
  assert.equal(game.audioManager.sounds.engine.playing.size, 0);
  assert.equal(game.audioManager.sounds.gameOver.playing.size, 1);
  assert.equal(released, true);
});

for (const behavior of ['unsupported', 'throws', 'rejects']) {
  test(`pointer lock ${behavior} is handled without breaking startup`, async (t) => {
    globalForTest(t, 'document', { pointerLockElement: null });
    let messages = 0;
    const input = new InputManager(new THREE.PerspectiveCamera(), null, new GameState(), {
      showMessage: () => messages++,
    });
    input.canvas = behavior === 'unsupported' ? {} : {
      requestPointerLock() {
        if (behavior === 'throws') throw new Error('Denied');
        return Promise.reject(new Error('Denied'));
      },
    };
    assert.equal(await input.requestPointerLock(), false);
    assert.equal(messages, 1);
  });
}

test('paused and menu clicks do not capture the mouse or fire', (t) => {
  let requests = 0, shots = 0;
  const canvas = { requestPointerLock: () => requests++ };
  globalForTest(t, 'document', { pointerLockElement: canvas });
  const state = new GameState();
  const input = new InputManager(new THREE.PerspectiveCamera(), { fireProjectile: () => shots++ }, state);
  input.canvas = canvas;
  input.onClick();
  state.session.begin();
  state.session.transition('playing');
  state.session.transition('paused');
  input.onClick();
  assert.equal(requests, 0);
  assert.equal(shots, 0);
  state.session.transition('playing');
  input.onClick();
  assert.equal(shots, 1);
});

test('losing pointer lock clears held movement keys', (t) => {
  globalForTest(t, 'document', { pointerLockElement: null, removeEventListener() {} });
  t.mock.method(console, 'log', () => {});
  const input = new InputManager(new THREE.PerspectiveCamera(), null, new GameState());
  input.canvas = {};
  input.keyStates.KeyW = true;
  input.onPointerlockChange();
  assert.deepEqual(input.keyStates, {});
});

for (const mode of ['endless', 'authored']) {
  test(`${mode} startup fixture advances the real update pipeline past power-ups`, (t) => {
    presentationClock(t);
    const { game } = startupFixture(t);
    delete window.AudioContext;
    globalForTest(t, 'document', { pointerLockElement: null });
    const errors = t.mock.method(console, 'error', () => {});
    game.camera = new THREE.PerspectiveCamera();
    game.camera.position.z = 5;
    game.scene.add(game.camera);
    game.spaceship = new Spaceship();
    game.spaceship.attachToCamera(game.camera);
    game.clock = { getDelta: () => 1 / 60 };
    game.levelManager = new LevelManager(game.scene, game.camera);
    game.levelManager.wallMaterial = new THREE.MeshBasicMaterial();
    game.levelManager.floorMaterial = new THREE.MeshBasicMaterial();
    const blueprint = new LevelBlueprint(1, 'Startup fixture');
    blueprint.addSegment({ type: SegmentType.STRAIGHT, obstacles: ObstaclePattern.NONE });
    game.levelManager.levels = [blueprint];
    game.isEndlessMode = mode === 'endless';
    game.levelManager.isEndless = game.isEndlessMode;
    game.levelManager.initLevel();
    game.projectileManager = new ProjectileManager(game.scene, game.camera, game.audioManager);
    game.enemyManager = new EnemyManager(game.scene, game.camera, game.gameState, game.audioManager, game.levelManager);
    game.enemyManager.lastRandomSpawnTime = Date.now();
    game.lastEnemySpawnTime = Date.now();
    game.powerUpManager = new PowerUpManager(game.scene, game.camera, game.gameState, null, game.uiManager, game.levelManager);
    game.gameState.setReferences(game.camera, game.audioManager, game.uiManager, game.activeAnimations, game);
    game.inputManager.updateMovement = () => {};
    game.startGame();
    game.powerUpManager.spawnPowerup(new THREE.Vector3(0, 0, -10), 'health');
    game.diagnostics = new RuntimeDiagnostics(true);
    const shot = game.projectileManager.createProjectile(new THREE.Vector3(0, 0, -10), new THREE.Quaternion());
    for (let i = 0; i < 20; i++) game.animate();
    assert.equal(game.diagnostics.updates, 20, 'every frame must reach the end of the simulation');
    assert.equal(errors.mock.callCount(), 0);
    assert.ok(Math.abs(shot.mesh.position.z + 15) < 1e-6, 'projectiles must advance while the player is idle');
    game.projectileManager.removeProjectile(shot);
    game.powerUpManager.removePowerup(game.powerUpManager.powerups[0].id);
  });
}
