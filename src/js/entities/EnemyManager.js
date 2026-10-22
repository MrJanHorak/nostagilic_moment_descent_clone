// Enemy entity module
import * as THREE from 'three';
import { clearEnemies, removeEnemyAt } from './EnemyLifecycle.js';
import { hasLineOfSight, traceShot } from '../utils/combatTrace.js';
import { moveSphere } from '../utils/sphereMovement.js';
import { animateEnemy, getEnemyFiringRange } from './EnemyAnimations.js';
import { enemyTypes } from './EnemyTypes.js';
import EnemyFactory from './EnemyFactory.js';
import ProjectileManager from './ProjectileManager.js';
import EffectsManager from '../effects/EffectsManager.js';
import { PLAYER_RADIUS } from '../core/levels/document/LevelContent.js';
import RoomNavigation from '../core/levels/document/RoomNavigation.js';
import { createFighterAttack, advanceFighterAttack, fighterCommitted, presentFighterAttack } from './FighterAttack.js';
import { createScoutAttack, updateScoutAttack } from './ScoutAttack.js';
import updateFighterMovement from './FighterMovement.js';
import { MINE_FIGHTER, mineSpeed, mineHealth } from './EnemyTactics.js';
import { MINE_SALVAGE } from './EnemySalvage.js';

/** @typedef {{lastSeen: THREE.Vector3 | null, goalRoom: string | null | undefined,
 * route: THREE.Vector3[] | null, waypoint: number, revision: number, tactical: boolean, nextAlertAt: number}} MinePursuit */

class EnemyManager {
  /** @param {THREE.Scene} scene
   * @param {THREE.Object3D} playerTransform
   * @param {import('../core/GameState.js').default} gameState
   * @param {import('../combatContracts.js').CombatAudio | null} audioManager
   * @param {import('../combatContracts.js').EnemyLevelView | null} [levelManager] */
  constructor(scene, playerTransform, gameState, audioManager, levelManager = null) {
    this.scene = scene;
    this.playerTransform = playerTransform;
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.levelManager = levelManager;

    // Initialize supporting systems
    this.enemyFactory = new EnemyFactory(scene);
    this.projectileManager = new ProjectileManager(scene, playerTransform, audioManager, gameState.session);
    this.projectileManager.setCombatWorld({ getColliders: () => this.levelManager?.solidColliders ?? [] });
    this.effectsManager = new EffectsManager(scene, gameState.session);
    this.clearing = false;
    this.generation = 0;

    // Enemy tracking
    /** @type {import('../combatContracts.js').EnemyInstance[]} */
    this.enemies = [];
    /** @type {readonly THREE.Object3D[]} */
    this.levelSegments = [];
    /** @type {Set<string>} */
    this.destroyedPredefinedEnemies = new Set();
    // Small authored mines stay resident. Cleanup never recreates a wounded body.
    /** @type {Set<string>} */
    this.instantiatedMineEnemies = new Set();
    /** @type {RoomNavigation | null} */
    this.mineNavigation = null;
    /** @type {Map<import('../combatContracts.js').EnemyInstance, MinePursuit>} */
    this.minePursuits = new Map();
    this.totalPredefinedEnemies = 0;
    this.levelComplete = false;
    /** @type {import('../combatContracts.js').EnemyDropSink | null} */
    this.powerUpManager = null;
    /** @type {((id: string, cause: import('../contracts.js').DefeatCause) => void) | null} */
    this.onEnemyDefeated = null;

    // Tunnel properties (used for spawning calculations)
    this.tunnelWidth = levelManager ? levelManager.tunnelWidth : 15;
    this.tunnelHeight = levelManager ? levelManager.tunnelHeight : 12;

    // For endless mode
    this.lastRandomSpawnTime = 0;
    this.randomSpawnInterval = 5000; // 5 seconds between spawns in endless mode
  }

  /** @param {readonly THREE.Object3D[]} segments */
  setLevelSegments(segments) {
    this.levelSegments = segments;
  }

  /** @param {import('../combatContracts.js').EnemyShooter} enemy */
  canSeePlayer(enemy) {
    return hasLineOfSight(enemy.mesh.position, this.playerTransform.position, this.levelManager?.solidColliders);
  }

  /** @param {import('../combatContracts.js').EnemyInstance} enemy
   * @param {number} delta @param {boolean} visible */
  updateArenaEnemy(enemy, delta, visible) {
    const direction = this.playerTransform.position.clone().sub(enemy.mesh.position);
    const committed = fighterCommitted(enemy);
    const pursue = !committed && visible && direction.length() < 30 && (enemy.type.name === 'scout' || direction.length() > 8);
    // Legacy type speeds are units/frame at 60 Hz. Keep stored velocity in that convention.
    const desired = pursue ? direction.normalize().multiplyScalar(enemy.type.speed) : new THREE.Vector3();
    if (!visible || committed) enemy.velocity.set(0, 0, 0); // No tracking through opaque walls; brace during an attack.
    else enemy.velocity.lerp(desired, 1 - Math.pow(0.95, delta * 60));
    const worldVelocity = enemy.velocity.clone().multiplyScalar(60);
    moveSphere(enemy.mesh.position, worldVelocity, delta, this.levelManager?.solidColliders ?? [], enemy.collisionRadius);
    enemy.velocity.copy(worldVelocity).divideScalar(60);
    animateEnemy(enemy, delta, this.gameState.session.timeMs / 1000);
    if (visible) enemy.mesh.lookAt(this.playerTransform.position);
  }

