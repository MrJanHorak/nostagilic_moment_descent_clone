import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import updateFighterMovement from '../src/js/entities/FighterMovement.js';
import { createFighterAttack } from '../src/js/entities/FighterAttack.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import GameState from '../src/js/core/GameState.js';
import { createDocument } from '../src/js/editor/EditorDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import createFighterDrill from '../src/js/core/levels/FighterDrill.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import { solidContact } from '../src/js/utils/sphereMovement.js';
import disposeObject from '../src/js/utils/disposeObject.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function fixture(t, size = [32, 16, 32]) {
  const document = createDocument(); document.rooms[0].size = size;
  document.playerSpawn.position = [0, 0, 2]; document.entities[0].position = [0, 0, -1];
  const level = compileLevelDocument(document), world = buildArena(level), scene = new THREE.Scene();
  const player = new THREE.Group(); player.position.set(0, 0, 10); scene.add(world.group, player);
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  const manager = new EnemyManager(scene, player, state, null,
    { currentLevel: level, solidColliders: world.colliders, isEndless: false, tunnelWidth: 32, tunnelHeight: 16 });
  manager.effectsManager.dynamicLights = false;
  manager.mineNavigation = new RoomNavigation(level.sourceDocument);
  const enemy = manager.spawnEnemy(v(), 'fighter'); enemy.mesh.userData.spawnPointId = 'movement-test';
  const step = (delta = 1 / 60) => {
    state.session.advance(delta);
    updateFighterMovement(enemy, player.position, world.colliders, manager.mineNavigation, state.session.timeMs, delta);
    for (const collider of world.colliders) assert.equal(solidContact(enemy.mesh.position, enemy.collisionRadius - 1e-4, collider), null);
  };
  t.after(() => { state.session.end(); manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); disposeObject(world.group); });
  return { manager, enemy, player, state, world, step };
}

test('a fighter strafes and changes height at its existing speed with bounded tactical decisions', t => {
  const { enemy, step } = fixture(t); let x = 0, y = 0, lights = 0;
  enemy.mesh.traverse(object => { if (object instanceof THREE.Light) lights++; });
  const children = enemy.mesh.children.length, radius = enemy.collisionRadius;
  for (let i = 0; i < 360; i++) {
    const before = enemy.mesh.position.clone(); step();
    assert.ok(before.distanceTo(enemy.mesh.position) <= enemy.type.speed + 1e-6);
    x = Math.max(x, Math.abs(enemy.mesh.position.x)); y = Math.max(y, Math.abs(enemy.mesh.position.y));
  }
  assert.ok(x > 0.4); assert.ok(y > 0.2);
  assert.ok(enemy.fighterMovement.decisions >= 5 && enemy.fighterMovement.decisions <= 9);
  assert.equal(enemy.mesh.children.length, children); assert.equal(enemy.collisionRadius, radius); assert.equal(lights, 0);
});

test('fighters back away from close targets and close excessive distance instead of parking or charging into them', t => {
  const near = fixture(t), far = fixture(t);
  near.player.position.set(0, 0, 3); far.player.position.set(0, 0, 15);
  for (let i = 0; i < 60; i++) { near.step(); far.step(); }
  assert.ok(near.enemy.mesh.position.distanceTo(near.player.position) > 4);
  assert.ok(far.enemy.mesh.position.distanceTo(far.player.position) < 14);
  assert.equal(near.enemy.fighterMovement.mode, 'retreat'); assert.equal(far.enemy.fighterMovement.mode, 'approach');
});

test('vertical sight lines and cramped rooms produce finite movement and preserve full body clearance', t => {
  const vertical = fixture(t, [32, 32, 32]), tight = fixture(t, [8, 8, 8]);
  vertical.player.position.set(0, 10, 0); tight.player.position.set(-1, 0, 1);
  tight.enemy.mesh.position.set(1.5, 0, -1.5);
  for (let i = 0; i < 360; i++) { vertical.step(); tight.step(); }
  assert.ok(vertical.enemy.mesh.position.toArray().every(Number.isFinite));
  assert.ok(Math.hypot(vertical.enemy.mesh.position.x, vertical.enemy.mesh.position.z) > 0.2);
  assert.equal(tight.manager.mineNavigation.roomAt(tight.enemy.mesh.position), 'room-1');
});

test('a newly closed obstruction blocks a cached movement target without tunneling or per-frame replanning', t => {
  const { enemy, world, step } = fixture(t);
  for (let i = 0; i < 15; i++) step();
  const sign = Math.sign(enemy.fighterMovement.target.x), edge = enemy.mesh.position.x + sign * (enemy.collisionRadius + 0.06);
  const minimum = Math.min(edge, edge + sign * 0.2), maximum = Math.max(edge, edge + sign * 0.2);
  world.colliders.push({ id: 'newly-closed-door', box: new THREE.Box3(v(minimum, -8, -16), v(maximum, 8, 16)) });
  let blocked = false;
  for (let i = 0; i < 240; i++) {
    step();
    blocked ||= enemy.fighterMovement.mode === 'blocked';
    assert.ok(sign > 0 ? enemy.mesh.position.x <= minimum - enemy.collisionRadius + 1e-4 : enemy.mesh.position.x >= maximum + enemy.collisionRadius - 1e-4);
  }
  assert.ok(blocked, 'the new door must interrupt the already cached dodge');
  assert.ok(enemy.fighterMovement.decisions < 15);
});

