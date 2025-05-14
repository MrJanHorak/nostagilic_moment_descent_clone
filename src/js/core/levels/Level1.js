// Level 1 - Introduction level
import LevelBlueprint from './LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from './SegmentTypes.js';
import * as THREE from 'three';

export default function createLevel1() {
  const level = new LevelBlueprint(1, 'Cave Introduction', {
    segmentCount: 20,
    difficulty: 1,
    hasEndSegment: true, // Add proper ending
  });

  // Tutorial section - no obstacles
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.NONE,
      lightColor: 0x4466aa,
    });
  }

  // Simple obstacles to introduce the player to obstacle avoidance
  for (let i = 0; i < 4; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles:
        i < 2 ? ObstaclePattern.SIDE_BLOCKS : ObstaclePattern.CENTER_BLOCK,
      lightColor: 0x4488cc,
    });
  }

  // Introduce more complex obstacle patterns
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.RANDOM,
      lightColor: 0x4466aa,
    });
  }

  // First encounter with scouts
  level.addEnemySpawn(new THREE.Vector3(0, 0, -50), 'scout');
  level.addEnemySpawn(new THREE.Vector3(-2, 1, -55), 'scout');
  
  // Health powerup after first engagement
  level.addPowerupSpawn(new THREE.Vector3(-2, 0, -75), 'health');

  // A segment with custom obstacles
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.CUSTOM,
    customObstacles: [
      { position: new THREE.Vector3(3, 0, -10), type: 'rock' },
      { position: new THREE.Vector3(-3, 0, -10), type: 'rock' },
      { position: new THREE.Vector3(0, 2, -15), type: 'pipe' },
    ],
    lightColor: 0xaa4466,
  });

  // Introduce weapon pickup (laser)
  level.addPowerupSpawn(new THREE.Vector3(0, 1, -90), 'weaponPickup');
  
  // Fighter enemy to test new weapon on
  level.addEnemySpawn(new THREE.Vector3(2, 1, -100), 'fighter');
  
  // Curve section for variety
  level.addSegment({
    type: SegmentType.CURVE_LEFT,
    obstacles: ObstaclePattern.SIDE_BLOCKS,
    lightColor: 0x6644aa,
  });

  // Speed boost pickup
  level.addPowerupSpawn(new THREE.Vector3(2, 1, -125), 'speedBoost');

  // More challenging section to end the level
  for (let i = 0; i < 5; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.NARROW_PATH,
      lightColor: 0x6644aa,
    });
  }

  // Final enemy encounters
  level.addEnemySpawn(new THREE.Vector3(-2, -1, -150), 'scout');
  level.addEnemySpawn(new THREE.Vector3(2, 0, -160), 'fighter');
  
  // Weapon upgrade to help with final fight
  level.addPowerupSpawn(new THREE.Vector3(0, -1, -175), 'weaponUpgrade');

  // End segment with exit
  level.addSegment({
    type: SegmentType.END,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x44ff44, // Green for exit
  });

  return level;
}