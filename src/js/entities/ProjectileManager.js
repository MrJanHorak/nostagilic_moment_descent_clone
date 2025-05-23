// Projectile system
import * as THREE from 'three';

class ProjectileManager {
  constructor(scene, camera, audioManager) {
    this.scene = scene;
    this.camera = camera;
    this.audioManager = audioManager;
    this.projectiles = [];
    this.enemyProjectiles = [];

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
        trailLength = 8; // Reduced from 12
        trailSize = 0.03; // Reduced from 0.04
        trailOpacity = 0.6; // Reduced from 0.7
        trailColor = 0xffaa00;
        break;

      case 'plasma':
        trailLength = 6; // Reduced from 8
        trailSize = 0.04; // Reduced from 0.05
        trailOpacity = 0.5; // Reduced from 0.6
        trailColor = color;
        break;

      case 'laser':
        trailLength = 4; // Reduced from 6
        trailSize = 0.02; // Reduced from 0.03
        trailOpacity = 0.4; // Reduced from 0.5
        trailColor = color;
        break;

      default: // 'standard' and others
        trailLength = 3; // Reduced from 5
        trailSize = 0.02; // Reduced from 0.03
        trailOpacity = 0.7; // Reduced from 0.8
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

    // Check if we have the weapon and ammo
    const currentWeapon = gameState.currentWeapon || 'pulse';
    const weaponInventory = gameState.weaponInventory || {
      pulse: { unlocked: true, ammo: Infinity },
    };

    if (!weaponInventory[currentWeapon]?.unlocked) {
      return;
    }

    // Check and consume ammo for non-infinite weapons
    if (
      weaponInventory[currentWeapon].ammo <= 0 &&
      weaponInventory[currentWeapon].ammo !== Infinity
    ) {
      // Out of ammo, play click sound and show message
      if (this.audioManager && this.audioManager.initialized) {
        this.audioManager.playSound('empty', { volume: 0.2 });
      }

      if (gameState.uiManager) {
        gameState.uiManager.showMessage('NO AMMO', 1500, '#ff6600');
      }

      // Fallback to pulse weapon
      gameState.currentWeapon = 'pulse';
      if (gameState.uiManager) {
        gameState.uiManager.updateWeaponUI();
      }
      return;
    }

    // Consume ammo if not infinite
    if (weaponInventory[currentWeapon].ammo !== Infinity) {
      weaponInventory[currentWeapon].ammo--;

      // Update UI if low on ammo
      if (weaponInventory[currentWeapon].ammo <= 5 && gameState.uiManager) {
        gameState.uiManager.updateWeaponUI();
      }
    }

    // Use weapon power from gameState
    const weaponPower = gameState.weaponPower || 1;

    // Configure weapon properties based on type
    let projectileColor, projectileType, projectileOptions;

    switch (currentWeapon) {
      case 'pulse':
        projectileColor = 0x00ff00;
        projectileType = 'standard';
        projectileOptions = {
          speed: this.projectileSpeed,
          power: 1 * weaponPower,
        };
        break;

      case 'laser':
        projectileColor = 0x00ffff;
        projectileType = 'laser';
        projectileOptions = {
          speed: this.projectileSpeed + 5, // Faster
          power: 1.5 * weaponPower,
          penetrating: true, // Can go through multiple enemies
        };
        break;

      case 'missile':
        projectileColor = 0xff8800;
        projectileType = 'missile';
        projectileOptions = {
          speed: this.projectileSpeed - 2, // Slower but more powerful
          power: 3 * weaponPower,
          explosive: true,
          explosionRadius: 1.5,
          unstable: true,
        };
        break;

      case 'plasma':
        projectileColor = 0xff00ff;
        projectileType = 'plasma';
        projectileOptions = {
          speed: this.projectileSpeed,
          power: 2 * weaponPower,
          pulsate: true,
          explosive: true,
          explosionRadius: 1.0,
        };
        break;
    }

    // Play appropriate weapon sound based on weapon type
    if (this.audioManager && this.audioManager.initialized) {
      switch (currentWeapon) {
        case 'pulse':
          this.audioManager.playSound('shoot', { volume: 0.3 });
          break;
        case 'laser':
          this.audioManager.playSound('shoot', { volume: 0.4, pitch: 1.2 });
          break;
        case 'missile':
          this.audioManager.playSound('shoot', { volume: 0.5, pitch: 0.8 });
          break;
        case 'plasma':
          this.audioManager.playSound('shoot', { volume: 0.4, pitch: 1.4 });
          break;
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
    if (gameState.playerVelocity) {
      playerVelocity.copy(gameState.playerVelocity);
    }

    // Create projectile with configured options
    const options = {
      type: projectileType,
      color: projectileColor,
      power: projectileOptions.power,
      playerVelocity: playerVelocity,
      speed: projectileOptions.speed,
      trailType: currentWeapon,
      explosive: projectileOptions.explosive || false,
      explosionRadius: projectileOptions.explosionRadius || 1.0,
      penetrating: projectileOptions.penetrating || false,
      pulsate: projectileOptions.pulsate || false,
      unstable: projectileOptions.unstable || false,
      guided: currentWeapon === 'missile' && weaponPower > 1,
    };

    return this.createProjectile(startPosition, startQuaternion, options);
  }

  // Enemy projectile shooting method
  fireEnemyProjectile(enemy, camera) {
    if (!enemy || !enemy.mesh) return;

    // Determine projectile type based on enemy type
    let projectileType;
    switch (enemy.type.name) {
      case 'fighter':
        projectileType = 'laser';
        break;
      case 'bomber':
        projectileType = 'bomb';
        break;
      case 'destroyer':
        projectileType = 'plasma';
        break;
      case 'boss':
        // Bosses have a chance to fire different projectile types
        const bossProjectiles = ['heavylaser', 'plasma', 'missile'];
        projectileType =
          bossProjectiles[Math.floor(Math.random() * bossProjectiles.length)];
        break;
      default:
        projectileType = 'standard';
    }

    if (!projectileType) return;

    // Create the projectile mesh
    let projectileGeometry;
    const projectileSize = enemy.type.size * 0.1;

    // Select geometry based on projectile type
    if (
      this.projectileGeometries &&
      this.projectileGeometries[projectileType]
    ) {
      projectileGeometry = this.projectileGeometries[projectileType];
    } else {
      // Fallback to basic sphere if specialized geometry not available
      projectileGeometry = new THREE.SphereGeometry(projectileSize, 8, 8);
    }

    // Create material with appropriate color
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.2,
    });

    const projectileMesh = new THREE.Mesh(
      projectileGeometry,
      projectileMaterial
    );

    // Position the projectile in front of the enemy
    const enemyForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      enemy.mesh.quaternion
    );
    const projectilePos = enemy.mesh.position
      .clone()
      .add(enemyForward.multiplyScalar(enemy.type.size * 1.5));
    projectileMesh.position.copy(projectilePos);

