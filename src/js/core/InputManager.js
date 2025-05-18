// Input Manager for handling keyboard and mouse inputs
import * as THREE from 'three';
import { checkPlayerObstacleCollision } from '../utils/collisionUtils.js';
import { shakeCamera } from '../utils/effectsUtils.js';

class InputManager {
  constructor(camera, projectileManager, gameState, uiManager = null) {
    this.camera = camera;
    this.projectileManager = projectileManager;
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.game = null; // Will be set from main.js

    this.keyStates = {};
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ'); // For camera rotation
    this.PI_2 = Math.PI / 2; // For clamping pitch
    this.canvas = null; // Will be set from outside

    this.moveSpeed = 0.15; // Base movement speed
    this.rotationSpeed = 0.05; // Rotation speed

    // Bind methods
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onPointerlockChange = this.onPointerlockChange.bind(this);
  }

  // Initialize with canvas
  init(canvas) {
    this.canvas = canvas;

    // Add event listeners
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerlockChange);
    this.canvas.addEventListener('click', this.onClick);

    return this;
  }

  // Mouse movement handler for camera rotation
  onMouseMove(event) {
    if (document.pointerLockElement !== this.canvas) {
      return;
    }

    const movementX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);

    this.euler.y -= movementX * 0.002; // Yaw
    this.euler.x -= movementY * 0.002; // Pitch

    this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x)); // Clamp pitch

    this.camera.quaternion.setFromEuler(this.euler);
  } // Handle key down
  onKeyDown(event) {
    this.keyStates[event.code] = true;

    // Handle escape key for pause menu
    if (
      event.code === 'Escape' &&
      this.gameState &&
      this.gameState.isGameStarted
    ) {
      // Toggle pause state
      if (this.uiManager) {
        this.uiManager.togglePauseMenu();
      }
    }

    // Handle weapon switching with number keys 1-4
    if (
      !this.gameState.isGameOver &&
      this.gameState.isGameStarted &&
      !this.gameState.isPaused
    ) {
      const weaponKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
      const keyIndex = weaponKeys.indexOf(event.code);

      if (keyIndex !== -1) {
        const weaponTypes = ['pulse', 'laser', 'missile', 'plasma'];
        const weaponType = weaponTypes[keyIndex];

        this.gameState.switchWeapon(weaponType);
      }
    }
  }

  // Handle key up
  onKeyUp(event) {
    this.keyStates[event.code] = false;
  }

  // Handle click - request pointer lock and fire projectile if appropriate
  onClick() {
    this.canvas.requestPointerLock();

    // Only shoot if game has started and is in progress
    if (
      this.gameState.isGameStarted &&
      !this.gameState.isGameOver &&
      document.pointerLockElement === this.canvas &&
      this.projectileManager
    ) {
      this.projectileManager.fireProjectile(this.gameState);
    }
  }

  // Handle pointer lock change
  onPointerlockChange() {
    if (document.pointerLockElement === this.canvas) {
      console.log('Pointer Lock active');
      document.addEventListener('mousemove', this.onMouseMove, false);
    } else {
      console.log('Pointer Lock inactive');
      document.removeEventListener('mousemove', this.onMouseMove, false);
    }
  }
  // Update player movement based on key states
  updateMovement(delta) {
    // Skip if game not started or is over
    if (!this.gameState.isGameStarted || this.gameState.isGameOver) {
      return;
    }

    // Gather input for spaceship drift physics
    const input = {
      left: !!this.keyStates['KeyA'],
      right: !!this.keyStates['KeyD'],
      up: !!this.keyStates['Space'],
      down: !!this.keyStates['ShiftLeft'] || !!this.keyStates['ControlLeft'],
      forward: !!this.keyStates['KeyW'],
      backward: !!this.keyStates['KeyS'],
    };

    // Pass input to spaceship for drift/inertia physics
    if (this.game && this.game.spaceship) {
      this.game.spaceship.update(delta, input);
      // Camera follows spaceship position
      this.camera.position.copy(this.game.spaceship.group.position);
    }

    // Roll left/right (still handled here)
    if (this.keyStates['KeyQ']) {
      this.camera.rotateZ(this.rotationSpeed);
    }
    if (this.keyStates['KeyE']) {
      this.camera.rotateZ(-this.rotationSpeed);
    }
  } // Provide feedback when player collides with an obstacle
  activateCollisionFeedback() {
    // Small screen shake for collision
    if (this.camera) {
      const shakeAnim = shakeCamera(this.camera, 0.3);
      if (this.game && this.game.activeAnimations) {
        this.game.activeAnimations.push(shakeAnim);
      }
    }

    // Visual feedback - slight flash
    const flashEffect = document.createElement('div');
    flashEffect.style.position = 'absolute';
    flashEffect.style.top = '0';
    flashEffect.style.left = '0';
    flashEffect.style.width = '100%';
    flashEffect.style.height = '100%';
    flashEffect.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
    flashEffect.style.pointerEvents = 'none';
    flashEffect.style.zIndex = '999';
    flashEffect.style.transition = 'opacity 0.2s ease-out';
    document.body.appendChild(flashEffect);

    // Fade out and remove
    setTimeout(() => {
      flashEffect.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(flashEffect);
      }, 200);
    }, 50);
  }

  // Cleanup resources
  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerlockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onClick);
    }
  }
}

export default InputManager;
