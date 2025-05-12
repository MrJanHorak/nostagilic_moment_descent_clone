// Level 2 - More advanced level with curved segments and more enemies
import LevelBlueprint from './LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from './SegmentTypes.js';
import * as THREE from 'three';

export default function createLevel2() {
  const level = new LevelBlueprint(2, 'Advanced Cave Network', {
    segmentCount: 25,
    difficulty: 2,
    hasEndSegment: true,
  });

  // Starting section
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.RANDOM,
      lightColor: 0x66aaff,
    });
  }

  // Curve section
  level.addSegment({
    type: SegmentType.CURVE_LEFT,
    obstacles: ObstaclePattern.SIDE_BLOCKS,
    lightColor: 0xff6644,
  });

  level.addSegment({
    type: SegmentType.CURVE_LEFT,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff6644,
  });

  // Complex obstacle patterns
  for (let i = 0; i < 4; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles:
        i % 2 === 0 ? ObstaclePattern.NARROW_PATH : ObstaclePattern.RANDOM,
      lightColor: 0x66ddff,
    });
  }

  // Another curve
  level.addSegment({
    type: SegmentType.CURVE_RIGHT,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff6644,
  });

  level.addSegment({
    type: SegmentType.CURVE_RIGHT,
    obstacles: ObstaclePattern.CENTER_BLOCK,
    lightColor: 0xff6644,
  });

  // A segment with custom obstacles forming a slalom pattern
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

  // Final challenging section
  for (let i = 0; i < 5; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.RANDOM,
      lightColor: 0x44aaff,
    });
  }

  // Boss room at the end
  level.addSegment({
    type: SegmentType.BOSS_ROOM,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff4444,
  });

  // End segment with exit
  level.addSegment({
    type: SegmentType.END,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x44ff44,
  });

  // Add predefined enemy spawn points (more than Level 1)
  level.addEnemySpawn(new THREE.Vector3(0, 0, -40), 'scout');

  level.addEnemySpawn(new THREE.Vector3(2, 1, -80), 'fighter');

  level.addEnemySpawn(new THREE.Vector3(-2, -1, -120), 'scout');

  level.addEnemySpawn(new THREE.Vector3(0, 2, -160), 'fighter');

  level.addEnemySpawn(new THREE.Vector3(-3, 0, -200), 'scout');

  // Boss enemy at the end
  level.addEnemySpawn(
    new THREE.Vector3(0, 0, -240),
    'fighter' // Could be replaced with a boss type
  );

  // Add predefined power-up spawn points
  level.addPowerupSpawn(new THREE.Vector3(-2, 0, -60), 'health');

  level.addPowerupSpawn(new THREE.Vector3(2, 1, -100), 'speedBoost');

  level.addPowerupSpawn(new THREE.Vector3(0, -1, -140), 'weaponUpgrade');

  level.addPowerupSpawn(new THREE.Vector3(-1, 2, -180), 'health');

  return level;
}
