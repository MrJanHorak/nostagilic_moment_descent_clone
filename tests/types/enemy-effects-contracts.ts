// Compile-only contracts for concrete builders, enemy ownership and effect pools.
import { Group, Mesh, MeshBasicMaterial, PointsMaterial, Scene, Vector3 } from 'three';
import EnemyFactory from '../../src/js/entities/EnemyFactory.js';
import { enemyTypes } from '../../src/js/entities/EnemyTypes.js';
import { clearEnemies, removeEnemyAt } from '../../src/js/entities/EnemyLifecycle.js';
import EffectsManager from '../../src/js/effects/EffectsManager.js';

const scene = new Scene(), factory = new EnemyFactory(scene), effects = new EffectsManager(scene);
const enemy = factory.createEnemy(enemyTypes[0], new Vector3(), new Group(), { accentLights: false });
const enemies = [enemy];
factory.meshBuilders.boss.buildMesh(new Group(), enemyTypes[4]);
enemy.isActive = false; // Mutable lifetime belongs to the owning code.
removeEnemyAt(enemies, 0); clearEnemies(enemies);
effects.createHitEffect(new Vector3());
effects.createExplosion(new Vector3(), 0xff0000, true, 2);
const pool = effects.objectPool;
const particles = pool.getFromPool('hitParticles');
if (particles) {
  const material: PointsMaterial = particles.material;
  void material; pool.returnToPool('hitParticles', particles);
}
effects.clear(); effects.dispose();

// @ts-expect-error Enemy definition names must identify a supported builder.
factory.createEnemy({ ...enemyTypes[0], name: 'interceptor' }, new Vector3());
// @ts-expect-error Enemy health must be numeric.
factory.createEnemy({ ...enemyTypes[0], health: 'tough' }, new Vector3());
// @ts-expect-error Spawn positions must be world vectors.
factory.createEnemy(enemyTypes[0], [0, 0, 0]);
// @ts-expect-error Light policy is a boolean option.
factory.createEnemy(enemyTypes[0], new Vector3(), null, { accentLights: 'off' });
// @ts-expect-error Builders require a body group.
factory.meshBuilders.scout.buildMesh(new Vector3(), enemyTypes[0]);
// @ts-expect-error Removal requires complete owned enemy instances.
removeEnemyAt([{ isActive: true }], 0);
// @ts-expect-error Removal uses a numeric index.
removeEnemyAt(enemies, enemy);
// @ts-expect-error Enemy body identity cannot be replaced by a consumer.
enemy.mesh = new Group();
// @ts-expect-error Hit positions must be vectors.
effects.createHitEffect([0, 0, 0]);
// @ts-expect-error Explosive mode must be boolean.
effects.createExplosion(new Vector3(), 0xff0000, 1);
// @ts-expect-error Explosion radius must be numeric.
effects.createExplosion(new Vector3(), 0xff0000, true, 'large');
// @ts-expect-error Pool categories are known names.
pool.getFromPool('sparks');
// @ts-expect-error A mesh cannot be returned to the particle category.
pool.returnToPool('hitParticles', new Mesh(undefined, new MeshBasicMaterial()));
// @ts-expect-error Diagnostic views cannot mutate pool membership.
pool.pools.hitParticles?.push(particles!);
// @ts-expect-error Particle creation is internal to effect ownership.
effects.createHitParticleSystem();
