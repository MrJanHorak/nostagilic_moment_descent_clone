import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import GameState from '../src/js/core/GameState.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import disposeObject from '../src/js/utils/disposeObject.js';

const sample = JSON.parse(readFileSync(new URL('../src/js/core/levels/documents/mine-link.v1.json', import.meta.url), 'utf8'));
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clone = () => structuredClone(sample);

function fixture(t, input = sample) {
  const level = compileLevelDocument(input), world = buildArena(level);
  const navigation = new RoomNavigation(level.sourceDocument);
  const state = new GameState(), scene = new THREE.Scene(), player = new THREE.Group();
  player.position.fromArray(level.spawn); scene.add(world.group, player);
  state.session.begin(); state.session.transition('playing');
  const view = { currentLevel: level, solidColliders: world.colliders, isEndless: false, tunnelWidth: 15, tunnelHeight: 12 };
  const manager = new EnemyManager(scene, player, state, null, view);
  t.after(() => {
    state.session.end(); manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); disposeObject(world.group);
  });
  return { level, world, navigation, state, scene, player, manager, view };
}

function noWallOverlap(enemy, colliders) {
  for (const { box } of colliders) {
    const closest = box.clampPoint(enemy.mesh.position, v());
    assert.ok(closest.distanceTo(enemy.mesh.position) >= enemy.collisionRadius - 1e-5, 'enemy body penetrated a wall');
  }
}

test('room routing uses rotated port normals, shortest stable loop paths and vertical hatches', t => {
  const { navigation } = fixture(t);
  assert.equal(navigation.roomAt(v(17, 0, -16)), 'gallery');
  const route = navigation.route(v(0, 0, -16), v(16, 12, 0), 1);
  assert.ok(route); assert.equal(route.length, 8);
  assert.deepEqual(route.slice(1, -1).map(point => point.toArray()), [
    [0, 0, -9.6], [0, 0, -6.4], [6.4, 0, 0], [9.6, 0, 0], [16, 4.4, 0], [16, 7.6, 0],
  ]);
  const rotated = navigation.route(v(0, 0, -16), v(16, 0, -16), 1);
  assert.deepEqual(rotated.slice(1, -1).map(point => point.toArray()), [[6.4, 0, -16], [9.6, 0, -16]]);
});

test('all room pairs and both directions have body-clear route segments, including the hatch', t => {
  const { level, navigation, world } = fixture(t);
  for (const radius of [0.5, 0.7778174686, 1.7286457462, 2.4504555415]) {
    for (const from of level.sourceDocument.rooms) for (const to of level.sourceDocument.rooms) {
      const start = v(...from.position), route = navigation.route(start, v(...to.position), radius);
      assert.ok(route);
      let previous = start;
      for (const waypoint of route) {
        assert.equal(traceShot(previous, waypoint, { colliders: world.colliders, radius }), null, `${from.id} -> ${to.id}, radius ${radius}`);
        previous = waypoint;
      }
    }
  }
});

test('body clearance selects a longer loop when the short portal is too narrow', t => {
  const input = clone(); input.connections[3].openingSize = [2, 2];
  const { navigation, world } = fixture(t, input);
  assert.equal(navigation.route(v(), v(16, 0, 0), 0.7).length, 4);
  const route = navigation.route(v(), v(16, 0, 0), 1.73);
  assert.equal(route.length, 8);
  let previous = v();
  for (const point of route) {
    assert.equal(traceShot(previous, point, { colliders: world.colliders, radius: 1.73 }), null);
    previous = point;
  }
});

test('unusable openings and bodies too large for rooms produce no route', t => {
  const input = clone(); input.connections.forEach(connection => { connection.openingSize = [2, 2]; });
  const { navigation } = fixture(t, input);
  assert.equal(navigation.route(v(), v(16, 12, 0), 1.73), null);
  assert.ok(navigation.route(v(), v(16, 12, 0), 0.77));
  for (const radius of [0, -1, NaN, Infinity, 6]) assert.equal(navigation.route(v(), v(), radius), null);
  assert.equal(navigation.route(v(100), v(), 1), null);
  assert.equal(navigation.route(v(), v(100), 1), null);
});

