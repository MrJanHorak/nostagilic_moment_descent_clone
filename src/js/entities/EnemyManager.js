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
    this.levelManager = levelManager; // Add this
    this.enemies = [];
    this.levelSegments = [];
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

  // createScoutMesh(body, enemyType) {
  //   // Scout - faster but smaller enemy with sharp angles

  //   // Core body - triangular prism shape
  //   const bodyGeometry = new THREE.CylinderGeometry(
  //     0,
  //     enemyType.size,
  //     enemyType.size * 1.5,
  //     3
  //   );
  //   const bodyMaterial = new THREE.MeshStandardMaterial({
  //     color: enemyType.color,
  //     roughness: 0.6,
  //     metalness: 0.4,
  //     emissive: enemyType.color,
  //     emissiveIntensity: 0.4,
  //   });
  //   const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  //   bodyMesh.name = 'scout_body';
  //   bodyMesh.rotation.x = Math.PI / 2; // Rotate to point forward
  //   body.add(bodyMesh);

  //   // Glowing eyes/sensors
  //   const eyeMaterial = new THREE.MeshBasicMaterial({
  //     color: 0xffff00,
  //     emissive: 0xffff00,
  //     emissiveIntensity: 1.0,
  //   });
  //   // Make eyes slightly larger for better visibility
  //   const eyeGeometry = new THREE.SphereGeometry(enemyType.size * 0.18, 8, 8);

  //   // Move eyes to the front of the ship instead of inside/behind
  //   // Notice the z position change from -0.5 to -0.8
  //   const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  //   leftEye.name = 'scout_eye_left';
  //   leftEye.position.set(
  //     -enemyType.size * 0.25,
  //     enemyType.size * 0.1,
  //     -enemyType.size * 0.8
  //   );
  //   body.add(leftEye);

  //   // Add small point light to left eye for glow effect
  //   const leftEyeLight = new THREE.PointLight(
  //     0xffff00,
  //     1.5, // Increased brightness
  //     enemyType.size * 2.5 // Increased range
  //   );
  //   leftEyeLight.position.copy(leftEye.position);
  //   body.add(leftEyeLight);

  //   const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  //   rightEye.name = 'scout_eye_right';
  //   rightEye.position.set(
  //     enemyType.size * 0.25,
  //     enemyType.size * 0.1,
  //     -enemyType.size * 0.8
  //   );
  //   body.add(rightEye);

  //   // Add small point light to right eye for glow effect
  //   const rightEyeLight = new THREE.PointLight(
  //     0xffff00,
  //     1.5, // Increased brightness
  //     enemyType.size * 2.5 // Increased range
  //   );
  //   rightEyeLight.position.copy(rightEye.position);
  //   body.add(rightEyeLight);

  //   // Small wings
  //   const wingGeometry = new THREE.BoxGeometry(
  //     enemyType.size * 1.5,
  //     enemyType.size * 0.1,
  //     enemyType.size * 0.5
  //   );
  //   const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
  //   wingMesh.name = 'scout_wings';
  //   wingMesh.position.set(0, 0, 0);
  //   body.add(wingMesh);
  // }

