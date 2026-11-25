import * as THREE from 'three';
import Game from '../main.js';
import Spaceship from '../entities/Spaceship.js';
import InputManager from '../core/InputManager.js';
import LevelManager from '../core/LevelManager.js';
import ProjectileManager from '../entities/ProjectileManager.js';
import EnemyManager from '../entities/EnemyManager.js';
import PowerUpManager from '../entities/PowerUpManager.js';

/** No-op presentation for a game with no screen (the game server and simulation tests).
 * Only `showSessionError` speaks up, so a broken session is never silent. */
export function silentUI() {
  const nothing = () => {};
  return { resetSessionUI: nothing, updateHUD: nothing, updateEnemyCount: nothing, updateWeaponUI: nothing, hideStartScreen: nothing, hideLevelSelect: nothing,
    showMessage: nothing, showPauseMenu: nothing, hidePauseMenu: nothing, showCompletion: nothing, showGameOver: nothing, showAnarchyResult: nothing,
    /** @param {Error} error */ showSessionError(error) { throw error; } };
}

/** The full game simulation with stub presentation: the same rules as the browser,
 * nothing drawn or heard. Needs a `document` global; a minimal one is supplied
 * when there is none (Node). */
export default function createHeadlessGame() {
  if (!('document' in globalThis)) Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  game.uiManager = /** @type {any} */ (silentUI());
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session); game.projectileManager.setCanvas({});
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  game.initializeAudio = () => {};
  game.inputManager.requestPointerLock = () => Promise.resolve(true);
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  return game;
}

/** Releases a headless game's session and pooled effects. @param {any} game */
export function disposeHeadlessGame(game) {
  game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose();
}
