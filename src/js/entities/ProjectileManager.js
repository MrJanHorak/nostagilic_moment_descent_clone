// Projectile system
import * as THREE from 'three';

class ProjectileManager {
  constructor(scene, camera, audioManager) {
    this.scene = scene;
    this.camera = camera;
    this.audioManager = audioManager;
    this.projectiles = [];

    // Default projectile geometry
    this.projectileGeometry = new THREE.SphereGeometry(0.05, 8, 8);

    // Add specialized projectile geometries
    this.projectileGeometries = {
      standard: this.projectileGeometry,
      laser: new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8),
      plasma: new THREE.SphereGeometry(0.08, 12, 12),
      bomb: new THREE.DodecahedronGeometry(0.12, 0),
      missile: new THREE.ConeGeometry(0.08, 0.3, 8),
      heavylaser: new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8),
      nova: new THREE.OctahedronGeometry(0.15, 1),
    };

    // Rotate cylinder geometries to align with direction of travel
    this.projectileGeometries.laser.rotateX(Math.PI / 2);
    this.projectileGeometries.heavylaser.rotateX(Math.PI / 2);
    this.projectileGeometries.missile.rotateX(Math.PI);

    this.projectileSpeed = 15; // Units per second
    this.canvas = null; // Will be set from outside
  }

  // Set the canvas reference for pointer lock checking
  setCanvas(canvas) {
    this.canvas = canvas;
  }

  // Create different projectile types with unique behaviors
  createProjectile(position, quaternion, options = {}) {
    const {
      type = 'standard',
      color = 0x00ff00,
      power = 1,
      playerVelocity = null,
      speed = this.projectileSpeed,
      explosive = false,
      guided = false,
      gravity = 0,
      heatSeek = false,
      pulsate = false,
      unstable = false,
      penetrating = false,
      acceleration = 0,
      trailType = 'standard',
    } = options;

    // Select geometry based on type
    const geometry =
      this.projectileGeometries[type] || this.projectileGeometries.standard;

    // Create material based on projectile properties
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.2,
      transparent: pulsate || explosive,
      opacity: 0.9,
    });

    const projectile = new THREE.Mesh(geometry, projectileMaterial);
    projectile.position.copy(position);
    projectile.quaternion.copy(quaternion);

    // Calculate velocity vector
    const velocity = new THREE.Vector3(0, 0, -speed);
    velocity.applyQuaternion(quaternion);

    // Add player's velocity to projectile if provided
    if (playerVelocity) {
      velocity.add(playerVelocity.clone().multiplyScalar(0.85));
    }

    // For unstable projectiles, add some randomness
    if (unstable) {
      velocity.x += (Math.random() - 0.5) * 0.1;
      velocity.y += (Math.random() - 0.5) * 0.1;
      velocity.z += (Math.random() - 0.5) * 0.1;
    }

    // Add point light for visual enhancement
    const light = new THREE.PointLight(color, 0.7, 2);
    projectile.add(light);

    // Create projectile data object
    const projectileData = {
      mesh: projectile,
      velocity: velocity,
      power: power,
      type: type,
      explosive: explosive,
      guided: guided,
      gravity: gravity,
      heatSeek: heatSeek,
      pulsate: pulsate,
      unstable: unstable,
      penetrating: penetrating,
      acceleration: acceleration,
      createdAt: Date.now(),
      light: light,
    };

    // Add trail if requested
    if (trailType) {
      this.addTrailToProjectile(projectileData, color, trailType);
    }

    // Add pulsating effect for certain projectile types
    if (pulsate) {
      projectileData.pulseData = {
        originalScale: 1.0,
        pulseSpeed: 3.0 + Math.random() * 2.0,
        pulseAmount: 0.2,
        baseOpacity: 0.8,
        lastPulse: 0,
      };
    }

    this.projectiles.push(projectileData);
    this.scene.add(projectile);

    // Set auto-cleanup timeout
    const lifetime = type === 'missile' || type === 'bomb' ? 5000 : 3000;
    setTimeout(() => this.removeProjectile(projectileData), lifetime);

    return projectileData;
  }

  // Add different trail effects based on projectile type
  addTrailToProjectile(projectileData, color, trailType) {
    let trailLength, trailSize, trailOpacity, trailColor;

    // Configure trail based on type
    switch (trailType) {
      case 'missile':
        trailLength = 12;
        trailSize = 0.04;
        trailOpacity = 0.7;
        trailColor = 0xffaa00;
        break;

      case 'plasma':
        trailLength = 8;
        trailSize = 0.05;
        trailOpacity = 0.6;
        trailColor = color;
        break;

      case 'laser':
        trailLength = 6;
        trailSize = 0.03;
        trailOpacity = 0.5;
        trailColor = color;
        break;

      default:
        trailLength = 5;
        trailSize = 0.03;
        trailOpacity = 0.8;
        trailColor = color;
    }

    // Create trail geometry
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.PointsMaterial({
      color: trailColor,
      size: trailSize,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: trailOpacity,
    });

    const trailPositions = new Float32Array(trailLength * 3);
    trailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(trailPositions, 3)
    );

    const trail = new THREE.Points(trailGeometry, trailMaterial);
    this.scene.add(trail);

    // Add trail data to projectile
    projectileData.trail = trail;
    projectileData.trailPositions = trailPositions;
    projectileData.trailIndex = 0;
    projectileData.lastTrailUpdate = 0;
    projectileData.trailLength = trailLength;
  }

  // Enhanced projectile with trail (legacy method kept for compatibility)
  createProjectileWithTrail(
    position,
    quaternion,
    color = 0x00ff00,
    power = 1,
    playerVelocity = null
  ) {
    return this.createProjectile(position, quaternion, {
      type: 'standard',
      color: color,
      power: power,
      playerVelocity: playerVelocity,
      trailType: 'standard',
    });
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
    let projectileType = 'standard';

    // If weapon is upgraded, use different projectiles
    if (weaponPower > 2) {
      projectileColor = 0x00ffff; // Blue for highly upgraded weapon
      projectileType = 'plasma';
    } else if (weaponPower > 1) {
      projectileColor = 0x00ffdd; // Cyan for upgraded weapon
      projectileType = 'laser';
    }

    // Play weapon sound - different sound for upgraded weapons
    if (this.audioManager.initialized) {
      if (weaponPower > 2) {
        this.audioManager.playSound('shoot', { volume: 0.5, pitch: 1.4 });
      } else if (weaponPower > 1) {
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
    const playerVelocity = new THREE.Vector3();
    if (gameState.speedMultiplier && gameState.playerVelocity) {
      playerVelocity.copy(gameState.playerVelocity);
    }

    // Create projectile with appropriate options based on weapon power
    const options = {
      type: projectileType,
      color: projectileColor,
      power: weaponPower,
      playerVelocity: playerVelocity,
      speed: this.projectileSpeed + (weaponPower - 1) * 2, // Faster projectiles for upgraded weapons
      trailType: weaponPower > 1 ? projectileType : 'standard',
    };

    if (weaponPower > 2) {
      options.pulsate = true;
    }

    return this.createProjectile(startPosition, startQuaternion, options);
  }

  // Remove a projectile and clean up resources
  removeProjectile(projectileData) {
    const index = this.projectiles.indexOf(projectileData);
    if (index === -1) return;

    // Remove from scene
    this.scene.remove(projectileData.mesh);
    if (projectileData.trail) {
      this.scene.remove(projectileData.trail);
    }

    // Dispose geometries and materials
    projectileData.mesh.geometry.dispose();
    projectileData.mesh.material.dispose();

    if (projectileData.trail) {
      projectileData.trail.geometry.dispose();
      projectileData.trail.material.dispose();
    }

    // Remove from projectiles array
    this.projectiles.splice(index, 1);
  }

  // Update projectiles - now handling special behaviors like gravity, guided, etc.
  updateProjectiles(delta) {
    const currentTime = Date.now();

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Apply velocity
      projectile.mesh.position.add(
        projectile.velocity.clone().multiplyScalar(delta)
      );

      // Apply special behaviors

      // Gravity effect
      if (projectile.gravity) {
        projectile.velocity.y -= projectile.gravity * delta * 60;
      }

      // Acceleration effect
      if (projectile.acceleration) {
        const currentSpeed = projectile.velocity.length();
        projectile.velocity
          .normalize()
          .multiplyScalar(currentSpeed + projectile.acceleration * delta * 60);
      }

      // Heat-seeking behavior
      if (projectile.heatSeek) {
        // Target is always camera (player) in this implementation
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.camera.position, projectile.mesh.position)
          .normalize();

        // Limited turn rate
        const turnFactor = 0.015;
        projectile.velocity.lerp(
          direction.multiplyScalar(projectile.velocity.length()),
          turnFactor
        );
      }

      // Guided missile behavior
      else if (projectile.guided) {
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.camera.position, projectile.mesh.position)
          .normalize();

        // More aggressive turn rate than heat-seeking
        const turnFactor = 0.035;
        projectile.velocity.lerp(
          direction.multiplyScalar(projectile.velocity.length()),
          turnFactor
        );
      }

      // Unstable projectile wobbling
      if (projectile.unstable) {
        projectile.velocity.x += (Math.random() - 0.5) * 0.002;
        projectile.velocity.y += (Math.random() - 0.5) * 0.002;
        projectile.velocity.z += (Math.random() - 0.5) * 0.002;
      }

      // Make projectile face the direction it's moving
      projectile.mesh.lookAt(
        projectile.mesh.position.clone().add(projectile.velocity)
      );

      // Pulsating effect
      if (projectile.pulsate && projectile.pulseData) {
        const { pulseSpeed, pulseAmount, originalScale } = projectile.pulseData;
        const pulseFactor = Math.sin(
          (currentTime - projectile.createdAt) * 0.01 * pulseSpeed
        );
        const scale = originalScale + pulseFactor * pulseAmount;

        projectile.mesh.scale.set(scale, scale, scale);

        // Also pulse light intensity
        if (projectile.light) {
          projectile.light.intensity = 0.5 + pulseFactor * 0.5;
        }

        // Pulse opacity if transparent
        if (projectile.mesh.material.transparent) {
          projectile.mesh.material.opacity = 0.7 + pulseFactor * 0.3;
        }
      }

      // Update trail if exists
      if (projectile.trail && projectile.trailPositions) {
        // Only update trail every 20ms for performance
        if (currentTime - projectile.lastTrailUpdate > 20) {
          // Shift existing positions back
          for (let j = projectile.trailPositions.length - 3; j >= 3; j -= 3) {
            projectile.trailPositions[j] = projectile.trailPositions[j - 3];
            projectile.trailPositions[j + 1] = projectile.trailPositions[j - 2];
            projectile.trailPositions[j + 2] = projectile.trailPositions[j - 1];
          }

          // Add current position at the start
          projectile.trailPositions[0] = projectile.mesh.position.x;
          projectile.trailPositions[1] = projectile.mesh.position.y;
          projectile.trailPositions[2] = projectile.mesh.position.z;

          projectile.trail.geometry.attributes.position.needsUpdate = true;
          projectile.lastTrailUpdate = currentTime;
        }
      }

      // Check for lifetime expiration (safety)
      const lifetime =
        projectile.type === 'missile' || projectile.type === 'bomb'
          ? 5000
          : 3000;
      if (currentTime - projectile.createdAt > lifetime) {
        this.removeProjectile(projectile);
      }
    }
  }

  // Add getter method to expose projectiles array to other systems
  getProjectiles() {
    return this.projectiles;
  }
}

export default ProjectileManager;
