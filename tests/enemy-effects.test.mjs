import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import GameState from '../src/js/core/GameState.js';
import EnemyFactory from '../src/js/entities/EnemyFactory.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import { clearEnemies, removeEnemyAt } from '../src/js/entities/EnemyLifecycle.js';
import { enemyTypes } from '../src/js/entities/EnemyTypes.js';
import EffectsManager from '../src/js/effects/EffectsManager.js';
import ObjectPool from '../src/js/utils/ObjectPool.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import { animateEnemy } from '../src/js/entities/EnemyAnimations.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function managerFixture(t, audio = null) {
  const state = new GameState(), scene = new THREE.Scene(), player = new THREE.Group();
  state.session.begin(); state.session.transition('playing');
  const manager = new EnemyManager(scene, player, state, audio);
  t.after(() => { manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); });
  return { manager, state, scene };
}

function materialOf(enemy) {
  let material;
  enemy.mesh.traverse(child => { if (!material && child instanceof THREE.Mesh) material = child.material; });
  assert.ok(material instanceof THREE.Material);
  return material;
}

test('every enemy builder produces a finite combat body, with preserved light policy and independent instances', () => {
  const scene = new THREE.Scene(), factory = new EnemyFactory(scene), enemies = [];
  for (const definition of enemyTypes) {
    const enemy = factory.createEnemy(definition, v(2, 3, 4), { position: v() }, { accentLights: false });
    const other = factory.createEnemy(definition, v());
    enemies.push(enemy, other);
    assert.equal(enemy.type, definition); assert.equal(enemy.health, definition.health);
    assert.equal(enemy.isActive, true); assert.equal(enemy.fireRate, 2000);
    assert.equal(enemy.collider.isEmpty(), false);
    assert.ok(Number.isFinite(enemy.collisionRadius) && enemy.collisionRadius > 0);
    assert.ok(enemy.mesh.position.equals(v(2, 3, 4)));
    let lights = 0, defaultLights = 0, meshes = 0;
    enemy.mesh.traverse(child => { lights += child instanceof THREE.Light; meshes += child instanceof THREE.Mesh; });
    other.mesh.traverse(child => { defaultLights += child instanceof THREE.Light; });
    assert.equal(lights, 1); assert.ok(defaultLights >= lights); assert.ok(meshes > 0);
    if (definition.name === 'scout' || definition.name === 'fighter') assert.ok(defaultLights > lights);
    assert.notEqual(materialOf(enemy), materialOf(other));
  }
  clearEnemies(enemies); assert.equal(scene.children.length, 0);
});

test('invalid enemy definitions and positions fail before a builder or scene allocation', () => {
  const scene = new THREE.Scene(), factory = new EnemyFactory(scene), definition = enemyTypes[0];
  factory.meshBuilders.scout = { buildMesh() { assert.fail('invalid input reached builder'); } };
  for (const invalid of [undefined, { ...definition, name: 'constructor' }, { ...definition, name: 'interceptor' },
    { ...definition, size: 0 }, { ...definition, health: Infinity }, { ...definition, damage: -1 }, { ...definition, speed: 'fast' }]) {
    assert.throws(() => factory.createEnemy(invalid, v()), /enemy type|Enemy definition/);
  }
  for (const invalid of [[0, 0, 0], v(NaN), v(0, Infinity)]) {
    assert.throws(() => factory.createEnemy(definition, invalid), /finite Vector3/);
  }
  assert.equal(scene.children.length, 0);
});

test('a failed builder releases its attached shared resources once without publishing a partial enemy', () => {
  const scene = new THREE.Scene(), factory = new EnemyFactory(scene), failure = new Error('builder failed');
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  let geometryDisposals = 0, materialDisposals = 0, additions = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);
  scene.addEventListener('childadded', () => additions++);
  factory.meshBuilders.scout = { buildMesh(body) {
    body.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material)); throw failure;
  } };
  assert.throws(() => factory.createEnemy(enemyTypes[0], v()), error => error === failure);
  assert.deepEqual([geometryDisposals, materialDisposals, additions, scene.children.length], [1, 1, 0, 0]);
});

