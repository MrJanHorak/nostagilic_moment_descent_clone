// filepath: c:\Users\janny\development\2ndAIGameAttempt\src\js\main.js
// Main game file
import * as THREE from 'three';

// Import core modules
import AudioManager from '../js/core/AudioManager.js';
import GameState from '../js/core/GameState.js';
import InputManager from '../js/core/InputManager.js';
import LevelManager from '../js/core/LevelManager.js';

// Import entities
import Spaceship from '../js/entities/Spaceship.js';
import ProjectileManager from '../js/entities/ProjectileManager.js';
import EnemyManager from '../js/entities/EnemyManager.js';
import PowerUpManager from '../js/entities/PowerUpManager.js';

// Import utils
import {
  setupRecursiveDetection,
  detectCircularReferences,
  validateSceneGeometries,
  setupSceneProtection,
} from '../js/utils/debugUtils.js';
import {
  createCaveParticles,
  updateCaveParticles,
  shakeCamera,
} from '../js/utils/effectsUtils.js';
import { checkPlayerObstacleCollision } from '../js/utils/collisionUtils.js';

// Import UI
import UIManager from '../js/ui/UIManager.js';
import RuntimeDiagnostics from './utils/RuntimeDiagnostics.js';

// Initialize the game
export default class Game {
  constructor() {
    // Core systems
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.canvas = null;

    // Managers
    this.audioManager = new AudioManager();
    this.gameState = new GameState();
    this.uiManager = null;
    this.inputManager = null;
    this.levelManager = null;
    this.projectileManager = null;
    this.enemyManager = null;
    this.powerUpManager = null;

    // Game entities
    this.spaceship = null;
    this.caveParticles = null;

    // Game state tracking
    this.activeAnimations = [];
    this.lastEnemySpawnTime = 0;
    this.enemySpawnInterval = 5000; // ms between enemy spawns
    this.lastPowerupSpawnTime = 0;

    // Add level selection properties
    this.currentLevelIndex = 0;
    this.isEndlessMode = true;
    this.diagnostics = new RuntimeDiagnostics(
      !!import.meta.env?.DEV &&
      new URLSearchParams(globalThis.window?.location?.search).has('smoke')
    );
  }

  async init() {
    console.log('Starting game initialization');
    try {
      // Set up debugging utilities
      if (import.meta.env?.DEV) setupRecursiveDetection();

      // Initialize scene
      this.initScene();
      console.log('Scene initialized');

      this.initCamera();
      console.log('Camera initialized');

      this.initRenderer();
      console.log('Renderer initialized'); // Set up scene protection (prevent circular references)
      if (import.meta.env?.DEV) setupSceneProtection(this.scene, this.camera);

      // Initialize managers
      this.uiManager = new UIManager(this.gameState, this.audioManager);
      this.uiManager.game = this;
      this.inputManager = new InputManager(
        this.camera,
        null,
        this.gameState,
        this.uiManager
      ).init(this.canvas);
      // Connect the input manager with the game
      this.inputManager.game = this;

      this.levelManager = new LevelManager(this.scene, this.camera);
      this.projectileManager = new ProjectileManager(
        this.scene,
        this.camera,
        this.audioManager
      );
      this.projectileManager.setCanvas(this.canvas);
      this.powerUpManager = new PowerUpManager(
        this.scene,
        this.camera,
        this.gameState,
        this.audioManager,
        this.uiManager,
        this.levelManager
      );

      this.enemyManager = new EnemyManager(
        this.scene,
        this.camera,
        this.gameState,
        this.audioManager,
        this.levelManager
      );

      // Connect EnemyManager to PowerUpManager so it can drop weapon pickups
      this.enemyManager.powerUpManager = this.powerUpManager;

      // Give the LevelManager a reference to the EnemyManager
      if (this.levelManager) {
        this.levelManager.enemyManager = this.enemyManager;
      }

      // Connect the input manager with the projectile manager
      this.inputManager.projectileManager = this.projectileManager; // Set up gameState references
      this.gameState.setReferences(
        this.camera,
        this.audioManager,
        this.uiManager,
        this.activeAnimations,
        this
      );

      // Initialize lighting
      this.initLighting();

      // Create the player's spaceship
      this.spaceship = new Spaceship();
      this.spaceship.attachToCamera(this.camera);

      // Initialize cave dust particles
      this.caveParticles = createCaveParticles(this.scene); // Initialize level manager first
      await this.levelManager.initMaterials();

      // Select mode: endless or level-based
      if (this.isEndlessMode) {
        this.levelManager.isEndless = true;
        this.levelManager.initLevel();
      } else {
        this.levelManager.isEndless = false;
        this.levelManager.loadLevel(this.currentLevelIndex);
      }

      // Set enemy manager to use level segments
      this.enemyManager.setLevelSegments(this.levelManager.getLevelSegments());

      // Every start screen owns its listeners, including screens recreated by Back.
      if (!this.uiManager.createStartScreen()) {
        throw new Error('Unable to create the start screen');
      }
      // Initialize the weapon UI if it exists
      if (this.gameState && this.uiManager) {
        this.gameState.resetWeaponInventory();
        this.uiManager.updateWeaponUI();
      }

      // Start animation loop
      this.animate();

      // Run diagnostics
      console.log('Running initial scene diagnostics...');
      detectCircularReferences(this.scene);
      validateSceneGeometries(this.scene);
      console.log('Initial scene diagnostics complete.');
    } catch (error) {
      this.diagnostics.reportError(error, 'Initialization');
      console.error('Game initialization failed:', error);
      throw error;
    }
  }

