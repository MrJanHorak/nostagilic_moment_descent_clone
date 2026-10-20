import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFighterAttack, advanceFighterAttack, presentFighterAttack, FIGHTER_WINDUP_MS, FIGHTER_RECOVERY_MS, FIGHTER_FLASH_MS } from '../src/js/entities/FighterAttack.js';
import createAttackWarningSound from '../src/js/core/AttackWarningSound.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import GameState from '../src/js/core/GameState.js';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import disposeObject from '../src/js/utils/disposeObject.js';

test('fighter timing gives every shot a full wind-up, a recovery window and the existing firing interval', () => {
  const state = createFighterAttack(0, 2000);
  assert.equal(advanceFighterAttack(state, 1349, true, 2000), null);
  assert.equal(advanceFighterAttack(state, 1350, true, 2000), 'charge');
  assert.equal(advanceFighterAttack(state, 1999, true, 2000), null);
  assert.equal(advanceFighterAttack(state, 2000, true, 2000), 'fire');
  assert.equal(state.phase, 'recover');
  assert.equal(advanceFighterAttack(state, 2849, true, 2500), null);
  assert.equal(advanceFighterAttack(state, 2850, true, 2500), null); assert.equal(state.phase, 'idle');
  assert.equal(advanceFighterAttack(state, 3850, true, 2500), 'charge');
  assert.equal(advanceFighterAttack(state, 4500, true, 2500), 'fire');
});

test('losing aim, range or sight cancels stored wind-up and reacquisition never releases an instant shot', () => {
  const state = createFighterAttack(0, 2000);
  assert.equal(advanceFighterAttack(state, 1350, true, 2000), 'charge');
  assert.equal(advanceFighterAttack(state, 1999, false, 2000), null); assert.equal(state.phase, 'idle');
  assert.equal(advanceFighterAttack(state, 2100, true, 2000), null);
  assert.equal(advanceFighterAttack(state, 2199, true, 2000), 'charge');
  assert.equal(advanceFighterAttack(state, 2848, true, 2000), null);
  assert.equal(advanceFighterAttack(state, 2849, true, 2000), 'fire');
});

test('long frames emit at most one shot and a fresh warning rather than a catch-up burst', () => {
  const state = createFighterAttack(0, 2000);
  assert.equal(advanceFighterAttack(state, 100000, true, 2000), 'charge');
  assert.equal(advanceFighterAttack(state, 100000, true, 2000), null);
  assert.equal(advanceFighterAttack(state, 200000, true, 2000), 'fire');
  assert.equal(advanceFighterAttack(state, 200000, true, 2000), null);
  assert.equal(advanceFighterAttack(state, 300000, true, 2000), 'charge');
  const before = structuredClone(state);
  for (const invalid of [NaN, Infinity, 299999]) assert.equal(advanceFighterAttack(state, invalid, true, 2000), null);
  assert.deepEqual(state, before);
});

function fixture(t, onSound = () => {}) {
  t.mock.method(Math, 'random', () => 0.5);
  const model = new EditorDocument(); model.resizeRoom('room-1', [32, 16, 32]);
  const level = compileLevelDocument(model.document), world = buildArena(level), state = new GameState();
  state.session.begin(); state.session.transition('playing');
  const scene = new THREE.Scene(), player = new THREE.Group(); player.position.set(0, 0, 4); scene.add(world.group, player);
  const sounds = [], audio = { initialized: true, playSound(id, options) { sounds.push(id); onSound(id, options); } };
  const manager = new EnemyManager(scene, player, state, audio,
    { currentLevel: level, solidColliders: world.colliders, isEndless: false, tunnelWidth: 32, tunnelHeight: 16 });
  const enemy = manager.spawnEnemy(new THREE.Vector3(0, 0, -10), 'fighter');
  const fire = manager.projectileManager.fireEnemyProjectile.bind(manager.projectileManager); let shots = 0;
  t.mock.method(manager.projectileManager, 'fireEnemyProjectile', (...args) => { shots++; return fire(...args); });
  const tick = () => { state.session.advance(1 / 60); manager.updateEnemies(1 / 60); };
  const until = (predicate, limit = 600) => { for (let i = 0; i < limit && !predicate(); i++) tick(); assert(predicate()); };
  t.after(() => { state.session.end(); manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); disposeObject(world.group); });
  return { manager, enemy, player, state, world, tick, until, sounds, shots: () => shots };
}

test('live fighter braces, shows amber charge/white flash/blue recovery, and fires a real damaging projectile', t => {
  const { enemy, manager, state, until, tick, sounds, shots } = fixture(t);
  const ring = enemy.mesh.getObjectByName('fighter_charge_ring'), weapon = enemy.mesh.getObjectByName('fighter_weapon');
  until(() => enemy.fighterAttack.phase === 'windup');
  assert.equal(ring.visible, true); assert.equal(ring.material.color.getHex(), 0xffc34f);
  const position = enemy.mesh.position.clone(), since = enemy.fighterAttack.since;
  for (let i = 0; i < 30; i++) tick();
  assert(enemy.mesh.position.equals(position)); assert.equal(shots(), 0); assert(weapon.position.z > enemy.type.size * 1.2);
  until(() => enemy.fighterAttack.phase === 'recover');
  assert(state.session.timeMs - since >= FIGHTER_WINDUP_MS); assert.equal(shots(), 1);
  assert.equal(ring.material.color.getHex(), 0xffffff);
  for (let i = 0; i < 10; i++) tick();
  assert.equal(ring.material.color.getHex(), 0x235268); assert(enemy.mesh.position.equals(position));
  assert.equal(shots(), 1); assert.equal(sounds.filter(id => id === 'enemyCharge').length, 1);
  until(() => state.playerHealth < 100); assert.equal(state.playerHealth, 90);
  assert(manager.projectileManager.enemyProjectiles.every(projectile => projectile.power === 10));
});