  /** @private @param {import('../combatContracts.js').EnemyInstance} enemy */
  minePursuit(enemy) {
    let pursuit = this.minePursuits.get(enemy);
    if (!pursuit) {
      pursuit = { lastSeen: null, goalRoom: undefined, route: null, waypoint: 0, revision: -1, tactical: false, nextAlertAt: 0 };
      this.minePursuits.set(enemy, pursuit);
    }
    return pursuit;
  }

  /** Share an actually observed position with at most four nearby allies in the
   * same/adjacent open room. Reports are bounded and never refresh from an unseen
   * player's movement. Recipients still route through physical, body-clear portals.
   * @private @param {import('../combatContracts.js').EnemyInstance} reporter @param {MinePursuit} pursuit */
  reportMineSighting(reporter, pursuit) {
    const navigation = this.mineNavigation, document = this.levelManager?.currentLevel?.sourceDocument;
    const now = this.gameState.session.timeMs;
    if (!navigation || !document || !pursuit.lastSeen || now < pursuit.nextAlertAt) return;
    pursuit.nextAlertAt = now + 1200;
    const room = navigation.roomAt(reporter.mesh.position), nearby = new Set([room]);
    for (const connection of document.connections) {
      if (this.levelManager?.interaction?.closedConnections.has(connection.id)) continue;
      if (connection.a.roomId === room) nearby.add(connection.b.roomId);
      if (connection.b.roomId === room) nearby.add(connection.a.roomId);
    }
    let notified = 0;
    for (const ally of this.enemies) {
      if (ally === reporter || !ally.isActive || ally.mesh.position.distanceToSquared(reporter.mesh.position) > 24 * 24 ||
          !nearby.has(navigation.roomAt(ally.mesh.position))) continue;
      const memory = this.minePursuit(ally);
      if (memory.lastSeen) memory.lastSeen.copy(pursuit.lastSeen);
      else memory.lastSeen = pursuit.lastSeen.clone();
      if (++notified === 4) break;
    }
  }

  /** Sight, nearby reports and incoming damage provide memory; hidden movement does not.
   * @param {import('../combatContracts.js').EnemyInstance} enemy
   * @param {number} delta @param {boolean} visible */
  updateMineEnemy(enemy, delta, visible) {
    const navigation = this.mineNavigation;
    if (!navigation) return;
    const pursuit = this.minePursuit(enemy);
    const distance = enemy.mesh.position.distanceTo(this.playerTransform.position);
    const enemyRoom = enemy.type.name === 'fighter' && visible ? navigation.roomAt(enemy.mesh.position) : null;
    const tactical = enemyRoom !== null && distance < getEnemyFiringRange('fighter') && enemyRoom === navigation.roomAt(this.playerTransform.position);
    // A local dodge leaves the old route's starting waypoint behind. Rebuild
    // once on returning to navigation, rather than backtracking or replanning every frame.
    if (pursuit.tactical && !tactical) pursuit.goalRoom = undefined;
    pursuit.tactical = tactical;
    if (visible && distance < 30) {
      if (pursuit.lastSeen) pursuit.lastSeen.copy(this.playerTransform.position);
      else pursuit.lastSeen = this.playerTransform.position.clone();
      this.reportMineSighting(enemy, pursuit);
    }
    if (pursuit.lastSeen) {
      const goalRoom = navigation.roomAt(pursuit.lastSeen);
      const revision = this.levelManager?.interaction?.revision ?? 0;
      if (goalRoom !== pursuit.goalRoom || pursuit.revision !== revision) {
        pursuit.route = navigation.route(enemy.mesh.position, pursuit.lastSeen, enemy.collisionRadius, this.levelManager?.interaction?.closedConnections);
        pursuit.waypoint = 0; pursuit.goalRoom = goalRoom; pursuit.revision = revision;
      }
      const route = pursuit.route;
      if (route) {
        const destination = navigation.destination(pursuit.lastSeen, enemy.collisionRadius);
        if (destination) route[route.length - 1].copy(destination);
        // Only discard reached points. Both sides of a frame must be traversed.
        while (pursuit.waypoint < route.length - 1 && enemy.mesh.position.distanceTo(route[pursuit.waypoint]) < 0.04) pursuit.waypoint++;
        // A player can hover in an open doorway, outside the inset room box.
        // Finish that approach only when the whole body can traverse the segment.
        if (pursuit.waypoint === route.length - 1 && !traceShot(enemy.mesh.position, pursuit.lastSeen, {
          colliders: this.levelManager?.solidColliders ?? [], radius: enemy.collisionRadius,
        })) route[route.length - 1].copy(pursuit.lastSeen);
      }
    }
    const target = pursuit.route?.[pursuit.waypoint];
    enemy.velocity.set(0, 0, 0);
    const holdRange = fighterCommitted(enemy) || visible && distance < 8 && enemy.type.name !== 'scout';
    if (tactical) updateFighterMovement(enemy, this.playerTransform.position, this.levelManager?.solidColliders ?? [], navigation, this.gameState.session.timeMs, delta, true);
    else if (target && !holdRange && delta > 0) {
      const travel = target.clone().sub(enemy.mesh.position);
      const speed = Math.min(mineSpeed(enemy), travel.length() / delta);
      const velocity = travel.normalize().multiplyScalar(speed);
      moveSphere(enemy.mesh.position, velocity, delta, this.levelManager?.solidColliders ?? [], enemy.collisionRadius);
      enemy.velocity.copy(velocity).divideScalar(60);
    }
    animateEnemy(enemy, delta, this.gameState.session.timeMs / 1000);
    if (visible) enemy.mesh.lookAt(this.playerTransform.position);
    else if (target && target.distanceToSquared(enemy.mesh.position) > 1e-6) enemy.mesh.lookAt(target);
  }

