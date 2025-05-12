// Example level demonstrating all level design concepts
import LevelBlueprint from './LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from './SegmentTypes.js';
import * as THREE from 'three';

export default function createExampleLevel() {
  console.log('Creating Example Level...');

  // Create the level blueprint with configuration
  const level = new LevelBlueprint(3, 'Example Level - Demonstration', {
    segmentCount: 20, // How many segments to keep loaded at once
    difficulty: 2, // Difficulty rating (used for enemy strength/frequency)
    hasEndSegment: true, // Whether this level has an ending or loops
  });

  // SECTION 1: Simple Introduction Area
  // -------------------------------
  console.log('Adding introduction area...');

  // Start with a few empty segments so the player can get oriented
  for (let i = 0; i < 2; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.NONE,
      lightColor: 0x66aaff, // Calm blue lighting
    });
  }

  // Add health powerup early on
  level.addPowerupSpawn(new THREE.Vector3(-2, 0, -30), 'health');

  // SECTION 2: Basic Obstacle Training
  // -------------------------------
  console.log('Adding basic obstacle training...');

  // Center obstacle segment
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.CENTER_BLOCK,
    lightColor: 0x88aaff, // Light blue
  });

  // Side obstacles segment
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.SIDE_BLOCKS,
    lightColor: 0x88aaff, // Light blue
  });

  // Random obstacles segment
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.RANDOM,
    lightColor: 0x88aaff, // Light blue
  });

  // SECTION 3: First Combat Encounter
  // -------------------------------
  console.log('Adding first combat encounter...');

  // Wide segment for first combat
  level.addSegment({
    type: SegmentType.BOSS_ROOM, // Using boss room type for extra space
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff8866, // Orange-red alert color
  });

  // Add scout enemy in the combat area
  level.addEnemySpawn(new THREE.Vector3(0, 0, -120), 'scout');

  // Add weapon powerup to help with combat
  level.addPowerupSpawn(new THREE.Vector3(2, 1, -125), 'weaponUpgrade');

  // SECTION 4: Curved Path Section
  // -------------------------------
  console.log('Adding curved path section...');

  // Left curve
  level.addSegment({
    type: SegmentType.CURVE_LEFT,
    obstacles: ObstaclePattern.SIDE_BLOCKS,
    lightColor: 0x44ff88, // Teal color
  });

  // Straight segment after curve
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x44ff88, // Teal color
  });

  // Right curve to balance
  level.addSegment({
    type: SegmentType.CURVE_RIGHT,
    obstacles: ObstaclePattern.SIDE_BLOCKS,
    lightColor: 0x44ff88, // Teal color
  });

  // SECTION 5: Advanced Obstacle Course
  // -------------------------------
  console.log('Adding advanced obstacle course...');

  // Custom slalom obstacle course
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.CUSTOM,
    customObstacles: [
      { position: new THREE.Vector3(3, 0, -5), type: 'rock' },
      { position: new THREE.Vector3(-3, 0, -10), type: 'rock' },
      { position: new THREE.Vector3(3, 0, -15), type: 'rock' },
      { position: new THREE.Vector3(-3, 0, -20), type: 'rock' },
    ],
    lightColor: 0xffaa44, // Amber light
  });

  // Narrow path challenge
  level.addSegment({
    type: SegmentType.NARROW_PATH, // Narrower segment type
    obstacles: ObstaclePattern.NARROW_PATH,
    lightColor: 0xaaaaaa, // Grey light for focus
  });

  // Speed boost for the player after the obstacle course
  level.addPowerupSpawn(new THREE.Vector3(0, -1, -210), 'speedBoost');

  // SECTION 6: Mid-Boss Encounter
  // -------------------------------
  console.log('Adding mid-boss encounter...');

  // Wider area for the boss fight
  level.addSegment({
    type: SegmentType.BOSS_ROOM,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff4444, // Red danger light
  });

  // Add stronger enemy
  level.addEnemySpawn(
    new THREE.Vector3(0, 0, -240),
    'fighter' // Stronger enemy type
  );

  // Add supporting enemies
  level.addEnemySpawn(new THREE.Vector3(-3, 1, -245), 'scout');

  level.addEnemySpawn(new THREE.Vector3(3, 1, -245), 'scout');

  // Health pickup to recover after the fight
  level.addPowerupSpawn(new THREE.Vector3(0, 0, -260), 'health');

  // SECTION 7: Final Stretch
  // -------------------------------
  console.log('Adding final stretch...');

  // Series of challenging segments with mixed obstacles
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles:
        i % 2 === 0 ? ObstaclePattern.RANDOM : ObstaclePattern.NARROW_PATH,
      lightColor: 0x8866ff, // Purple light
    });
  }

  // Vertical challenge segment with obstacles at different heights
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.CUSTOM,
    customObstacles: [
      { position: new THREE.Vector3(0, 2, -8), type: 'pipe' },
      { position: new THREE.Vector3(0, -2, -12), type: 'pipe' },
      { position: new THREE.Vector3(2, 0, -16), type: 'crate' },
      { position: new THREE.Vector3(-2, 0, -16), type: 'crate' },
    ],
    lightColor: 0x8866ff, // Purple light
  });

  // SECTION 8: End Segment
  // -------------------------------
  console.log('Adding end segment...');

  // Final end segment with exit portal
  level.addSegment({
    type: SegmentType.END,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x00ffaa, // Bright cyan for exit
  });

  console.log('Example level creation complete!');
  return level;
}