test('empty or nonfinite builder output cannot create an unbounded collision body', () => {
  const scene = new THREE.Scene(), factory = new EnemyFactory(scene);
  factory.meshBuilders.scout = { buildMesh() {} };
  assert.throws(() => factory.createEnemy(enemyTypes[0], v()), /no geometry/);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  let disposals = 0; geometry.addEventListener('dispose', () => disposals++);
  factory.meshBuilders.scout = { buildMesh(body) {
    const mesh = new THREE.Mesh(geometry, material); mesh.scale.x = Infinity; body.add(mesh);
  } };
  assert.throws(() => factory.createEnemy(enemyTypes[0], v()), /invalid bounds/);
  assert.equal(disposals, 1); assert.equal(scene.children.length, 0);
});

test('factory glow supports material arrays while preserving materials without emissive shading', () => {
  const scene = new THREE.Scene(), factory = new EnemyFactory(scene);
  const standard = new THREE.MeshStandardMaterial(), basic = new THREE.MeshBasicMaterial();
  factory.meshBuilders.scout = { buildMesh(body) { body.add(new THREE.Mesh(new THREE.BoxGeometry(), [standard, basic])); } };
  const enemy = factory.createEnemy(enemyTypes[0], v());
  assert.equal(standard.emissive.getHex(), enemyTypes[0].color); assert.equal(standard.emissiveIntensity, 0.8);
  assert.equal('emissive' in basic, false);
  clearEnemies([enemy]); assert.equal(scene.children.length, 0);
});

test('enemy removal invalidates identity before disposal hooks and cannot remove a neighboring enemy', () => {
  const scene = new THREE.Scene(), factory = new EnemyFactory(scene);
  const enemy = factory.createEnemy(enemyTypes[0], v()), neighbor = factory.createEnemy(enemyTypes[1], v());
  const enemies = [enemy, neighbor]; let disposals = 0;
  materialOf(enemy).addEventListener('dispose', () => {
    disposals++; assert.equal(enemy.isActive, false); assert.equal(enemies.includes(enemy), false);
    assert.equal(removeEnemyAt(enemies, enemies.indexOf(enemy)), null);
  });
  for (const invalid of [-1, 0.5, Infinity, NaN, 2]) assert.equal(removeEnemyAt(enemies, invalid), null);
  assert.equal(removeEnemyAt(enemies, 0), enemy); assert.equal(disposals, 1);
  assert.deepEqual(enemies, [neighbor]); assert.equal(neighbor.isActive, true);
  clearEnemies(enemies);
});

test('batch cleanup marks every enemy inactive before any disposal hook', () => {
  const factory = new EnemyFactory(new THREE.Scene());
  const enemies = enemyTypes.slice(0, 2).map(type => factory.createEnemy(type, v())), original = [...enemies];
  let disposals = 0;
  for (const enemy of original) materialOf(enemy).addEventListener('dispose', () => {
    disposals++; assert.equal(enemies.length, 0); assert.ok(original.every(item => !item.isActive)); clearEnemies(enemies);
  });
  clearEnemies(enemies); clearEnemies(enemies); assert.equal(disposals, 2);
});

test('enemy reset rejects replacement spawns during cleanup and remains reusable without kill credit', t => {
  const { manager, scene, state } = managerFixture(t);
  assert.throws(() => manager.spawnEnemy(v(), 'unknown'), /Unknown enemy type: unknown/);
  assert.equal(scene.children.length, 0); assert.equal(manager.enemies.length, 0);
  const enemy = manager.spawnEnemy(v(), 'scout'), neighbor = manager.spawnEnemy(v(), 'fighter');
  materialOf(enemy).addEventListener('dispose', () => {
    assert.equal(manager.enemies.length, 0); assert.equal(neighbor.isActive, false);
    assert.throws(() => manager.spawnEnemy(v(), 'scout'), /clearing/); manager.resetLevel();
  });
  manager.onEnemyDefeated = () => assert.fail('cleanup awarded objective credit');
  manager.resetLevel(); assert.equal(scene.children.length, 0); assert.equal(state.score, 0);
  assert.ok(manager.spawnEnemy(v(), 'scout').isActive);
});