  /** @param {import('../combatContracts.js').EnemyCombatTarget} enemy
   * @param {Pick<import('../combatContracts.js').PlayerProjectile, 'power'>} projectile
   * @param {THREE.Vector3} position */
  hitEnemy(enemy, projectile, position) {
    const index = this.enemies.findIndex(candidate => candidate === enemy);
    if (index === -1 || !enemy.isActive || enemy.health <= 0 || this.gameState.session.phase !== 'playing') return;
    const resistance = enemy.type.name === 'boss' ? 0.7 : enemy.type.name === 'destroyer' ? 0.8 : 1;
    enemy.health -= projectile.power * resistance;
    if (this.mineNavigation) this.minePursuit(this.enemies[index]).lastSeen = this.playerTransform.position.clone();
    this.effectsManager.createHitEffect(position.clone());
    if (this.audioManager?.initialized) {
      try { this.audioManager.playSound('hit', { volume: 0.3 }); }
      catch (error) { console.warn('Unable to play hit sound:', error); }
    }
    if (enemy.health > 0 || !enemy.isActive || !this.enemies.some(candidate => candidate === enemy)) return;
    this.gameState.score += enemy.type.pointValue;
    this.gameState.recordEnemyKill?.(enemy.type.name);
    this.destroyEnemy(this.enemies.findIndex(candidate => candidate === enemy));
  }

  // Spawn enemy at a position
  /** @param {THREE.Vector3} position @param {import('../contracts.js').EnemyType | null} [typeName] */
  spawnEnemy(position, typeName = null) {
    if (this.clearing) throw new Error('EnemyManager is clearing');
    const generation = this.generation, sessionId = this.gameState.session.id;
    // If no specific type requested, choose randomly
    const enemyType = typeName
      ? enemyTypes.find((t) => t.name === typeName)
      : enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    if (!enemyType) throw new RangeError(`Unknown enemy type: ${typeName}`);

    // Use the factory to create the enemy
    const authored = !!this.levelManager?.currentLevel?.sourceDocument;
    const enemy = this.enemyFactory.createEnemy(
      authored ? { ...enemyType, health: mineHealth(enemyType) } : enemyType,
      position,
      this.playerTransform,
      { accentLights: this.levelManager?.currentLevel?.rendering?.enemyAccentLights ?? true }
    );
    if (!this.isCurrent(generation, sessionId)) {
      removeEnemyAt([enemy], 0);
      throw new Error('Enemy spawn was cancelled by a reset');
    }

    this.enemies.push(enemy);
    enemy.lastFireTime = this.gameState.session?.timeMs ?? 0;
    if (enemy.type.name === 'fighter') {
      if (authored) enemy.fireRate = MINE_FIGHTER.intervalMs;
      enemy.fighterAttack = createFighterAttack(enemy.lastFireTime,
        authored ? MINE_FIGHTER.windupMs + MINE_FIGHTER.firstReactionMs : enemy.fireRate,
        authored ? MINE_FIGHTER : undefined);
    }
    if (enemy.type.name === 'scout') enemy.scoutAttack = createScoutAttack(enemy.lastFireTime, authored);
    return enemy;
  }

