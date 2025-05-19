// Enemy entity module
import * as THREE from 'three';
import { createExplosionEffect } from '../utils/effectsUtils.js';
import { checkProjectileEnemyCollision } from '../utils/collisionUtils.js';
import { animateEnemy, getEnemyFiringRange } from './EnemyAnimations.js';
import { enemyTypes } from './EnemyTypes.js';
import EnemyFactory from './EnemyFactory.js';
import ProjectileManager from './ProjectileManager.js';
import EffectsManager from '../effects/EffectsManager.js';
import ObjectPool from '../utils/ObjectPool.js';

class EnemyManager {
  constructor(scene, camera, gameState, audioManager, levelManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.levelManager = levelManager;

    // Initialize supporting systems
    this.enemyFactory = new EnemyFactory(scene);
    this.projectileManager = new ProjectileManager(scene, audioManager);
    this.effectsManager = new EffectsManager(scene);
    this.objectPool = new ObjectPool();

    // Enemy tracking
    this.enemies = [];
    this.levelSegments = [];
    this.destroyedPredefinedEnemies = new Set();
    this.totalPredefinedEnemies = 0;

    // Tunnel properties (used for spawning calculations)
    this.tunnelWidth = levelManager ? levelManager.tunnelWidth : 15;
    this.tunnelHeight = levelManager ? levelManager.tunnelHeight : 12;

    // For endless mode
    this.lastRandomSpawnTime = 0;
    this.randomSpawnInterval = 5000; // 5 seconds between spawns in endless mode
  }

  setLevelSegments(segments) {
    this.levelSegments = segments;
  }