test('combat destruction invalidates the enemy before effect/audio callbacks and credits its spawn once', t => {
  const { manager } = managerFixture(t), enemy = manager.spawnEnemy(v(), 'scout');
  enemy.mesh.userData.isPredefined = true; enemy.mesh.userData.spawnPointId = 'guard';
  let explosions = 0, sounds = 0, credits = 0;
  const reenter = () => {
    assert.equal(enemy.isActive, false); assert.equal(manager.enemies.includes(enemy), false);
    assert.equal(manager.destroyEnemy(manager.enemies.indexOf(enemy)), false);
  };
  manager.effectsManager.createExplosion = () => { explosions++; reenter(); };
  manager.audioManager = { initialized: true, playSound() { sounds++; reenter(); } };
  manager.onEnemyDefeated = (id, cause) => { credits++; assert.equal(id, 'guard'); assert.equal(cause, 'ram'); };
  assert.equal(manager.destroyEnemy(0, 'ram'), true); assert.equal(manager.destroyEnemy(0), false);
  assert.deepEqual([explosions, sounds, credits, manager.destroyedPredefinedEnemies.size], [1, 1, 1, 1]);
});

test('reentrant lethal hit feedback cannot award duplicate damage, score or kill statistics', t => {
  const { manager, state } = managerFixture(t), enemy = manager.spawnEnemy(v(), 'scout');
  let hitSounds = 0;
  manager.audioManager = { initialized: true, playSound(id) {
    if (id === 'hit') { hitSounds++; manager.hitEnemy(enemy, { power: 10 }, v()); }
  } };
  manager.hitEnemy(enemy, { power: 10 }, v());
  assert.equal(hitSounds, 1); assert.equal(state.score, enemy.type.pointValue);
  assert.equal(state.enemyKills.scout, 1); assert.equal(manager.enemies.length, 0);
});

test('a reset during enemy disposal cancels stale destruction feedback and objective credit', t => {
  const { manager, scene } = managerFixture(t), enemy = manager.spawnEnemy(v(), 'scout');
  enemy.mesh.userData.isPredefined = true; enemy.mesh.userData.spawnPointId = 'old-guard';
  materialOf(enemy).addEventListener('dispose', () => manager.resetLevel());
  manager.onEnemyDefeated = () => assert.fail('stale destruction credited after reset');
  assert.equal(manager.destroyEnemy(0), true);
  assert.equal(scene.children.length, 0); assert.equal(manager.destroyedPredefinedEnemies.size, 0);
  assert.equal(manager.effectsManager.explosionEffects.length, 0);
});

test('pool retention is bounded, duplicate returns are rejected, and disposal sees detached ownership', () => {
  const discarded = [], pool = new ObjectPool({ maxPerPool: 1, onDiscard(object) {
    assert.ok(!Object.values(pool.pools).flat().includes(object)); discarded.push(object);
  } });
  const first = new THREE.Group(), second = new THREE.Group();
  assert.equal(pool.returnToPool('one', first), true); assert.equal(first.visible, false);
  assert.equal(pool.returnToPool('one', first), false); assert.equal(pool.returnToPool('two', first), false);
  assert.equal(pool.returnToPool('one', second), false); assert.deepEqual(discarded, [second]);
  assert.equal(pool.getFromPool('one'), first); assert.equal(pool.getFromPool('one'), null);
  assert.equal(pool.returnToPool('two', first), true);
  pool.clearPool('two'); pool.clearAllPools(); assert.deepEqual(discarded, [second, first]);
});

