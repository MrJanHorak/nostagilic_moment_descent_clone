import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import GameState from '../src/js/core/GameState.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import createCrossfireRelay from '../src/js/core/levels/CrossfireRelay.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const box = (min, max) => new THREE.Box3(v(...min), v(...max));
function fixture(t, authored = true) {
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  state.weaponInventory.pulse.ammo = 40; state.pulseAmmoCapacity = 80;
  const scene = new THREE.Scene(), player = new THREE.Group(), messages = [];
  const ui = { updateHUD() {}, updateWeaponUI() {}, showMessage(message) { messages.push(message); } };
  const level = { currentLevel: authored ? { ...createCrossfireRelay(), powerupSpawns: [] } : { kind: 'arena', enemySpawns: [] },
    solidColliders: [], tunnelWidth: 30, tunnelHeight: 20, isEndless: false };
  const enemies = new EnemyManager(scene, player, state, null, level);
  enemies.effectsManager.dynamicLights = false;
  const pickups = new PowerUpManager(scene, player, state, null, ui, level);
  enemies.setPowerUpManager(pickups);
  const shots = new ProjectileManager(scene, player, null, state.session);
  shots.setCanvas({});
  shots.setCombatWorld({ transientLights: false, getTargets: () => enemies.enemies,
    getColliders: () => level.solidColliders, getRules: () => ({ pulseDamage: 5 }),
    onTargetHit: (enemy, shot, point) => enemies.hitEnemy(enemy, shot, point) });
  t.after(() => { state.session.end(); pickups.clear(); shots.dispose(); enemies.resetLevel(); enemies.projectileManager.dispose(); enemies.effectsManager.dispose(); });
  return { state, player, level, enemies, pickups, shots, messages };
}

test('authored scout/fighter durability increases while legacy training keeps its original health', t => {
  const mine = fixture(t), legacy = fixture(t, false);
  for (const [type, health, old] of [['scout', 20, 10], ['fighter', 40, 25], ['bomber', 50, 50], ['destroyer', 100, 100], ['boss', 200, 200]]) {
    assert.equal(mine.enemies.spawnEnemy(v(), type).health, health);
    assert.equal(legacy.enemies.spawnEnemy(v(), type).health, old);
  }
});

test('each authored shot kill leaves one persistent equipment-specific reward without duplicate kill/drop credit', t => {
  const { enemies, pickups, state } = fixture(t);
  for (const [type, drop] of [['scout', 'pulseAmmo'], ['fighter', 'laserSalvage'], ['bomber', 'missileSalvage'], ['destroyer', 'plasmaSalvage'], ['boss', 'plasmaSalvage']]) {
    const enemy = enemies.spawnEnemy(v(8), type), before = pickups.powerups.length;
    enemies.hitEnemy(enemy, { power: 10000 }, enemy.mesh.position);
    enemies.hitEnemy(enemy, { power: 10000 }, enemy.mesh.position);
    assert.equal(pickups.powerups.length, before + 1);
    assert.equal(pickups.powerups.at(-1).type.name, drop);
    assert.equal(pickups.powerups.at(-1).lifetime, Infinity);
    assert.equal(state.enemyKills[type], 1);
  }
  pickups.update(60); assert.equal(pickups.powerups.length, 5, 'salvage survives a long route back');
});

test('cleanup, ramming and repeated retirement cannot manufacture equipment rewards', t => {
  const { enemies, pickups } = fixture(t);
  const removed = enemies.spawnEnemy(v(), 'fighter'); enemies.removeEnemy(enemies.enemies.indexOf(removed));
  const rammed = enemies.spawnEnemy(v(), 'fighter'); enemies.destroyEnemy(enemies.enemies.indexOf(rammed), 'ram');
  enemies.spawnEnemy(v(), 'fighter'); enemies.resetLevel();
  assert.equal(pickups.powerups.length, 0);
});

test('salvage unlocks the matching weapon without switching, supplies bounded ammo, and resets with the session', t => {
  const { pickups, player, state, messages } = fixture(t);
  for (const [type, ammo, cap, key] of [['laser', 12, 60, 2], ['missile', 4, 20, 3], ['plasma', 8, 40, 4]]) {
    pickups.spawnPowerup(v(), `${type}Salvage`, { persistent: true }); pickups.update(0);
    assert.deepEqual(state.weaponInventory[type], { unlocked: true, ammo });
    assert.equal(state.currentWeapon, 'pulse'); assert.ok(messages.at(-1).includes(`${key} TO SELECT`));
    state.weaponInventory[type].ammo = cap;
    const reward = pickups.spawnPowerup(v(), `${type}Salvage`, { persistent: true }); pickups.update(0);
    assert.ok(pickups.powerups.includes(reward), 'full ammunition leaves the reward available');
    state.weaponInventory[type].ammo = cap - 1; pickups.update(0);
    assert.equal(state.weaponInventory[type].ammo, cap); assert.ok(!pickups.powerups.includes(reward));
  }
  player.position.set(10, 0, 0); pickups.spawnPowerup(v(), 'laserSalvage', { persistent: true });
  pickups.clear(); state.resetForSession();
  assert.equal(pickups.powerups.length, 0); assert.equal(state.currentWeapon, 'pulse');
  assert.deepEqual(state.weaponInventory.laser, { unlocked: false, ammo: 0 });
});

