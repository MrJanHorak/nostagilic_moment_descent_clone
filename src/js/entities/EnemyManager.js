// Enemy entity module
import * as THREE from 'three';
import { createExplosionEffect } from '../utils/effectsUtils.js';
import { checkProjectileEnemyCollision } from '../utils/collisionUtils.js';

// Enemy type definitions
export const enemyTypes = [
  {
    name: 'scout',
    color: 0xff0000,
    size: 0.4,
    health: 10,
    speed: 0.05,
    damage: 5,
    pointValue: 50,
  },
  {
    name: 'fighter',
    color: 0xff6600,
    size: 0.6,
    health: 25,
    speed: 0.03,
    damage: 10,
    pointValue: 100,
  },
];

class EnemyManager {
  constructor(scene, camera, gameState, audioManager, levelManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.levelManager = levelManager;
    this.enemies = [];
    this.levelSegments = [];

    // Track permanently destroyed predefined enemies
    this.destroyedPredefinedEnemies = new Set();

    // Track total enemies for win condition
    this.totalPredefinedEnemies = 0;

    // For endless mode
    this.lastRandomSpawnTime = 0;
    this.randomSpawnInterval = 5000; // 5 seconds between spawns in endless mode
  }

  setLevelSegments(segments) {
    this.levelSegments = segments;
  }

  // Create enemy mesh
  createEnemyMesh(enemyType) {
    const body = new THREE.Group();
    body.name = `${enemyType.name}_enemy`;

    // Add debug property to track object creation
    body.userData.creationInfo = {
      createdAt: new Date().toISOString(),
      creator: 'createEnemyMesh',
      enemyType: enemyType.name,
    };

    // Use different geometry based on enemy type
    if (enemyType.name === 'scout') {
      this.createScoutMesh(body, enemyType);
    } else {
      this.createFighterMesh(body, enemyType);
    }

    return body;
  }