  initScene() {
    this.scene = new THREE.Scene();
    // Add atmospheric fog to enhance cave feel
    this.scene.fog = new THREE.FogExp2(0x000511, 0.03);
    this.scene.background = new THREE.Color(0x000511); // Dark blue background
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;
    this.camera.rotation.order = 'YXZ'; // To avoid gimbal lock issues with rotations
    this.scene.add(this.camera); // Add camera to scene
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    // Handle window resizing
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x333333, 0.3); // Dimmer ambient light for cave feel
    this.scene.add(ambientLight);

    // Main directional light (softer)
    const directionalLight = new THREE.DirectionalLight(0xcccccc, 0.5);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);

    // Add spotlight attached to player for flashlight effect
    const spotlight = new THREE.SpotLight(
      0xffffff,
      2.0,
      30,
      Math.PI / 5,
      0.5,
      1
    );
    spotlight.position.set(0, 0, 0); // Will be updated to follow camera
    this.camera.add(spotlight);
    spotlight.target.position.set(0, 0, -1);
    this.camera.add(spotlight.target);

    // Add a secondary wider light for better tunnel visibility
    const wideLight = new THREE.SpotLight(
      0xaaccff,
      1.0,
      20,
      Math.PI / 3,
      0.8,
      1
    );
    wideLight.position.set(0, 0, 0);
    this.camera.add(wideLight);
    wideLight.target.position.set(0, 0, -1);
    this.camera.add(wideLight.target);
  }

  // Create bump sound for collisions
  createBumpSound() {
    if (this.audioManager && this.audioManager.initialized) {
      this.audioManager.createSound('bump', () => {
        // Simple bump/collision sound
        const ctx = this.audioManager.context;
        const duration = 0.15;
        const buffer = ctx.createBuffer(
          1,
          ctx.sampleRate * duration,
          ctx.sampleRate
        );
        const data = buffer.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
          const t = i / ctx.sampleRate;
          data[i] =
            Math.sin(2 * Math.PI * 150 * t) *
            (1 - t / duration) *
            (Math.random() * 0.2 + 0.8);
        }

        return buffer;
      });
    }
  }
  initializeAudio() {
    if (!this.audioManager.init()) return;

    for (const [id, frequency, duration] of [
      ['empty', 80, 0.05], ['weaponSwitch', 1000, 0.15], ['hit', 500, 0.1],
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
    if (!this.audioManager.sounds.bump?.buffer) this.createBumpSound();

    // Stay inside the user gesture; no delayed playback can leak into a later run.
    if (this.audioManager.context.state === 'suspended') {
      this.audioManager.context.resume().catch((error) => {
        console.warn('Audio could not resume; continuing without sound.', error);
      });
    }
    this.audioManager.stopSound('backgroundMusic');
    this.audioManager.stopSound('engine');
    this.audioManager.playSound('backgroundMusic', { isMusic: true, loop: true, volume: 0.4 });
    this.audioManager.playSound('engine', { loop: true, volume: 0.2 });
  }

  startGame() {
    // Sound is optional: a device/autoplay failure must not strand the start menu.
    try {
      this.initializeAudio();
    } catch (error) {
      this.audioManager.stopAllSounds();
      console.warn('Audio setup failed; continuing without sound.', error);
    }
    this.gameState.resetWeaponInventory();
    this.gameState.isGameOver = false;
    this.gameState.isPaused = false;
    this.gameState.isGameStarted = true;
    this.inputManager.clearKeys();
    this.uiManager.hideStartScreen();
    this.uiManager.hideLevelSelect();
    this.inputManager.requestPointerLock();
  }
  animate() {
    try {
      requestAnimationFrame(() => this.animate());
      if (!this.clock) {
        console.warn('Clock is undefined in animate loop');
        return;
      }

      const rawDelta = this.clock.getDelta();
      this.diagnostics.recordFrame(this.gameState);
      // Clamp delta to prevent large spikes that cause performance issues
      const delta = Math.min(rawDelta, 0.0333); // Cap at ~30 FPS equivalent (1/30 = 0.0333)

      // Performance monitoring (update every 60 frames)
      if (!this.frameCount) this.frameCount = 0;
      if (!this.lastFPSCheck) this.lastFPSCheck = performance.now();

      this.frameCount++;
      if (this.frameCount % 60 === 0) {
        const now = performance.now();
        const fps = Math.round(60000 / (now - this.lastFPSCheck));
        this.lastFPSCheck = now;

        // Log performance if FPS is low
        if (fps < 45) {
          console.warn(`Low FPS detected: ${fps} FPS (target: 60)`);
        }
      }

      // Make sure activeAnimations exists
      if (!this.activeAnimations) {
        this.activeAnimations = [];
        console.warn('Initialized missing activeAnimations array');
      }

      // Update active animations
      for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
        try {
          // Check if the animation function exists
          if (typeof this.activeAnimations[i] === 'function') {
            const isComplete = this.activeAnimations[i](delta);
            if (isComplete) {
              this.activeAnimations.splice(i, 1);
            }
          } else {
            // Remove invalid animation entries
            console.warn(
              'Invalid animation function found, removing from queue'
            );
            this.activeAnimations.splice(i, 1);
          }
        } catch (error) {
          console.warn('Error in animation function:', error);
          this.activeAnimations.splice(i, 1);
        }
      } // Skip most updates if game not started yet or is paused
      if (
        this.gameState &&
        this.gameState.isGameStarted &&
        !this.gameState.isGameOver &&
        !this.gameState.isPaused
      ) {
        try {
          // === Update player movement FIRST ===
          if (this.inputManager) {
            this.inputManager.updateMovement(delta);
          }

          // === Player movement and collision ===
          if (this.spaceship && this.levelManager) {
            // Calculate intended movement (velocity * delta)
            const intendedMove = this.spaceship.velocity
              .clone()
              .multiplyScalar(delta);
            // Check for collision (still use ship's group for collision)
            const collision = checkPlayerObstacleCollision(
              this.spaceship.group,
              this.levelManager.obstacles,
              intendedMove,
              this.levelManager.tunnelWidth,
              this.levelManager.tunnelHeight
            );
            if (!collision) {
              // Instead of moving the ship, move the tunnel/obstacles/enemies in the opposite direction
              this.levelManager.offsetLevel(intendedMove.clone().negate());
              if (this.enemyManager)
                this.enemyManager.offsetEnemies(intendedMove.clone().negate());
              if (this.projectileManager)
                this.projectileManager.offsetProjectiles(
                  intendedMove.clone().negate()
                );
              if (this.powerUpManager)
                this.powerUpManager.offsetPowerUps(
                  intendedMove.clone().negate()
                ); // Move cave particles using batch operation
              if (this.caveParticles && intendedMove.z !== 0) {
                this.caveParticles.position.z -= intendedMove.z;
              }
            } else {
              // Collision: stop velocity in that direction
              this.spaceship.velocity.set(0, 0, 0);
              // Play bump sound if available
              if (this.audioManager) {
                this.audioManager.playSound('bump');
              }
            }
          }

          // Update level
          if (this.levelManager) {
            this.levelManager.updateLevel();
          }

          // Update the enemy manager's reference to level segments
          if (this.enemyManager && this.levelManager) {
            const segments = this.levelManager.getLevelSegments();
            if (segments) {
              this.enemyManager.setLevelSegments(segments);
            }
          }

          // Update projectiles
          if (this.projectileManager) {
            this.projectileManager.updateProjectiles(delta);
          }

          // Update enemies
          if (this.enemyManager && this.projectileManager) {
            const projectiles = this.projectileManager.getProjectiles();
            if (projectiles) {
              this.enemyManager.updateEnemies(delta, projectiles);
            }
          }

          // Update power-ups
          if (this.powerUpManager) {
            this.powerUpManager.update();
          } // Update particles (reduced frequency for performance)
          if (this.caveParticles) {
            if (!this.lastParticleUpdate) this.lastParticleUpdate = 0;
            const currentTime = performance.now();

            // Update particles every 50ms instead of every frame
            if (currentTime - this.lastParticleUpdate > 50) {
              updateCaveParticles(this.caveParticles, delta);
              this.lastParticleUpdate = currentTime;
            }
          }
          const currentTime = Date.now();

          // Use level blueprint enemy spawns or random spawns depending on mode
          if (this.isEndlessMode) {
            // Spawn enemies periodically in endless mode
            if (
              this.lastEnemySpawnTime !== undefined &&
              this.enemySpawnInterval !== undefined &&
              currentTime - this.lastEnemySpawnTime > this.enemySpawnInterval
            ) {
              if (this.enemyManager && this.levelManager) {
                const segmentLength = this.levelManager.getSegmentLength();
                if (segmentLength !== undefined) {
                  this.enemyManager.spawnEnemiesInTunnel(segmentLength);
                }
              }

              this.lastEnemySpawnTime = currentTime;

              // Gradually decrease spawn interval (increase difficulty)
              this.enemySpawnInterval = Math.max(
                2000,
                this.enemySpawnInterval - 50
              );
            }

            // Spawn powerups periodically in endless mode
            if (
              this.lastPowerupSpawnTime !== undefined &&
              this.powerupSpawnInterval !== undefined &&
              currentTime - this.lastPowerupSpawnTime >
                this.powerupSpawnInterval
            ) {
              if (this.powerUpManager) {
                this.powerUpManager.spawnRandomPowerup();
              }

              this.lastPowerupSpawnTime = currentTime;
            }
          } else {
            // Use predefined spawn points in level-based mode
            if (this.enemyManager) {
              this.enemyManager.spawnPredefinedEnemies();
            }

            if (this.powerUpManager) {
              this.powerUpManager.spawnPredefinedPowerUps();
            }
          }

          // Update HUD
          if (this.uiManager) {
            this.uiManager.updateHUD();
          }
          this.diagnostics.recordUpdate();
        } catch (error) {
          this.diagnostics.reportError(error, 'Simulation');
          console.error('Error in game update loop:', error);
        }
      }

      // === Camera follows ship exactly ===
      if (this.spaceship && this.camera) {
        // Set camera position directly relative to ship
        const cameraOffset = new THREE.Vector3(0, 2, 6); // y=up, z=back
        const shipPos = this.spaceship.group.position;
        this.camera.position.copy(shipPos.clone().add(cameraOffset));
        this.camera.lookAt(shipPos);
      }

      // Render the scene
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    } catch (error) {
      this.diagnostics.reportError(error, 'Animation');
      console.error('Critical error in animation loop:', error);
    }
  }

  // Select a specific level
  selectLevel(levelIndex) {
    this.currentLevelIndex = levelIndex;
    this.isEndlessMode = false;

    if (this.levelManager) {
      this.levelManager.isEndless = false;
      this.levelManager.loadLevel(levelIndex);
    }
  }

  // Select endless mode
  selectEndlessMode() {
    this.isEndlessMode = true;

    if (this.levelManager) {
      this.levelManager.isEndless = true;
      this.levelManager.clearLevel();
      this.levelManager.initEndlessLevel();
    }
  }

  // Restart current level
  restartLevel() {
    if (this.isEndlessMode) {
      if (this.levelManager) {
        this.levelManager.clearLevel();
        this.levelManager.initEndlessLevel();
      }
    } else {
      if (this.levelManager) {
        this.levelManager.loadLevel(this.currentLevelIndex);
      }
    }

    // Reset player position and state
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.gameState.playerHealth = this.gameState.maxPlayerHealth;

    // Update HUD
    if (this.uiManager) {
      this.uiManager.updateHUD();
    }
  }

  // Method to handle game restart from game over state
  restartGame() {
    // Reset game state
    this.gameState.isGameOver = false;
    this.gameState.score = 0;
    this.gameState.playerHealth = this.gameState.maxPlayerHealth;

    // Hide game over display
    if (this.uiManager && this.uiManager.hudElements.gameOverDisplay) {
      this.uiManager.hudElements.gameOverDisplay.style.display = 'none';
    }

    // Reset player position
    if (this.camera) {
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
    }

    // Restart current level
    this.restartLevel();

    // Update the UI
    if (this.uiManager) {
      this.uiManager.updateHUD();
    }

    // Show message
    this.uiManager.showMessage('Game Restarted!', 2000, '#00ff00');
  }

  // Method to show level selection screen
  showLevelSelection() {
    // Hide game over or start screen if visible
    if (this.uiManager.startScreen) {
      this.uiManager.hideStartScreen();
    }

    if (this.uiManager.hudElements.gameOverDisplay) {
      this.uiManager.hudElements.gameOverDisplay.style.display = 'none';
    }

    // Show level selection screen
    this.uiManager.createLevelSelect(this);
  }
}