  // Spawn enemies in the tunnel segments
  /** @param {number} segmentLength */
  spawnEnemiesInTunnel(segmentLength) {
    // Only consider segments beyond the first one to avoid enemies too close to player start
    const validSegments = this.levelSegments.slice(1);

    // Choose a random segment
    if (validSegments.length === 0) return;

    // Choose a random segment closer to the player (between 20-60% of the way through the tunnel)
    const segmentIndex =
      Math.floor(validSegments.length * 0.2) +
      Math.floor(Math.random() * (validSegments.length * 0.4));

    if (!validSegments[segmentIndex]) return;

    let segment = validSegments[segmentIndex];

    // Check if this segment is suitable for spawning
    // Avoid spawning in curve segments as they cause position calculation issues
    const isCurved =
      segment.userData &&
      segment.userData.type &&
      (segment.userData.type === 'curveLeft' ||
        segment.userData.type === 'curveRight');

    // If the segment is curved, try to find a better segment
    if (isCurved) {
      // Try segments before or after this one
      const trySegments = [];
      if (validSegments[segmentIndex - 1])
        trySegments.push(validSegments[segmentIndex - 1]);
      if (validSegments[segmentIndex + 1])
        trySegments.push(validSegments[segmentIndex + 1]);

      // If we have alternatives, pick one randomly
      if (trySegments.length > 0) {
        const altSegment =
          trySegments[Math.floor(Math.random() * trySegments.length)];
        if (altSegment) segment = altSegment;
      }
    }

    // Get segment dimensions from children more reliably
    let segmentWidth = 8; // More conservative default width
    let segmentHeight = 8; // More conservative default height

    // Find floor and ceiling more reliably
    const floor = segment.children.find(
      (child) =>
        child.position.y < 0 &&
        child.rotation.x < 0 && // Floor typically has negative x rotation
        child instanceof THREE.Mesh
    );

    const ceiling = segment.children.find(
      (child) =>
        child.position.y > 0 &&
        child.rotation.x > 0 && // Ceiling typically has positive x rotation
        child instanceof THREE.Mesh
    );

    // Get actual dimensions from geometry if possible
    if (floor instanceof THREE.Mesh && (floor.geometry instanceof THREE.PlaneGeometry || floor.geometry instanceof THREE.BoxGeometry)) {
      segmentWidth = floor.geometry.parameters.width * 0.7; // More conservative width (70%)
    }

    if (floor && ceiling) {
      segmentHeight = Math.abs(ceiling.position.y - floor.position.y) * 0.6; // More conservative height (60%)
    }

    // Use more conservative position bounds within the segment
    const x = (Math.random() - 0.5) * segmentWidth * 0.8;
    const y = (Math.random() - 0.5) * segmentHeight * 0.8;

    // Position along the segment length (avoid edges)
    const z = -segmentLength * (Math.random() * 0.6 + 0.2); // Position between 20% and 80% through segment

    // Convert local coordinates to world coordinates
    // Apply the segment's world matrix to get the correct position
    segment.updateMatrixWorld(true); // Ensure matrix is up to date
    const spawnPosition = new THREE.Vector3(x, y, z).applyMatrix4(
      segment.matrixWorld
    );

    // Verify position is inside level bounds - perform raycasting check
    const tooCloseToWall = this.isPositionTooCloseToWalls(
      spawnPosition,
      segment
    );
    if (tooCloseToWall) {
      // If too close to wall, try again with more conservative positioning
      // Move towards center of tunnel
      spawnPosition.x *= 0.5;
      spawnPosition.y *= 0.5;
    }

    // Choose an enemy type appropriate for the current game progress
    const enemyTypesForCurrentProgress = this.getEnemyTypesForCurrentProgress();
    const enemyType =
      enemyTypesForCurrentProgress[
        Math.floor(Math.random() * enemyTypesForCurrentProgress.length)
      ];

    // Create and return the enemy
    const enemy = this.spawnEnemy(spawnPosition, enemyType.name);

    // Store reference to originating segment
    if (enemy && enemy.mesh) {
      enemy.mesh.userData.originSegment = segment.id;
    }

    return enemy;
  }

  // Helper method to check if a position is too close to walls
  /** @param {THREE.Vector3} position @param {THREE.Object3D} segment */
  isPositionTooCloseToWalls(position, segment) {
    // Simple distance check from segment center
    const horizontalDistance = Math.sqrt(
      Math.pow(position.x - segment.position.x, 2) +
        Math.pow(position.z - segment.position.z, 2)
    );

    // If more than 80% of the way to the edge, consider it too close
    return horizontalDistance > this.tunnelWidth * 0.4;
  }

  // Get appropriate enemy types based on current game progress
  getEnemyTypesForCurrentProgress() {
    // By default return all enemy types except boss
    return enemyTypes.filter((type) => type.name !== 'boss');
  }

