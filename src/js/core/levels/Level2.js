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

  // Introduce basic enemies
  level.addEnemySpawn(new THREE.Vector3(0, 0, -40), 'scout');
  level.addEnemySpawn(new THREE.Vector3(2, 1, -45), 'scout');

  // Missile weapon pickup - great against bombers
  level.addPowerupSpawn(new THREE.Vector3(-2, 0, -60), 'weaponPickup');

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

  // Introduce bomber enemy
  level.addEnemySpawn(new THREE.Vector3(0, 2, -80), 'bomber');

  // Complex obstacle patterns
  for (let i = 0; i < 4; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles:
        i % 2 === 0 ? ObstaclePattern.RANDOM : ObstaclePattern.CENTER_BLOCK,
      lightColor: 0xdd6644,
    });
  }

  // Health pickup after the challenges
  level.addPowerupSpawn(new THREE.Vector3(0, -1, -100), 'health');

  // More bomber enemies
  level.addEnemySpawn(new THREE.Vector3(2, 1, -110), 'fighter');
  level.addEnemySpawn(new THREE.Vector3(-2, -1, -115), 'bomber');

  // Speed boost for evasion
  level.addPowerupSpawn(new THREE.Vector3(2, 1, -130), 'speedBoost');

  // Junction area - wider space for a mini-battle
  level.addSegment({
    type: SegmentType.JUNCTION,
    obstacles: ObstaclePattern.RANDOM,
    lightColor: 0xff4444, // Red warning light
  });

  // Mini-battle with multiple enemies
  level.addEnemySpawn(new THREE.Vector3(0, 2, -140), 'fighter');
  level.addEnemySpawn(new THREE.Vector3(-3, 0, -145), 'bomber');
  level.addEnemySpawn(new THREE.Vector3(3, 0, -145), 'fighter');

  // Plasma weapon pickup - powerful for the upcoming destroyer
  level.addPowerupSpawn(new THREE.Vector3(0, -1, -150), 'weaponPickup');

  // Challenging tunnel section with custom obstacles
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.CUSTOM,
    customObstacles: [
      { position: new THREE.Vector3(2, 1, -5), type: 'pipe' },
      { position: new THREE.Vector3(-2, -1, -10), type: 'rock' },
      { position: new THREE.Vector3(3, 0, -15), type: 'rock' },
      { position: new THREE.Vector3(-3, 0, -20), type: 'rock' },
    ],
    lightColor: 0xffaa44,
  });

  // Final challenging section
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.RANDOM,
      lightColor: 0x44aaff,
    });
  }

  // Extra ammo pickup
  level.addPowerupSpawn(new THREE.Vector3(-1, 2, -180), 'ammoPickup');

  // Health before boss
  level.addPowerupSpawn(new THREE.Vector3(0, 0, -190), 'health');

  // Boss room at the end - destroyer mini-boss
  level.addSegment({
    type: SegmentType.BOSS_ROOM,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff4444,
  });

  // Destroyer enemy as mini-boss
  level.addEnemySpawn(new THREE.Vector3(0, 0, -240), 'destroyer');

  // End segment with exit
  level.addSegment({
    type: SegmentType.END,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x44ff44,
  });

  return level;
}
