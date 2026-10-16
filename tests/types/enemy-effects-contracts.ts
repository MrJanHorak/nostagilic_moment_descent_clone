// Compile-only contracts for concrete builders, enemy ownership and effect pools.
import { Group, Mesh, MeshBasicMaterial, PointsMaterial, Scene, Vector3 } from 'three';
import EnemyFactory from '../../src/js/entities/EnemyFactory.js';
import EnemyManager from '../../src/js/entities/EnemyManager.js';
import { animateEnemy, getEnemyFiringRange } from '../../src/js/entities/EnemyAnimations.js';
import GameState from '../../src/js/core/GameState.js';
import type { EnemyLevelView } from '../../src/js/combatContracts.js';
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

const level: EnemyLevelView = { tunnelWidth: 15, tunnelHeight: 12, isEndless: false, solidColliders: [],
  currentLevel: { kind: 'arena', enemySpawns: [{ id: 'guard', enemyType: 'scout', position: new Vector3() }] } };
const manager = new EnemyManager(scene, new Group(), new GameState(), null, level);
manager.setPowerUpManager({ spawnPowerup(position, type) { position.clone(); void type; } });
manager.onEnemyDefeated = (id, cause) => { id.toUpperCase(); const combatCause: 'shot' | 'ram' = cause; void combatCause; };
manager.spawnEnemy(new Vector3(), 'fighter'); manager.setLevelSegments([new Group()]);
manager.hitEnemy(enemy, { power: 5 }, new Vector3());
animateEnemy(enemy, 1 / 60, 2); getEnemyFiringRange('boss');

// @ts-expect-error Player transforms must expose an Object3D, not just a vector.
new EnemyManager(scene, new Vector3(), new GameState(), null);
// @ts-expect-error Enemy orchestration requires the actual player/session state.
new EnemyManager(scene, new Group(), {}, null);
// @ts-expect-error Spawn names identify known definitions.
manager.spawnEnemy(new Vector3(), 'interceptor');
// @ts-expect-error Damage is numeric at the hit boundary.
manager.hitEnemy(enemy, { power: 'strong' }, new Vector3());
// @ts-expect-error Hits need a complete combat target.
manager.hitEnemy({ isActive: true }, { power: 5 }, new Vector3());
// @ts-expect-error Drop collaborators receive known drop identifiers, not numbers.
manager.setPowerUpManager({ spawnPowerup(_position: Vector3, _type: number) {} });
// @ts-expect-error Objective callbacks identify spawns with strings.
manager.onEnemyDefeated = (_id: boolean) => {};
// @ts-expect-error Authored enemy positions are runtime vectors.
const badSpawn: EnemyLevelView['currentLevel'] = { enemySpawns: [{ enemyType: 'scout', position: [0, 0, 0] }] };
void badSpawn;
// @ts-expect-error Segment transforms must be scene objects.
manager.setLevelSegments([new Vector3()]);
// @ts-expect-error Cleanup is not a combat defeat cause.
manager.destroyEnemy(0, 'cleanup');
// @ts-expect-error Animation needs the typed enemy size as well as its name/body.
animateEnemy({ mesh: new Group(), type: { name: 'scout' } }, 1 / 60);
// @ts-expect-error Simulation delta must be numeric.
animateEnemy(enemy, 'fast');
// @ts-expect-error Firing ranges are defined for known enemy types.
getEnemyFiringRange('interceptor');
// @ts-expect-error Generation checks are internal to orchestration.
manager.isCurrent(0, 1);