  // Spawn predefined enemies from level blueprint
  spawnPredefinedEnemies() {
    if (!this.levelManager || !this.levelManager.currentLevel) return;

    const level = this.levelManager.currentLevel;
    const generation = this.generation, sessionId = this.gameState.session.id;
    const persistent = level.kind === 'arena' && !!level.sourceDocument;
    if (persistent && level.sourceDocument && !this.mineNavigation) this.mineNavigation = new RoomNavigation(level.sourceDocument);

    // Set total enemies count once (first time we load the level)
    if (this.totalPredefinedEnemies === 0 && level.enemySpawns) {
      this.totalPredefinedEnemies = level.enemySpawns.length;
      // Update UI with enemy count
      if (this.gameState && this.gameState.uiManager) {
        this.gameState.uiManager.updateEnemyCount?.(
          this.destroyedPredefinedEnemies.size,
          this.totalPredefinedEnemies
        );
      }
    }

    for (const [index, spawnPoint] of level.enemySpawns.entries()) {
      if (!this.isCurrent(generation, sessionId) || this.levelManager.currentLevel !== level) return;
      // Generate a unique ID for this spawn point
      const spawnPointId = spawnPoint.id ?? `enemy:${index}`;

      // Skip if this enemy was permanently destroyed
      if (this.destroyedPredefinedEnemies.has(spawnPointId) || (persistent && this.instantiatedMineEnemies.has(spawnPointId))) {
        continue;
      }

      // Check if enemy should be visible now (based on player position)
      const distanceToPlayer = spawnPoint.position.distanceTo(
        this.playerTransform.position
      );

      // Only spawn if within reasonable distance and not already spawned
      if (persistent || (distanceToPlayer < 50 && distanceToPlayer > 5)) {
        // Check if this enemy is already spawned
        const alreadySpawned = this.enemies.some((enemy) => {
          return enemy.mesh.userData.spawnPointId === spawnPointId;
        });

        if (!alreadySpawned) {
          // Use the proper spawnEnemy method to create fully initialized enemy
          const enemy = this.spawnEnemy(
            spawnPoint.position,
            spawnPoint.enemyType
          );

          if (enemy && enemy.mesh) {
            // Mark it as a predefined spawn
            enemy.mesh.userData.isPredefined = true;
            enemy.mesh.userData.spawnPointId = spawnPointId;
            enemy.mesh.userData.spawnPosition = spawnPoint.position.clone();
            if (persistent) this.instantiatedMineEnemies.add(spawnPointId);
          }
        }
      }
    }

    // Check win condition - all predefined enemies destroyed
    this.checkLevelCompletion();
  }

  // Check if all enemies in the level are destroyed
  checkLevelCompletion() {
    if (this.levelManager?.currentLevel?.mission) return; // Extraction owns mission completion.
    if (
      !this.levelComplete &&
      this.gameState.session?.phase === 'playing' &&
      !this.levelManager?.isEndless &&
      this.levelManager &&
      this.levelManager.currentLevel &&
      this.destroyedPredefinedEnemies.size >= this.totalPredefinedEnemies &&
      this.totalPredefinedEnemies > 0
    ) {
      this.levelComplete = true;

      // Notify game state that level is complete
      if (this.gameState && this.gameState.levelCompleted) {
        this.gameState.levelCompleted();
      }
    }
  }

  // Add method to handle enemy spawning for endless mode
  /** @param {number} currentTime */
  updateEndlessMode(currentTime) {
    // Check if it's time to spawn a new enemy
    if (currentTime - this.lastRandomSpawnTime > this.randomSpawnInterval) {
      this.spawnEnemiesInTunnel(20); // Use a default segment length
      this.lastRandomSpawnTime = currentTime;

      // Gradually decrease spawn interval for increasing difficulty
      // Minimum 1 second between spawns
      this.randomSpawnInterval = Math.max(1000, this.randomSpawnInterval - 50);
    }
  }

  // Reset enemies for new level with defensive checks
  resetLevel() {
    if (this.clearing) return;
    this.clearing = true;
    this.generation++;
    try {
      this.minePursuits.clear();
      this.mineNavigation = null;
      this.instantiatedMineEnemies.clear();
      clearEnemies(this.enemies);
      this.projectileManager.clear();
      this.effectsManager.clear();
      this.destroyedPredefinedEnemies.clear();
      this.totalPredefinedEnemies = 0;
      this.levelComplete = false;
      this.levelSegments = [];
      this.lastRandomSpawnTime = 0;
      this.randomSpawnInterval = 5000;
    } finally {
      this.clearing = false;
    }
  }