  // Spawn enemy at a position
  spawnEnemy(position, typeName = null) {
    // If no specific type requested, choose randomly
    const enemyType = typeName
      ? enemyTypes.find((t) => t.name === typeName)
      : enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

    // Use the factory to create the enemy
    const enemy = this.enemyFactory.createEnemy(
      enemyType,
      position,
      this.camera
    );

    this.enemies.push(enemy);
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

    let segment = validSegments[segmentIndex];

    // Check if this segment is suitable for spawning
    // Avoid spawning in curve segments as they cause position calculation issues
    const isCurved =
      segment.userData &&
      segment.userData.type &&
      (segment.userData.type === 'curveLeft' ||
        segment.userData.type === 'curveRight');

    // If the segment is curved, try to find a better segment
    if (isCurved) {
      // Try segments before or after this one
      const trySegments = [];
      if (validSegments[segmentIndex - 1])
        trySegments.push(validSegments[segmentIndex - 1]);
      if (validSegments[segmentIndex + 1])
        trySegments.push(validSegments[segmentIndex + 1]);

      // If we have alternatives, pick one randomly
      if (trySegments.length > 0) {
        const altSegment =
          trySegments[Math.floor(Math.random() * trySegments.length)];
        if (altSegment) segment = altSegment;
      }
    }

    // Calculate a position somewhere in the segment
    const segmentPosition = segment.position.clone();

    // Get segment dimensions from children more reliably
    let segmentWidth = 8; // More conservative default width
    let segmentHeight = 8; // More conservative default height

    // Find floor and ceiling more reliably
    const floor = segment.children.find(
      (child) =>
        child.position.y < 0 &&
        child.rotation.x < 0 && // Floor typically has negative x rotation
        child.geometry
    );

    const ceiling = segment.children.find(
      (child) =>
        child.position.y > 0 &&
        child.rotation.x > 0 && // Ceiling typically has positive x rotation
        child.geometry
    );

    // Get actual dimensions from geometry if possible
    if (floor && floor.geometry && floor.geometry.parameters) {
      segmentWidth = floor.geometry.parameters.width * 0.7; // More conservative width (70%)
    }

    if (floor && ceiling) {
      segmentHeight = Math.abs(ceiling.position.y - floor.position.y) * 0.6; // More conservative height (60%)
    }

    // Use more conservative position bounds within the segment
    const x = (Math.random() - 0.5) * segmentWidth * 0.8;
    const y = (Math.random() - 0.5) * segmentHeight * 0.8;

    // Position along the segment length (avoid edges)
    const z = -segmentLength * (Math.random() * 0.6 + 0.2); // Position between 20% and 80% through segment

    // Convert local coordinates to world coordinates
    // Apply the segment's world matrix to get the correct position
    segment.updateMatrixWorld(true); // Ensure matrix is up to date
    const spawnPosition = new THREE.Vector3(x, y, z).applyMatrix4(
      segment.matrixWorld
    );

    // Verify position is inside level bounds - perform raycasting check
    const tooCloseToWall = this.isPositionTooCloseToWalls(
      spawnPosition,
      segment
    );
    if (tooCloseToWall) {
      // If too close to wall, try again with more conservative positioning
      // Move towards center of tunnel
      spawnPosition.x *= 0.5;
      spawnPosition.y *= 0.5;
    }

    // Create debug visualization for spawn point (useful for development)
    const debugSpawn = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: tooCloseToWall ? 0xff0000 : 0x00ff00,
        emissive: tooCloseToWall ? 0xff0000 : 0x00ff00,
        emissiveIntensity: 0.5,
      })
    );
    debugSpawn.position.copy(spawnPosition);
    this.scene.add(debugSpawn);

    // Remove debug marker after a few seconds
    setTimeout(() => {
      this.scene.remove(debugSpawn);
      if (debugSpawn.geometry) debugSpawn.geometry.dispose();
      if (debugSpawn.material) debugSpawn.material.dispose();
    }, 5000);

    // Choose an enemy type appropriate for the current game progress
    const enemyTypesForCurrentProgress = this.getEnemyTypesForCurrentProgress();
    const enemyType =
      enemyTypesForCurrentProgress[
        Math.floor(Math.random() * enemyTypesForCurrentProgress.length)
      ];

    // Create and return the enemy
    const enemy = this.spawnEnemy(spawnPosition, enemyType.name);

    // Store reference to originating segment
    if (enemy && enemy.mesh) {
      enemy.mesh.userData.originSegment = segment.id;
    }

    return enemy;
  }

  // Helper method to check if a position is too close to walls
  isPositionTooCloseToWalls(position, segment) {
    // Simple distance check from segment center
    const horizontalDistance = Math.sqrt(
      Math.pow(position.x - segment.position.x, 2) +
        Math.pow(position.z - segment.position.z, 2)
    );

    // If more than 80% of the way to the edge, consider it too close
    return horizontalDistance > this.tunnelWidth * 0.4;
  }

  // Get appropriate enemy types based on current game progress
  getEnemyTypesForCurrentProgress() {
    // By default return all enemy types except boss
    return enemyTypes.filter((type) => type.name !== 'boss');
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

  // Reset enemies for new level with defensive checks
  resetLevel() {
    // Clear tracking of destroyed enemies
    if (this.destroyedPredefinedEnemies) {
      this.destroyedPredefinedEnemies.clear();
    } else {
      this.destroyedPredefinedEnemies = new Set();
    }

    this.totalPredefinedEnemies = 0;

    // Remove all existing enemies with defensive checks
    if (this.enemies && this.enemies.length) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        this.destroyEnemy(i);
      }
    }

    this.enemies = [];

    // Reset endless mode timers
    this.lastRandomSpawnTime = 0;
    this.randomSpawnInterval = 5000;
  }

  // Enemy update function
  updateEnemies(delta, projectiles) {
    // Update effects first
    this.effectsManager.update();

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

      // Apply enemy type-specific movement
      if (distanceToPlayer < 30) {
        // Get direction to player
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.camera.position, enemy.mesh.position)
          .normalize();

        // Apply movement patterns based on enemy type
        let movementSpeed = enemy.type.speed;

        // Apply behavior modifications based on enemy type
        switch (enemy.type.name) {
          case 'boss':
            // Boss moves more deliberately with minimal randomness
            direction.x += (Math.random() - 0.5) * 0.05;
            direction.y += (Math.random() - 0.5) * 0.05;
            direction.z += (Math.random() - 0.5) * 0.05;

            // Boss tries to maintain a certain distance from player
            const optimalDistance = 15;
            const distanceAdjustment =
              (distanceToPlayer - optimalDistance) * 0.02;
            movementSpeed *= Math.max(0, Math.min(1.5, distanceAdjustment));
            break;

          case 'bomber':
            // Bombers tend to move to positions above the player to drop bombs
            direction.y += 0.1; // Slight upward bias
            direction.x += (Math.random() - 0.5) * 0.3;
            direction.z += (Math.random() - 0.5) * 0.1;
            break;

          case 'destroyer':
            // Destroyers move more deliberately with less randomness
            direction.x += (Math.random() - 0.5) * 0.1;
            direction.y += (Math.random() - 0.5) * 0.1;
            direction.z += (Math.random() - 0.5) * 0.1;

            // Destroyers also prefer a certain engagement distance
            const destroyerOptimalDistance = 10;
            const destroyerDistAdj =
              (distanceToPlayer - destroyerOptimalDistance) * 0.01;
            movementSpeed *= Math.max(0, Math.min(1.2, destroyerDistAdj));
            break;

          default:
            // Default for scouts and fighters - more erratic movement
            direction.x += (Math.random() - 0.5) * 0.2;
            direction.y += (Math.random() - 0.5) * 0.2;
            direction.z += (Math.random() - 0.5) * 0.2;
        }

        // Update velocity with smoothing - different smoothing per enemy type
        let smoothingFactor = 0.05;
        if (enemy.type.name === 'boss') smoothingFactor = 0.02;
        else if (enemy.type.name === 'destroyer') smoothingFactor = 0.03;

        enemy.velocity.lerp(
          direction.multiplyScalar(movementSpeed),
          smoothingFactor
        );

        // Apply velocity
        enemy.mesh.position.add(enemy.velocity);

        // Make enemy face the player
        enemy.mesh.lookAt(this.camera.position);

        // Apply animations to enemy mesh based on its type
        animateEnemy(enemy, delta);
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
      }

      // Check projectile collision
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const projectile = projectiles[j];

        if (checkProjectileEnemyCollision(projectile, enemy)) {
          // Enemy takes damage - different damage resistance based on enemy type
          let damageMultiplier = 1.0;
          if (enemy.type.name === 'boss')
            damageMultiplier = 0.7; // Boss takes less damage
          else if (enemy.type.name === 'destroyer') damageMultiplier = 0.8; // Destroyers have some armor

          enemy.health -= projectile.power * damageMultiplier;

          // Visual hit feedback
          this.effectsManager.createHitEffect(projectile.mesh.position.clone());

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

          projectiles.splice(j, 1); // Check if enemy is destroyed
          if (enemy.health <= 0) {
            // Add score
            this.gameState.score += enemy.type.pointValue;

            // Record the kill in statistics
            if (this.gameState && this.gameState.recordEnemyKill) {
              this.gameState.recordEnemyKill(enemy.type.name);
            }

            // Create weapon pickup chance based on enemy type
            const position = enemy.mesh.position.clone();
            this.spawnEnemyDrop(position, enemy.type.name);

            // Destroy the enemy
            this.destroyEnemy(i);
            break;
          }
        }
      }

      // Handle enemy firing projectiles
      if (
        enemy.type.name !== 'scout' &&
        currentTime - enemy.lastFireTime > enemy.fireRate
      ) {
        // Only shoot if within range and in front of the player
        const firingRange = getEnemyFiringRange(enemy.type.name);

        // Check if player is in front of the enemy
        const inFrontOf =
          this.camera
            .getWorldDirection(new THREE.Vector3())
            .dot(
              new THREE.Vector3()
                .subVectors(enemy.mesh.position, this.camera.position)
                .normalize()
            ) < 0;

        if (distanceToPlayer < firingRange && inFrontOf) {
          this.projectileManager.fireEnemyProjectile(enemy, this.camera);
          enemy.lastFireTime = currentTime;

          // Set next fire rate based on enemy type
          if (enemy.type.name === 'bomber') {
            // Bombers fire slower but with more powerful explosives
            enemy.fireRate = 3000 + Math.random() * 1000;
          } else if (enemy.type.name === 'destroyer') {
            // Destroyers fire at medium rate with accurate shots
            enemy.fireRate = 2000 + Math.random() * 1000;
          } else if (enemy.type.name === 'boss') {
            // Boss fires faster and more frequently
            enemy.fireRate = 800 + Math.random() * 700;

            // Boss occasionally fires from multiple weapons at once
            if (Math.random() < 0.3) {
              setTimeout(() => {
                if (enemy && enemy.mesh && enemy.mesh.parent) {
                  this.projectileManager.fireEnemyProjectile(
                    enemy,
                    this.camera
                  );
                }
              }, 200);

              if (Math.random() < 0.2) {
                setTimeout(() => {
                  if (enemy && enemy.mesh && enemy.mesh.parent) {
                    this.projectileManager.fireEnemyProjectile(
                      enemy,
                      this.camera
                    );
                  }
                }, 400);
              }
            }
          } else {
            // Default fire rate for others
            enemy.fireRate = 2000 + Math.random() * 1000;
          }
        }
      }
    }

    // Update enemy projectiles
    this.projectileManager.updateProjectiles(
      delta,
      this.camera,
      this.gameState,
      this.effectsManager
    );
  }

  destroyEnemy(index) {
    // Check if we have a valid array and index
    if (!this.enemies || index < 0 || index >= this.enemies.length) {
      return;
    }

    const enemy = this.enemies[index];
    if (!enemy) return;

    // Check if this is a predefined enemy and mark as permanently destroyed
    if (
      enemy.mesh &&
      enemy.mesh.userData &&
      enemy.mesh.userData.isPredefined &&
      enemy.mesh.userData.spawnPointId
    ) {
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

    // Create explosion effect (do this before removing from scene)
    if (this.scene && enemy.mesh && enemy.mesh.position) {
      createExplosionEffect(this.scene, enemy.mesh.position.clone());

      // Remove the entire enemy mesh from scene
      this.scene.remove(enemy.mesh);
    }

    // Play explosion sound with defensive checks
    if (
      this.audioManager &&
      this.audioManager.initialized &&
      enemy.mesh &&
      enemy.mesh.position &&
      this.camera
    ) {
      try {
        // Calculate volume based on distance to player
        const distanceToPlayer = enemy.mesh.position.distanceTo(
          this.camera.position
        );
        const volume = Math.min(0.8, 10 / Math.max(1, distanceToPlayer));
        this.audioManager.playSound('explosion', { volume });
      } catch (error) {
        console.warn('Error playing explosion sound:', error);
      }
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

  // Spawn item drops when enemies are destroyed
  spawnEnemyDrop(position, enemyType) {
    // Check if PowerUpManager exists
    if (!this.powerUpManager) return;

    // Different drop chances based on enemy type
    let dropChance = 0;
    let weaponDropChance = 0;

    switch (enemyType) {
      case 'scout':
        dropChance = 0.2; // 20% chance to drop something
        weaponDropChance = 0.2; // 20% of drops are weapons (4% overall)
        break;
      case 'fighter':
        dropChance = 0.3; // 30% chance
        weaponDropChance = 0.3; // 30% of drops are weapons (9% overall)
        break;
      case 'bomber':
        dropChance = 0.5; // 50% chance
        weaponDropChance = 0.4; // 40% of drops are weapons (20% overall)
        break;
      case 'destroyer':
        dropChance = 0.7; // 70% chance
        weaponDropChance = 0.6; // 60% of drops are weapons (42% overall)
        break;
      case 'boss':
        dropChance = 1.0; // 100% chance to drop something
        weaponDropChance = 0.8; // 80% chance it's a weapon
        break;
      default:
        dropChance = 0.2;
        weaponDropChance = 0.3;
    }

    // Determine if we should drop something
    if (Math.random() > dropChance) return;

    // Determine what type of item to drop
    if (Math.random() < weaponDropChance) {
      // Weapon drop
      const weaponFound =
        this.gameState.weaponInventory.laser.unlocked &&
        this.gameState.weaponInventory.missile.unlocked &&
        this.gameState.weaponInventory.plasma.unlocked;

      if (!weaponFound) {
        // If player doesn't have all weapons, higher chance for new weapon
        this.powerUpManager.spawnPowerup(position, 'weaponPickup');
      } else {
        // Player has all weapons, give ammo
        this.powerUpManager.spawnPowerup(position, 'ammoPickup');
      }
    } else {
      // Other powerups - distribute randomly
      const powerupTypes = [
        'health',
        'speedBoost',
        'weaponUpgrade',
        'ammoPickup',
      ];
      const weights = [0.4, 0.2, 0.2, 0.2]; // 40% health, 20% others

      // Weighted random selection
      const rand = Math.random();
      let powerup;
      let cumulativeWeight = 0;

      for (let i = 0; i < powerupTypes.length; i++) {
        cumulativeWeight += weights[i];
        if (rand <= cumulativeWeight) {
          powerup = powerupTypes[i];
          break;
        }
      }

      this.powerUpManager.spawnPowerup(position, powerup);
    }
  }

  // Set reference to PowerUpManager
  setPowerUpManager(manager) {
    this.powerUpManager = manager;
  }

  // Move all enemies by offset (Vector3)
  offsetEnemies(offset) {
    for (const enemy of this.enemies) {
      if (enemy && enemy.mesh && enemy.mesh.position) {
        enemy.mesh.position.add(offset);
      }
    }
  }
}

export default EnemyManager;
