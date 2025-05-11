# Developer Guide: Extending the Game

This document provides guidance on how to extend various aspects of the game.

## Table of Contents

1. [Adding New Enemy Types](#adding-new-enemy-types)
2. [Adding New Power-ups](#adding-new-power-ups)
3. [Adding New Weapons](#adding-new-weapons)
4. [Creating New Level Features](#creating-new-level-features)
5. [Extending the UI](#extending-the-ui)

## Adding New Enemy Types

To add a new enemy type:

1. Open `src/js/entities/EnemyManager.js`
2. Add a new object to the `enemyTypes` array:

```javascript
{
  name: 'yourEnemyName',
  color: 0xHEXCOLOR, // Use a hexadecimal color
  size: 0.5, // Base size of the enemy
  health: 15, // Health points
  speed: 0.04, // Movement speed
  damage: 7, // Damage dealt to player on collision
  pointValue: 75, // Score points awarded when destroyed
}
```

3. In the same file, add a new method to create the mesh for your enemy type (following the pattern of `createScoutMesh` and `createFighterMesh`)
4. Modify the `createEnemyMesh` method to call your new mesh creation method when appropriate

## Adding New Power-ups

To add a new power-up:

1. Open `src/js/entities/PowerUpManager.js`
2. Add a new object to the `powerupTypes` array:

```javascript
{
  name: 'yourPowerupName',
  color: 0xHEXCOLOR, // Use a hexadecimal color
  size: 0.5, // Visual size
  duration: 10000, // Duration in milliseconds (0 for instant effects)
  effect: function (gameState, uiManager) {
    // Implement your power-up effect here
    // For example:
    gameState.someProperty = newValue;

    // Show message to player
    uiManager.showMessage('Your Power-up Effect!', 2000, '#yourColor');

    // For timed power-ups, reset after duration
    if (this.duration > 0) {
      setTimeout(() => {
        gameState.someProperty = originalValue;
        uiManager.showMessage('Effect Ended', 1500, '#yourColor');
      }, this.duration);
    }
  },
  message: 'Your Power-up Message!',
}
```

## Adding New Weapons

To add a new weapon type:

1. Open `src/js/entities/ProjectileManager.js`
2. Enhance the `fireProjectile` method to support different weapon types
3. Add weapon-specific properties to the game state in `src/js/core/GameState.js`
4. Create new visual effects for the projectiles
5. Add new sound effects for the weapons

Example enhancement:

```javascript
// In ProjectileManager.js
fireProjectile(gameState) {
  // ... existing code ...

  // Check weapon type
  switch(gameState.currentWeapon) {
    case 'laser':
      // Default weapon behavior
      break;
    case 'yourNewWeapon':
      // Your custom weapon behavior
      projectileColor = 0xYOURCOLOR;
      projectileSize = 0.1; // Larger projectile
      projectileSpeed = 7; // Faster projectile
      break;
  }

  // ... continue with firing logic ...
}
```

## Creating New Level Features

To add new features to the level:

1. Open `src/js/core/LevelManager.js`
2. Enhance the `createTunnelSegment` method to add your new features
3. Add variation to the tunnel generation
4. Create new obstacle types in the `addObstacles` method

Example enhancement:

```javascript
// In LevelManager.js - Add a new obstacle type
if (obstacleType < 0.3) {
  // Rock obstacles
}
else if (obstacleType < 0.6) {
  // Pipe obstacles
}
else if (obstacleType < 0.8) {
  // Box obstacles
}
else {
  // Your new obstacle type
  const geometry = new THREE.YourGeometryType(params);
  const material = new THREE.MeshStandardMaterial({
    color: 0xYOURCOLOR,
    // other material properties
  });
  obstacle = new THREE.Mesh(geometry, material);

  // Add special properties/behaviors
  // ...
}
```

## Extending the UI

To enhance the UI:

1. Open `src/js/ui/UIManager.js`
2. Add new UI elements to the constructor or create new methods for specific UI components
3. Add update methods for your new UI elements

Example:

```javascript
// In UIManager.js
createWeaponIndicator() {
  const weaponUI = document.createElement('div');
  // Style and position your UI element
  // ...

  document.body.appendChild(weaponUI);
  return weaponUI;
}

updateWeaponUI() {
  // Update the weapon UI based on current weapon
  // ...
}
```

## Troubleshooting

If you encounter issues:

1. Check the browser console for errors
2. Use the debugging utilities in `src/js/utils/debugUtils.js`
3. Add console logs to track the flow of your new functionality
4. Make sure all imports use absolute paths with the `/src/js/` prefix

Happy coding!
