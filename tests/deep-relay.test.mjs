import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import { serializeLevelDocument, parseLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import MineGuide from '../src/js/core/levels/document/MineGuide.js';
import { enemyTypes } from '../src/js/entities/EnemyTypes.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

const sample = JSON.parse(readFileSync(new URL('../src/js/core/levels/documents/deep-relay.v2.json', import.meta.url), 'utf8'));
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
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session);
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'deep-relay') }); game.updateSimulation(1 / 60);
  t.after(() => { game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose(); });
  return game;
}

function fly(game, axis, target) {
  const keys = [['KeyA', 'KeyD'], ['ShiftLeft', 'Space'], ['KeyW', 'KeyS']][axis];
  for (let step = 0; step < 2400; step++) {
    if (game.session.phase !== 'playing') return;
    const error = target - game.spaceship.group.position.getComponent(axis), velocity = game.spaceship.velocity.getComponent(axis);
    if (Math.abs(error) < 0.08 && Math.abs(velocity) < 0.1) { game.inputManager.clearKeys(); return; }
    const control = error - velocity * 0.45;
    game.inputManager.keyStates = Math.abs(control) < 0.04 ? {} : { [keys[control < 0 ? 0 : 1]]: true };
    game.updateSimulation(1 / 60);
  }
  assert.fail(`Unable to fly ${axis} to ${target}: ${game.spaceship.group.position.toArray()}`);
}
function route(game, points) { for (const [axis, target] of points) fly(game, axis, target); }

test('Deep Relay is a round-trippable eight-room v2 mission with a loop, cache, two gates and generous finite ammunition', () => {
  const text = serializeLevelDocument(sample), level = compileLevelDocument(parseLevelDocument(text));
  assert.equal(serializeLevelDocument(level.sourceDocument), text);
  assert.equal(level.sourceDocument.rooms.length, 8); assert.equal(level.sourceDocument.connections.length, 8);
  assert.equal(level.enemySpawns.length, 5); assert.equal(level.devices.length, 2); assert.equal(level.doors.length, 2);
  assert.equal(level.sourceDocument.rooms.find(room => room.id === 'supply-cache').prefab, 'straight-corridor');
  const health = sample.entities.filter(entity => entity.kind === 'enemy').reduce((sum, entity) => sum + enemyTypes.find(type => type.name === entity.type).health, 0);
  assert.equal(health / sample.combat.pulseDamage, 19);
  assert.equal(sample.combat.initialPulseAmmo, 70);
  assert.equal(sample.entities.filter(entity => entity.type === 'pulseAmmo').length, 2);
  assert.equal(sample.entities.filter(entity => entity.type === 'health').length, 2);
});

test('the docking spawn provides real wall cover and ten seconds of quiet preparation', t => {
  const game = fixture(t), spawn = game.spaceship.group.position.clone();
  for (const enemy of game.enemyManager.enemies) assert.equal(game.enemyManager.canSeePlayer(enemy), false, enemy.mesh.userData.spawnPointId);
  for (let frame = 0; frame < 600; frame++) game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'playing'); assert.equal(game.gameState.playerHealth, 100);
  assert.equal(game.enemyManager.projectileManager.enemyProjectiles.length, 0);
  assert.ok(game.spaceship.group.position.equals(spawn));
});

test('guidance follows reachable relays, vertical hatches and the exit without mutating the authored graph', () => {
  const document = compileLevelDocument(sample).sourceDocument, guide = new MineGuide(document), activated = new Set(), closed = new Set(['junction-lift', 'control-extraction']);
  const before = serializeLevelDocument(document);
  assert.match(guide.describe(v(4, 0, 4), activated, closed), /Location: Blue Docking Bay.*Lift power relay.*passage to Blue Lift Junction/);
  activated.add('relay:lift'); closed.delete('junction-lift');
  assert.match(guide.describe(v(16, 0, 0), activated, closed), /Extraction relay.*ceiling hatch to Green Upper Lift/);
  assert.match(guide.describe(v(16, 16, 0), new Set(), closed), /Lift power relay.*floor hatch to Blue Lift Junction/);
  activated.add('relay:extraction'); closed.clear();
  assert.match(guide.describe(v(16, 16, -16), activated, closed), /Exit in Green Extraction.*passage to Green Extraction/);
  assert.equal(guide.describe(v(500, 500, 500), activated, closed), '');
  assert.equal(serializeLevelDocument(document), before);
});

test('relay hints respect reachability even when authoring order lists the locked relay first', () => {
  const input = structuredClone(sample); input.devices.reverse();
  const guide = new MineGuide(compileLevelDocument(input).sourceDocument);
  assert.match(guide.describe(v(4, 0, 4), new Set(), new Set(['junction-lift', 'control-extraction'])), /Lift power relay/);
  assert.doesNotMatch(guide.describe(v(4, 0, 4), new Set(), new Set(['junction-lift', 'control-extraction'])), /Extraction relay/);
});

