# Level Design Guide

This guide explains how to create custom levels for the Descent game. The level system uses a blueprint-based approach that allows for complete customization of tunnel segments, obstacle patterns, enemy placement, and power-up distribution.

## Table of Contents

1. [Understanding the Level System](#understanding-the-level-system)
2. [Level Blueprint Structure](#level-blueprint-structure)
3. [Segment Types](#segment-types)
4. [Obstacle Patterns](#obstacle-patterns)
5. [Creating a New Level](#creating-a-new-level)
6. [Enemy and Power-Up Placement](#enemy-and-power-up-placement)
7. [Adding Your Level to the Game](#adding-your-level-to-the-game)
8. [Advanced Customizations](#advanced-customizations)
9. [Tips for Good Level Design](#tips-for-good-level-design)

## Understanding the Level System

The level system consists of several key components:

- **LevelBlueprint.js**: Defines the base class for level blueprints
- **SegmentTypes.js**: Contains segment type and obstacle pattern enums
- **Level1.js** and **Level2.js**: Example level implementations
- **LevelManager.js** (parent folder): Manages level loading, rendering, and updating

The levels are constructed from tunnel segments that connect to form a complete level. Each segment can have different properties like width, height, curve, lighting, and obstacle placement.

## Level Blueprint Structure

Every level extends the `LevelBlueprint` class which has the following structure:

```javascript
export default class LevelBlueprint {
  constructor(id, name, config = {}) {
    this.id = id;                               // Level identifier
    this.name = name;                           // Level display name
    this.segmentCount = config.segmentCount || 15; // Number of segments
    this.segments = [];                         // Segment definitions
    this.enemySpawns = [];                      // Enemy spawn points
    this.powerupSpawns = [];                    // Power-up spawn points
    this.difficulty = config.difficulty || 1;   // Level difficulty
    this.endSegment = config.hasEndSegment || false; // Whether level has an ending
  }

  // Methods to build the level
  addSegment(segmentDef) {...}
  addEnemySpawn(position, enemyType) {...}
  addPowerupSpawn(position, powerupType) {...}
}
```

## Segment Types

Segments are defined in `SegmentTypes.js`:

```javascript
export const SegmentType = {
  STRAIGHT: 'straight', // Standard straight segment
  CURVE_LEFT: 'curveLeft', // Curved segment turning left
  CURVE_RIGHT: 'curveRight', // Curved segment turning right
  JUNCTION: 'junction', // Junction area (wider)
  BOSS_ROOM: 'bossRoom', // Larger area for boss fights
  END: 'end', // Level endpoint with exit
};
```

## Obstacle Patterns

Obstacles can be placed in predefined patterns:

```javascript
export const ObstaclePattern = {
  NONE: 'none', // No obstacles
  RANDOM: 'random', // Randomly placed obstacles
  CENTER_BLOCK: 'centerBlock', // Single obstacle in center
  SIDE_BLOCKS: 'sideBlocks', // Obstacles along the sides
  NARROW_PATH: 'narrowPath', // Creates a narrow passage
  CUSTOM: 'custom', // Custom obstacle placement
};
```

## Creating a New Level

To create a new level, follow these steps:

1. Create a new file (e.g., `Level3.js`) in the levels folder
2. Import the necessary modules
3. Define your level structure using the LevelBlueprint methods

Here's a template for a new level:

```javascript
// filepath: src/js/core/levels/Level3.js
import LevelBlueprint from './LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from './SegmentTypes.js';
import * as THREE from 'three';

export default function createLevel3() {
  // Create a new level blueprint with ID, name, and configuration
  const level = new LevelBlueprint(3, 'Forbidden Depths', {
    segmentCount: 25, // How many segments to keep loaded
    difficulty: 2, // Difficulty rating
    hasEndSegment: true, // Whether this level has an ending
  });

  // Add segments to build your level
  // Starting area - no obstacles for the first 2 segments
  for (let i = 0; i < 2; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.NONE,
      lightColor: 0x4488cc, // Blueish light
    });
  }

  // Add a curved section
  level.addSegment({
    type: SegmentType.CURVE_LEFT,
    obstacles: ObstaclePattern.SIDE_BLOCKS,
    lightColor: 0xff6600, // Orange light
  });

  // Add a segment with custom obstacle placement
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.CUSTOM,
    customObstacles: [
      { position: new THREE.Vector3(2, 0, -8), type: 'rock' },
      { position: new THREE.Vector3(-2, 0, -12), type: 'pipe' },
      { position: new THREE.Vector3(0, 1.5, -16), type: 'crate' },
    ],
    lightColor: 0x66aaff,
  });

  // Add a challenging narrow path section
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.NARROW_PATH,
      lightColor: 0xaa44ff, // Purple light
    });
  }

  // Add more segments as needed to complete your level
  // ...

  // Add a boss room at the end
  level.addSegment({
    type: SegmentType.BOSS_ROOM,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff4444, // Red light for danger
  });

  // Add the end segment with exit
  level.addSegment({
    type: SegmentType.END,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x44ff44, // Green light for exit
  });

  return level;
}
```

## Enemy and Power-Up Placement

Enemies and power-ups can be placed at specific positions in your level:

```javascript
// Add enemies at specific locations
// Scout enemy at position (0, 0, -50)
level.addEnemySpawn(new THREE.Vector3(0, 0, -50), 'scout');

// Fighter enemy at position (2, 1, -100)
level.addEnemySpawn(new THREE.Vector3(2, 1, -100), 'fighter');

// Add power-ups at specific locations
// Health power-up at position (-2, 0, -75)
level.addPowerupSpawn(new THREE.Vector3(-2, 0, -75), 'health');

// Speed boost power-up at position (2, 1, -125)
level.addPowerupSpawn(new THREE.Vector3(2, 1, -125), 'speedBoost');
```

### Enemy Types

Available enemy types are defined in `EnemyManager.js`:

- `scout`: Fast but weak
- `fighter`: Slower but stronger

### Power-up Types

Available power-up types are defined in `PowerUpManager.js`:

- `health`: Restores player health
- `speedBoost`: Increases player speed temporarily
- `weaponUpgrade`: Upgrades player weapons temporarily

## Adding Your Level to the Game

Once you've created your level, add it to the game:

1. Import your level creation function in `LevelManager.js`:

```javascript
import createLevel1 from './levels/Level1.js';
import createLevel2 from './levels/Level2.js';
import createLevel3 from './levels/Level3.js'; // Add your new level
```

2. Add it to the levels array in the LevelManager constructor:

```javascript
this.levels = [createLevel1(), createLevel2(), createLevel3()]; // Add your level
```

## Advanced Customizations

### Custom Obstacle Placement

For precise obstacle placement, use the `CUSTOM` obstacle pattern:

```javascript
level.addSegment({
  type: SegmentType.STRAIGHT,
  obstacles: ObstaclePattern.CUSTOM,
  customObstacles: [
    // x, y, z coordinates and obstacle type
    { position: new THREE.Vector3(3, 0, -5), type: 'rock' },
    { position: new THREE.Vector3(-3, 0, -10), type: 'pipe' },
    { position: new THREE.Vector3(0, 2, -15), type: 'crate' },
  ],
  lightColor: 0xffaa44,
});
```

### Light Colors

You can set custom light colors for each segment to change the mood:

```javascript
// Red danger zone
level.addSegment({
  type: SegmentType.STRAIGHT,
  obstacles: ObstaclePattern.CENTER_BLOCK,
  lightColor: 0xff0000, // Bright red
});

// Calm blue area
level.addSegment({
  type: SegmentType.STRAIGHT,
  obstacles: ObstaclePattern.NONE,
  lightColor: 0x0066ff, // Blue
});

// Eerie green section
level.addSegment({
  type: SegmentType.CURVE_RIGHT,
  obstacles: ObstaclePattern.RANDOM,
  lightColor: 0x00ff66, // Green
});
```

### Creating a Slalom Course

You can create interesting patterns like a slalom course:

```javascript
level.addSegment({
  type: SegmentType.STRAIGHT,
  obstacles: ObstaclePattern.CUSTOM,
  customObstacles: [
    { position: new THREE.Vector3(3, 0, -5), type: 'rock' },
    { position: new THREE.Vector3(-3, 0, -10), type: 'rock' },
    { position: new THREE.Vector3(3, 0, -15), type: 'rock' },
    { position: new THREE.Vector3(-3, 0, -20), type: 'rock' },
  ],
  lightColor: 0xffaa44,
});
```

### Tunnel Width Variation

Different segment types have different tunnel widths:

- `STRAIGHT`: Standard width
- `NARROW_PATH`: 70% of standard width
- `BOSS_ROOM`: 150% of standard width

## Tips for Good Level Design

1. **Start Simple**: Begin your level with a few simple segments to allow the player to get comfortable.

2. **Progressive Difficulty**: Gradually increase the challenge throughout the level.

3. **Rhythm and Flow**: Alternate between intense sections and calmer areas to create a good flow.

4. **Visual Variety**: Use different light colors and segment types to keep the level visually interesting.

5. **Reward Exploration**: Place power-ups in locations that reward skilled maneuvering.

6. **Signpost Danger**: Use red lighting for difficult areas to warn players.

7. **Test Thoroughly**: Make sure your level is playable and has a good difficulty curve.

8. **Think in 3D**: Remember players can move in all directions, so consider vertical obstacle placement too.

9. **Ensure Fairness**: Always ensure there's a path through the obstacles that doesn't require perfect play.

10. **Memory Considerations**: Don't make levels too long, as all segments are loaded into memory.

## Example: Minimal Working Level

Here's a minimal example of a working level:

```javascript
import LevelBlueprint from './LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from './SegmentTypes.js';
import * as THREE from 'three';

export default function createMinimalLevel() {
  const level = new LevelBlueprint(99, 'Minimal Level', {
    segmentCount: 10,
    difficulty: 1,
    hasEndSegment: true,
  });

  // Add a few straight segments
  for (let i = 0; i < 8; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: i > 2 ? ObstaclePattern.RANDOM : ObstaclePattern.NONE,
      lightColor: 0x4466aa,
    });
  }

  // Add an end segment
  level.addSegment({
    type: SegmentType.END,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x00ff00,
  });

  // Add one enemy and one power-up
  level.addEnemySpawn(new THREE.Vector3(0, 0, -30), 'scout');
  level.addPowerupSpawn(new THREE.Vector3(0, 0, -20), 'health');

  return level;
}
```

## Testing and Debugging Levels

When creating new levels, you'll want to test them thoroughly to ensure they work as expected:

1. **Preview Mode**: You can view your level without enemies by adding a preview flag:

```javascript
const level = new LevelBlueprint(4, 'Test Level', {
  segmentCount: 10,
  difficulty: 1,
  preview: true, // Disables enemies when true
});
```

2. **Checking for Errors**: Common errors include:

   - Forgetting to import necessary modules
   - Invalid obstacle positions
   - Using object types that don't exist

3. **Console Debugging**: Add console logs to your level creation function to track initialization:

```javascript
export default function createLevel4() {
  console.log('Creating Level 4...');
  const level = new LevelBlueprint(4, 'Debug Level', {
    segmentCount: 10,
    difficulty: 1,
  });

  // Add segments and track progress
  console.log('Adding segments to Level 4...');

  // After creation
  console.log('Level 4 creation complete:', level);
  return level;
}
```

4. **Playing Your Level**: To easily test a specific level during development, you can modify the game's starting level:

```javascript
// In main.js in the Game constructor:
this.currentLevelIndex = 3; // Set to your new level's index
this.isEndlessMode = false; // Ensure you're in level mode, not endless mode
```

Remember to revert these changes before releasing your game!

If you have any questions about level design or need help creating custom levels for your game, feel free to expand on this documentation.
