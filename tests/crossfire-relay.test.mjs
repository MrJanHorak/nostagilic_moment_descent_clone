import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import createCrossfireRelay from '../src/js/core/levels/CrossfireRelay.js';
import { serializeLevelDocument, parseLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { openingFrame } from '../src/js/core/levels/document/RoomMath.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { traceShot, hasLineOfSight } from '../src/js/utils/combatTrace.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

const v = (...values) => new THREE.Vector3(...values);
function fixture(t) {
  t.mock.method(console, 'log', () => {}); t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {}, hideLevelSelect() {},
    showMessage() {}, showPauseMenu() {}, hidePauseMenu() {}, showCompletion() {}, showGameOver() {}, showSessionError(error) { throw error; } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session); game.projectileManager.setCanvas({});
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'crossfire-relay') });
  game.updateSimulation(1 / 60);
  t.after(() => { game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose(); });
  return game;
}
function advance(game, frames) { for (let i = 0; i < frames; i++) game.updateSimulation(1 / 60); }
function fireAt(game, enemy) {
  game.spaceship.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(game.spaceship.group.position, enemy.mesh.position, v(0, 1, 0)));
  return game.projectileManager.fireProjectile(game.gameState, { requirePointerLock: false });
}

test('Crossfire is portable, independently selectable, and finishable without optional supplies or campaign advancement', t => {
  const game = fixture(t), level = game.levelManager.currentLevel, doc = level.sourceDocument;
  const text = serializeLevelDocument(doc);
  assert.equal(serializeLevelDocument(parseLevelDocument(text)), text);
  assert.equal(level.campaignOrder, undefined); assert.equal(game.nextMissionIndex(), -1);
  assert.deepEqual(level.enemySpawns.map(enemy => enemy.enemyType).sort(), ['fighter', 'scout']);
  assert.equal(level.mission.requiredEnemyIds.length, 2);
  const needed = game.enemyManager.enemies.reduce((sum, enemy) => sum + Math.ceil(enemy.health / level.combat.pulseDamage), 0);
  assert.ok(level.combat.initialPulseAmmo >= needed * 3, 'mandatory route has room for misses without collecting the cache');
  assert.ok(doc.connections.length >= doc.rooms.length + 1, 'ground and overhead circuits provide independent loops');
  const navigation = new RoomNavigation(doc), blocked = new Set(['arrival-approach', 'supply-shortcut']);
  const route = navigation.route(v(...level.spawn), v(0, 0, -32), 0.5, blocked);
  assert.ok(route?.some(point => point.y > 14), 'the overhead approach still reaches combat when both ground entries are unavailable');
});

test('arrival stays quiet for ten seconds and real doorway walls break the ranged sightline', t => {
  const game = fixture(t), position = game.spaceship.group.position.clone(), manager = game.enemyManager;
  for (const enemy of manager.enemies) assert.equal(manager.canSeePlayer(enemy), false);
  advance(game, 600);
  assert.equal(game.gameState.playerHealth, 100); assert.equal(game.session.phase, 'playing');
  assert.ok(game.spaceship.group.position.equals(position));
  assert.equal(manager.projectileManager.enemyProjectiles.length, 0);
  const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter'), colliders = game.levelManager.solidColliders;
  assert.equal(hasLineOfSight(fighter.mesh.position, v(0, 0, -7), colliders), true);
  assert.equal(hasLineOfSight(fighter.mesh.position, v(6, 0, -7), colliders), false);
});

test('every authored portal physically fits the ship and the overhead path descends into the combat room', t => {
  const game = fixture(t), level = game.levelManager.currentLevel, interaction = game.levelManager.interaction;
  assert.equal(interaction.tryActivate(v(-6, 0, -29))?.id, 'crossfire:relay'); interaction.update(1);
  const rooms = new Map(level.sourceDocument.rooms.map(room => [room.id, room])), colliders = game.levelManager.solidColliders;
  for (const connection of level.sourceDocument.connections) {
    const frame = openingFrame(rooms.get(connection.a.roomId), connection.a, connection.openingSize);
    const center = v(...frame.center), normal = v(...frame.normal);
    for (const sign of [-1, 1]) {
      const start = center.clone().addScaledVector(normal, sign * 1.2), end = center.clone().addScaledVector(normal, -sign * 1.2);
      assert.equal(traceShot(start, end, { colliders, radius: 0.5 }), null, connection.id);
      moveSphere(start, end.clone().sub(start), 1, colliders, 0.5);
      assert.ok(start.distanceTo(end) < 1e-6, connection.id);
    }
  }
  let position = v(0, 0, 0);
  for (const point of [[0, 21, 0], [0, 21, -32], [0, 0, -32]]) {
    const end = v(...point);
    assert.equal(traceShot(position, end, { colliders, radius: 0.5 }), null);
    moveSphere(position, end.clone().sub(position), 1, colliders, 0.5); assert.ok(position.distanceTo(end) < 1e-6);
  }
});