test('a large body can use a sufficiently wide hatch in both directions', t => {
  const input = clone(); input.connections.forEach(connection => { connection.openingSize = [10, 10]; });
  const { navigation, world } = fixture(t, input);
  const radius = 4.3055928738;
  for (const [start, target] of [[v(), v(16, 12, 0)], [v(16, 12, 0), v()]]) {
    const route = navigation.route(start, target, radius); assert.ok(route);
    let previous = start;
    for (const point of route) {
      assert.equal(traceShot(previous, point, { colliders: world.colliders, radius }), null);
      previous = point;
    }
  }
});

test('near-wall targets and starts in portal throats first enter safe room interiors', t => {
  const { navigation, world } = fixture(t);
  for (const start of [v(7.99), v(8.01), v(16, 5.99), v(16, 6.01)]) {
    const route = navigation.route(start, v(20, 16, 5), 1.73);
    assert.ok(route);
    let previous = start;
    for (const point of route) {
      assert.equal(traceShot(previous, point, { colliders: world.colliders, radius: 1.73 }), null);
      previous = point;
    }
  }
  const route = navigation.route(v(), v(7.4, 5.4, 7.4), 1.73);
  assert.deepEqual(route.at(-1).toArray(), [5.67, 3.67, 5.67]);
  route[0].set(999, 999, 999);
  assert.deepEqual(navigation.route(v(), v(), 1)[0].toArray(), [0, 0, 0], 'routes must not mutate graph or later callers');
});

test('unalerted mine enemies stay idle behind walls and never fire through them', t => {
  const { manager, state } = fixture(t);
  manager.updateEnemies(0);
  const scout = manager.enemies.find(enemy => enemy.type.name === 'scout');
  const start = scout.mesh.position.clone();
  assert.equal(manager.canSeePlayer(scout), false);
  for (let frame = 0; frame < 120; frame++) { state.session.advance(1 / 60); manager.updateEnemies(1 / 60); }
  assert.ok(scout.mesh.position.equals(start));
  assert.equal(manager.minePursuits.get(scout).lastSeen, null);
});

test('damage alerts a drone; remembered pursuit crosses two turns and a hatch without following hidden movement', t => {
  const { manager, navigation, player, state, world } = fixture(t);
  manager.updateEnemies(0);
  const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter');
  player.position.set(16, 14, 4);
  manager.hitEnemy(fighter, { power: 1 }, fighter.mesh.position);
  const remembered = player.position.clone();
  player.position.set(500, 500, 500); // Outside and occluded; never a valid routing target.
  const visited = new Set();
  for (let frame = 0; frame < 2400; frame++) {
    state.session.advance(1 / 60); manager.updateEnemies(1 / 60);
    visited.add(navigation.roomAt(fighter.mesh.position)); noWallOverlap(fighter, world.colliders);
  }
  assert.deepEqual([...visited], ['core', 'bay', 'return', 'upper']);
  assert.ok(fighter.mesh.position.distanceTo(remembered) < 0.04);
  assert.ok(manager.minePursuits.get(fighter).lastSeen.equals(remembered));
  assert.equal(manager.projectileManager.enemyProjectiles.length, 0);
  assert.equal(fighter.health, 24);
  const stopped = fighter.mesh.position.clone();
  state.session.advance(1); manager.updateEnemies(1);
  assert.ok(fighter.mesh.position.distanceTo(stopped) < 1e-6);
});

