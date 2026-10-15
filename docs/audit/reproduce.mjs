// Read-only behavioral probes for the October 14, 2026 assessment.
// These describe the old baseline, not a passing game regression suite.
// Run from the project root: node docs/audit/reproduce.mjs
import * as THREE from 'three';
import Game from '../../src/js/main.js';
import AudioManager from '../../src/js/core/AudioManager.js';
import GameState from '../../src/js/core/GameState.js';
import LevelManager from '../../src/js/core/LevelManager.js';
import Spaceship from '../../src/js/entities/Spaceship.js';
import EnemyManager from '../../src/js/entities/EnemyManager.js';
import ProjectileManager from '../../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../../src/js/entities/PowerUpManager.js';

const results = [];
const probe = (id, run) => {
  try {
    const { reproduced, ...details } = run();
    results.push({ id, outcome: reproduced ? 'defect-reproduced' : 'not-reproduced', ...details });
  } catch (error) {
    results.push({ id, outcome: 'probe-error', error: String(error) });
  }
};
const levelFixture = () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const level = new LevelManager(scene, camera);
  level.wallMaterial = new THREE.MeshLambertMaterial();
  level.floorMaterial = new THREE.MeshLambertMaterial();
  return { scene, camera, level };
};

// Prevent only presentation/lifetime callbacks from escaping this synchronous probe run.
// These probes do not initialize WebGL, audio, DOM, or the continuous game loop.
const originalTimeout = globalThis.setTimeout;
const originalRAF = globalThis.requestAnimationFrame;
const originalLog = console.log;
globalThis.setTimeout = () => 0;
globalThis.requestAnimationFrame = () => 0;
console.log = () => {};
try {
  probe('A01-audio-start-contract', () => {
    const audio = new AudioManager();
    return { reproduced: typeof audio.createSound !== 'function', createSound: typeof audio.createSound };
  });

  probe('A02-powerup-offset', () => {
    const powers = new PowerUpManager(new THREE.Scene(), new THREE.PerspectiveCamera());
    let error;
    try { powers.offsetPowerUps(new THREE.Vector3()); } catch (caught) { error = String(caught); }
    return { reproduced: error?.includes('not iterable') === true, error };
  });

  probe('A03-camera-overwrites-aim', () => {
    const game = new Game();
    game.camera = new THREE.PerspectiveCamera();
    game.spaceship = new Spaceship();
    game.spaceship.attachToCamera(game.camera);
    game.clock = { getDelta: () => 1 / 60 };
    game.camera.rotation.y = Math.PI / 2;
    game.animate();
    const fromYaw = game.camera.quaternion.clone();
    game.camera.rotation.set(0, 0, 0);
    game.animate();
    const difference = fromYaw.angleTo(game.camera.quaternion);
    return { reproduced: difference < 1e-6, differenceRadians: difference, cameraPosition: game.camera.position.toArray() };
  });

  probe('A04-forward-ignores-orientation', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.y = Math.PI / 2;
    const ship = new Spaceship();
    ship.attachToCamera(camera);
    ship.update(0.1, { forward: true });
    return { reproduced: ship.velocity.x === 0 && ship.velocity.z < 0, velocity: ship.velocity.toArray() };
  });

  probe('A05-roll-unused', () => {
    const ship = new Spaceship();
    const before = ship.group.quaternion.clone();
    ship.update(1, { rollRight: true });
    const difference = before.angleTo(ship.group.quaternion);
    return { reproduced: difference === 0, differenceRadians: difference };
  });

  probe('A06-frame-dependent-damping', () => {
    const simulate = (fps) => {
      const ship = new Spaceship();
      ship.velocity.z = -6;
      for (let i = 0; i < fps; i++) ship.update(1 / fps, {});
      return ship.velocity.length();
    };
    const at60Hz = simulate(60), at120Hz = simulate(120);
    return { reproduced: Math.abs(at60Hz - at120Hz) > 0.1, at60Hz, at120Hz };
  });

  probe('A07-enemy-projectile-constructor', () => {
    const audio = new AudioManager();
    const enemies = new EnemyManager(new THREE.Scene(), new THREE.PerspectiveCamera(), new GameState(), audio);
    return {
      reproduced: enemies.projectileManager.camera === audio && enemies.projectileManager.audioManager === undefined,
      cameraIsAudioManager: enemies.projectileManager.camera === audio,
      audioManager: typeof enemies.projectileManager.audioManager,
    };
  });

  probe('A08-double-obstacle-offset', () => {
    const { scene, level } = levelFixture();
    const segment = new THREE.Group();
    scene.add(segment);
    level.segmentMap.set(0, segment);
    level.addCenterObstacle(segment);
    const obstacle = level.obstacles[0].mesh;
    const before = obstacle.getWorldPosition(new THREE.Vector3());
    level.offsetLevel(new THREE.Vector3(1, 0, 0));
    const displacement = obstacle.getWorldPosition(new THREE.Vector3()).sub(before);
    return { reproduced: displacement.x === 2, requestedX: 1, actualWorldX: displacement.x };
  });

  probe('A09-endless-initial-segments-untracked', () => {
    const { scene, level } = levelFixture();
    level.initEndlessLevel();
    const initialSceneGroups = scene.children.length;
    const initialMapSize = level.segmentMap.size;
    level.updateLevel();
    return {
      reproduced: initialMapSize === 0 && scene.children.length > level.levelSegments.length,
      initialSceneGroups, initialMapSize,
      afterUpdateSceneGroups: scene.children.length,
      afterUpdateTrackedGroups: level.levelSegments.length,
    };
  });

  probe('A10-streaming-progress-stationary', () => {
    const { camera, level } = levelFixture();
    level.updateLevel();
    const before = level.lastSegmentIndex;
    level.offsetLevel(new THREE.Vector3(0, 0, 40));
    level.updateLevel();
    return { reproduced: before === level.lastSegmentIndex, before, after: level.lastSegmentIndex, cameraZ: camera.position.z };
  });

  probe('A11-floor-depth-and-wall-center', () => {
    const { level } = levelFixture();
    const segment = level.createTunnelSegment(new THREE.Vector3(), false);
    const [floor, , leftWall] = segment.children;
    return {
      reproduced: floor.geometry.parameters.height !== level.segmentLength && leftWall.position.z !== -level.segmentLength / 2,
      intendedDepth: level.segmentLength,
      actualFloorDepth: floor.geometry.parameters.height,
      intendedWallCenterZ: -level.segmentLength / 2,
      actualWallCenterZ: leftWall.position.z,
    };
  });

  probe('A12-custom-obstacle-space', () => {
    const { scene, level } = levelFixture();
    const segment = new THREE.Group();
    segment.position.z = -200;
    scene.add(segment);
    level.addCustomObstacles(segment, [{ type: 'crate', position: new THREE.Vector3(3, 0, -10) }]);
    const mesh = level.obstacles[0].mesh;
    const worldZ = mesh.getWorldPosition(new THREE.Vector3()).z;
    return { reproduced: worldZ === -10, segmentZ: -200, authoredZ: -10, actualLocalZ: mesh.position.z, actualWorldZ: worldZ };
  });

  probe('A13-authored-powerup-type-lost', () => {
    const { scene, camera, level } = levelFixture();
    level.currentLevel = level.levels[0];
    const spawn = level.currentLevel.powerupSpawns[0];
    camera.position.copy(spawn.position);
    const powers = new PowerUpManager(scene, camera, new GameState(), null, null, level);
    const types = [];
    powers.spawnPowerup = (_position, type) => types.push(type);
    powers.spawnPredefinedPowerUps();
    return { reproduced: types.length > 0 && types.every((type) => type === undefined), authoredType: spawn.powerupType, receivedTypes: types.map(String) };
  });

  probe('A14-completion-repeats', () => {
    let completions = 0;
    const enemies = new EnemyManager(new THREE.Scene(), new THREE.PerspectiveCamera(), { levelCompleted: () => completions++ }, null, { currentLevel: {} });
    enemies.totalPredefinedEnemies = 1;
    enemies.destroyedPredefinedEnemies.add('spawn-1');
    enemies.checkLevelCompletion();
    enemies.checkLevelCompletion();
    return { reproduced: completions === 2, callbacksForOneCompletedLevel: completions };
  });

  probe('A15-projectile-shared-geometry-disposal', () => {
    const projectiles = new ProjectileManager(new THREE.Scene(), new THREE.PerspectiveCamera(), null);
    const first = projectiles.createProjectile(new THREE.Vector3(), new THREE.Quaternion());
    const second = projectiles.createProjectile(new THREE.Vector3(), new THREE.Quaternion());
    let disposals = 0;
    second.mesh.geometry.addEventListener('dispose', () => disposals++);
    const shared = first.mesh.geometry === second.mesh.geometry;
    projectiles.removeProjectile(first);
    return { reproduced: shared && disposals > 0 && projectiles.projectiles.includes(second), shared, disposalsWhileSecondActive: disposals };
  });

  probe('A16-restart-retains-session-state', () => {
    const game = new Game();
    game.camera = new THREE.PerspectiveCamera();
    game.spaceship = new Spaceship();
    game.spaceship.velocity.z = -6;
    game.gameState.isPaused = true;
    game.gameState.weaponPower = 2;
    game.gameState.enemyKills.scout = 5;
    game.levelManager = { clearLevel() {}, initEndlessLevel() {} };
    game.projectileManager = { projectiles: [{ id: 'old-shot' }] };
    game.uiManager = { hudElements: {}, updateHUD() {}, showMessage() {} };
    game.restartGame();
    return {
      reproduced: game.spaceship.velocity.z === -6 && game.gameState.isPaused && game.projectileManager.projectiles.length === 1,
      velocityZ: game.spaceship.velocity.z,
      paused: game.gameState.isPaused,
      oldShots: game.projectileManager.projectiles.length,
      weaponPower: game.gameState.weaponPower,
      oldScoutKills: game.gameState.enemyKills.scout,
    };
  });
} finally {
  console.log = originalLog;
  globalThis.setTimeout = originalTimeout;
  if (originalRAF === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = originalRAF;
}

console.log(JSON.stringify({
  baselineCommit: '7e70489',
  auditDate: '2026-10-14',
  node: process.version,
  warning: 'Defect reproductions, not end-to-end gameplay tests. No game files are modified.',
  results,
}, null, 2));
if (results.some((result) => result.outcome === 'probe-error')) process.exitCode = 1;