for (const [approach, position] of [['direct', [0, 0, -26]], ['overhead', [0, 21, -32]]]) test(`${approach}: actual combat, pause and replay preserve both objective kills`, t => {
  const game = fixture(t), source = serializeLevelDocument(game.levelManager.currentLevel.sourceDocument);
  game.spaceship.group.position.set(...position);
  let mixed = false;
  for (let frame = 0; frame < 1200 && !mixed; frame++) {
    advance(game, 1);
    const [fighter, scout] = ['fighter', 'scout'].map(type => game.enemyManager.enemies.find(enemy => enemy.type.name === type));
    mixed = fighter.fighterAttack.phase !== 'idle' && (approach === 'overhead' || scout.scoutAttack.phase !== 'approach');
  }
  assert.ok(mixed, `The ${approach} approach must engage its visible threats`);
  if (approach === 'overhead') assert.ok(game.enemyManager.minePursuits.get(game.enemyManager.enemies.find(enemy => enemy.type.name === 'scout')).lastSeen, 'the fighter sighting alerts the scout even while shaft walls block its own sight');
  const before = game.enemyManager.enemies.map(enemy => [enemy.mesh.position.toArray(), enemy.fighterAttack?.phase, enemy.scoutAttack?.phase]);
  game.pauseGame(); advance(game, 120);
  assert.deepEqual(game.enemyManager.enemies.map(enemy => [enemy.mesh.position.toArray(), enemy.fighterAttack?.phase, enemy.scoutAttack?.phase]), before);
  game.resumeGame();
  for (const type of approach === 'overhead' ? ['fighter', 'scout'] : ['scout', 'fighter']) {
    const enemy = game.enemyManager.enemies.find(candidate => candidate.type.name === type);
    if (!enemy) continue; // An approaching ally can intercept an earlier real shot.
    if (approach === 'overhead' && type === 'scout') {
      game.spaceship.group.position.set(0, 0, -32);
      for (let frame = 0; frame < 600 && enemy.scoutAttack.phase === 'approach'; frame++) advance(game, 1);
      assert.notEqual(enemy.scoutAttack.phase, 'approach', 'the scout engages after the ship enters its sightline');
    }
    let shots = 0;
    while (enemy.isActive && shots++ < 24) {
      assert.equal(game.session.phase, 'playing'); assert.ok(fireAt(game, enemy));
      advance(game, 20);
    }
    for (let frame = 0; frame < 120 && enemy.isActive && game.projectileManager.projectiles.length; frame++) advance(game, 1);
    assert.equal(enemy.isActive, false, `${type} must be defeated by real aimed projectiles: health ${enemy.health}, position ${enemy.mesh.position.toArray()}, phase ${game.session.phase}, shield ${game.gameState.playerHealth}`);
  }
  assert.equal(game.gameState.enemyKills.scout, 1); assert.equal(game.gameState.enemyKills.fighter, 1);
  assert.equal(game.mission.ready, false, 'kills alone do not replace the relay');
  assert.ok(game.gameState.weaponInventory.pulse.ammo > 0);
  game.spaceship.group.position.set(-6, 0, -27); game.spaceship.group.quaternion.identity();
  assert.equal(game.interact(), true); advance(game, 60); assert.equal(game.mission.ready, true);
  assert.equal(game.levelManager.interaction.closedConnections.size, 0);
  game.spaceship.group.position.fromArray(game.mission.definition.exit.position); game.updateMission();
  assert.equal(game.session.phase, 'completed'); assert.equal(game.gameState.score, 1150);
  game.restartLevel(); advance(game, 1);
  assert.equal(game.enemyManager.enemies.length, 2); assert.equal(game.mission.ready, false);
  assert.equal(game.gameState.playerHealth, 100); assert.equal(game.gameState.weaponInventory.pulse.ammo, 40);
  assert.equal(game.levelManager.interaction.closedConnections.size, 1);
  assert.equal(game.enemyManager.projectileManager.enemyProjectiles.length, 0);
  assert.equal(serializeLevelDocument(game.levelManager.currentLevel.sourceDocument), source);
});

test('the relay shortcut is physical, optional supplies collect once, and extraction still requires both guards', t => {
  const game = fixture(t), interaction = game.levelManager.interaction, colliders = game.levelManager.solidColliders;
  const start = v(8, 0, 0), end = v(12, 0, 0);
  assert.ok(traceShot(start, end, { colliders, radius: 0.5 }));
  game.spaceship.group.position.set(-6, 0, -27); assert.equal(game.interact(), true); advance(game, 60);
  assert.equal(traceShot(start, end, { colliders, radius: 0.5 }), null);
  assert.equal(game.mission.ready, false, 'opening a return route does not award combat completion');
  // Isolate collection at authored positions; combat/extraction is covered above.
  game.gameState.playerHealth = 50; game.gameState.weaponInventory.pulse.ammo = 10;
  for (const position of [[22, 0, -4], [18, 0, 0]]) { game.spaceship.group.position.set(...position); game.powerUpManager.update(0); }
  assert.equal(game.gameState.playerHealth, 75); assert.equal(game.gameState.weaponInventory.pulse.ammo, 30);
  game.powerUpManager.update(0); assert.equal(game.gameState.weaponInventory.pulse.ammo, 30);
  game.spaceship.group.position.fromArray(game.mission.definition.exit.position); game.updateMission(); assert.equal(game.session.phase, 'playing');
});