    // Calculate direction to player
    const direction = new THREE.Vector3();
    direction.subVectors(camera.position, projectileMesh.position).normalize();

    // Add a slight inaccuracy to make it more fair
    const inaccuracy = 0.05;
    direction.x += (Math.random() * 2 - 1) * inaccuracy;
    direction.y += (Math.random() * 2 - 1) * inaccuracy;
    direction.z += (Math.random() * 2 - 1) * inaccuracy;
    direction.normalize();

    // Scale by projectile speed
    const velocity = direction.multiplyScalar(10);

    // Create the projectile object
    const projectile = {
      mesh: projectileMesh,
      velocity: velocity,
      type: projectileType,
      power: 10,
      life: 3000,
      timestamp: Date.now(),
    };

    // Add to scene and projectiles array
    this.scene.add(projectileMesh);
    this.enemyProjectiles.push(projectile);

    return projectile;
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
  updateProjectiles(delta, camera, gameState, effectsManager) {
    const currentTime = Date.now();

    // Process player projectiles
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
        if (currentTime - projectile.lastTrailUpdate > 30) {
          // Increased from 20ms
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

    // Process enemy projectiles
    if (this.enemyProjectiles && this.enemyProjectiles.length > 0) {
      for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        const projectile = this.enemyProjectiles[i];

        // Skip invalid projectiles
        if (!projectile || !projectile.mesh) {
          this.enemyProjectiles.splice(i, 1);
          continue;
        }

        // Check lifetime
        if (currentTime - projectile.timestamp > projectile.life) {
          this.removeEnemyProjectile(i);
          continue;
        }

        // Apply velocity with delta time
        projectile.mesh.position.addScaledVector(projectile.velocity, delta);

        // Update trail if present
        if (projectile.trail && projectile.trailPositions) {
          if (currentTime - projectile.lastTrailUpdate > 40) {
            // Increased from 30ms
            // Update trail every 30ms
            projectile.lastTrailUpdate = currentTime;

            // Shift positions back
            for (let j = projectile.trailPositions.length - 3; j >= 3; j -= 3) {
              projectile.trailPositions[j] = projectile.trailPositions[j - 3];
              projectile.trailPositions[j + 1] =
                projectile.trailPositions[j - 2];
              projectile.trailPositions[j + 2] =
                projectile.trailPositions[j - 1];
            }

            // Set first position to current projectile position
            projectile.trailPositions[0] = projectile.mesh.position.x;
            projectile.trailPositions[1] = projectile.mesh.position.y;
            projectile.trailPositions[2] = projectile.mesh.position.z;

            // Update the buffer attribute
            projectile.trail.geometry.attributes.position.needsUpdate = true;
          }
        }

        // Check for collision with player
        if (camera) {
          const distanceToPlayer = projectile.mesh.position.distanceTo(
            camera.position
          );
          const collisionThreshold = 0.5; // Adjust based on player size

          if (
            gameState &&
            !gameState.isGameOver &&
            distanceToPlayer < collisionThreshold
          ) {
            // Player takes damage
            gameState.takeDamage(projectile.power || 10);

            // Create explosion effect if we have an effects manager
            if (effectsManager) {
              effectsManager.createExplosion(
                projectile.mesh.position.clone(),
                0xff0000,
                true,
                1.0
              );
            }

            // Remove projectile
            this.removeEnemyProjectile(i);
          }
          // Remove if too far from player (optimization)
          else if (distanceToPlayer > 50) {
            this.removeEnemyProjectile(i);
          }
        }
      }
    }
  }

