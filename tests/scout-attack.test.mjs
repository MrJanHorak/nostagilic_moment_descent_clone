import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import GameState from '../src/js/core/GameState.js';
import { presentScoutAttack } from '../src/js/entities/ScoutAttack.js';
import disposeObject from '../src/js/utils/disposeObject.js';

function fixture(t, onSound = () => {}) {
  t.mock.method(Math, 'random', () => 0.5);
  const scene = new THREE.Scene(), player = new THREE.Group(), state = new GameState();
  state.session.begin(); state.session.transition('playing');
  const solids = [], audio = { initialized: true, playSound: onSound };
  const manager = new EnemyManager(scene, player, state, audio, { currentLevel: { kind: 'arena', enemySpawns: [] }, isEndless: false, solidColliders: solids });
  const enemy = manager.spawnEnemy(new THREE.Vector3(0, 0, -5), 'scout');
  const tick = () => { state.session.advance(1 / 60); manager.updateEnemies(1 / 60); };
  const until = (predicate, limit = 500) => { for (let i = 0; i < limit && !predicate(); i++) tick(); assert(predicate()); };
  t.after(() => { state.session.end(); manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); disposeObject(scene); });
  return { manager, player, state, enemy, solids, tick, until };
}

test('scout warns without moving, commits a straight strike, deals one hit, then retreats and holds for return fire', t => {
  const f = fixture(t), { enemy, state, until, tick } = f;
  until(() => enemy.scoutAttack.phase === 'windup'); const origin = enemy.mesh.position.clone(), since = state.session.timeMs;
  const wings = enemy.mesh.getObjectByName('scout_wings'); assert(wings.scale.x < 1);
  for (let i = 0; i < 30; i++) tick(); assert(enemy.mesh.position.equals(origin)); assert.equal(state.playerHealth, 100);
  until(() => enemy.scoutAttack.phase === 'lunge'); assert(state.session.timeMs - since >= 550);
  until(() => state.playerHealth < 100); assert.equal(state.playerHealth, 95); assert.equal(enemy.isActive, true);
  assert.equal(enemy.scoutAttack.phase, 'recover'); const hitAt = enemy.mesh.position.clone();
  for (let i = 0; i < 40; i++) tick(); assert.equal(state.playerHealth, 95); assert(enemy.mesh.position.distanceTo(f.player.position) > hitAt.distanceTo(f.player.position));
  const held = enemy.mesh.position.clone(); for (let i = 0; i < 20; i++) tick(); assert(enemy.mesh.position.equals(held));
  assert.equal(state.score, 0); assert.equal(state.enemyKills.scout, 0);
  f.manager.hitEnemy(enemy, { power: 10 }, enemy.mesh.position); assert.equal(enemy.isActive, false); assert.equal(state.enemyKills.scout, 1);
});

test('sidestepping a committed lunge evades it; turning the player cannot steer the scout mid-strike', t => {
  const { player, enemy, state, until, tick } = fixture(t);
  until(() => enemy.scoutAttack.phase === 'lunge'); const direction = enemy.scoutAttack.direction.clone(), rotation = enemy.mesh.quaternion.clone();
  player.position.x = 4; until(() => enemy.scoutAttack.phase === 'recover');
  assert.equal(state.playerHealth, 100); assert.equal(enemy.mesh.position.x, 0);
  assert(enemy.scoutAttack.direction.equals(direction)); assert(enemy.mesh.quaternion.equals(rotation));
  for (let i = 0; i < 30; i++) tick(); assert.equal(state.playerHealth, 100);
});

test('cover cancels a wind-up; a closing wall blocks the committed body and strike', t => {
  const { player, enemy, state, solids, until, tick } = fixture(t);
  until(() => enemy.scoutAttack.phase === 'windup');
  const wall = { box: new THREE.Box3(new THREE.Vector3(-10, -10, -2.2), new THREE.Vector3(10, 10, -1.8)) };
  solids.push(wall); tick(); assert.equal(enemy.scoutAttack.phase, 'approach');
  for (let i = 0; i < 60; i++) tick(); assert.equal(state.playerHealth, 100);
  solids.pop(); until(() => enemy.scoutAttack.phase === 'lunge'); solids.push(wall);
  until(() => enemy.scoutAttack.phase === 'recover');
  assert.equal(state.playerHealth, 100); assert(enemy.mesh.position.z <= wall.box.min.z - enemy.collisionRadius);
  assert(enemy.mesh.position.distanceTo(player.position) > 2);
});

test('pause, death, reset and reentrant warnings cannot leave a delayed scout strike', t => {
  const f = fixture(t); f.until(() => f.enemy.scoutAttack.phase === 'windup');
  const since = f.enemy.scoutAttack.since, position = f.enemy.mesh.position.clone();
  f.state.session.transition('paused'); for (let i = 0; i < 100; i++) f.tick();
  assert.equal(f.enemy.scoutAttack.since, since); assert(f.enemy.mesh.position.equals(position));
  f.state.session.transition('playing'); f.manager.hitEnemy(f.enemy, { power: 10 }, position);
  for (let i = 0; i < 100; i++) f.tick(); assert.equal(f.state.playerHealth, 100);
  const next = f.manager.spawnEnemy(new THREE.Vector3(0, 0, -5), 'scout'); assert.equal(next.scoutAttack.phase, 'approach');
  f.manager.resetLevel(); for (let i = 0; i < 100; i++) f.tick(); assert.equal(f.state.playerHealth, 100); assert.equal(f.state.session.tasks.size, 0);
  let manager;
  const g = fixture(t, id => { if (id === 'enemyCharge') manager.resetLevel(); }); manager = g.manager;
  g.until(() => !g.enemy.isActive); assert.equal(g.state.playerHealth, 100); assert.equal(manager.enemies.length, 0);
});

test('scout cue transforms are bounded by the existing collision body and do not accumulate', t => {
  const { enemy, state, until } = fixture(t); until(() => enemy.scoutAttack.phase === 'windup');
  const time = state.session.timeMs + 300; presentScoutAttack(enemy, time); const wings = enemy.mesh.getObjectByName('scout_wings'), scale = wings.scale.clone();
  for (let i = 0; i < 1000; i++) presentScoutAttack(enemy, time);
  assert(wings.scale.equals(scale)); assert(wings.scale.x <= 1);
  enemy.scoutAttack.phase = 'approach'; presentScoutAttack(enemy, time); assert.equal(wings.scale.x, 1);
});

test('a scout damage callback that replaces the run cannot continue the old attack or damage the replacement', t => {
  const f = fixture(t); let replacement;
  t.mock.method(f.state, 'takeDamage', () => {
    f.manager.resetLevel(); f.state.session.end(); f.state.session.begin(); f.state.session.transition('playing');
    replacement = f.manager.spawnEnemy(new THREE.Vector3(0, 0, -15), 'scout');
  });
  f.until(() => replacement !== undefined);
  assert.equal(f.enemy.isActive, false); assert.equal(replacement.scoutAttack.phase, 'approach');
  assert.equal(f.manager.enemies.length, 1); assert.equal(f.state.playerHealth, 100);
});