test('pool draining and clearing invalidate all categories before disposal callbacks', () => {
  const pool = new ObjectPool({ onDiscard() { assert.equal(Object.keys(pool.pools).length, 0); } });
  pool.returnToPool('one', new THREE.Group()); pool.returnToPool('two', new THREE.Group());
  pool.clearAllPools(); pool.clearAllPools();
  const object = new THREE.Group(); pool.returnToPool('one', object);
  assert.deepEqual(pool.drainAll(), [object]); assert.equal(pool.getFromPool('one'), null);
  for (const maxPerPool of [-1, 0.5, Infinity, NaN]) {
    assert.throws(() => new ObjectPool({ maxPerPool, onDiscard() {} }), /capacity/);
  }
});

test('effects reuse resets color, scale, opacity and expiration while pause freezes the simulation', () => {
  const scene = new THREE.Scene(), state = new GameState(), session = state.session;
  session.begin(); session.transition('playing'); const effects = new EffectsManager(scene, session);
  effects.createHitEffect(v()); effects.createExplosion(v(), 0xff0000, true, 3); effects.update(0);
  const light = effects.activeExplosionLights[0], mesh = effects.explosionEffects[0].mesh;
  const particles = effects.hitEffects[0].particleSystem;
  session.transition('paused'); session.advance(1); effects.update(1);
  assert.equal(session.timeMs, 0); assert.equal(effects.activeExplosionLights.length, 1);
  assert.equal(mesh.material.opacity, 0.7);
  session.transition('playing'); session.advance(0.6); effects.update(0.6);
  assert.equal(scene.children.length, 0);
  effects.createHitEffect(v(1, 2, 3)); effects.createExplosion(v(4, 5, 6), 0x00ff00, true, 2); effects.update(0);
  assert.equal(effects.activeExplosionLights[0], light); assert.equal(light.color.getHex(), 0x00ff00);
  assert.equal(effects.explosionEffects[0].mesh, mesh); assert.equal(effects.hitEffects[0].particleSystem, particles);
  assert.equal(mesh.material.opacity, 0.7); assert.equal(particles.material.opacity, 0.7);
  assert.ok(mesh.scale.equals(v(2, 2, 2))); assert.ok(mesh.position.equals(v(4, 5, 6)));
  session.advance(0.1); effects.update(0.1); assert.equal(effects.activeExplosionLights.length, 1, 'deadline was renewed');
  session.advance(0.5); effects.update(0.5); assert.equal(scene.children.length, 0); effects.dispose();
});

test('effect bursts keep all active visuals but retain at most 32 of each expired category', () => {
  const scene = new THREE.Scene(), effects = new EffectsManager(scene), disposals = new Map();
  for (let i = 0; i < 40; i++) { effects.createHitEffect(v()); effects.createExplosion(v(), 0xff0000, true); }
  effects.update(0);
  assert.deepEqual([effects.activeHitLights.length, effects.activeExplosionLights.length, effects.hitEffects.length, effects.explosionEffects.length], [40, 40, 40, 40]);
  for (const object of [...effects.hitEffects.map(effect => effect.particleSystem), ...effects.explosionEffects.map(effect => effect.mesh)]) {
    for (const resource of [object.geometry, object.material]) {
      disposals.set(resource, 0); resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
    }
  }
  effects.update(0.6); assert.equal(scene.children.length, 0);
  for (const name of ['hitLight', 'explosionLight', 'hitParticles', 'explosionMesh']) assert.equal(effects.objectPool.pools[name].length, 32);
  assert.equal([...disposals.values()].filter(count => count === 1).length, 32, '8 particle and 8 mesh pairs discarded');
  effects.clear(); effects.dispose(); effects.dispose();
  assert.ok([...disposals.values()].every(count => count === 1));
});

