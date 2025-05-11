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
    this.powerupSpawnInterval = 15000; // ms between powerups
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
      console.log('Renderer initialized');

      // Set up scene protection (prevent circular references)
      setupSceneProtection(this.scene, this.camera);

      // Initialize managers
      this.uiManager = new UIManager(this.gameState, this.audioManager);
      this.inputManager = new InputManager(
        this.camera,
        null,
        this.gameState
      ).init(this.canvas);
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
        this.audioManager
      );
      this.powerUpManager = new PowerUpManager(
        this.scene,
        this.camera,
        this.gameState,
        this.audioManager,
        this.uiManager
      );

      // Connect the input manager with the projectile manager
      this.inputManager.projectileManager = this.projectileManager;

      // Set up gameState references
      this.gameState.setReferences(
        this.camera,
        this.audioManager,
        this.uiManager,
        this.activeAnimations
      );

      // Initialize lighting
      this.initLighting();

      // Create the player's spaceship
      this.spaceship = new Spaceship();
      this.spaceship.attachToCamera(this.camera);

      // Initialize cave dust particles
      this.caveParticles = createCaveParticles(this.scene);

      // Initialize level
      await this.levelManager.initMaterials();
      this.levelManager.initLevel();

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

  startGame() {
    this.gameState.isGameStarted = true;
    this.uiManager.hideStartScreen();

    // Initialize audio on first interaction
    this.audioManager.init();

    // Play background music
    this.audioManager.playSound('backgroundMusic', {
      isMusic: true,
      loop: true,
      volume: 0.4,
    });

    // Play engine hum sound
    this.audioManager.playSound('engine', {
      loop: true,
      volume: 0.2,
    });

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
      }

      // Skip most updates if game not started yet
      if (
        this.gameState &&
        this.gameState.isGameStarted &&
        !this.gameState.isGameOver
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

          // Spawn enemies periodically
          const currentTime = Date.now();
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

          // Spawn powerups periodically
          if (
            this.lastPowerupSpawnTime !== undefined &&
            this.powerupSpawnInterval !== undefined &&
            currentTime - this.lastPowerupSpawnTime > this.powerupSpawnInterval
          ) {
            if (this.powerUpManager) {
              this.powerUpManager.spawnRandomPowerup();
            }

            this.lastPowerupSpawnTime = currentTime;
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
}