test('a wall prevents collecting salvage through it and an open passage permits collection', t => {
  const { pickups, player, state, level } = fixture(t);
  player.position.set(-0.3, 0, 0);
  level.solidColliders.push({ box: box([0, -2, -2], [0.1, 2, 2]) });
  pickups.spawnPowerup(v(0.3), 'missileSalvage', { persistent: true }); pickups.update(0);
  assert.equal(state.weaponInventory.missile.unlocked, false); assert.equal(pickups.powerups.length, 1);
  level.solidColliders.length = 0; pickups.update(0);
  assert.equal(state.weaponInventory.missile.unlocked, true); assert.equal(pickups.powerups.length, 0);
});

test('salvaged weapons fire at the authored damage scale, spend their ammo and fall back to pulse when empty', t => {
  const { state, shots, pickups } = fixture(t);
  for (const [type, power, radius] of [['laser', 7.5, 0], ['missile', 15, 4], ['plasma', 10, 2.5]]) {
    pickups.spawnPowerup(v(), `${type}Salvage`); pickups.update(0); assert.equal(state.switchWeapon(type), true);
    const before = state.weaponInventory[type].ammo;
    const shot = shots.fireProjectile(state, { requirePointerLock: false });
    assert.ok(shot); assert.equal(shot.power, power); assert.equal(shot.penetrating, type === 'laser');
    if (radius) assert.equal(shot.explosionRadius, radius);
    assert.equal(shot.guided, false, 'salvaged missiles fly toward the aim, never back toward the player');
    assert.equal(state.weaponInventory[type].ammo, before - 1);
    shots.clear(); state.weaponInventory[type].ammo = 0;
    assert.equal(shots.fireProjectile(state, { requirePointerLock: false }), undefined);
    assert.equal(state.currentWeapon, 'pulse');
  }
});

function target(x, y = 0) {
  return { isActive: true, health: 100, mesh: { position: v(x, y) }, collider: box([x - 0.25, y - 0.25, -0.25], [x + 0.25, y + 0.25, 0.25]) };
}
function traceFixture(t, targets, colliders = []) {
  const scene = new THREE.Scene(), player = new THREE.Group(), state = new GameState(); state.session.begin(); state.session.transition('playing');
  const shots = new ProjectileManager(scene, player, null, state.session), hits = [], explosions = [];
  shots.setCombatWorld({ transientLights: false, getTargets: () => targets, getColliders: () => colliders,
    onTargetHit(enemy, projectile) { hits.push(enemy); enemy.health -= projectile.power; },
    onExplosion(position, radius) { explosions.push({ position, radius }); } });
  const fire = options => { const shot = shots.createProjectile(v(), new THREE.Quaternion(), { power: 20, trailType: null, ...options }); shot.velocity.set(20, 0, 0); return shot; };
  t.after(() => shots.dispose()); return { shots, state, hits, explosions, fire };
}

test('laser pierces each robot once across frames, stops at walls, and handles a target at its muzzle', t => {
  const a = target(0), b = target(3), hidden = target(7);
  const { shots, hits, fire } = traceFixture(t, [hidden, b, a], [{ box: box([5, -2, -2], [5.1, 2, 2]) }]);
  const shot = fire({ penetrating: true }); shot.launchOrigin = v(-1);
  shots.moveProjectile(shot, 0.01); shots.moveProjectile(shot, 0.01); shots.moveProjectile(shot, 0.5);
  assert.deepEqual(hits, [a, b]); assert.equal(a.health, 80); assert.equal(b.health, 80); assert.equal(hidden.health, 100);
  assert.equal(shots.projectiles.length, 0);
  shots.moveProjectile(shot, 1); assert.equal(hits.length, 2);
});

test('missile blast gives one full direct hit, distance falloff to neighbors, and no damage behind a wall or outside its radius', t => {
  const direct = target(3), near = target(3, 1), far = target(3, 3), covered = target(3, -1), outside = target(3, 5);
  const { shots, hits, explosions, fire } = traceFixture(t, [direct, near, far, covered, outside], [{ box: box([1, -0.6, -2], [6, -0.5, 2]) }]);
  const shot = fire({ explosive: true, explosionRadius: 4 }); shots.moveProjectile(shot, 0.5);
  assert.equal(direct.health, 80); assert.equal(hits.filter(enemy => enemy === direct).length, 1);
  assert.ok(near.health < far.health && far.health < 100); assert.equal(covered.health, 100); assert.equal(outside.health, 100);
  assert.equal(explosions.length, 1); assert.equal(explosions[0].radius, 4);
  shots.moveProjectile(shot, 1); assert.equal(explosions.length, 1);
});

test('a wall impact explodes on the incoming side and never damages robots behind the wall', t => {
  const front = target(4, 1), behind = target(6);
  const { shots, explosions, fire } = traceFixture(t, [front, behind], [{ box: box([5, -3, -3], [5.2, 3, 3]) }]);
  shots.moveProjectile(fire({ explosive: true, explosionRadius: 4 }), 1);
  assert.ok(front.health < 100); assert.equal(behind.health, 100); assert.equal(explosions.length, 1);
});

test('penetration rejects reentrant movement and a callback reset stops remaining laser/blast damage', t => {
  for (const explosive of [false, true]) {
    const first = target(2), next = target(3);
    const { shots, fire } = traceFixture(t, [first, next]); let hits = 0;
    shots.setCombatWorld({ getTargets: () => [first, next], onTargetHit(_target, shot) {
      hits++; shots.moveProjectile(shot, 1); shots.clear();
    } });
    shots.moveProjectile(fire({ penetrating: !explosive, explosive, explosionRadius: 4 }), 1);
    assert.equal(hits, 1); assert.equal(next.health, 100); assert.equal(shots.projectiles.length, 0);
  }
});