  // Enemy update function
  /** @param {number} delta */
  updateEnemies(delta) {
    if (this.gameState.session?.phase !== 'playing') return;
    const generation = this.generation, sessionId = this.gameState.session.id;
    // Update effects first
    this.effectsManager.update(delta);
    if (!this.isCurrent(generation, sessionId) || this.gameState.session.phase !== 'playing') return;

    // Check if level has predefined enemies or if we should use endless mode
    const currentTime = this.gameState.session.timeMs;
    if (this.levelManager && this.levelManager.isEndless) {
      this.updateEndlessMode(currentTime);
    } else {
      this.spawnPredefinedEnemies();
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.isCurrent(generation, sessionId) || this.gameState.session.phase !== 'playing') return;
      const enemy = this.enemies[i];
      if (!enemy.isActive) continue;
      const arena = !this.levelManager?.isEndless && this.levelManager?.currentLevel?.kind === 'arena';
      const visible = this.canSeePlayer(enemy);

      // Update enemy position
      const distanceToPlayer = enemy.mesh.position.distanceTo(
        this.playerTransform.position
      );

      // Apply enemy type-specific movement
      const scout = enemy.type.name === 'scout' ? updateScoutAttack(enemy, this.playerTransform.position, PLAYER_RADIUS,
        this.levelManager?.solidColliders ?? [], currentTime, delta, visible) : null;
      if (scout?.warning && this.audioManager?.initialized) {
        try { this.audioManager.playSound('enemyCharge', { volume: 0.18 }); }
        catch (error) { console.warn('Unable to play scout warning:', error); }
      }
      if (!this.isCurrent(generation, sessionId) || this.gameState.session.phase !== 'playing') return;
      if (scout?.hit) this.gameState.takeDamage(enemy.type.damage);
      if (!this.isCurrent(generation, sessionId) || this.gameState.session.phase !== 'playing') return;
      if (scout?.handled) { /* Movement and aim belong to the committed strike. */ }
      else if (arena && this.mineNavigation) this.updateMineEnemy(enemy, delta, visible);
      else if (arena) this.updateArenaEnemy(enemy, delta, visible);
      else if (distanceToPlayer < 30) {
        // Get direction to player
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.playerTransform.position, enemy.mesh.position)
          .normalize();

        // Apply movement patterns based on enemy type
        let movementSpeed = fighterCommitted(enemy) ? 0 : enemy.type.speed;
        if (fighterCommitted(enemy)) enemy.velocity.set(0, 0, 0);

        // Apply behavior modifications based on enemy type
        switch (enemy.type.name) {
          case 'boss': {
            // Boss moves more deliberately with minimal randomness
            direction.x += (Math.random() - 0.5) * 0.05;
            direction.y += (Math.random() - 0.5) * 0.05;
            direction.z += (Math.random() - 0.5) * 0.05;

            // Boss tries to maintain a certain distance from player
            const optimalDistance = 15;
            const distanceAdjustment =
              (distanceToPlayer - optimalDistance) * 0.02;
            movementSpeed *= Math.max(0, Math.min(1.5, distanceAdjustment));
            break;
          }

          case 'bomber':
            // Bombers tend to move to positions above the player to drop bombs
            direction.y += 0.1; // Slight upward bias
            direction.x += (Math.random() - 0.5) * 0.3;
            direction.z += (Math.random() - 0.5) * 0.1;
            break;

          case 'destroyer': {
            // Destroyers move more deliberately with less randomness
            direction.x += (Math.random() - 0.5) * 0.1;
            direction.y += (Math.random() - 0.5) * 0.1;
            direction.z += (Math.random() - 0.5) * 0.1;

            // Destroyers also prefer a certain engagement distance
            const destroyerOptimalDistance = 10;
            const destroyerDistAdj =
              (distanceToPlayer - destroyerOptimalDistance) * 0.01;
            movementSpeed *= Math.max(0, Math.min(1.2, destroyerDistAdj));
            break;
          }

          default:
            // Default for scouts and fighters - more erratic movement
            direction.x += (Math.random() - 0.5) * 0.2;
            direction.y += (Math.random() - 0.5) * 0.2;
            direction.z += (Math.random() - 0.5) * 0.2;
        }

        // Update velocity with smoothing - different smoothing per enemy type
        let smoothingFactor = 0.05;
        if (enemy.type.name === 'boss') smoothingFactor = 0.02;
        else if (enemy.type.name === 'destroyer') smoothingFactor = 0.03;

        enemy.velocity.lerp(
          direction.multiplyScalar(movementSpeed),
          smoothingFactor
        );

        // Apply velocity
        enemy.mesh.position.add(enemy.velocity);

        // Make enemy face the player
        enemy.mesh.lookAt(this.playerTransform.position);

        // Apply animations to enemy mesh based on its type
        animateEnemy(enemy, delta, currentTime / 1000);
      }

      // Update enemy collider
      enemy.mesh.updateMatrixWorld(true);
      enemy.collider.setFromObject(enemy.mesh);

      // Check collision with player
      const collisionDistance = arena ? enemy.collisionRadius + PLAYER_RADIUS : enemy.type.size * 2;
      if (enemy.type.name !== 'scout' && !this.gameState.isGameOver && visible && enemy.mesh.position.distanceTo(this.playerTransform.position) < collisionDistance) {
        // Player takes damage
        this.gameState.takeDamage(enemy.type.damage);
        if (!this.isCurrent(generation, sessionId)) return;

        // Destroy the enemy
        this.destroyEnemy(this.enemies.indexOf(enemy), 'ram');
        continue;
      }

      // Check distance - if enemy is too far behind player, remove it
      if (distanceToPlayer > 50 && !this.mineNavigation) {
        this.removeEnemy(i);
        continue;
      }

