// This file tests the refactored EnemyManager components
import * as THREE from 'three';
import EnemyManager from './EnemyManager.js';
import { enemyTypes } from './EnemyTypes.js';

// This is a simple test to verify that the EnemyManager and all its dependencies
// are working together correctly after refactoring.

export function testEnemyManager(scene, camera, gameState, audioManager) {
  console.log('Testing refactored EnemyManager...');

  // Create enemy manager
  const enemyManager = new EnemyManager(scene, camera, gameState, audioManager);
  console.log('EnemyManager initialized', enemyManager);

  // Check if all dependencies are properly initialized
  console.log('EnemyFactory available:', !!enemyManager.enemyFactory);
  console.log('ProjectileManager available:', !!enemyManager.projectileManager);
  console.log('EffectsManager available:', !!enemyManager.effectsManager);
  console.log('EnemyTypes available:', enemyTypes.length);
  console.log('Enemy types:', enemyTypes.map((type) => type.name).join(', '));

  // Spawn test enemies of each type in different positions
  const positions = [
    new THREE.Vector3(-3, 0, -10),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(3, 0, -10),
    new THREE.Vector3(-2, 2, -10),
    new THREE.Vector3(2, 2, -10),
  ];

  // Spawn each enemy type
  enemyTypes.forEach((type, index) => {
    const position = positions[index % positions.length];
    const enemy = enemyManager.spawnEnemy(position, type.name);
    console.log(`Spawned enemy: ${type.name}`, enemy);
  });

  return enemyManager;
}