test('new cover during wind-up cancels the shot and the next clear sighting needs a fresh full warning', t => {
  const { enemy, world, until, tick, state, sounds, shots } = fixture(t);
  until(() => enemy.fighterAttack.phase === 'windup'); for (let i = 0; i < 30; i++) tick();
  const barrier = { id: 'closed-cover', box: new THREE.Box3(new THREE.Vector3(-3, -3, -2), new THREE.Vector3(3, 3, -1)) };
  world.colliders.push(barrier); tick(); assert.equal(enemy.fighterAttack.phase, 'idle');
  assert.equal(enemy.mesh.getObjectByName('fighter_charge_ring').visible, false);
  for (let i = 0; i < 90; i++) tick(); assert.equal(shots(), 0); assert.equal(state.playerHealth, 100);
  world.colliders.splice(world.colliders.indexOf(barrier), 1);
  until(() => enemy.fighterAttack.phase === 'windup'); const since = enemy.fighterAttack.since;
  for (let i = 0; i < 30; i++) tick(); assert.equal(shots(), 0);
  until(() => shots() === 1); assert(state.session.timeMs - since >= FIGHTER_WINDUP_MS);
  assert.equal(sounds.filter(id => id === 'enemyCharge').length, 2);
});

test('pause freezes charge; death, reset and session replacement leave no delayed attacks', t => {
  const { manager, enemy, state, until, tick, shots } = fixture(t);
  until(() => enemy.fighterAttack.phase === 'windup'); for (let i = 0; i < 10; i++) tick();
  const before = { ...enemy.fighterAttack }, position = enemy.mesh.position.clone();
  state.session.transition('paused'); for (let i = 0; i < 200; i++) tick();
  assert.deepEqual(enemy.fighterAttack, before); assert(enemy.mesh.position.equals(position)); assert.equal(shots(), 0);
  state.session.transition('playing'); manager.hitEnemy(enemy, { power: 100 }, enemy.mesh.position);
  for (let i = 0; i < 200; i++) tick(); assert.equal(shots(), 0);
  const replacement = manager.spawnEnemy(new THREE.Vector3(0, 0, -10), 'fighter');
  assert.equal(replacement.fighterAttack.phase, 'idle'); assert(replacement.fighterAttack.readyAt > state.session.timeMs);
  manager.resetLevel(); for (let i = 0; i < 200; i++) tick();
  assert.equal(manager.enemies.length, 0); assert.equal(shots(), 0); assert.equal(state.session.tasks.size, 0);
});

test('warning callbacks may reset the encounter without releasing a stale shot or touching a new enemy', t => {
  let manager;
  const f = fixture(t, id => { if (id === 'enemyCharge') manager.resetLevel(); }); manager = f.manager;
  f.until(() => manager.enemies.length === 0);
  assert.equal(f.enemy.isActive, false); assert.equal(f.shots(), 0); assert.equal(f.state.session.tasks.size, 0);
});

test('presentation derives transforms from state without cumulative drift or extra scene resources', t => {
  const { enemy, until, state } = fixture(t); until(() => enemy.fighterAttack.phase === 'windup');
  const weapon = enemy.mesh.getObjectByName('fighter_weapon'), ring = enemy.mesh.getObjectByName('fighter_charge_ring');
  const geometry = ring.geometry, children = enemy.mesh.children.length;
  const time = state.session.timeMs + 300; presentFighterAttack(enemy, time);
  const position = weapon.position.clone(), scale = ring.scale.clone();
  for (let i = 0; i < 1000; i++) presentFighterAttack(enemy, time);
  assert(weapon.position.equals(position)); assert(ring.scale.equals(scale));
  assert.equal(enemy.mesh.children.length, children); assert.equal(ring.geometry, geometry);
  enemy.fighterAttack.phase = 'recover'; enemy.fighterAttack.since = time; enemy.fighterAttack.firedAt = time;
  presentFighterAttack(enemy, time + FIGHTER_FLASH_MS); assert.equal(ring.material.color.getHex(), 0x235268);
  enemy.fighterAttack.phase = 'idle'; presentFighterAttack(enemy, time + FIGHTER_RECOVERY_MS);
  assert.equal(ring.visible, false); assert.equal(weapon.position.z, enemy.type.size * 1.2);
});

test('warning chirps are deterministic, bounded and silent at their ends/gap', () => {
  const context = { sampleRate: 8000, createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, getChannelData: i => data[i] };
  } };
  const buffer = createAttackWarningSound(context), data = buffer.getChannelData(0);
  assert.equal(buffer.numberOfChannels, 1); assert.equal(buffer.length, 1920);
  assert.deepEqual(data, createAttackWarningSound(context).getChannelData(0));
  assert(data.every(sample => Number.isFinite(sample) && Math.abs(sample) < 0.4));
  assert(data.some(sample => Math.abs(sample) > 0.2)); assert.equal(data[0], 0); assert(Math.abs(data.at(-1)) < 0.001);
  assert(data.slice(820, 1100).every(sample => sample === 0));
});
