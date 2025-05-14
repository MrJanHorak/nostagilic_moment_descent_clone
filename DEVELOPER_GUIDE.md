# Developer Guide: Extending the Game

This document provides guidance on how to extend various aspects of the game.

## Table of Contents

1. [Adding New Enemy Types](#adding-new-enemy-types)
2. [Adding New Power-ups](#adding-new-power-ups)
3. [Adding New Weapons](#adding-new-weapons)
4. [Creating New Level Features](#creating-new-level-features)
5. [Extending the UI](#extending-the-ui)

## Adding New Enemy Types

The game currently implements five enemy types: scout, fighter, bomber, destroyer, and boss. Each has unique characteristics, behavior patterns, and visual appearance.

### Current Enemy Types

| Enemy Type | Health | Speed | Damage | Points | Description                                         |
| ---------- | ------ | ----- | ------ | ------ | --------------------------------------------------- |
| Scout      | 10     | 0.05  | 5      | 50     | Fast, agile reconnaissance ships with low health    |
| Fighter    | 25     | 0.03  | 10     | 100    | Balanced combat ships with moderate capabilities    |
| Bomber     | 50     | 0.02  | 20     | 200    | Heavy ships that deploy explosive weapons           |
| Destroyer  | 100    | 0.01  | 30     | 500    | Heavily armored ships with devastating attacks      |
| Boss       | 200    | 0.005 | 50     | 1000   | Massive command ships with multiple attack patterns |

### Adding a New Enemy Type

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

3. In the same file, add a new method to create the mesh for your enemy type, following the pattern of existing methods like `createScoutMesh`, `createFighterMesh`, etc.
4. Modify the `createEnemyMesh` method to call your new mesh creation method when appropriate
5. Add behavior patterns in the EnemyAnimations.js file

## Adding New Power-ups

The game currently features five power-up types: health, speedBoost, weaponUpgrade, weaponPickup, and ammoPickup.

### Current Power-up Types

| Power-up Type  | Effect                                     | Duration |
| -------------- | ------------------------------------------ | -------- |
| Health         | Repairs player shield by 25% of max health | Instant  |
| Speed Boost    | Increases player movement speed by 50%     | 10 sec   |
| Weapon Upgrade | Doubles weapon damage                      | 15 sec   |
| Weapon Pickup  | Provides a random weapon with ammunition   | Instant  |
| Ammo Pickup    | Replenishes ammunition for special weapons | Instant  |

### Adding a New Power-up

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

The game currently features four weapon types: pulse, laser, missile, and plasma.

### Current Weapon Types

| Weapon Type | Ammo     | Damage | Speed  | Special Properties                       |
| ----------- | -------- | ------ | ------ | ---------------------------------------- |
| Pulse       | Infinite | Low    | Medium | Basic projectile weapon                  |
| Laser       | Limited  | Medium | High   | High-accuracy beam weapon                |
| Missile     | Limited  | High   | Low    | Explosive projectiles with splash damage |
| Plasma      | Limited  | V.High | Medium | Advanced energy weapon with high damage  |

### Adding a New Weapon

To add a new weapon type:

1. Open `src/js/core/GameState.js` and add your new weapon to the `weaponInventory` object
2. Open `src/js/entities/ProjectileManager.js`
3. Enhance the `fireProjectile` method to support your new weapon type
4. Create new visual effects for the projectiles
5. Add new sound effects for the weapons

Example enhancement:

```javascript
// In ProjectileManager.js
fireProjectile(gameState) {
  // ... existing code ...

  // Check weapon type
  switch(gameState.currentWeapon) {
    case 'pulse':
      // Default weapon behavior
      break;
    case 'laser':
      // Laser behavior
      break;
    case 'missile':
      // Missile behavior
      break;
    case 'plasma':
      // Plasma behavior
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

Levels in the game are constructed from a series of connected tunnel segments. The game supports several segment types, including straight sections, curves, junctions, and boss rooms.

### Available Segment Types

| Segment Type | Description                             |
| ------------ | --------------------------------------- |
| STRAIGHT     | Standard straight tunnel segment        |
| CURVE_LEFT   | Curved segment turning left             |
| CURVE_RIGHT  | Curved segment turning right            |
| JUNCTION     | Wider junction area with multiple paths |
| BOSS_ROOM    | Large area designed for boss encounters |
| END          | Level endpoint with exit                |

### Creating a Boss Room

Boss rooms are special segments designed for confrontations with boss enemies. To add a boss room to your level:

1. In your level blueprint file (e.g., `Level3.js`), add a boss room segment:

```javascript
// Add a boss room segment
level.addSegment({
  type: SegmentType.BOSS_ROOM,
  width: 12, // Boss rooms are typically wider
  height: 8, // And taller
  length: 15, // And longer
  obstaclePattern: ObstaclePattern.CUSTOM,
  obstacles: [
    // Custom obstacle placement for the boss arena
    { position: new THREE.Vector3(3, 0, 7), scale: new THREE.Vector3(1, 2, 1) },
    {
      position: new THREE.Vector3(-3, 0, 7),
      scale: new THREE.Vector3(1, 2, 1),
    },
    // Add more obstacles as needed
  ],
  lightColor: 0xff0000, // Red lighting for dramatic effect
  lightIntensity: 0.8,
});

// Spawn the boss enemy in the boss room
level.addEnemySpawn(
  new THREE.Vector3(0, 0, 7.5), // Position in the middle of the boss room
  'boss' // Enemy type 'boss'
);
```

2. Add power-ups strategically around the boss room:

```javascript
// Add power-ups to help the player in the boss fight
level.addPowerupSpawn(new THREE.Vector3(3, 2, 4), 'health');

level.addPowerupSpawn(new THREE.Vector3(-3, 2, 4), 'weaponUpgrade');
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