      if (!enemy.isActive || this.gameState.session.phase !== 'playing') continue;
      if (enemy.type.name === 'fighter') {
        this.updateFighterAttack(enemy, currentTime);
        if (!this.isCurrent(generation, sessionId) || this.gameState.session.phase !== 'playing') return;
        continue;
      }
      // Handle enemy firing projectiles
      if (
        enemy.type.name !== 'scout' &&
        currentTime - enemy.lastFireTime > enemy.fireRate
      ) {
        // Check the enemy's facing, independent of the player's viewing direction.
        const firingRange = getEnemyFiringRange(enemy.type.name);

        const inFrontOf =
          enemy.mesh
            .getWorldDirection(new THREE.Vector3())
            .dot(
              new THREE.Vector3()
                .subVectors(this.playerTransform.position, enemy.mesh.position)
                .normalize()
            ) > 0;

        if (distanceToPlayer < firingRange && inFrontOf && this.canSeePlayer(enemy)) {
          this.projectileManager.fireEnemyProjectile(enemy, this.playerTransform);
          enemy.lastFireTime = currentTime;

          // Set next fire rate based on enemy type
          if (enemy.type.name === 'bomber') {
            // Bombers fire slower but with more powerful explosives
            enemy.fireRate = 3000 + Math.random() * 1000;
          } else if (enemy.type.name === 'destroyer') {
            // Destroyers fire at medium rate with accurate shots
            enemy.fireRate = 2000 + Math.random() * 1000;
          } else if (enemy.type.name === 'boss') {
            // Boss fires faster and more frequently
            enemy.fireRate = 800 + Math.random() * 700;

            // Boss occasionally fires from multiple weapons at once
            if (Math.random() < 0.3) {
              this.gameState.session.schedule(200, () => {
                if (enemy.isActive && enemy.mesh.parent && this.canSeePlayer(enemy)) {
                  this.projectileManager.fireEnemyProjectile(
                    enemy,
                    this.playerTransform
                  );
                }
              });

              if (Math.random() < 0.2) {
                this.gameState.session.schedule(400, () => {
                  if (enemy.isActive && enemy.mesh.parent && this.canSeePlayer(enemy)) {
                    this.projectileManager.fireEnemyProjectile(
                      enemy,
                      this.playerTransform
                    );
                  }
                });
              }
            }
          } else {
            // Default fire rate for others
            enemy.fireRate = 2000 + Math.random() * 1000;
          }
        }
      }
    }

    // Update enemy projectiles
    if (!this.isCurrent(generation, sessionId)) return;
    this.projectileManager.updateProjectiles(
      delta,
      this.playerTransform,
      this.gameState,
      this.effectsManager
    );
  }

  /** @param {import('../combatContracts.js').EnemyInstance} enemy @param {number} now */
  updateFighterAttack(enemy, now) {
    enemy.fighterAttack ??= createFighterAttack(now, enemy.fireRate);
    const direction = this.playerTransform.position.clone().sub(enemy.mesh.position), distance = direction.length();
    const eligible = distance < getEnemyFiringRange('fighter') && this.canSeePlayer(enemy)
      && enemy.mesh.getWorldDirection(new THREE.Vector3()).dot(direction.normalize()) > 0;
    const event = advanceFighterAttack(enemy.fighterAttack, now, eligible, enemy.fireRate);
    presentFighterAttack(enemy, now); enemy.mesh.updateMatrixWorld(true); enemy.collider.setFromObject(enemy.mesh);
    if (event === 'charge' && this.audioManager?.initialized) {
      try { this.audioManager.playSound('enemyCharge', { volume: 0.22 * Math.max(0.25, 1 - distance / 30) }); }
      catch (error) { console.warn('Unable to play enemy warning:', error); }
    } else if (event === 'fire') {
      const authored = !!this.levelManager?.currentLevel?.sourceDocument;
      enemy.lastFireTime = now;
      enemy.fireRate = authored ? MINE_FIGHTER.intervalMs + Math.random() * MINE_FIGHTER.intervalVariationMs : 2000 + Math.random() * 1000;
      this.projectileManager.fireEnemyProjectile(enemy, this.playerTransform,
        authored ? { speed: MINE_FIGHTER.projectileSpeed, inaccuracy: MINE_FIGHTER.inaccuracy } : undefined);
    }
  }

  /** @private @param {number} generation @param {number} sessionId */
  isCurrent(generation, sessionId) {
    return this.generation === generation && this.gameState.session.id === sessionId;
  }

  /** @param {number} index */
  removeEnemy(index) {
    const enemy = this.enemies[index];
    if (enemy) this.minePursuits.delete(enemy);
    return removeEnemyAt(this.enemies, index);
  }

  /** @param {number} index @param {import('../contracts.js').DefeatCause} [cause] */
  destroyEnemy(index, cause = 'shot') {
    const enemy = this.enemies[index];
    if (!enemy?.isActive) return false;
    const generation = this.generation;
    const sessionId = this.gameState.session.id;
    const spawnId = enemy.mesh.userData.isPredefined ? enemy.mesh.userData.spawnPointId : null;
    // Cleanup hooks, effects and audio must observe an already removed enemy.
    this.removeEnemy(index);
    if (!this.isCurrent(generation, sessionId)) return true;
    // Ownership is retired before drop creation can call back into combat.
    if (cause === 'shot' && this.gameState.session.phase === 'playing') {
      if (this.levelManager?.currentLevel?.sourceDocument) {
        this.powerUpManager?.spawnPowerup(enemy.mesh.position.clone(), MINE_SALVAGE[enemy.type.name], { persistent: true });
      } else if (this.levelManager?.currentLevel?.kind !== 'arena') this.spawnEnemyDrop(enemy.mesh.position.clone(), enemy.type.name);
    }
    if (!this.isCurrent(generation, sessionId)) return true;
    if (spawnId) this.destroyedPredefinedEnemies.add(spawnId);
    this.effectsManager.createExplosion(enemy.mesh.position.clone(), 0xff9500, true);
    if (!this.isCurrent(generation, sessionId)) return true;
    if (this.audioManager?.initialized) {
      const distance = this.playerTransform?.position.distanceTo(enemy.mesh.position) ?? 20;
      const volume = Math.min(0.8, 10 / Math.max(1, distance));
      try { this.audioManager.playSound('explosion', { volume }); }
      catch (error) { console.warn('Unable to play explosion sound:', error); }
    }
    if (!this.isCurrent(generation, sessionId)) return true;
    // One disposal path for shot deaths, ramming and ordinary teardown.
    // Only combat destruction below emits objective progress; removeEnemy never does.
    if (spawnId) {
      this.onEnemyDefeated?.(spawnId, cause);
      if (!this.isCurrent(generation, sessionId)) return true;
      this.gameState.uiManager?.updateEnemyCount?.(this.destroyedPredefinedEnemies.size, this.totalPredefinedEnemies);
      this.checkLevelCompletion();
    }
    return true;
  }

  // Spawn item drops when enemies are destroyed
  /** @param {THREE.Vector3} position @param {import('../contracts.js').EnemyType} enemyType */
  spawnEnemyDrop(position, enemyType) {
    // Check if PowerUpManager exists
    if (!this.powerUpManager) return;

    // Different drop chances based on enemy type
    let dropChance;
    let weaponDropChance;

    switch (enemyType) {
      case 'scout':
        dropChance = 0.2; // 20% chance to drop something
        weaponDropChance = 0.2; // 20% of drops are weapons (4% overall)
        break;
      case 'fighter':
        dropChance = 0.3; // 30% chance
        weaponDropChance = 0.3; // 30% of drops are weapons (9% overall)
        break;
      case 'bomber':
        dropChance = 0.5; // 50% chance
        weaponDropChance = 0.4; // 40% of drops are weapons (20% overall)
        break;
      case 'destroyer':
        dropChance = 0.7; // 70% chance
        weaponDropChance = 0.6; // 60% of drops are weapons (42% overall)
        break;
      case 'boss':
        dropChance = 1.0; // 100% chance to drop something
        weaponDropChance = 0.8; // 80% chance it's a weapon
        break;
      default:
        dropChance = 0.2;
        weaponDropChance = 0.3;
    }

    // Determine if we should drop something
    if (Math.random() > dropChance) return;

    // Determine what type of item to drop
    if (Math.random() < weaponDropChance) {
      // Weapon drop
      const weaponFound =
        this.gameState.weaponInventory.laser.unlocked &&
        this.gameState.weaponInventory.missile.unlocked &&
        this.gameState.weaponInventory.plasma.unlocked;

      if (!weaponFound) {
        // If player doesn't have all weapons, higher chance for new weapon
        this.powerUpManager.spawnPowerup(position, 'weaponPickup');
      } else {
        // Player has all weapons, give ammo
        this.powerUpManager.spawnPowerup(position, 'ammoPickup');
      }
    } else {
      // Other powerups - distribute randomly
      /** @type {readonly import('../combatContracts.js').EnemyDropType[]} */
      const powerupTypes = [
        'health',
        'speedBoost',
        'weaponUpgrade',
        'ammoPickup',
      ];
      const weights = [0.4, 0.2, 0.2, 0.2]; // 40% health, 20% others

      // Weighted random selection
      const rand = Math.random();
      let powerup = powerupTypes[powerupTypes.length - 1];
      let cumulativeWeight = 0;

      for (let i = 0; i < powerupTypes.length; i++) {
        cumulativeWeight += weights[i];
        if (rand <= cumulativeWeight) {
          powerup = powerupTypes[i];
          break;
        }
      }

      this.powerUpManager.spawnPowerup(position, powerup);
    }
  }

  // Set reference to PowerUpManager
  /** @param {import('../combatContracts.js').EnemyDropSink | null} manager */
  setPowerUpManager(manager) {
    this.powerUpManager = manager;
  }

  // Move all enemies by offset (Vector3)
  /** @param {THREE.Vector3} offset */
  offsetEnemies(offset) {
    for (const enemy of this.enemies) {
      if (enemy && enemy.mesh && enemy.mesh.position) {
        enemy.mesh.position.add(offset);
      }
    }
  }
}

export default EnemyManager;
