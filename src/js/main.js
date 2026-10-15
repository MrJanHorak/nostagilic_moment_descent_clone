import * as THREE from 'three';
import AudioManager from './core/AudioManager.js';
import GameState from './core/GameState.js';
import InputManager from './core/InputManager.js';
import LevelManager from './core/LevelManager.js';
import Spaceship from './entities/Spaceship.js';
import ProjectileManager from './entities/ProjectileManager.js';
import EnemyManager from './entities/EnemyManager.js';
import PowerUpManager from './entities/PowerUpManager.js';
import UIManager from './ui/UIManager.js';
import RuntimeDiagnostics from './utils/RuntimeDiagnostics.js';
import { createCaveParticles, updateCaveParticles } from './utils/effectsUtils.js';
import { checkPlayerObstacleCollision } from './utils/collisionUtils.js';

export default class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.audioManager = new AudioManager();
    this.gameState = new GameState();
    this.session = this.gameState.session;
    this.activeAnimations = [];
    this.currentLevelIndex = 0;
    this.isEndlessMode = true;
    this.powerupSpawnInterval = 15000;
    this.diagnostics = new RuntimeDiagnostics(!!import.meta.env?.DEV &&
      new URLSearchParams(globalThis.window?.location?.search).has('smoke'));
  }

  async init() {
    try {
      this.initScene();
      this.initCamera();
      this.initRenderer();
      this.uiManager = new UIManager(this.gameState, this.audioManager);
      this.uiManager.game = this;
      this.levelManager = new LevelManager(this.scene, this.camera);
      this.projectileManager = new ProjectileManager(this.scene, this.camera, this.audioManager, this.session);
      this.projectileManager.setCanvas(this.canvas);
      this.inputManager = new InputManager(this.camera, this.projectileManager, this.gameState, this.uiManager).init(this.canvas);
      this.inputManager.game = this;
      this.powerUpManager = new PowerUpManager(this.scene, this.camera, this.gameState, this.audioManager, this.uiManager, this.levelManager);
      this.enemyManager = new EnemyManager(this.scene, this.camera, this.gameState, this.audioManager, this.levelManager);
      this.enemyManager.powerUpManager = this.powerUpManager;
      this.gameState.setReferences(this.camera, this.audioManager, this.uiManager, this.activeAnimations, this);
      this.initLighting();
      this.spaceship = new Spaceship();
      this.spaceship.attachToCamera(this.camera);
      this.caveParticles = createCaveParticles(this.scene);
      await this.levelManager.initMaterials();
      this.levelManager.initLevel(); // Static background preview; no live session yet.
      if (!this.uiManager.createStartScreen()) throw new Error('Unable to create the start screen');
      this.animate();
    } catch (error) {
      this.diagnostics.reportError(error, 'Initialization');
      throw error;
    }
  }

  initScene() {
    this.scene.fog = new THREE.FogExp2(0x000511, 0.03);
    this.scene.background = new THREE.Color(0x000511);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 5;
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.canvas = this.renderer.domElement;
    document.body.appendChild(this.canvas);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initLighting() {
    this.scene.add(new THREE.AmbientLight(0x333333, 0.3));
    const directional = new THREE.DirectionalLight(0xcccccc, 0.5);
    directional.position.set(5, 10, 7.5);
    this.scene.add(directional);
    for (const [color, intensity, distance, angle, penumbra] of [
      [0xffffff, 2, 30, Math.PI / 5, 0.5], [0xaaccff, 1, 20, Math.PI / 3, 0.8],
    ]) {
      const light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, 1);
      light.target.position.set(0, 0, -1);
      this.camera.add(light, light.target);
    }
  }

  initializeAudio() {
    if (!this.audioManager.init()) return;
    for (const [id, frequency, duration] of [
      ['empty', 80, 0.05], ['weaponSwitch', 1000, 0.15], ['hit', 500, 0.1], ['bump', 150, 0.15],
    ]) {
      if (this.audioManager.sounds[id]?.buffer) continue;
      this.audioManager.createSound(id, (ctx) => {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / ctx.sampleRate;
          data[i] = Math.sin(2 * Math.PI * frequency * t) * (1 - t / duration) * 0.2;
        }
        return buffer;
      });
    }
    this.audioManager.context.resume().catch((error) => console.warn('Audio could not resume.', error));
    this.audioManager.playSound('backgroundMusic', { isMusic: true, loop: true, volume: 0.4 });
    this.audioManager.playSound('engine', { loop: true, volume: 0.2 });
  }

  releasePointerLock() {
    if (this.inputManager) this.inputManager.wasPointerLocked = false;
    if (globalThis.document?.pointerLockElement) {
      try { document.exitPointerLock(); } catch { /* Already released by browser. */ }
    }
  }

  endSession() {
    this.session.end(); // Invalidate callbacks before touching entities or UI.
    this.inputManager?.clearKeys();
    this.releasePointerLock();
    this.audioManager.stopAllSounds();
    this.audioManager.setPaused(false);
    this.activeAnimations.length = 0;
    this.enemyManager?.resetLevel();
    this.projectileManager?.clear();
    this.powerUpManager?.clear();
    this.levelManager?.clearLevel();
    this.uiManager?.resetSessionUI();
  }

  startSession({ endless = this.isEndlessMode, levelIndex = this.currentLevelIndex } = {}) {
    if (!endless && (!Number.isInteger(levelIndex) || !this.levelManager?.levels[levelIndex])) {
      throw new RangeError(`Unknown mission index: ${levelIndex}`);
    }
    this.endSession();
    this.isEndlessMode = endless;
    this.currentLevelIndex = levelIndex;
    this.session.begin();
    try {
      this.gameState.resetForSession();
      this.camera.position.set(0, 0, 5);
      this.camera.rotation.set(0, 0, 0);
      this.spaceship.velocity.set(0, 0, 0);
      this.spaceship.pitch = 0;
      this.spaceship.group.rotation.set(0, 0, 0);
      this.spaceship.group.position.set(0, -0.2, -1.5);
      this.caveParticles?.position.set(0, 0, 0);
      this.lastPowerupSpawnTime = 0;
      this.lastParticleUpdate = 0;
      this.levelManager.isEndless = endless;
      if (endless) {
        this.levelManager.currentLevel = null;
        this.levelManager.initEndlessLevel();
      } else this.levelManager.loadLevel(levelIndex);
      this.enemyManager.setLevelSegments(this.levelManager.getLevelSegments());
      try { this.initializeAudio(); } catch (error) {
        this.audioManager.stopAllSounds();
        console.warn('Audio setup failed; continuing without sound.', error);
      }
      this.session.transition('playing');
      this.clock.getDelta(); // Discard time spent in menus/loading.
      this.uiManager.hideStartScreen();
      this.uiManager.hideLevelSelect();
      this.uiManager.updateHUD();
      this.uiManager.updateEnemyCount(0, endless ? 0 : this.levelManager.currentLevel.enemySpawns.length);
      this.inputManager.requestPointerLock();
      return true;
    } catch (error) {
      this.endSession();
      this.session.begin();
      this.session.transition('error');
      this.diagnostics.reportError(error, 'Starting session');
      this.uiManager?.showSessionError(error);
      console.error('Unable to start session:', error);
      return false;
    }
  }

  startGame() { return this.startSession(); }
  selectLevel(index) { return this.startSession({ endless: false, levelIndex: index }); }
  selectEndlessMode() { return this.startSession({ endless: true }); }
  restartLevel() { return this.startSession(); }
  restartGame() { return this.startSession(); }

  pauseGame() {
    if (this.session.phase !== 'playing') return false;
    this.session.transition('paused');
    this.inputManager.clearKeys();
    this.audioManager.setPaused(true);
    this.releasePointerLock();
    this.uiManager.showPauseMenu();
    return true;
  }

  resumeGame() {
    if (this.session.phase !== 'paused') return false;
    this.session.transition('playing');
    this.inputManager.clearKeys();
    this.clock.getDelta();
    this.audioManager.setPaused(false);
    this.uiManager.hidePauseMenu();
    this.inputManager.requestPointerLock();
    return true;
  }

  togglePause() { return this.session.phase === 'paused' ? this.resumeGame() : this.pauseGame(); }

  die() {
    if (this.session.phase !== 'playing') return false;
    this.session.transition('dead');
    this.session.tasks.clear();
    this.inputManager.clearKeys();
    this.releasePointerLock();
    this.audioManager.stopAllSounds();
    this.audioManager.playSound('gameOver', { volume: 0.6 });
    this.uiManager.updateHUD();
    this.uiManager.showGameOver();
    return true;
  }

  completeSession() {
    if (this.session.phase !== 'playing' || this.isEndlessMode) return false;
    this.session.transition('completed');
    this.session.tasks.clear();
    this.gameState.score += 1000;
    this.inputManager.clearKeys();
    this.releasePointerLock();
    this.audioManager.stopAllSounds();
    this.audioManager.playSound('powerup', { volume: 0.7 });
    this.uiManager.updateHUD();
    this.uiManager.showCompletion(this.currentLevelIndex + 1 < this.levelManager.levels.length);
    return true;
  }

  nextMission() {
    if (this.session.phase !== 'completed') return false;
    const next = this.currentLevelIndex + 1;
    if (next >= this.levelManager.levels.length) return false;
    return this.startSession({ endless: false, levelIndex: next });
  }

  showLevelSelection() {
    this.endSession();
    this.uiManager.hideStartScreen();
    this.uiManager.createLevelSelect(this);
  }

  showMainMenu() {
    this.endSession();
    this.uiManager.createStartScreen();
  }

  updateSimulation(delta) {
    if (this.session.phase !== 'playing') return;
    const generation = this.session.id;
    this.session.advance(delta);
    if (this.session.id !== generation || this.session.phase !== 'playing') return;
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      if (this.activeAnimations[i](delta)) this.activeAnimations.splice(i, 1);
    }
    this.inputManager.updateMovement(delta);
    // Legacy movement contract remains until the next player-root checkpoint.
    const intended = this.spaceship.velocity.clone().multiplyScalar(delta);
    const collision = checkPlayerObstacleCollision(this.spaceship.group, this.levelManager.obstacles,
      intended, this.levelManager.tunnelWidth, this.levelManager.tunnelHeight);
    if (collision) this.spaceship.velocity.set(0, 0, 0);
    else {
      const offset = intended.negate();
      this.levelManager.offsetLevel(offset);
      this.enemyManager.offsetEnemies(offset);
      this.projectileManager.offsetProjectiles(offset);
      this.powerUpManager.offsetPowerUps(offset);
      if (this.caveParticles) this.caveParticles.position.z += offset.z;
    }
    this.levelManager.updateLevel();
    this.enemyManager.setLevelSegments(this.levelManager.getLevelSegments());
    this.projectileManager.updateProjectiles(delta);
    this.enemyManager.updateEnemies(delta, this.projectileManager.getProjectiles());
    if (this.session.phase !== 'playing') return;
    this.powerUpManager.update(delta);
    if (this.caveParticles && this.session.timeMs - this.lastParticleUpdate >= 50) {
      updateCaveParticles(this.caveParticles, (this.session.timeMs - this.lastParticleUpdate) / 1000);
      this.lastParticleUpdate = this.session.timeMs;
    }
    if (this.isEndlessMode && this.session.timeMs - this.lastPowerupSpawnTime >= this.powerupSpawnInterval) {
      this.powerUpManager.spawnRandomPowerup();
      this.lastPowerupSpawnTime = this.session.timeMs;
    }
    this.uiManager.updateHUD();
    this.diagnostics.recordUpdate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    try {
      this.diagnostics.recordFrame(this.gameState);
      this.updateSimulation(Math.min(this.clock.getDelta(), 0.0333));
      // The existing camera-follow bug is intentionally isolated from lifecycle work.
      if (this.spaceship && this.camera) {
        const shipPosition = this.spaceship.group.position;
        this.camera.position.copy(shipPosition).add(new THREE.Vector3(0, 2, 6));
        this.camera.lookAt(shipPosition);
      }
      if (this.session.phase !== 'error') this.renderer?.render(this.scene, this.camera);
    } catch (error) {
      this.diagnostics.reportError(error, 'Simulation/render');
      console.error('Game update failed:', error);
      this.endSession();
      this.session.begin();
      this.session.transition('error');
      this.uiManager?.showSessionError(error);
    }
  }
}
