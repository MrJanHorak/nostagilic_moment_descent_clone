// Projectile system
import * as THREE from 'three';

class ProjectileManager {
  constructor(scene, camera, audioManager) {
    this.scene = scene;
    this.camera = camera;
    this.audioManager = audioManager;
    this.projectiles = [];

    this.projectileGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    this.projectileSpeed = 15; // Units per second
    this.canvas = null; // Will be set from outside
  }

  // Set the canvas reference for pointer lock checking
  setCanvas(canvas) {
    this.canvas = canvas;
  }
  // Enhanced projectile with trail
  createProjectileWithTrail(
    position,
    quaternion,
    color = 0x00ff00,
    power = 1,
    playerVelocity = null
  ) {
    // Main projectile - using MeshStandardMaterial which supports emissive properties
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.2,
    });

    const projectile = new THREE.Mesh(
      this.projectileGeometry,
      projectileMaterial
    );
    projectile.position.copy(position);
    projectile.quaternion.copy(quaternion);

    const velocity = new THREE.Vector3(0, 0, -this.projectileSpeed);
    velocity.applyQuaternion(quaternion);

    // Add player's velocity to projectile if provided
    if (playerVelocity) {
      velocity.add(playerVelocity * 8.5);
    }

    // Trail effect - create small points that follow the projectile's path
    const trailLength = 5;
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.PointsMaterial({
      color: color,
      size: 0.03,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.8,
    });

    const trailPositions = new Float32Array(trailLength * 3);
    trailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(trailPositions, 3)
    );

    const trail = new THREE.Points(trailGeometry, trailMaterial);
    this.scene.add(trail);

    // Projectile data
    const projectileData = {
      mesh: projectile,
      velocity: velocity,
      power: power,
      trail: trail,
      trailPositions: trailPositions,
      trailIndex: 0,
      lastTrailUpdate: 0,
    };

    this.projectiles.push(projectileData);
    this.scene.add(projectile);

    // Remove after some time
    setTimeout(() => {
      if (this.projectiles.indexOf(projectileData) !== -1) {
        this.scene.remove(projectile);
        this.scene.remove(trail);
        projectile.geometry.dispose();
        projectile.material.dispose();
        trail.geometry.dispose();
        trail.material.dispose();
        const index = this.projectiles.indexOf(projectileData);
        if (index > -1) {
          this.projectiles.splice(index, 1);
        }
      }
    }, 3000);

    return projectileData;
  }

  // Fire a projectile from the player's viewpoint
  fireProjectile(gameState) {
    if (
      !this.canvas ||
      document.pointerLockElement !== this.canvas ||
      gameState.isGameOver ||
      !gameState.isGameStarted
    )
      return;

    // Use weapon power from gameState
    const weaponPower = gameState.weaponPower || 1;

    // Default green projectile
    let projectileColor = 0x00ff00;

    // If weapon is upgraded, use a different color
    if (weaponPower > 1) {
      projectileColor = 0x00ffdd; // Brighter color for upgraded weapon
    }

    // Play weapon sound - different sound for upgraded weapons
    if (this.audioManager.initialized) {
      if (weaponPower > 1) {
        this.audioManager.playSound('shoot', { volume: 0.4, pitch: 1.2 });
      } else {
        this.audioManager.playSound('shoot', { volume: 0.3 });
      }
    }

    // Get world position and quaternion of the camera (spaceship's viewpoint)
    const startPosition = new THREE.Vector3();
    const startQuaternion = new THREE.Quaternion();
    this.camera.getWorldPosition(startPosition);
    this.camera.getWorldQuaternion(startQuaternion);

    // Offset slightly forward from the camera to avoid immediate collision with spaceship model
    const offset = new THREE.Vector3(0, 0, -2); // Adjust Z offset as needed
    offset.applyQuaternion(startQuaternion);
    startPosition.add(offset);

    // Calculate player's current velocity
    // This assumes the ship is moving with the camera
    const playerVelocity = new THREE.Vector3();
    if (gameState.speedMultiplier && gameState.playerVelocity) {
      // If velocity is tracked in gameState, use that
      playerVelocity.copy(gameState.playerVelocity);
    } else {
      // Otherwise approximate from speed multiplier
      const baseSpeed = 1.0;
      const currentSpeed = baseSpeed * (gameState.speedMultiplier || 1.0);
      // Assume forward velocity in camera's direction
      playerVelocity.set(0, 0, -currentSpeed);
      playerVelocity.applyQuaternion(startQuaternion);
    }

    this.createProjectileWithTrail(
      startPosition,
      startQuaternion,
      projectileColor,
      weaponPower
    );
  }

  // Update projectiles function with trails
  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Update position
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);

      // Update trail positions
      const currentTime = performance.now();
      if (currentTime - projectile.lastTrailUpdate > 50) {
        // Update trail every 50ms
        projectile.lastTrailUpdate = currentTime;

        // Update trail positions - shift positions back
        for (let j = projectile.trailPositions.length - 3; j >= 3; j -= 3) {
          projectile.trailPositions[j] = projectile.trailPositions[j - 3];
          projectile.trailPositions[j + 1] = projectile.trailPositions[j - 2];
          projectile.trailPositions[j + 2] = projectile.trailPositions[j - 1];
        }

        // Set the first position to the current projectile position
        projectile.trailPositions[0] = projectile.mesh.position.x;
        projectile.trailPositions[1] = projectile.mesh.position.y;
        projectile.trailPositions[2] = projectile.mesh.position.z;

        // Update buffer attribute
        projectile.trail.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  // Get the projectiles array
  getProjectiles() {
    return this.projectiles;
  }
}

export default ProjectileManager;