test('effect clear invalidates active and cached references before hooks, rejects creation, and can be reused', () => {
  const scene = new THREE.Scene(), effects = new EffectsManager(scene);
  effects.createHitEffect(v()); effects.update(0); effects.update(0.4); // Cached particles.
  effects.createExplosion(v(), 0xff0000, true); // Active mesh.
  let callbacks = 0;
  const objects = [...Object.values(effects.objectPool.pools).flat(), ...effects.explosionEffects.map(effect => effect.mesh)];
  for (const object of objects) {
    if (!object.geometry) continue;
    object.geometry.addEventListener('dispose', () => {
      callbacks++; assert.equal(effects.hitEffects.length, 0); assert.equal(effects.explosionEffects.length, 0);
      assert.equal(effects.activeHitLights.length + effects.activeExplosionLights.length, 0);
      assert.equal(Object.keys(effects.objectPool.pools).length, 0);
      assert.throws(() => effects.createHitEffect(v()), /clearing/);
      assert.throws(() => effects.createExplosion(v(), 0xff0000), /clearing/); effects.clear();
    });
  }
  effects.clear(); effects.clear(); assert.equal(callbacks, 2); assert.equal(scene.children.length, 0);
  effects.createHitEffect(v()); effects.update(0); assert.equal(effects.hitEffects.length, 1); effects.dispose();
});

test('permanent effect retirement rejects allocation during and after disposal and updates remain inert', () => {
  const scene = new THREE.Scene(), effects = new EffectsManager(scene);
  effects.createExplosion(v(), 0xff0000, true); let disposals = 0;
  effects.explosionEffects[0].mesh.geometry.addEventListener('dispose', () => {
    disposals++; assert.throws(() => effects.createExplosion(v(), 0xff0000), /disposed/);
  });
  effects.dispose(); effects.dispose(); effects.clear(); effects.update(100); effects.processHitEffects(); effects.processExplosionEffects();
  assert.equal(disposals, 1); assert.equal(scene.children.length, 0); assert.equal(effects.elapsedMs, 0);
  assert.throws(() => effects.createHitEffect(v()), /disposed/); assert.throws(() => effects.createExplosion(v(), 0xff0000), /disposed/);
});

test('pool overflow disposal can clear the manager without continuing a stale update or double disposal', () => {
  const scene = new THREE.Scene(), effects = new EffectsManager(scene), resources = new Map();
  for (let i = 0; i < 33; i++) effects.createHitEffect(v());
  effects.update(0);
  for (const effect of effects.hitEffects) for (const resource of [effect.particleSystem.geometry, effect.particleSystem.material]) {
    resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
  }
  // Reverse expiry retains 32, then the first particle system overflows.
  effects.hitEffects[0].particleSystem.geometry.addEventListener('dispose', () => effects.clear());
  assert.doesNotThrow(() => effects.update(0.4));
  assert.equal(scene.children.length, 0); assert.equal(effects.hitEffects.length, 0);
  assert.equal(Object.keys(effects.objectPool.pools).length, 0);
  assert.ok([...resources.values()].every(count => count === 1)); effects.dispose();
});

test('a scene-removal callback that clears effects does not return the departing particles to a stale pool', () => {
  const scene = new THREE.Scene(), effects = new EffectsManager(scene);
  effects.createHitEffect(v()); effects.update(0);
  const particles = effects.hitEffects[0].particleSystem; let disposals = 0;
  particles.geometry.addEventListener('dispose', () => disposals++);
  scene.addEventListener('childremoved', event => { if (event.child === particles) effects.clear(); });
  effects.update(0.4);
  assert.equal(disposals, 1); assert.equal(scene.children.length, 0);
  assert.equal(Object.keys(effects.objectPool.pools).length, 0); effects.dispose(); assert.equal(disposals, 1);
});

test('all five shipped enemy rigs remain finite through their animation paths', t => {
  t.mock.method(Math, 'random', () => 0.5);
  const scene = new THREE.Scene(), factory = new EnemyFactory(scene);
  const enemies = enemyTypes.map(type => factory.createEnemy(type, v()));
  for (let frame = 0; frame < 120; frame++) for (const enemy of enemies) animateEnemy(enemy, 1 / 60, frame / 60);
  for (const enemy of enemies) enemy.mesh.traverse(child => {
    assert.ok([...child.position, ...child.quaternion, ...child.scale].every(Number.isFinite), child.name);
    if (child instanceof THREE.Mesh) {
      const positions = child.geometry.getAttribute('position');
      assert.ok([...positions.array].every(Number.isFinite), child.name);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        assert.ok(Number.isFinite(material.opacity));
        if (material instanceof THREE.MeshStandardMaterial) assert.ok(Number.isFinite(material.emissiveIntensity));
      }
    }
  });
  clearEnemies(enemies); assert.equal(scene.children.length, 0);
});