test('warning and recovery brace movement, then resume without a teleport or delayed movement callback', t => {
  const { enemy, state, step } = fixture(t);
  for (let i = 0; i < 40; i++) step();
  const before = enemy.mesh.position.clone(); enemy.fighterAttack = createFighterAttack(state.session.timeMs, 2000);
  for (const phase of ['windup', 'recover']) {
    enemy.fighterAttack.phase = phase;
    for (let i = 0; i < 60; i++) step();
    assert.ok(enemy.mesh.position.equals(before)); assert.equal(enemy.fighterMovement.mode, 'brace');
  }
  enemy.fighterAttack.phase = 'idle'; for (let i = 0; i < 30; i++) step();
  assert.ok(enemy.mesh.position.distanceTo(before) > 0.2);
  assert.equal(state.session.tasks.size, 0);
});

test('30/60/120 Hz movement remains close despite bounded tactical decision sampling', t => {
  const positions = [];
  for (const fps of [30, 60, 120]) {
    const { enemy, step } = fixture(t);
    for (let i = 0; i < fps * 6; i++) step(1 / fps);
    positions.push(enemy.mesh.position.clone());
  }
  assert.ok(positions[0].distanceTo(positions[1]) < 0.15);
  assert.ok(positions[2].distanceTo(positions[1]) < 0.15);
});

test('breaking sight replans from the dodged position once and remembers only the last observed player position', t => {
  const { enemy, manager, state, player } = fixture(t);
  for (let i = 0; i < 60; i++) { state.session.advance(1 / 60); manager.updateMineEnemy(enemy, 1 / 60, true); }
  const observed = player.position.clone(), dodged = enemy.mesh.position.clone();
  const route = manager.mineNavigation.route.bind(manager.mineNavigation); let plans = 0, start;
  t.mock.method(manager.mineNavigation, 'route', (...args) => { plans++; start = args[0].clone(); return route(...args); });
  player.position.set(100, 100, 100);
  for (let i = 0; i < 120; i++) { state.session.advance(1 / 60); manager.updateMineEnemy(enemy, 1 / 60, false); }
  assert.equal(plans, 1); assert.ok(start.equals(dodged));
  assert.ok(manager.minePursuits.get(enemy).lastSeen.equals(observed));
});

test('pause freezes live tactical state and reset creates a fresh fighter rather than keeping old waypoints', t => {
  const { enemy, manager, state } = fixture(t);
  for (let i = 0; i < 60; i++) { state.session.advance(1 / 60); manager.updateEnemies(1 / 60); }
  const before = enemy.mesh.position.clone(), target = enemy.fighterMovement.target.clone(), decisions = enemy.fighterMovement.decisions;
  state.session.transition('paused');
  for (let i = 0; i < 300; i++) { state.session.advance(1 / 60); manager.updateEnemies(1 / 60); }
  assert.ok(enemy.mesh.position.equals(before)); assert.ok(enemy.fighterMovement.target.equals(target)); assert.equal(enemy.fighterMovement.decisions, decisions);
  manager.resetLevel(); state.session.transition('playing');
  const replacement = manager.spawnEnemy(v(), 'fighter'); assert.equal(replacement.fighterMovement, undefined);
  assert.equal(state.session.tasks.size, 0);
});

test('the proving ground has a usable loop, two required fighters, cover walls and a sufficient authored ammunition budget', () => {
  const level = createFighterDrill(), navigation = new RoomNavigation(level.sourceDocument);
  assert.equal(level.sourceDocument.rooms.length, 4); assert.equal(level.sourceDocument.connections.length, 4);
  assert.equal(level.enemySpawns.length, 2); assert.equal(level.mission.requiredEnemyIds.length, 2);
  assert.equal(level.combat.pulseDamage, 5); assert.ok(level.combat.initialPulseAmmo >= 10);
  assert.ok(level.powerupSpawns.some(pickup => pickup.powerupType === 'health'));
  assert.ok(level.powerupSpawns.some(pickup => pickup.powerupType === 'pulseAmmo'));
  for (const room of level.sourceDocument.rooms) assert.ok(navigation.route(v(...level.spawn), v(...room.position), 0.5));
  const blocked = new Set(['bay-floor']);
  const route = navigation.route(v(0, 0, 8), v(6, 3, -18), 0.5, blocked);
  assert.ok(route.length > 4, 'the east gallery must provide an alternate route around the wall');
});
