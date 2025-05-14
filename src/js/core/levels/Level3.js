// Level 3 - Final level with boss battle
import LevelBlueprint from './LevelBlueprint.js';
import { SegmentType, ObstaclePattern } from './SegmentTypes.js';
import * as THREE from 'three';

export default function createLevel3() {
  const level = new LevelBlueprint(3, 'Descent to the Core', {
    segmentCount: 30,
    difficulty: 3,
    hasEndSegment: true,
  });

  // Starting area
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.RANDOM,
      lightColor: 0x4488ff,
    });
  }

  // Initial enemies - scouts and fighters
  level.addEnemySpawn(new THREE.Vector3(-2, 1, -40), 'scout');
  level.addEnemySpawn(new THREE.Vector3(2, -1, -45), 'fighter');
  level.addEnemySpawn(new THREE.Vector3(0, 1, -50), 'bomber');
  
  // Weapon pickup for early advantage
  level.addPowerupSpawn(new THREE.Vector3(0, 0, -60), 'weaponPickup');
  
  // Complex pathway with curves
  level.addSegment({
    type: SegmentType.CURVE_RIGHT,
    obstacles: ObstaclePattern.SIDE_BLOCKS,
    lightColor: 0xff6600,
  });
  
  level.addSegment({
    type: SegmentType.STRAIGHT,
    obstacles: ObstaclePattern.CENTER_BLOCK,
    lightColor: 0xff6600,
  });
  
  level.addSegment({
    type: SegmentType.CURVE_LEFT,
    obstacles: ObstaclePattern.RANDOM,
    lightColor: 0xff6600,
  });

  // Mid-level enemies
  level.addEnemySpawn(new THREE.Vector3(0, 2, -80), 'destroyer');
  level.addEnemySpawn(new THREE.Vector3(-2, -1, -85), 'bomber');
  
  // Health and ammo after battle
  level.addPowerupSpawn(new THREE.Vector3(0, 1, -95), 'health');
  level.addPowerupSpawn(new THREE.Vector3(2, 0, -100), 'ammoPickup');
  
  // Challenging narrow pathway
  for (let i = 0; i < 4; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.NARROW_PATH,
      lightColor: 0xaa44ff,
    });
  }
  
  // Junction area with multiple enemies
  level.addSegment({
    type: SegmentType.JUNCTION,
    obstacles: ObstaclePattern.CUSTOM,
    customObstacles: [
      { position: new THREE.Vector3(3, -1, -10), type: 'rock' },
      { position: new THREE.Vector3(-3, -1, -15), type: 'rock' },
    ],
    lightColor: 0xff4444,
  });
  
  // Ambush of mixed enemies
  level.addEnemySpawn(new THREE.Vector3(2, 0, -130), 'fighter');
  level.addEnemySpawn(new THREE.Vector3(0, 2, -135), 'bomber');
  level.addEnemySpawn(new THREE.Vector3(-2, 0, -130), 'fighter');
  level.addEnemySpawn(new THREE.Vector3(0, -2, -140), 'destroyer');
  
  // Weapon upgrade and health before final approach
  level.addPowerupSpawn(new THREE.Vector3(0, 0, -150), 'weaponUpgrade');
  level.addPowerupSpawn(new THREE.Vector3(3, 1, -160), 'health');
  level.addPowerupSpawn(new THREE.Vector3(-3, 1, -165), 'ammoPickup');
  
  // Final approach - warning lighting
  for (let i = 0; i < 3; i++) {
    level.addSegment({
      type: SegmentType.STRAIGHT,
      obstacles: ObstaclePattern.RANDOM,
      lightColor: 0xff2222, // Intense red warning
    });
  }

  // Boss arena
  level.addSegment({
    type: SegmentType.BOSS_ROOM,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0xff0000, // Pure red for danger
  });
  
  // Final boss
  level.addEnemySpawn(new THREE.Vector3(0, 0, -220), 'boss');
  
  // End segment with exit
  level.addSegment({
    type: SegmentType.END,
    obstacles: ObstaclePattern.NONE,
    lightColor: 0x44ff44,
  });

  return level;
}