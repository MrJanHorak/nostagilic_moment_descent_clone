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

// Import UI
import UIManager from '../js/ui/UIManager.js';

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
  }

  async init() {
    console.log('Starting game initialization');
    try {
      // Set up debugging utilities
      setupRecursiveDetection();
      console.log('Recursive detection set up');

      // Initialize scene
      this.initScene();
      console.log('Scene initialized');

      this.initCamera();
      console.log('Camera initialized');

      this.initRenderer();
      console.log('Renderer initialized'); // Set up scene protection (prevent circular references)
      setupSceneProtection(this.scene, this.camera);

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
      this.enemyManager = new EnemyManager(
        this.scene,
        this.camera,
        this.gameState,
        this.audioManager,
        this.levelManager
      );

      // Give the LevelManager a reference to the EnemyManager
      if (this.levelManager) {
        this.levelManager.enemyManager = this.enemyManager;
      }
      this.powerUpManager = new PowerUpManager(
        this.scene,
        this.camera,
        this.gameState,
        this.audioManager,
        this.uiManager,
        this.levelManager
      );

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

      // Create start screen and set up event listener
      const startButton = this.uiManager.createStartScreen();
      startButton.addEventListener('click', () => this.startGame());

      // Start animation loop
      this.animate();

      // Run diagnostics
      console.log('Running initial scene diagnostics...');
      detectCircularReferences(this.scene);
      validateSceneGeometries(this.scene);
      console.log('Initial scene diagnostics complete.');
    } catch (error) {
      console.error('Game initialization failed:', error);
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

  startGame() {
    this.gameState.isGameStarted = true;
    this.uiManager.hideStartScreen(); // Initialize audio on first interaction
    this.audioManager.init();

    // Create collision bump sound after audio initialization
    this.createBumpSound();

    // Create hit sound for projectile collisions
    this.audioManager.createSound('hit', () => {
      const ctx = this.audioManager.context;
      const duration = 0.1;
      const buffer = ctx.createBuffer(
        1,
        ctx.sampleRate * duration,
        ctx.sampleRate
      );
      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        data[i] =
          Math.sin(2 * Math.PI * 500 * t) *
          (1 - t / duration) *
          (Math.random() * 0.1 + 0.9);
      }

      return buffer;
    });

    console.log('Starting game audio...');

    // Make sure audio context is running - browsers often suspend it until user interaction
    if (
      this.audioManager.context &&
      this.audioManager.context.state === 'suspended'
    ) {
      this.audioManager.context.resume().then(() => {
        console.log('Audio context successfully resumed');
      });
    }

    // Play background music with a slight delay to ensure audio context is running
    setTimeout(() => {
      console.log('Trying to play background music...');
      const musicSource = this.audioManager.playSound('backgroundMusic', {
        isMusic: true,
        loop: true,
        volume: 0.4,
      });

      if (musicSource) {
        console.log('Background music started successfully');
      } else {
        console.warn('Failed to start background music');
      }

      // Play engine hum sound
      const engineSource = this.audioManager.playSound('engine', {
        loop: true,
        volume: 0.2,
      });

      if (engineSource) {
        console.log('Engine sound started successfully');
      } else {
        console.warn('Failed to start engine sound');
      }
    }, 100); // Small delay to ensure audio context is properly initialized

    // Run diagnostics after scene is initialized
    console.log('Running scene diagnostics in startGame...');
    detectCircularReferences(this.scene);
    validateSceneGeometries(this.scene);
    console.log('Scene diagnostics complete.');

    // Request pointer lock to start the game
    this.canvas.requestPointerLock();
  }

  animate() {
    try {
      requestAnimationFrame(() => this.animate());

      if (!this.clock) {
        console.warn('Clock is undefined in animate loop');
        return;
      }

      const delta = this.clock.getDelta();

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
          // Update player movement
          if (this.inputManager) {
            this.inputManager.updateMovement(delta);
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
          }

          // Update particles
          if (this.caveParticles) {
            updateCaveParticles(this.caveParticles, delta);
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
        } catch (error) {
          console.error('Error in game update loop:', error);
        }
      }

      // Render the scene
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    } catch (error) {
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
