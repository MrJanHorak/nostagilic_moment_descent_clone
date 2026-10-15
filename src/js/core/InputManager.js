// Input Manager for handling keyboard and mouse inputs
import * as THREE from 'three';
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
    this.onPointerlockError = this.onPointerlockError.bind(this);
    this.clearKeys = this.clearKeys.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  // Initialize with canvas
  init(canvas) {
    this.canvas = canvas;

    // Add event listeners
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerlockChange);
    document.addEventListener('pointerlockerror', this.onPointerlockError);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.addEventListener('click', this.onClick);

    return this;
  }

  // Mouse movement handler for camera rotation
  onMouseMove(event) {
    if (
      document.pointerLockElement !== this.canvas ||
      this.gameState.session.phase !== 'playing'
    ) {
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
    // Always set keyStates, even if pointer lock is not active
    this.keyStates[event.code] = true;

    // Handle escape key for pause menu
    if (
      event.code === 'Escape' &&
      !event.repeat &&
      this.gameState &&
      this.gameState.isGameStarted
    ) {
      // Toggle pause state
      if (this.uiManager) {
        this.game.togglePause();
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
    // Always unset keyStates, even if pointer lock is not active
    this.keyStates[event.code] = false;
  }

  // Handle click - request pointer lock and fire projectile if appropriate
  onClick() {
    if (this.gameState.session.phase !== 'playing') return;
    if (document.pointerLockElement !== this.canvas) {
      this.requestPointerLock();
      return;
    }

    // Only shoot if game has started and is in progress
    if (
      this.gameState.isGameStarted &&
      !this.gameState.isGameOver &&
      !this.gameState.isPaused &&
      document.pointerLockElement === this.canvas &&
      this.projectileManager
    ) {
      this.projectileManager.fireProjectile(this.gameState);
    }
  }

  requestPointerLock() {
    const generation = this.game?.session.id;
    if (document.pointerLockElement === this.canvas) return Promise.resolve(true);
    try {
      if (!this.canvas?.requestPointerLock) throw new Error('Pointer lock is unavailable');
      return Promise.resolve(this.canvas.requestPointerLock()).then(
        () => true,
        () => {
          if (generation === this.game?.session.id) this.onPointerlockError();
          return false;
        }
      );
    } catch {
      this.onPointerlockError();
      return Promise.resolve(false);
    }
  }

  onPointerlockError() {
    if (this.game && this.game.session.phase !== 'playing') return;
    if (performance.now() - (this.lastLockMessage ?? -Infinity) < 500) return;
    this.lastLockMessage = performance.now();
    this.uiManager?.showMessage('Click the game view to capture mouse controls.', 2500, '#ffcc66');
  }

  clearKeys() {
    this.keyStates = {};
  }

  // Handle pointer lock change
  onPointerlockChange() {
    if (document.pointerLockElement === this.canvas) {
      if (this.game && this.game.session.phase !== 'playing') {
        this.game.releasePointerLock();
        return;
      }
      this.wasPointerLocked = true;
      console.log('Pointer Lock active');
      document.addEventListener('mousemove', this.onMouseMove, false);
    } else {
      const wasLocked = this.wasPointerLocked;
      this.wasPointerLocked = false;
      this.clearKeys();
      console.log('Pointer Lock inactive');
      document.removeEventListener('mousemove', this.onMouseMove, false);
      if (wasLocked) this.game?.pauseGame();
    }
  }

  onBlur() {
    this.clearKeys();
    this.game?.pauseGame();
  }

  onVisibilityChange() { if (document.hidden) this.onBlur(); }
  // Update player movement based on key states
  updateMovement(delta) {
    // Skip if game not started or is over
    if (this.gameState.session.phase !== 'playing') {
      return;
    }

    // Gather input for spaceship drift physics
    const input = {
      left: !!this.keyStates['KeyA'] || !!this.keyStates['ArrowLeft'],
      right: !!this.keyStates['KeyD'] || !!this.keyStates['ArrowRight'],
      up: !!this.keyStates['Space'],
      down: !!this.keyStates['ShiftLeft'] || !!this.keyStates['ControlLeft'],
      forward: !!this.keyStates['KeyW'],
      backward: !!this.keyStates['KeyS'],
      pitchUp: !!this.keyStates['ArrowUp'],
      pitchDown: !!this.keyStates['ArrowDown'],
      rollLeft: !!this.keyStates['KeyQ'],
      rollRight: !!this.keyStates['KeyE'],
    };

    // Pass input to spaceship for drift/inertia physics
    if (this.game && this.game.spaceship) {
      this.game.spaceship.update(delta, input);
    }

    // Optionally, handle roll here if you want to rotate the ship visually
    // (e.g., this.game.spaceship.group.rotation.z += ...)
  } // Provide feedback when player collides with an obstacle
  activateCollisionFeedback() {
    if (this.gameState.session.phase !== 'playing') return;
    // Small screen shake for collision
    if (this.camera) {
      const shakeAnim = shakeCamera(this.camera, 0.3);
      if (this.game && this.game.activeAnimations) {
        this.game.activeAnimations.push(shakeAnim);
      }
    }

    this.uiManager?.flash('rgba(255, 255, 255, 0.15)');
  }

  // Cleanup resources
  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerlockChange);
    document.removeEventListener('pointerlockerror', this.onPointerlockError);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onClick);
    }
  }
}

export default InputManager;