test('renewed sight updates a remembered target without cutting portal corners', t => {
  const { manager, player, world } = fixture(t);
  manager.updateEnemies(0);
  const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter');
  player.position.set(16, 14, 4); manager.hitEnemy(fighter, { power: 1 }, fighter.mesh.position);
  player.position.set(500, 500, 500);
  // Finish just beyond a door plane, then change the goal room during crossing.
  for (let frame = 0; frame < 600 && fighter.mesh.position.z < -7.99; frame++) manager.updateMineEnemy(fighter, 1 / 60, false);
  assert.ok(fighter.mesh.position.z >= -7.99);
  player.position.set(0, 0, -16);
  for (let frame = 0; frame < 300; frame++) {
    manager.updateMineEnemy(fighter, 1 / 60, true); noWallOverlap(fighter, world.colliders);
  }
  assert.ok(manager.minePursuits.get(fighter).lastSeen.equals(player.position));
  assert.ok(fighter.mesh.position.distanceTo(player.position) <= 8.04);
});

test('an alerted fighter waits when every connecting portal is too small for its body', t => {
  const input = clone(); input.connections.forEach(connection => { connection.openingSize = [2, 2]; });
  const { manager, player } = fixture(t, input);
  manager.updateEnemies(0);
  const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter'), start = fighter.mesh.position.clone();
  player.position.set(16, 12, 0); manager.hitEnemy(fighter, { power: 1 }, start);
  player.position.set(500, 500, 500);
  for (let frame = 0; frame < 120; frame++) manager.updateEnemies(1 / 60);
  assert.ok(fighter.mesh.position.equals(start));
  assert.equal(manager.minePursuits.get(fighter).route, null);
});

for (const [name, target] of [['doorway', v(8, 0, 0)], ['hatch', v(16, 6, 0)]]) {
  test(`a scout can finish its approach and ram a player hovering in a ${name}`, t => {
    const { manager, state, player } = fixture(t); manager.updateEnemies(0);
    const scout = manager.enemies.find(enemy => enemy.type.name === 'scout');
    manager.removeEnemy(manager.enemies.findIndex(enemy => enemy.type.name === 'fighter'));
    player.position.copy(target); manager.hitEnemy(scout, { power: 1 }, scout.mesh.position);
    const defeats = []; manager.onEnemyDefeated = (id, cause) => defeats.push([id, cause]);
    for (let frame = 0; frame < 1800 && scout.isActive; frame++) {
      state.session.advance(1 / 60); manager.updateEnemies(1 / 60);
    }
    assert.equal(scout.isActive, false, 'interior clamping must not strand the scout outside ram range');
    assert.deepEqual(defeats, [['mine:scout', 'ram']]);
    assert.equal(state.playerHealth, 95); assert.equal(state.score, 0);
  });
}

test('authored enemies spawn once even beyond 50 units and within the old 5-unit exclusion', t => {
  const input = clone();
  for (let i = 1; i <= 3; i++) {
    input.rooms.push({ ...input.rooms[0], id: `far-${i}`, position: [0, 0, -16 * (i + 1)] });
    input.connections.push({ id: `far-link-${i}`, a: { roomId: i === 1 ? 'core' : `far-${i - 1}`, port: 'negativeZ' },
      b: { roomId: `far-${i}`, port: 'positiveZ' }, openingSize: [6, 6] });
  }
  input.entities[0].roomId = 'far-3'; input.entities[1].roomId = 'bay'; input.entities[1].position = [0, 0, 0];
  const { manager, player } = fixture(t, input);
  manager.updateEnemies(0);
  assert.equal(manager.enemies.length, 2);
  const fighter = manager.enemies.find(enemy => enemy.type.name === 'fighter');
  assert.ok(fighter.mesh.position.distanceTo(player.position) > 50);
  manager.hitEnemy(fighter, { power: 5 }, fighter.mesh.position);
  fighter.lastFireTime = 1234; fighter.fireRate = 3456;
  const position = fighter.mesh.position.clone();
  for (const where of [v(500, 500, 500), v(16, 12, 0), v(0, 0, 4)]) {
    player.position.copy(where); manager.updateEnemies(0);
    assert.ok(manager.enemies.includes(fighter)); assert.equal(fighter.health, 20);
    assert.ok(fighter.mesh.position.equals(position));
    assert.equal(fighter.lastFireTime, 1234); assert.equal(fighter.fireRate, 3456);
  }
});

