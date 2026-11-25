/** Heavy robot roles (Phase 5): the destroyer's directional armour and the boss's phases. */
import * as THREE from 'three';

/** Damage multipliers by where a shot lands on a destroyer. */
export const DESTROYER_ARMOR = Object.freeze({ front: 0.25, side: 0.8, rear: 2 });
/** Boss phases begin at these shield fractions (phase 2 at 2/3, phase 3 at 1/3). */
export const BOSS_PHASES = Object.freeze([2 / 3, 1 / 3]);
/** Escorts a boss calls in at the start of each new phase. */
export const BOSS_ESCORTS = 2;

/** Which side a shot strikes: 'front' when it travels against the robot's facing,
 * 'rear' when it travels with it, otherwise 'side'.
 * @param {THREE.Vector3} facing the robot's forward direction (unit)
 * @param {THREE.Vector3} shotDirection the direction the shot travels */
export function armorSide(facing, shotDirection) {
  if (shotDirection.lengthSq() === 0) return 'side';
  const toward = -facing.dot(shotDirection.clone().normalize());
  return toward > 0.5 ? 'front' : toward < -0.5 ? 'rear' : 'side';
}

/** Damage multiplier for a hit on `enemy` by `projectile` landing at `point`.
 * Destroyers have a heavy front plate and a weak rear; the boss resists a little everywhere.
 * @param {any} enemy @param {any} projectile @param {THREE.Vector3} [point] @returns {{scale: number, side: string | null}} */
export function hitScale(enemy, projectile, point) {
  if (enemy.type.name === 'boss') return { scale: 0.7, side: null };
  if (enemy.type.name !== 'destroyer') return { scale: 1, side: null };
  const direction = projectile?.velocity?.isVector3 && projectile.velocity.lengthSq() > 0 ? projectile.velocity.clone()
    : point && projectile?.launchOrigin?.isVector3 ? point.clone().sub(projectile.launchOrigin) : new THREE.Vector3();
  const side = armorSide(enemy.mesh.getWorldDirection(new THREE.Vector3()), direction);
  return { scale: DESTROYER_ARMOR[side], side };
}

/** The boss's phase for its remaining shields: 1, 2 or 3. @param {number} fraction health / max health */
export function bossPhase(fraction) {
  return fraction > BOSS_PHASES[0] ? 1 : fraction > BOSS_PHASES[1] ? 2 : 3;
}