  // Helper method to remove enemy projectiles
  removeEnemyProjectile(index) {
    if (
      !this.enemyProjectiles ||
      index < 0 ||
      index >= this.enemyProjectiles.length
    )
      return;

    const projectile = this.enemyProjectiles[index];
    if (!projectile) return;

    // Remove mesh from scene
    if (projectile.mesh && projectile.mesh.parent) {
      projectile.mesh.parent.remove(projectile.mesh);
    }

    // Remove trail if it exists
    if (projectile.trail && projectile.trail.parent) {
      projectile.trail.parent.remove(projectile.trail);
    }

    // Dispose resources
    if (projectile.mesh) {
      if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
      if (projectile.mesh.material) projectile.mesh.material.dispose();
    }

    if (projectile.trail) {
      if (projectile.trail.geometry) projectile.trail.geometry.dispose();
      if (projectile.trail.material) projectile.trail.material.dispose();
    }

    // Remove from array
    this.enemyProjectiles.splice(index, 1);
  }

  // Clean up all enemy projectiles
  clearEnemyProjectiles() {
    if (this.enemyProjectiles) {
      for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        this.removeEnemyProjectile(i);
      }
      this.enemyProjectiles = [];
    }
  }

  // Add getter method to expose projectiles array to other systems
  getProjectiles() {
    return this.projectiles;
  }

  // Move all projectiles by offset (Vector3)
  offsetProjectiles(offset) {
    for (const proj of this.projectiles) {
      if (proj && proj.mesh && proj.mesh.position) {
        proj.mesh.position.add(offset);
      }
    }
  }
}

export default ProjectileManager;
