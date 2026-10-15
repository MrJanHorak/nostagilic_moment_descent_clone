import * as THREE from 'three';
import ScoutMeshBuilder from './meshBuilders/ScoutMeshBuilder.js';
import FighterMeshBuilder from './meshBuilders/FighterMeshBuilder.js';
import BomberMeshBuilder from './meshBuilders/BomberMeshBuilder.js';
import DestroyerMeshBuilder from './meshBuilders/DestroyerMeshBuilder.js';
import BossMeshBuilder from './meshBuilders/BossMeshBuilder.js';

class EnemyFactory {
  constructor(scene) {
    this.scene = scene;
    this.meshBuilders = {
      scout: new ScoutMeshBuilder(),
      fighter: new FighterMeshBuilder(),
      bomber: new BomberMeshBuilder(),
      destroyer: new DestroyerMeshBuilder(),
      boss: new BossMeshBuilder(),
    };
  }

  createEnemy(enemyType, position, playerTransform = null) {
    const body = new THREE.Group();
    body.name = `${enemyType.name}_enemy`;

    // Add debug property
    body.userData.creationInfo = {
      createdAt: new Date().toISOString(),
      creator: 'createEnemyMesh',
      enemyType: enemyType.name,
    };

    // Use appropriate mesh builder
    const meshBuilder = this.meshBuilders[enemyType.name];
    if (meshBuilder) {
      meshBuilder.buildMesh(body, enemyType);
    }

    // Conservative body envelope around the origin, independent of facing.
    // Includes wings/trails; reserve room for the small cosmetic animations.
    const bounds = new THREE.Box3().setFromObject(body);
    const extent = new THREE.Vector3(...['x', 'y', 'z'].map(axis => Math.max(Math.abs(bounds.min[axis]), Math.abs(bounds.max[axis]))));
    const collisionRadius = extent.length() * 1.1;

    // Position the enemy
    body.position.copy(position);

    // Look at player initially if playerTransform is provided
    if (playerTransform) {
      const lookAtPosition = playerTransform.position.clone();
      body.lookAt(lookAtPosition);
    }

    // Create enemy data object
    const enemy = {
      mesh: body,
      type: enemyType,
      health: enemyType.health,
      collider: new THREE.Box3(),
      velocity: new THREE.Vector3(),
      isActive: true,
      lastFireTime: 0,
      fireRate: 2000, // milliseconds between shots
      collisionRadius,
    };

    // Update the enemy collider
    enemy.collider.setFromObject(body);

    // Add to scene
    this.scene.add(body);

    // Add emissive glow to make enemies more visible
    body.traverse((child) => {
      if (child.isMesh && child.material) {
        // Make enemy materials emissive with higher intensity for visibility
        child.material.emissive = new THREE.Color(enemyType.color);
        child.material.emissiveIntensity = 0.8;
      }
    });

    // Add a point light attached to enemy for better visibility
    const enemyLight = new THREE.PointLight(enemyType.color, 0.6, 5);
    enemyLight.position.set(0, 0, 0);
    body.add(enemyLight);

    return enemy;
  }
}

export default EnemyFactory;
