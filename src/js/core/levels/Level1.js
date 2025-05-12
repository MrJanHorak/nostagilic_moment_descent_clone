// Level 1 - Introduction level
import LevelBlueprint from './LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from './SegmentTypes.js';
import * as THREE from 'three';

export default function createLevel1() {
  const level = new LevelBlueprint(1, 'Cave Introduction', {
    segmentCount: 20,
    difficulty: 1,
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
  for (let i = 0; i < 5; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.RANDOM,
      lightColor: 0x4466aa,
    });
  }

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

  // More challenging section to end the level
  for (let i = 0; i < 7; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.NARROW_PATH,
      lightColor: 0x6644aa,
    });
  }

  // Add predefined enemy spawn points
  level.addEnemySpawn(new THREE.Vector3(0, 0, -50), 'scout');

  level.addEnemySpawn(new THREE.Vector3(2, 1, -100), 'fighter');

  level.addEnemySpawn(new THREE.Vector3(-2, -1, -150), 'scout');

  // Add predefined power-up spawn points
  level.addPowerupSpawn(new THREE.Vector3(-2, 0, -75), 'health');

  level.addPowerupSpawn(new THREE.Vector3(2, 1, -125), 'speedBoost');

  level.addPowerupSpawn(new THREE.Vector3(0, -1, -175), 'weaponUpgrade');

  return level;
}