test('boss shield deformation is repeatable at a fixed time and bounded by the original surface', () => {
  const enemy = new EnemyFactory(new THREE.Scene()).createEnemy(enemyTypes.find(type => type.name === 'boss'), v());
  const shield = enemy.mesh.getObjectByName('boss_shield'), positions = shield.geometry.getAttribute('position');
  const rest = positions.array.slice();
  animateEnemy(enemy, 1 / 60, 10); const firstFrame = positions.array.slice();
  for (let i = 0; i < 100; i++) animateEnemy(enemy, 1 / 60, 10);
  assert.deepEqual(positions.array, firstFrame, 'repeated frames must not accumulate deformation');
  for (let frame = 0; frame < 180; frame++) {
    animateEnemy(enemy, 1 / 60, frame / 10);
    for (let i = 0; i < positions.count; i++) {
      const baseRadius = Math.hypot(...rest.slice(i * 3, i * 3 + 3));
      const radius = Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i));
      assert.ok(Math.abs(radius - baseRadius) <= 0.050001);
    }
  }
  clearEnemies([enemy]);
});

test('a shield vertex at the origin and malformed animation metadata do not poison scene transforms', () => {
  const body = new THREE.Group(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
  const shield = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); shield.name = 'boss_shield'; body.add(shield);
  animateEnemy({ mesh: body, type: { name: 'boss', size: 1 } }, 1 / 60, 1);
  assert.deepEqual([...geometry.attributes.position.array].slice(0, 3), [0, 0, 0]);
  assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
  const glowMaterials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial()];
  const engine = new THREE.Mesh(new THREE.BoxGeometry(), glowMaterials); engine.name = 'bomber_engine_glow_invalid';
  engine.userData = { pulsate: true, pulseSpeed: NaN, pulseMin: 'bad', pulseMax: Infinity, rotate: true, rotationAxis: 'invalid' };
  body.add(engine);
  const tube = new THREE.Group(); tube.name = 'bomber_tube_invalid'; body.add(tube);
  animateEnemy({ mesh: body, type: { name: 'bomber', size: 1 } }, 1 / 60, 1);
  assert.ok([...engine.scale, ...engine.quaternion, ...tube.position].every(Number.isFinite));
  for (const material of glowMaterials) assert.ok(Number.isFinite(material.opacity));
  assert.ok(glowMaterials.slice(0, 2).every(material => Number.isFinite(material.emissiveIntensity)));
  assert.equal('emissiveIntensity' in glowMaterials[2], false); disposeObject(body);
});

test('invalid animation times are ignored before modifying a rig', () => {
  const enemy = new EnemyFactory(new THREE.Scene()).createEnemy(enemyTypes.find(type => type.name === 'fighter'), v());
  const before = enemy.mesh.toJSON();
  for (const delta of [NaN, Infinity, -1]) animateEnemy(enemy, delta, 1);
  animateEnemy(enemy, 1 / 60, NaN); animateEnemy(enemy, 1 / 60, Infinity);
  assert.deepEqual(enemy.mesh.toJSON(), before); clearEnemies([enemy]);
});

test('a reset during scene publication cancels the pending spawn and releases its completed body', t => {
  const { manager, scene } = managerFixture(t), disposals = new Map();
  scene.addEventListener('childadded', event => {
    event.child.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      for (const resource of [child.geometry, child.material]) if (!disposals.has(resource)) {
        disposals.set(resource, 0); resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
      }
    });
    manager.resetLevel();
  });
  assert.throws(() => manager.spawnEnemy(v(), 'fighter'), /cancelled by a reset/);
  assert.equal(manager.enemies.length, 0); assert.equal(scene.children.length, 0);
  assert.ok(disposals.size > 0); assert.ok([...disposals.values()].every(count => count === 1));
});

