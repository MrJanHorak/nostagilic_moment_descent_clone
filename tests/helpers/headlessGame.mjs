import * as THREE from 'three';
import Game from '../../src/js/main.js';
import Spaceship from '../../src/js/entities/Spaceship.js';
import InputManager from '../../src/js/core/InputManager.js';
import LevelManager from '../../src/js/core/LevelManager.js';
import ProjectileManager from '../../src/js/entities/ProjectileManager.js';
import EnemyManager from '../../src/js/entities/EnemyManager.js';
import PowerUpManager from '../../src/js/entities/PowerUpManager.js';

/** A headless game with stub presentation, like the other simulation tests. */
export function headlessGame(t) {
  t.mock.method(console, 'log', () => {});
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