  createScoutMesh(body, enemyType) {
    // ========== SCOUT SHIP MESH ==========
    // The Scout is a fast, small enemy ship with a sharp triangular design.
    // This function constructs and adds the 3D mesh components to the given 'body' Object3D.
    // It consists of a triangular main body, thin wings, and glowing front-facing eyes.

    // ==========================
    //        MAIN BODY
    // ==========================

    // Create a triangular prism using a cylinder with 3 radial segments (triangular cross-section)
    const bodyGeometry = new THREE.CylinderGeometry(
      enemyType.size, // Top radius (will face FORWARD toward the player due to rotation)
      0, // Bottom radius (sharp point at the back)
      enemyType.size * 1.5, // Height/length of the scout's body
      3 // Segments to form a triangular cross-section
    );

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color, // Primary color from the enemy type
      roughness: 0.6, // Moderate matte surface
      metalness: 0.2, // Slight metallic sheen
      emissive: enemyType.color, // Emits same color as body
      emissiveIntensity: 0.2, // Low subtle glow effect
    });

    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'scout_body';

    // Rotate the prism so the flat face points toward the player and the sharp point trails behind
    bodyMesh.rotation.x = -Math.PI / 2; // -90° around X axis
    body.add(bodyMesh);

    // ==========================
    //         WINGS
    // ==========================

    // Small box-shaped wings, wide but very thin
    const wingGeometry = new THREE.BoxGeometry(
      enemyType.size * 2.5, // Width (extends far out from center)
      enemyType.size * 0.1, // Height (very thin)
      enemyType.size * 0.5 // Depth (front-to-back)
    );

    const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
    wingMesh.name = 'scout_wings';

    // Position the wings near the middle-bottom of the body
    wingMesh.position.set(
      0, // Centered on X
      0, // Centered on Y
      -0.1 // Slightly offset backwards (Z-axis)
    );
    body.add(wingMesh);

    // ==========================
    //       GLOWING EYES
    // ==========================

    // Bright glowing eyes help the player visually track the scout
    const eyeMaterial = new THREE.MeshStandardMaterial({
      // CHANGED FROM MeshBasicMaterial
      color: 0xffff00, // Bright yellow
      emissive: 0xffff00, // Same yellow glow
      emissiveIntensity: 1.0, // Full intensity for high visibility
    });

    const eyeGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.15, // Radius (15% of scout's size)
      8, // Width segments (low poly is fine)
      8 // Height segments
    );

    // ---- LEFT EYE ----
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.name = 'scout_eye_left';

    // Positioning relative to the flat (front) side of the ship
    leftEye.position.set(
      -enemyType.size * 0.18, // Left of center
      enemyType.size * 0.2, // Slightly raised
      enemyType.size * 0.1 // Forward on the Z-axis (points to player)
    );
    body.add(leftEye);

    // Add a glowing yellow point light inside the eye
    const leftEyeLight = new THREE.PointLight(
      0xffff00, // Yellow
      2.0, // Brightness
      enemyType.size * 2.0 // Range of influence
    );
    leftEyeLight.position.copy(leftEye.position);
    body.add(leftEyeLight);

    // ---- RIGHT EYE ----
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.name = 'scout_eye_right';

    rightEye.position.set(
      enemyType.size * 0.18, // Right of center
      enemyType.size * 0.2, // Slightly raised
      enemyType.size * 0.1 // Forward on Z-axis
    );
    body.add(rightEye);

    const rightEyeLight = new THREE.PointLight(
      0xffff00, // Yellow
      2.0, // Brightness
      enemyType.size * 2.0 // Range
    );
    rightEyeLight.position.copy(rightEye.position);
    body.add(rightEyeLight);
  }

  createFighterMesh(body, enemyType) {
    // ===== MAIN BODY =====
    const bodyGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.9,
      enemyType.size * 0.5,
      enemyType.size * 2,
      6
    );

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color,
      roughness: 0.2,
      metalness: 0.8,
      emissive: enemyType.color,
      emissiveIntensity: 0.4,
    });

    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'fighter_body';
    bodyMesh.rotation.x = -Math.PI / 2;
    body.add(bodyMesh);

    // ===== FRONT WEAPON =====
    const weaponGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.1,
      enemyType.size * 0.15,
      enemyType.size * 0.9,
      12
    );

    const weaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.1,
      metalness: 1.0,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
    });

    const weaponMesh = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weaponMesh.name = 'fighter_weapon';
    weaponMesh.rotation.x = Math.PI / 2;
    weaponMesh.position.set(0, 0, enemyType.size * 1.2);
    body.add(weaponMesh);

    // ===== ENGINE GLOW =====
    const engineGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.3,
      16,
      16
    );

    // MeshBasicMaterial doesn't need or support emissive
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
    });

    const engineMesh = new THREE.Mesh(engineGeometry, engineMaterial);
    engineMesh.name = 'fighter_engine';
    engineMesh.position.set(0, 0, -enemyType.size);
    body.add(engineMesh);

    const engineLight = new THREE.PointLight(0xff5500, 1.5, enemyType.size * 4);
    engineLight.position.copy(engineMesh.position);
    body.add(engineLight);

    // ENGINE TRAILS section
    for (let i = -1; i <= 1; i += 2) {
      const trailGeometry = new THREE.CylinderGeometry(
        0.05,
        0.1,
        enemyType.size * 1.2,
        8
      );

      const trailMaterial = new THREE.MeshStandardMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.3,
      });

      const trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
      trailMesh.position.set(
        i * enemyType.size * 0.3,
        0,
        -enemyType.size * 1.6
      );
      trailMesh.rotation.x = Math.PI / 2;
      body.add(trailMesh);
    }

    // ===== LAYERED WINGS =====
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0x111111,
      emissiveIntensity: 0.3,
    });

    const wingGeometry = new THREE.BoxGeometry(
      enemyType.size * 2.2,
      enemyType.size * 0.15,
      enemyType.size * 0.6
    );

    // Make sure wings are properly created
    for (let i = 0; i < 2; i++) {
      const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
      wingMesh.name = `fighter_wing_${i}`;
      wingMesh.position.set(
        0,
        i * enemyType.size * 0.12 - enemyType.size * 0.06,
        0
      );
      body.add(wingMesh);
    }

    // ===== ANTENNAS WITH LIGHT TIPS =====
    const antennaHeight = enemyType.size * 0.6;
    const antennaGeometry = new THREE.CylinderGeometry(
      0.02,
      0.02,
      antennaHeight,
      8
    );

    const antennaMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      emissive: 0x333333,
      emissiveIntensity: 0.5,
    });

    const antennaOffset = enemyType.size * 0.4;

    // Ensure antenna loop is complete
    for (let side of [-1, 1]) {
      const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
      antenna.name = `fighter_antenna_${side > 0 ? 'right' : 'left'}`;
      antenna.position.set(
        side * antennaOffset,
        enemyType.size * 0.5,
        enemyType.size * 0.3
      );
      antenna.rotation.z = (side * Math.PI) / 20;
      body.add(antenna);

      const tipLight = new THREE.PointLight(
        0xff0000,
        0.6,
        enemyType.size * 1.5
      );
      tipLight.name = `fighter_antenna_light_${side > 0 ? 'right' : 'left'}`;
      tipLight.position.set(
        antenna.position.x,
        antenna.position.y + antennaHeight / 2,
        antenna.position.z
      );
      body.add(tipLight);
    }
  }

  // Spawn enemy at a position
  spawnEnemy(position, typeName = null) {
    // If no specific type requested, choose randomly
    const enemyType = typeName
      ? enemyTypes.find((t) => t.name === typeName)
      : enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

    const enemyMesh = this.createEnemyMesh(enemyType);
    enemyMesh.position.copy(position);

    // Look at player initially
    const lookAtPosition = this.camera.position.clone();
    enemyMesh.lookAt(lookAtPosition);

    // Store enemy data
    const enemy = {
      mesh: enemyMesh,
      type: enemyType,
      health: enemyType.health,
      collider: new THREE.Box3(),
      velocity: new THREE.Vector3(),
      isActive: true,
      lastFireTime: 0,
      fireRate: 2000, // milliseconds between shots
    };

    // Update the enemy collider
    enemy.collider.setFromObject(enemyMesh);

    this.enemies.push(enemy);
    this.scene.add(enemyMesh);

    // Add emissive glow to make enemies more visible
    enemy.mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        // Make enemy materials emissive with higher intensity for visibility
        child.material.emissive = new THREE.Color(enemyType.color);
        child.material.emissiveIntensity = 0.8;
      }
    });

    // Add a point light attached to enemy for better visibility
    const enemyLight = new THREE.PointLight(enemyType.color, 0.6, 5);
    enemyLight.position.set(0, 0, 0);
    enemy.mesh.add(enemyLight);

    return enemy;
  }

  // Spawn enemies in the tunnel segments
  spawnEnemiesInTunnel(segmentLength) {
    // Only consider segments beyond the first one to avoid enemies too close to player start
    const validSegments = this.levelSegments.slice(1);

    // Choose a random segment
    if (validSegments.length === 0) return;

    // Choose a random segment closer to the player (between 20-60% of the way through the tunnel)
    const segmentIndex =
      Math.floor(validSegments.length * 0.2) +
      Math.floor(Math.random() * (validSegments.length * 0.4));

    if (!validSegments[segmentIndex]) return;

    const segment = validSegments[segmentIndex];

    // Calculate a position somewhere in the segment
    const segmentPosition = segment.position.clone();

    // Get segment dimensions from children (assuming first child is floor)
    let segmentWidth = 10;
    let segmentHeight = 10;

    if (segment.children.length >= 4) {
      // For simplicity assume the order: floor, ceiling, leftWall, rightWall
      const floor = segment.children.find(
        (child) =>
          child.position.y < 0 &&
          child.geometry &&
          child.geometry.type === 'PlaneGeometry'
      );
      const ceiling = segment.children.find(
        (child) =>
          child.position.y > 0 &&
          child.geometry &&
          child.geometry.type === 'PlaneGeometry'
      );

      if (floor && floor.geometry.parameters) {
        segmentWidth = floor.geometry.parameters.width * 0.8; // 80% of width to stay away from walls
      }

      if (floor && ceiling) {
        segmentHeight = Math.abs(ceiling.position.y - floor.position.y) * 0.8; // 80% of height to stay away from floor/ceiling
      }
    }

    // Random position within segment bounds - placed in middle of tunnel for visibility
    const x = (Math.random() - 0.5) * segmentWidth * 0.6;
    const y = (Math.random() - 0.5) * segmentHeight * 0.6;
    const z = -segmentLength * (Math.random() * 0.7 + 0.15); // Position between 15% and 85% through segment

    const spawnPosition = new THREE.Vector3(x, y, z).applyMatrix4(
      segment.matrixWorld
    );

    // Create a visual debug marker for the spawn point
    const debugSpawn = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff00ff })
    );
    debugSpawn.position.copy(spawnPosition);
    this.scene.add(debugSpawn);

    // Remove debug marker after 5 seconds
    setTimeout(() => {
      this.scene.remove(debugSpawn);
      debugSpawn.geometry.dispose();
      debugSpawn.material.dispose();
    }, 5000);

    const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    return this.spawnEnemy(spawnPosition, enemyType.name);
  }

  // Spawn predefined enemies from level blueprint
  spawnPredefinedEnemies() {
    if (!this.levelManager || !this.levelManager.currentLevel) return;

    const level = this.levelManager.currentLevel;

    // Set total enemies count once (first time we load the level)
    if (this.totalPredefinedEnemies === 0 && level.enemySpawns) {
      this.totalPredefinedEnemies = level.enemySpawns.length;
      // Update UI with enemy count
      if (this.gameState && this.gameState.uiManager) {
        this.gameState.uiManager.updateEnemyCount(
          this.destroyedPredefinedEnemies.size,
          this.totalPredefinedEnemies
        );
      }
    }

    for (const spawnPoint of level.enemySpawns) {
      // Generate a unique ID for this spawn point
      const spawnPointId = `${spawnPoint.position.x}_${spawnPoint.position.y}_${spawnPoint.position.z}`;

      // Skip if this enemy was permanently destroyed
      if (this.destroyedPredefinedEnemies.has(spawnPointId)) {
        continue;
      }

      // Check if enemy should be visible now (based on player position)
      const distanceToPlayer = spawnPoint.position.distanceTo(
        this.camera.position
      );

      // Only spawn if within reasonable distance and not already spawned
      if (distanceToPlayer < 50 && distanceToPlayer > 5) {
        // Check if this enemy is already spawned
        const alreadySpawned = this.enemies.some((enemy) => {
          return enemy.mesh.userData.spawnPointId === spawnPointId;
        });

        if (!alreadySpawned) {
          // Use the proper spawnEnemy method to create fully initialized enemy
          const enemy = this.spawnEnemy(
            spawnPoint.position,
            spawnPoint.enemyType
          );

          if (enemy && enemy.mesh) {
            // Mark it as a predefined spawn
            enemy.mesh.userData.isPredefined = true;
            enemy.mesh.userData.spawnPointId = spawnPointId;
            enemy.mesh.userData.spawnPosition = spawnPoint.position.clone();
          }
        }
      }
    }

    // Check win condition - all predefined enemies destroyed
    this.checkLevelCompletion();
  }

  // Check if all enemies in the level are destroyed
  checkLevelCompletion() {
    if (
      this.levelManager &&
      this.levelManager.currentLevel &&
      this.destroyedPredefinedEnemies.size >= this.totalPredefinedEnemies &&
      this.totalPredefinedEnemies > 0
    ) {
      // All enemies destroyed - level complete!
      console.log('Level completed! All enemies destroyed.');

      // Notify game state that level is complete
      if (this.gameState && this.gameState.levelCompleted) {
        this.gameState.levelCompleted();
      }
    }
  }

  // Add method to handle enemy spawning for endless mode
  updateEndlessMode(currentTime) {
    // Check if it's time to spawn a new enemy
    if (currentTime - this.lastRandomSpawnTime > this.randomSpawnInterval) {
      this.spawnEnemiesInTunnel(20); // Use a default segment length
      this.lastRandomSpawnTime = currentTime;

      // Gradually decrease spawn interval for increasing difficulty
      // Minimum 1 second between spawns
      this.randomSpawnInterval = Math.max(1000, this.randomSpawnInterval - 50);
    }
  }

  // Reset enemies for new level
  resetLevel() {
    // Clear tracking of destroyed enemies
    this.destroyedPredefinedEnemies.clear();
    this.totalPredefinedEnemies = 0;

    // Remove all existing enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      this.scene.remove(enemy.mesh);

      // Clean up resources
      enemy.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    this.enemies = [];

    // Reset endless mode timers
    this.lastRandomSpawnTime = 0;
    this.randomSpawnInterval = 5000;
  }
  // Enemy update function
  updateEnemies(delta, projectiles) {
    // Check if level has predefined enemies or if we should use endless mode
    const currentTime = Date.now();
    if (this.levelManager && this.levelManager.isEndless) {
      this.updateEndlessMode(currentTime);
    } else {
      this.spawnPredefinedEnemies();
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isActive) continue;

      // Update enemy position
      const distanceToPlayer = enemy.mesh.position.distanceTo(
        this.camera.position
      );

      // Simple AI: if player is within certain distance, move toward player
      if (distanceToPlayer < 30) {
        // Get direction to player
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.camera.position, enemy.mesh.position)
          .normalize();

        // Apply some randomness to movement
        direction.x += (Math.random() - 0.5) * 0.2;
        direction.y += (Math.random() - 0.5) * 0.2;
        direction.z += (Math.random() - 0.5) * 0.2;

        // Update velocity with smoothing
        enemy.velocity.lerp(direction.multiplyScalar(enemy.type.speed), 0.05);

        // Apply velocity
        enemy.mesh.position.add(enemy.velocity);

        // Make enemy face the player
        enemy.mesh.lookAt(this.camera.position);
      }

      // Update enemy collider
      enemy.mesh.updateMatrixWorld(true);
      enemy.collider.setFromObject(enemy.mesh);

      // Check collision with player
      const collisionDistance = enemy.type.size * 2;
      if (!this.gameState.isGameOver && distanceToPlayer < collisionDistance) {
        // Player takes damage
        this.gameState.takeDamage(enemy.type.damage);

        // Destroy the enemy
        this.destroyEnemy(i);
        continue;
      }

      // Check distance - if enemy is too far behind player, remove it
      if (distanceToPlayer > 50) {
        this.scene.remove(enemy.mesh);
        this.enemies.splice(i, 1);
        continue;
      } // Check projectile collision
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const projectile = projectiles[j];

        if (checkProjectileEnemyCollision(projectile, enemy)) {
          // Enemy takes damage
          enemy.health -= projectile.power;

          // Visual hit feedback
          this.createHitEffect(projectile.mesh.position.clone());

          // Play hit sound
          if (this.audioManager && this.audioManager.initialized) {
            try {
              this.audioManager.playSound('hit', {
                volume: Math.min(0.7, 10 / Math.max(1, distanceToPlayer)),
                fallback: 'explosion', // Try playing explosion sound if hit is not available
              });
            } catch (e) {
              console.warn('Error playing hit sound:', e);
            }
          }

          // Remove projectile
          if (projectile.mesh.parent) {
            projectile.mesh.parent.remove(projectile.mesh);
          }
          if (projectile.trail.parent) {
            projectile.trail.parent.remove(projectile.trail);
          }

          if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
          if (projectile.mesh.material) projectile.mesh.material.dispose();
          if (projectile.trail.geometry) projectile.trail.geometry.dispose();
          if (projectile.trail.material) projectile.trail.material.dispose();

          // Clear references
          projectile.mesh.geometry = null;
          projectile.mesh.material = null;
          projectile.trail.geometry = null;
          projectile.trail.material = null;

          projectiles.splice(j, 1);

          // Check if enemy is destroyed
          if (enemy.health <= 0) {
            // Add score
            this.gameState.score += enemy.type.pointValue;

            // Destroy the enemy
            this.destroyEnemy(i);
            break;
          }
        }
      }
    }
  }

  // Create a visual effect when a projectile hits an enemy
  createHitEffect(position) {
    // Create a small flash at hit position
    const flash = new THREE.PointLight(0xffff00, 2, 5);
    flash.position.copy(position);
    this.scene.add(flash);

    // Remove after a short time
    setTimeout(() => {
      if (flash.parent) {
        flash.parent.remove(flash); // Use parent.remove instead of scene.remove
      }
    }, 100);

    // Add small particles
    const particleCount = 10;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Random position within small radius
      positions[i] = position.x + (Math.random() - 0.5) * 0.3;
      positions[i + 1] = position.y + (Math.random() - 0.5) * 0.3;
      positions[i + 2] = position.z + (Math.random() - 0.5) * 0.3;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particles, material);
    this.scene.add(particleSystem);

    // Remove particles after a short time
    setTimeout(() => {
      if (particleSystem.parent) {
        particleSystem.parent.remove(particleSystem);

        // Make sure to dispose of the buffer attributes too
        if (particles.attributes.position) {
          particles.attributes.position.array = null;
        }
        particles.dispose();
        material.dispose();

        // Clear references
        particleSystem.geometry = null;
        particleSystem.material = null;
      }
    }, 300);
  }

  destroyEnemy(index) {
    const enemy = this.enemies[index];

    // Check if this is a predefined enemy and mark as permanently destroyed
    if (enemy.mesh.userData.isPredefined && enemy.mesh.userData.spawnPointId) {
      this.destroyedPredefinedEnemies.add(enemy.mesh.userData.spawnPointId);

      // Update the UI with new count
      if (this.gameState && this.gameState.uiManager) {
        this.gameState.uiManager.updateEnemyCount(
          this.destroyedPredefinedEnemies.size,
          this.totalPredefinedEnemies
        );
      }

      // Check if level is complete
      this.checkLevelCompletion();
    }

    // First, let's make sure lights are removed first
    const lightsToRemove = [];
    enemy.mesh.traverse((child) => {
      if (child.isLight) {
        lightsToRemove.push(child);
      }
    });

    // Remove lights separately to avoid modification during traversal
    for (const light of lightsToRemove) {
      if (light.parent) {
        light.parent.remove(light);
      }
    }

    // Create explosion particle effect (do this before removing from scene)
    createExplosionEffect(this.scene, enemy.mesh.position.clone());

    // Remove the entire enemy mesh from scene
    this.scene.remove(enemy.mesh);

    // Play explosion sound
    if (this.audioManager && this.audioManager.initialized) {
      // Calculate volume based on distance to player
      const distanceToPlayer = enemy.mesh.position.distanceTo(
        this.camera.position
      );
      const volume = Math.min(0.8, 10 / Math.max(1, distanceToPlayer));
      this.audioManager.playSound('explosion', { volume });
    }

    // Properly dispose of all resources
    const disposeMaterial = (material) => {
      if (!material) return;

      // Dispose textures
      const propertiesToCheck = [
        'map',
        'lightMap',
        'bumpMap',
        'normalMap',
        'specularMap',
        'envMap',
        'emissiveMap',
        'roughnessMap',
        'metalnessMap',
        'alphaMap',
      ];

      propertiesToCheck.forEach((prop) => {
        if (material[prop]) {
          material[prop].dispose();
        }
      });

      material.dispose();
    };

    // Clean up resources with enhanced disposal
    enemy.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(child.material);
        }

        // Remove material reference from the child
        child.material = undefined;
      }
    });

    // Remove reference from array
    this.enemies.splice(index, 1);
  }

  // destroyEnemy(index) {
  //   const enemy = this.enemies[index];

  //   // Check if this is a predefined enemy and mark as permanently destroyed
  //   if (enemy.mesh.userData.isPredefined && enemy.mesh.userData.spawnPointId) {
  //     this.destroyedPredefinedEnemies.add(enemy.mesh.userData.spawnPointId);

  //     // Update the UI with new count
  //     if (this.gameState && this.gameState.uiManager) {
  //       this.gameState.uiManager.updateEnemyCount(
  //         this.destroyedPredefinedEnemies.size,
  //         this.totalPredefinedEnemies
  //       );
  //     }

  //     // Check if level is complete
  //     this.checkLevelCompletion();
  //   }

  //   // First remove all lights that might be part of the enemy mesh
  //   enemy.mesh.traverse((child) => {
  //     if (child.isLight) {
  //       enemy.mesh.remove(child);
  //     }
  //   });

  //   // Create explosion particle effect (do this before removing from scene)
  //   createExplosionEffect(this.scene, enemy.mesh.position.clone());

  //   // Remove the entire enemy mesh from scene
  //   this.scene.remove(enemy.mesh);

  //   // Play explosion sound
  //   if (this.audioManager && this.audioManager.initialized) {
  //     // Calculate volume based on distance to player
  //     const distanceToPlayer = enemy.mesh.position.distanceTo(
  //       this.camera.position
  //     );
  //     const volume = Math.min(0.8, 10 / Math.max(1, distanceToPlayer));
  //     this.audioManager.playSound('explosion', { volume });
  //   }

  //   // Dispose of geometries and materials
  //   enemy.mesh.traverse((child) => {
  //     if (child.geometry) {
  //       child.geometry.dispose();
  //     }

  //     // Handle material disposal with explicit checks
  //     if (child.material) {
  //       if (Array.isArray(child.material)) {
  //         child.material.forEach((mat) => {
  //           if (mat.map) mat.map.dispose();
  //           if (mat.lightMap) mat.lightMap.dispose();
  //           if (mat.bumpMap) mat.bumpMap.dispose();
  //           if (mat.normalMap) mat.normalMap.dispose();
  //           if (mat.specularMap) mat.specularMap.dispose();
  //           if (mat.envMap) mat.envMap.dispose();
  //           mat.dispose();
  //         });
  //       } else {
  //         if (child.material.map) child.material.map.dispose();
  //         if (child.material.lightMap) child.material.lightMap.dispose();
  //         if (child.material.bumpMap) child.material.bumpMap.dispose();
  //         if (child.material.normalMap) child.material.normalMap.dispose();
  //         if (child.material.specularMap) child.material.specularMap.dispose();
  //         if (child.material.envMap) child.material.envMap.dispose();
  //         child.material.dispose();
  //       }
  //     }
  //   });

  //   // Remove reference from array
  //   this.enemies.splice(index, 1);
  // }
}

export default EnemyManager;
