import * as THREE from 'three';
import AudioManager from './core/AudioManager.js';
import GameState from './core/GameState.js';
import InputManager from './core/InputManager.js';
import LevelManager from './core/LevelManager.js';
import Spaceship from './entities/Spaceship.js';
import { prepareLevelDocument } from './core/levels/document/compileLevelDocument.js';
import disposeObject from './utils/disposeObject.js';
import ProjectileManager from './entities/ProjectileManager.js';
import EnemyManager from './entities/EnemyManager.js';
import PowerUpManager from './entities/PowerUpManager.js';
import UIManager from './ui/UIManager.js';
import SimulationStepper from './core/SimulationStepper.js';
import RuntimeDiagnostics from './utils/RuntimeDiagnostics.js';
import MissionObjective from './core/MissionObjective.js';
import UserSettings from './core/UserSettings.js';
import { createCaveParticles, updateCaveParticles } from './utils/effectsUtils.js';
import { checkPlayerObstacleCollision } from './utils/collisionUtils.js';
import { moveSphere } from './utils/sphereMovement.js';

export default class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.stepper = new SimulationStepper();
    this.scene = new THREE.Scene();
    this.audioManager = new AudioManager();
    this.gameState = new GameState();
    this.settings = new UserSettings(undefined, values => this.audioManager.applyPreferences(values));
    this.session = this.gameState.session;
    this.activeAnimations = [];
    this.mission = null;
    this.currentLevelIndex = 0;
    this.importedLevelIndex = null;
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
      this.levelManager = new LevelManager(this.scene, this.spaceship.group);
      this.projectileManager = new ProjectileManager(this.scene, this.spaceship.group, this.audioManager, this.session);
      this.projectileManager.setCanvas(this.canvas);
      this.inputManager = new InputManager(this.camera, this.projectileManager, this.gameState, this.uiManager, this.settings).init(this.canvas);
      this.inputManager.game = this;
      this.powerUpManager = new PowerUpManager(this.scene, this.spaceship.group, this.gameState, this.audioManager, this.uiManager, this.levelManager);
      this.enemyManager = new EnemyManager(this.scene, this.spaceship.group, this.gameState, this.audioManager, this.levelManager);
      this.enemyManager.powerUpManager = this.powerUpManager;
      this.gameState.setReferences(this.camera, this.audioManager, this.uiManager, this.activeAnimations, this);
      this.initLighting();
      this.caveParticles = createCaveParticles(this.scene);
      await this.levelManager.initMaterials();
      this.levelManager.loadLevel(0); // Static flight arena preview; no live session yet.
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
    this.spaceship = new Spaceship();
    this.spaceship.attachCamera(this.camera);
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
    this.diagnostics.invalidateCapture?.('Session ended during capture');
    this.stepper.reset();
    this.session.end(); // Invalidate callbacks before touching entities or UI.
    this.mission = null;
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

  startSession({ endless = this.isEndlessMode, levelIndex = this.currentLevelIndex, preparedWorld = null } = {}) {
    if (!endless && (!Number.isInteger(levelIndex) || !this.levelManager?.levels[levelIndex])) {
      throw new RangeError(`Unknown mission index: ${levelIndex}`);
    }
    this.endSession();
    this.isEndlessMode = endless;
    this.currentLevelIndex = levelIndex;
    this.session.begin();
    try {
      this.gameState.resetForSession();
      this.spaceship.reset();
      this.lastMovement = null;
      this.camera.position.set(0, 0, 0);
      this.camera.quaternion.identity();
      this.gameState.playerVelocity = this.spaceship.velocity;
      this.caveParticles?.position.set(0, 0, 0);
      this.lastPowerupSpawnTime = 0;
      this.lastParticleUpdate = 0;
      this.levelManager.isEndless = endless;
      if (endless) {
        this.levelManager.currentLevel = null;
        this.levelManager.initEndlessLevel();
      } else this.levelManager.loadLevel(levelIndex, preparedWorld);
      const level = this.levelManager.currentLevel;
      this.mission = !endless && level.mission ? new MissionObjective(level.mission) : null;
      if (!endless && Number.isFinite(level.combat?.initialPulseAmmo)) {
        this.gameState.weaponInventory.pulse.ammo = level.combat.initialPulseAmmo;
        this.gameState.pulseAmmoCapacity = level.combat.maxPulseAmmo;
      }
      this.enemyManager.onEnemyDefeated = (id, cause) => {
        if (this.session.phase === 'playing') this.mission?.recordDefeat(id, cause);
      };
      this.projectileManager.setCombatWorld?.({
        getColliders: () => this.levelManager.solidColliders,
        getTargets: () => this.enemyManager.enemies,
        getRules: () => this.isEndlessMode ? null : this.levelManager.currentLevel?.combat,
        onTargetHit: (enemy, projectile, position) => this.enemyManager.hitEnemy(enemy, projectile, position),
      });
      if (this.levelManager.currentLevel?.kind === 'arena' && !endless) {
        this.spaceship.group.position.fromArray(this.levelManager.currentLevel.spawn);
        if (this.levelManager.currentLevel.spawnRotation) this.spaceship.group.quaternion.fromArray(this.levelManager.currentLevel.spawnRotation);
      }
      if (this.caveParticles) this.caveParticles.visible = this.levelManager.currentLevel?.kind !== 'arena';
      this.enemyManager.setLevelSegments(this.levelManager.getLevelSegments());
      try { this.initializeAudio(); } catch (error) {
        this.audioManager.stopAllSounds();
        console.warn('Audio setup failed; continuing without sound.', error);
      }
      this.session.transition('playing');
      this.clock.getDelta(); // Discard time spent in menus/loading.
      this.uiManager.hideStartScreen();
      this.uiManager.hideLevelSelect();
      this.uiManager.updateWeaponUI();
      this.uiManager.updateHUD();
      this.uiManager.updateEnemyCount(0, endless ? 0 : this.levelManager.currentLevel.enemySpawns.length);
      if (!endless && this.levelManager.currentLevel?.kind === 'arena') this.uiManager.showArenaGuide?.();
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
  // The editor/file UI can call this after reading JSON. Invalid data or staging
  // failures leave the active session intact. Reuse one imported catalog slot.
  startLevelDocument(input) {
    const prepared = prepareLevelDocument(input);
    try {
      this.importedLevelIndex ??= this.levelManager.levels.length;
      this.levelManager.levels[this.importedLevelIndex] = prepared.level;
      return this.startSession({ endless: false, levelIndex: this.importedLevelIndex, preparedWorld: prepared.world });
    } finally {
      if (!prepared.world.claimed) disposeObject(prepared.world.group);
    }
  }
  selectLevel(index) { return this.startSession({ endless: false, levelIndex: index }); }
  selectEndlessMode() { return this.startSession({ endless: true }); }
  restartLevel() { return this.startSession(); }
  restartGame() { return this.startSession(); }

  pauseGame() {
    if (this.session.phase !== 'playing') return false;
    this.diagnostics.invalidateCapture?.('Paused during capture');
    this.stepper.reset();
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
    if (this.mission && !this.mission.completed) return false;
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

  updateMission() {
    if (!this.mission || this.session.phase !== 'playing') return;
    this.levelManager.updateExitMarker(this.mission.ready);
    if (this.mission.tryComplete(this.spaceship.group.position, this.spaceship.radius)) this.completeSession();
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
    if (!this.isEndlessMode && this.levelManager.currentLevel?.kind === 'arena') {
      this.lastMovement = moveSphere(this.spaceship.group.position, this.spaceship.velocity,
        delta, this.levelManager.solidColliders, this.spaceship.radius);
    } else {
      const intended = this.spaceship.velocity.clone().multiplyScalar(delta);
      const collision = checkPlayerObstacleCollision(this.spaceship.group, this.levelManager.obstacles,
        intended, this.levelManager.tunnelWidth, this.levelManager.tunnelHeight);
      if (collision) this.spaceship.velocity.set(0, 0, 0);
      else this.spaceship.group.position.add(intended);
    }
    this.levelManager.updateLevel();
    this.enemyManager.setLevelSegments(this.levelManager.getLevelSegments());
    this.enemyManager.updateEnemies(delta);
    if (this.session.phase !== 'playing') return;
    this.projectileManager.updateProjectiles(delta);
    if (this.session.phase !== 'playing') return;
    this.powerUpManager.update(delta);
    this.updateMission();
    if (this.session.phase !== 'playing') return;
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

  advanceFrame(delta) {
    if (this.session.phase !== 'playing') { this.stepper.reset(); return; }
    const generation = this.session.id;
    this.stepper.advance(delta, (step) => {
      this.updateSimulation(step);
      return this.session.phase === 'playing' && this.session.id === generation;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    try {
      const frameStart = this.diagnostics.enabled ? performance.now() : 0;
      this.advanceFrame(this.clock.getDelta());
      if (this.session.phase !== 'error') this.renderer?.render(this.scene, this.camera);
      this.diagnostics.recordFrame(this.gameState, this.diagnostics.enabled ? performance.now() - frameStart : 0);
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