test('real thrust traverses the lower loop, rotated supply cache, two relay gates and upper extraction; ten replays restore ownership', t => {
  const game = fixture(t), source = serializeLevelDocument(game.levelManager.currentLevel.sourceDocument);
  assert.equal(game.levelManager.currentLevelIndex, 8);
  for (const enemy of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(enemy, { power: 100 }, enemy.mesh.position);
  assert.equal(game.mission.ready, false);
  // Start out of direct sight. Center before crossing the north doorway, then fly the entire lower loop.
  route(game, [[0, 0], [2, -16], [0, 16], [2, 0], [0, 0], [0, 16], [2, -16], [0, 0], [2, 0], [0, 16]]);
  game.gameState.playerHealth = 50; game.gameState.weaponInventory.pulse.ammo = 40;
  route(game, [[0, 32], [0, 29], [0, 35], [0, 16]]);
  assert.equal(game.gameState.playerHealth, 75); assert.equal(game.gameState.weaponInventory.pulse.ammo, 60);
  assert.equal(traceShot(v(16, 0, 0), v(16, 16, 0), { colliders: game.levelManager.solidColliders }).target.id, 'door:lift');
  route(game, [[0, 13], [2, 3]]); assert.equal(game.interact(), true);
  assert.equal(game.levelManager.interaction.closedConnections.size, 1); assert.equal(game.mission.ready, false);
  route(game, [[2, 0], [0, 16], [1, 16], [1, 0], [1, 16], [2, -16], [2, 0], [2, -16]]);
  assert.equal(traceShot(v(16, 16, -16), v(32, 16, -16), { colliders: game.levelManager.solidColliders }).target.id, 'door:extraction');
  route(game, [[0, 12], [2, -13]]); assert.equal(game.interact(), true);
  assert.equal(game.mission.ready, true); route(game, [[2, -16], [0, 32], [0, 16], [0, 32], [2, -20]]);
  assert.equal(game.session.phase, 'completed'); assert.equal(game.gameState.score, 1400);
  game.updateSimulation(1); assert.equal(game.gameState.score, 1400);
  let baseline;
  for (let cycle = 0; cycle < 10; cycle++) {
    const previous = game.levelManager.interaction, root = game.levelManager.levelSegments[0], counts = [];
    for (const door of game.levelManager.currentLevel.doors) {
      const mesh = root.getObjectByName(door.id); counts.push(0);
      const index = counts.length - 1; mesh.geometry.addEventListener('dispose', () => counts[index]++);
    }
    game.restartLevel(); game.updateSimulation(1 / 60);
    assert.deepEqual(counts, [1, 1]); assert.equal(previous.retired, true);
    assert.equal(game.levelManager.interaction.closedConnections.size, 2); assert.equal(game.mission.ready, false);
    assert.equal(game.mission.activatedDevices.size, 0); assert.equal(game.mission.defeats.size, 0);
    assert.equal(game.enemyManager.enemies.length, 5); assert.equal(game.levelManager.solidColliders.length, 98);
    assert.equal(game.gameState.weaponInventory.pulse.ammo, 70); assert.equal(game.gameState.playerHealth, 100);
    assert.ok(game.spaceship.group.position.distanceTo(v(4, 0, 4)) < 1e-8);
    assert.equal(serializeLevelDocument(game.levelManager.currentLevel.sourceDocument), source);
    if (cycle === 0) baseline = game.scene.children.length;
    else assert.equal(game.scene.children.length, baseline, 'restarts retain a stable world, enemies and pickups');
  }
});

test('all five authored encounters can be cleared with ordinary five-damage pulse fire and the starting ammunition', t => {
  const game = fixture(t); game.projectileManager.setCanvas({});
  const positions = [[4, 0, -10], [14, 0, -10], [20, 16, 6], [16, 16, -12], [35, 16, -19]];
  const ids = sample.mission.requiredEnemyIds;
  for (let i = 0; i < ids.length; i++) {
    const enemy = game.enemyManager.enemies.find(enemy => enemy.mesh.userData.spawnPointId === ids[i]);
    game.spaceship.group.position.fromArray(positions[i]);
    for (let shot = 0; enemy.isActive && shot < 15; shot++) {
      game.spaceship.group.quaternion.setFromUnitVectors(v(0, 0, -1), enemy.mesh.position.clone().sub(game.spaceship.group.position).normalize());
      game.spaceship.group.updateMatrixWorld(true);
      assert.ok(game.projectileManager.fireProjectile(game.gameState, { requirePointerLock: false }));
      for (let frame = 0; frame < 12; frame++) game.updateSimulation(1 / 60);
    }
    assert.equal(game.mission.defeats.get(ids[i]), 'shot', ids[i]);
  }
  assert.equal(game.session.phase, 'playing'); assert.ok(game.gameState.playerHealth > 0);
  assert.ok(game.gameState.weaponInventory.pulse.ammo >= 40, 'at least forty shots remain without collecting ammo');
  assert.equal(game.mission.defeats.size, 5); assert.equal(game.mission.ready, false, 'both relays remain required');
});
