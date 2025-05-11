// Input Manager for handling keyboard and mouse inputs
import * as THREE from 'three';

class InputManager {
  constructor(camera, projectileManager, gameState) {
    this.camera = camera;
    this.projectileManager = projectileManager;
    this.gameState = gameState;

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
  }

  // Handle key down
  onKeyDown(event) {
    this.keyStates[event.code] = true;
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

    // Apply speed multiplier from game state
    const currentSpeed = this.moveSpeed * this.gameState.speedMultiplier;

    // Calculate movement direction in local space
    const direction = new THREE.Vector3();

    // Forward/backward
    if (this.keyStates['KeyW']) {
      direction.z -= 1;
    }
    if (this.keyStates['KeyS']) {
      direction.z += 1;
    }

    // Left/right
    if (this.keyStates['KeyA']) {
      direction.x -= 1;
    }
    if (this.keyStates['KeyD']) {
      direction.x += 1;
    }

    // Up/down
    if (this.keyStates['Space']) {
      direction.y += 1;
    }
    if (this.keyStates['ShiftLeft'] || this.keyStates['ControlLeft']) {
      direction.y -= 1;
    }

    // Roll left/right
    if (this.keyStates['KeyQ']) {
      this.camera.rotateZ(this.rotationSpeed);
    }
    if (this.keyStates['KeyE']) {
      this.camera.rotateZ(-this.rotationSpeed);
    }

    // Normalize direction vector for consistent speed in all directions
    if (direction.lengthSq() > 0) {
      direction.normalize();

      // Apply speed
      direction.multiplyScalar(currentSpeed);

      // Convert to world space
      const worldDirection = direction.clone();
      worldDirection.applyQuaternion(this.camera.quaternion);

      // Update camera position
      this.camera.position.add(worldDirection);
    }
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