createScoutMesh(body, enemyType) {
  // Scout - faster but smaller enemy with sharp angles
  // This function creates the visual mesh for the scout enemy type
  
  // ===== MAIN BODY =====
  // Core body - triangular prism shape (pointed cone)
  // Parameters: top radius, bottom radius, height, number of segments
  const bodyGeometry = new THREE.CylinderGeometry(
    enemyType.size,           // Top radius (wide end) - this will now be at the front
    0,                        // Bottom radius (pointed end) - this will now be at the back
    enemyType.size * 1.5,     // Height of the cylinder
    3                         // Number of segments (3 creates triangular cross-section)
  );
  
  // Material with emissive properties to make it glow slightly
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: enemyType.color,          // Base color from enemy type
    roughness: 0.6,                  // Higher values = less shiny (0-1)
    metalness: 0.2,                  // Higher values = more metallic (0-1)
    emissive: enemyType.color,       // Same color glow
    emissiveIntensity: 0.2,          // Strength of the glow (0-1)
  });
  
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.name = 'scout_body';
  
  // Rotate to point backward (REVERSED from previous orientation)
  // This makes the pointed end face away from the player
  // and the flat base (with eyes) face toward the player
  bodyMesh.rotation.x = -Math.PI / 2; // Negative value reverses orientation
  body.add(bodyMesh);

  // ===== WINGS =====
  // Small wings attached to the sides for visual interest
  // Parameters: width, height, depth
  const wingGeometry = new THREE.BoxGeometry(
    enemyType.size * 2.5,     // Width (extends to sides)
    enemyType.size * 0.1,     // Height (thin)
    enemyType.size * 0.5      // Depth (front-to-back)
  );
  
  const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
  wingMesh.name = 'scout_wings';
  wingMesh.position.set(0, 0, -0.1); // Centered on the body
  body.add(wingMesh);

  // ===== EYES / SENSORS =====
  // Glowing eyes/sensors that are highly visible to the player
  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,           // Bright yellow base color 
    emissive: 0xffff00,        // Same yellow for glow
    emissiveIntensity: 1.0,    // Maximum glow intensity
  });
  
  // Spherical eyes - size affects visibility
  const eyeGeometry = new THREE.SphereGeometry(
    enemyType.size * 0.15,     // Radius (20% of enemy size)
    8,                        // Width segments
    8                         // Height segments
  );

  // ===== LEFT EYE =====
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.name = 'scout_eye_left';
  
  // Position relative to body:
  leftEye.position.set(
    -enemyType.size * 0.18,   // X - offset left from center
    enemyType.size * 0.2,     // Y - slightly raised from center
    enemyType.size * 0.1      // Z - CHANGED: now positive to place at the front
                              // (since we inverted the rotation)
  );
  body.add(leftEye);

  // Add point light to left eye for enhanced visibility
  const leftEyeLight = new THREE.PointLight(
    0xffff00,                 // Yellow light color
    2.0,                      // Brightness/intensity
    enemyType.size * 2.0      // Range of light effect
  );
  leftEyeLight.position.copy(leftEye.position);
  body.add(leftEyeLight);

  // ===== RIGHT EYE =====
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.name = 'scout_eye_right';
  
  // Position relative to body:
  rightEye.position.set(
    enemyType.size * 0.18,    // X - offset right from center
    enemyType.size * 0.2,     // Y - slightly raised from center
    enemyType.size * 0.1      // Z - CHANGED: now positive to place at the front
                              // (since we inverted the rotation)
  );
  body.add(rightEye);

  // Add point light to right eye for enhanced visibility
  const rightEyeLight = new THREE.PointLight(
    0xffff00,                 // Yellow light color
    2.0,                      // Brightness/intensity
    enemyType.size * 2.0      // Range of light effect
  );
  rightEyeLight.position.copy(rightEye.position);
  body.add(rightEyeLight);
}

  createFighterMesh(body, enemyType) {
    // Fighter - larger, more powerful enemy with complex shape

    // Main body - hexagonal prism
    const bodyGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.6,
      enemyType.size * 0.8,
      enemyType.size * 1.8,
      6
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color,
      roughness: 0.3,
      metalness: 0.7,
      emissive: enemyType.color,
      emissiveIntensity: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'fighter_body';
    bodyMesh.rotation.x = Math.PI / 2; // Rotate to point forward
    body.add(bodyMesh);

    // Front weapon
    const weaponGeometry = new THREE.ConeGeometry(
      enemyType.size * 0.3,
      enemyType.size * 0.7,
      8
    );
    const weaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.2,
      metalness: 0.9,
    });
    const weaponMesh = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weaponMesh.name = 'fighter_weapon';
    weaponMesh.position.set(0, 0, -enemyType.size * 1);
    weaponMesh.rotation.x = -Math.PI / 2;
    body.add(weaponMesh);

    // Engine glow
    const engineGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.3,
      16,
      16
    );
    const engineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8,
    });
    const engineMesh = new THREE.Mesh(engineGeometry, engineMaterial);
    engineMesh.name = 'fighter_engine';
    engineMesh.position.set(0, 0, enemyType.size * 0.8);
    body.add(engineMesh);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(
      enemyType.size * 2.2,
      enemyType.size * 0.2,
      enemyType.size * 0.7
    );
    const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
    wingMesh.name = 'fighter_wings';
    wingMesh.position.set(0, 0, enemyType.size * 0.2);
    body.add(wingMesh);

    // Small antennas
    const antennaGeometry = new THREE.CylinderGeometry(
      0.02,
      0.02,
      enemyType.size * 0.6
    );
    const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });

    const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    leftAntenna.name = 'fighter_antenna_left';
    leftAntenna.position.set(
      -enemyType.size * 0.3,
      enemyType.size * 0.3,
      -enemyType.size * 0.7
    );
    leftAntenna.rotation.z = Math.PI / 6;
    body.add(leftAntenna);

    const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    rightAntenna.name = 'fighter_antenna_right';
    rightAntenna.position.set(
      enemyType.size * 0.3,
      enemyType.size * 0.3,
      -enemyType.size * 0.7
    );
    rightAntenna.rotation.z = -Math.PI / 6;
    body.add(rightAntenna);
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
      new THREE.MeshBasicMaterial({ color: 0xff00ff })
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

    for (const spawnPoint of level.enemySpawns) {
      // Check if enemy should be visible now (based on player position)
      const distanceToPlayer = spawnPoint.position.distanceTo(
        this.camera.position
      );

      // Only spawn if within reasonable distance and not already spawned
      if (distanceToPlayer < 50 && distanceToPlayer > 5) {
        // Check if this enemy was already spawned (using position as identifier)
        const alreadySpawned = this.enemies.some((enemy) => {
          return (
            enemy.userData.spawnPosition &&
            enemy.userData.spawnPosition.distanceTo(spawnPoint.position) < 1
          );
        });

        if (!alreadySpawned) {
          // Find the enemy type definition
          const enemyTypeDef = enemyTypes.find(
            (type) => type.name === spawnPoint.enemyType
          );
          if (enemyTypeDef) {
            // Create the enemy
            const enemyMesh = this.createEnemyMesh(enemyTypeDef);
            enemyMesh.position.copy(spawnPoint.position);

            // Mark it as a predefined spawn
            enemyMesh.userData.isPredefined = true;
            enemyMesh.userData.spawnPosition = spawnPoint.position.clone();

            // Add to scene and track
            this.scene.add(enemyMesh);
            this.enemies.push(enemyMesh);
          }
        }
      }
    }
  }

  // Enemy update function
  updateEnemies(delta, projectiles) {
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
            this.audioManager.playSound('hit', {
              volume: Math.min(0.7, 10 / Math.max(1, distanceToPlayer)),
            });
          }

          // Remove projectile
          this.scene.remove(projectile.mesh);
          this.scene.remove(projectile.trail);
          projectile.mesh.geometry.dispose();
          projectile.mesh.material.dispose();
          projectile.trail.geometry.dispose();
          projectile.trail.material.dispose();
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
      this.scene.remove(flash);
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
      this.scene.remove(particleSystem);
      particles.dispose();
      material.dispose();
    }, 300);
  }

  destroyEnemy(index) {
    const enemy = this.enemies[index];
    this.scene.remove(enemy.mesh);

    // Play explosion sound
    if (this.audioManager.initialized) {
      // Calculate volume based on distance to player
      const distanceToPlayer = enemy.mesh.position.distanceTo(
        this.camera.position
      );
      const volume = Math.min(0.8, 10 / Math.max(1, distanceToPlayer));
      this.audioManager.playSound('explosion', { volume });
    }

    // Create explosion particle effect
    createExplosionEffect(this.scene, enemy.mesh.position.clone());

    // Dispose of geometries and materials
    enemy.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.enemies.splice(index, 1);
  }
}

export default EnemyManager;
