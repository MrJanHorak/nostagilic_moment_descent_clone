# EnemyManager Refactoring Documentation

## Overview

The EnemyManager class was refactored to improve maintainability, readability, and modularity. This document provides details about the changes made and how the new structure works.

## Key Components

### EnemyManager.js

- Serves as the main coordinator for enemy-related functionality
- Delegates mesh creation to EnemyFactory
- Delegates projectile handling to ProjectileManager
- Delegates visual effects to EffectsManager

### EnemyFactory.js

- Responsible for creating different enemy types
- Uses mesh builders to construct the 3D representations
- Provides a consistent interface for enemy creation

### MeshBuilders (in meshBuilders/ folder)

- Each enemy type has its own mesh builder class
- Separation of concerns: mesh geometry creation is isolated from game logic
- Makes adding new enemy types simpler

### EnemyTypes.js

- Contains data definitions for each enemy type
- Centralizes all enemy configuration in one place

### ProjectileTypes.js

- Contains data definitions for projectile types
- Centralizes all projectile configuration in one place

### EffectsManager.js

- Handles visual effects like explosions and hit effects
- Manages reusable effect objects via ObjectPool

### ObjectPool.js

- Reuses objects instead of creating new ones
- Improves performance by reducing garbage collection

## Benefits of Refactoring

1. **Separation of Concerns**: Each class has a single responsibility
2. **Improved Maintainability**: Smaller, focused files are easier to understand and modify
3. **Better Testability**: Components can be tested in isolation
4. **Enhanced Reusability**: Components like EffectsManager can be used in other parts of the game
5. **Simplified Extensibility**: Adding new enemy types only requires creating a new mesh builder

## Usage Example

```javascript
// Create enemy manager with dependencies
const enemyManager = new EnemyManager(scene, camera, gameState, audioManager);

// Spawn an enemy of specific type at position
const enemy = enemyManager.spawnEnemy(new THREE.Vector3(0, 0, -10), 'boss');

// Update all enemies each frame
enemyManager.updateEnemies(deltaTime, playerProjectiles);
```

## File Structure

```
entities/
├── EnemyManager.js         - Main enemy management logic
├── EnemyFactory.js         - Creates enemy instances
├── EnemyTypes.js           - Enemy type definitions
├── EnemyAnimations.js      - Animation utilities for enemies
├── ProjectileManager.js    - Manages enemy projectiles
├── ProjectileTypes.js      - Projectile type definitions
└── meshBuilders/
    ├── MeshBuilder.js      - Base mesh builder class
    ├── ScoutMeshBuilder.js - Scout enemy mesh
    ├── FighterMeshBuilder.js - Fighter enemy mesh
    ├── BomberMeshBuilder.js  - Bomber enemy mesh
    ├── DestroyerMeshBuilder.js - Destroyer enemy mesh
    └── BossMeshBuilder.js    - Boss enemy mesh
effects/
└── EffectsManager.js       - Manages visual effects
utils/
└── ObjectPool.js           - Object pooling for performance
```
