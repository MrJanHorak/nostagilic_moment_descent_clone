// Compile-only examples for projectile creation, hit callbacks and resource ownership.
import { Box3, Group, Quaternion, Scene, Vector3 } from 'three';
import GameState from '../../src/js/core/GameState.js';
import InputManager from '../../src/js/core/InputManager.js';
import ProjectileManager from '../../src/js/entities/ProjectileManager.js';
import { enemyTypes } from '../../src/js/entities/EnemyTypes.js';
import disposeObject from '../../src/js/utils/disposeObject.js';
import type { EnemyCombatTarget, EnemyProjectile } from '../../src/js/combatContracts.js';

const state = new GameState(), root = new Group(), scene = new Scene();
const shots = new ProjectileManager(scene, root, null, state.session);
new InputManager(null, shots, state); // Real implementation satisfies the input firing port.
const target: EnemyCombatTarget = { mesh: new Group(), type: enemyTypes[0], health: 10,
  collider: new Box3(), velocity: new Vector3(), collisionRadius: 0.5, isActive: true, lastFireTime: 0, fireRate: 2000 };
shots.setCombatWorld({ getTargets: () => [target], getColliders: () => [new Box3()], getRules: () => ({ pulseDamage: 5 }),
  onTargetHit(enemy, projectile, point) {
    const faction: 'player' = projectile.faction;
    enemy.health -= projectile.power; point.clone(); void faction;
  } });
const pulse = shots.createProjectile(new Vector3(), new Quaternion(), { power: 5, trailType: null, launchOrigin: new Vector3() });
const hostile = shots.fireEnemyProjectile(target, root);
shots.moveProjectile(pulse, 1 / 60);
shots.updateProjectiles(1 / 60, root, state, { createExplosion() {} });
disposeObject(pulse.trail);
shots.clear(); shots.dispose();

// @ts-expect-error Projectile type names must identify supported geometries.
shots.createProjectile(new Vector3(), new Quaternion(), { type: 'railgun' });
// @ts-expect-error Power must be numeric.
shots.createProjectile(new Vector3(), new Quaternion(), { power: 'strong' });
// @ts-expect-error Muzzle tracing starts from a world vector.
shots.createProjectile(new Vector3(), new Quaternion(), { launchOrigin: [0, 0, 0] });
// @ts-expect-error Projectile orientation must be a quaternion.
shots.createProjectile(new Vector3(), new Vector3());
// @ts-expect-error Owner references cannot be transplanted to another manager.
pulse.ownerManager = new ProjectileManager(scene, root, null);
// @ts-expect-error Player/enemy identity must remain immutable.
pulse.faction = 'enemy';
if (hostile) {
  // @ts-expect-error Hostile projectiles use the enemy removal path.
  shots.removeProjectile(hostile);
}
// @ts-expect-error Consumers cannot append to the public projectile view.
shots.getProjectiles().push(pulse);
// @ts-expect-error Enemy targets must supply the complete combat target shape.
shots.setCombatWorld({ getTargets: () => [{ isActive: true, collider: new Box3() }] });
// @ts-expect-error Enemy hit callbacks receive player shots, not hostile shots.
shots.setCombatWorld({ onTargetHit(_enemy, projectile: EnemyProjectile) { void projectile; } });
// @ts-expect-error Enemy definitions have known immutable names.
enemyTypes[0].name = 'scout';
// @ts-expect-error The definition list is immutable to checked callers.
enemyTypes.push(enemyTypes[0]);
// @ts-expect-error Creation belongs to a scene, not an arbitrary group.
new ProjectileManager(new Group(), root, null);
// @ts-expect-error Disposal keep sets contain materials, not numbers.
disposeObject(root, new Set(), new Set([1]));
// @ts-expect-error Trail allocation is internal to projectile creation.
shots.addTrailToProjectile(pulse, 0xff0000, 'standard');
// @ts-expect-error Cache ownership stays inside the manager.
shots.sharedGeometries.has(pulse.mesh.geometry);