test('ram damage that starts a replacement run cannot destroy or advance that run using the old frame', t => {
  const { manager, state } = managerFixture(t);
  const oldEnemy = manager.spawnEnemy(v(0, 0, 0.1), 'scout'); let replacement;
  t.mock.method(state, 'takeDamage', () => {
    manager.resetLevel(); state.session.end(); state.session.begin(); state.session.transition('playing');
    replacement = manager.spawnEnemy(v(0, 0, 15), 'fighter');
  });
  const projectiles = t.mock.method(manager.projectileManager, 'updateProjectiles', () => assert.fail('advanced replacement run'));
  manager.updateEnemies(1 / 60);
  assert.equal(oldEnemy.isActive, false); assert.equal(replacement.isActive, true);
  assert.deepEqual(manager.enemies, [replacement]); assert.ok(replacement.mesh.position.equals(v(0, 0, 15)));
  assert.equal(projectiles.mock.callCount(), 0);
});

test('effect update that resets enemy ownership stops the old orchestration frame', t => {
  const { manager } = managerFixture(t); let replacement;
  t.mock.method(manager.effectsManager, 'update', () => {
    manager.resetLevel(); replacement = manager.spawnEnemy(v(0, 0, 15), 'fighter');
  });
  t.mock.method(manager.projectileManager, 'updateProjectiles', () => assert.fail('continued after reset'));
  manager.updateEnemies(1 / 60);
  assert.ok(replacement.mesh.position.equals(v(0, 0, 15))); assert.equal(replacement.lastFireTime, 0);
});

test('defeat callback that resets the level cannot overwrite replacement enemy counters', t => {
  const { manager, state } = managerFixture(t), enemy = manager.spawnEnemy(v(), 'scout');
  enemy.mesh.userData.isPredefined = true; enemy.mesh.userData.spawnPointId = 'old-guard';
  state.uiManager = { updateEnemyCount() { assert.fail('stale counter update'); } };
  manager.onEnemyDefeated = () => { manager.resetLevel(); manager.spawnEnemy(v(0, 0, 15), 'fighter'); };
  assert.equal(manager.destroyEnemy(0), true);
  assert.equal(manager.enemies.length, 1); assert.equal(manager.enemies[0].type.name, 'fighter');
  assert.equal(manager.destroyedPredefinedEnemies.size, 0);
});

test('boss burst callbacks remain paused with the session and cannot fire after their enemy is removed', t => {
  const { manager, state } = managerFixture(t);
  t.mock.method(Math, 'random', () => 0.1);
  const boss = manager.spawnEnemy(v(0, 0, 20), 'boss');
  state.session.advance(3); manager.updateEnemies(1 / 60);
  assert.equal(state.session.tasks.size, 2); assert.equal(manager.projectileManager.enemyProjectiles.length, 1);
  state.session.transition('paused'); state.session.advance(1); manager.updateEnemies(1);
  assert.equal(state.session.tasks.size, 2); assert.equal(manager.projectileManager.enemyProjectiles.length, 1);
  manager.removeEnemy(manager.enemies.indexOf(boss)); state.session.transition('playing'); state.session.advance(0.5);
  assert.equal(state.session.tasks.size, 0); assert.equal(manager.projectileManager.enemyProjectiles.length, 1);
});

test('optional enemy-count feedback is not required to spawn and defeat authored enemies', t => {
  const { manager, state } = managerFixture(t);
  manager.levelManager = { currentLevel: { kind: 'arena', enemySpawns: [{ id: 'guard', enemyType: 'scout', position: v(0, 0, 10) }] } };
  state.uiManager = {};
  manager.spawnPredefinedEnemies(); assert.equal(manager.enemies.length, 1);
  assert.equal(manager.destroyEnemy(0), true); assert.deepEqual([...manager.destroyedPredefinedEnemies], ['guard']);
});