test('ordinary cleanup retires a mine spawn without kill credit or recreating it', t => {
  const { manager, state } = fixture(t);
  manager.updateEnemies(0);
  const enemy = manager.enemies[0]; let defeats = 0;
  manager.onEnemyDefeated = () => defeats++;
  manager.removeEnemy(0); manager.updateEnemies(0);
  assert.equal(enemy.isActive, false); assert.equal(manager.enemies.length, 1);
  assert.equal(manager.minePursuits.has(enemy), false);
  assert.equal(defeats, 0); assert.equal(state.score, 0); assert.equal(manager.destroyedPredefinedEnemies.size, 0);
});

test('a reset from an enemy-count callback cannot publish stale mine spawns', t => {
  const { manager, state } = fixture(t);
  state.uiManager = { updateEnemyCount() { manager.resetLevel(); } };
  manager.spawnPredefinedEnemies();
  assert.equal(manager.enemies.length, 0); assert.equal(manager.mineNavigation, null);
  assert.equal(manager.instantiatedMineEnemies.size, 0);
});

test('cleanup callbacks observe retired pursuit state and cannot respawn its body', t => {
  const { manager } = fixture(t); manager.updateEnemies(0);
  const enemy = manager.enemies[0]; let material;
  enemy.mesh.traverse(child => { if (!material && child instanceof THREE.Mesh) material = child.material; });
  let calls = 0;
  material.addEventListener('dispose', () => {
    calls++; assert.equal(manager.minePursuits.has(enemy), false);
    assert.equal(enemy.isActive, false); manager.spawnPredefinedEnemies();
    assert.equal(manager.enemies.some(candidate => candidate.mesh.userData.spawnPointId === 'mine:fighter'), false);
  });
  manager.removeEnemy(0); assert.equal(calls, 1);
});

test('pause freezes pursuit and cooldowns; restart clears memory, IDs, damage and old bodies', t => {
  const { manager, state, player } = fixture(t);
  manager.updateEnemies(0);
  const enemy = manager.enemies[0]; manager.hitEnemy(enemy, { power: 5 }, enemy.mesh.position);
  const position = enemy.mesh.position.clone(), lastSeen = manager.minePursuits.get(enemy).lastSeen.clone();
  state.session.transition('paused'); player.position.set(16, 14, 0);
  state.session.advance(5); manager.updateEnemies(5);
  assert.ok(enemy.mesh.position.equals(position)); assert.equal(state.session.timeMs, 0);
  assert.ok(manager.minePursuits.get(enemy).lastSeen.equals(lastSeen));
  state.session.end(); manager.resetLevel();
  assert.equal(manager.minePursuits.size, 0); assert.equal(manager.mineNavigation, null);
  assert.equal(manager.instantiatedMineEnemies.size, 0); assert.equal(enemy.isActive, false);
  player.position.set(0, 0, 4); state.session.begin(); state.session.transition('playing'); manager.updateEnemies(0);
  assert.equal(manager.enemies.length, 2); assert.notEqual(manager.enemies[0], enemy);
  assert.equal(manager.enemies[0].health, manager.enemies[0].type.health);
  assert.equal(manager.enemies[0].lastFireTime, 0);
});

test('a mine kill grants exactly one defeat and cannot respawn before restart', t => {
  const { manager, state } = fixture(t); manager.updateEnemies(0);
  const enemy = manager.enemies[0], defeats = [];
  manager.onEnemyDefeated = (id, cause) => defeats.push([id, cause]);
  manager.hitEnemy(enemy, { power: 100 }, enemy.mesh.position);
  manager.hitEnemy(enemy, { power: 100 }, enemy.mesh.position); manager.updateEnemies(0);
  assert.equal(state.score, enemy.type.pointValue); assert.equal(defeats.length, 1);
  assert.deepEqual(defeats[0], ['mine:fighter', 'shot']);
  assert.equal(manager.enemies.length, 1); assert.equal(manager.destroyedPredefinedEnemies.size, 1);
});
