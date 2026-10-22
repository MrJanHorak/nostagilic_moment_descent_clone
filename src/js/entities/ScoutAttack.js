import { Line3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { moveSphere } from '../utils/sphereMovement.js';
import { hasLineOfSight } from '../utils/combatTrace.js';
import { MINE_SCOUT } from './EnemyTactics.js';

export const SCOUT_WINDUP_MS = 550;
export const SCOUT_LUNGE_MS = 650;
export const SCOUT_RECOVERY_MS = 1100;

/** @param {number} now @param {boolean} [aggressive] @returns {import('../combatContracts.js').ScoutAttackState} */
export function createScoutAttack(now, aggressive = false) {
  return { phase: 'approach', since: now, readyAt: now + (aggressive ? MINE_SCOUT.initialDelayMs : 500), direction: new Vector3(), aggressive };
}

/** A strike commits to one direction; moving sideways after the warning can
 * evade it. Retreat uses the same physical collision as pursuit. No timers.
 * @param {import('../combatContracts.js').EnemyInstance} enemy
 * @param {Vector3} player @param {number} playerRadius
 * @param {readonly import('../contracts.js').SolidCollider[]} solids
 * @param {number} now @param {number} delta @param {boolean} visible */
export function updateScoutAttack(enemy, player, playerRadius, solids, now, delta, visible) {
  const state = enemy.scoutAttack ??= createScoutAttack(now);
  const windup = state.aggressive ? MINE_SCOUT.windupMs : SCOUT_WINDUP_MS;
  const recovery = state.aggressive ? MINE_SCOUT.recoveryMs : SCOUT_RECOVERY_MS;
  let warning = false, hit = false;
  if (state.phase === 'approach' && visible && enemy.mesh.position.distanceTo(player) <= (state.aggressive ? MINE_SCOUT.strikeRange : 6) && now >= state.readyAt) {
    state.phase = 'windup'; state.since = now; warning = true;
  }
  if (state.phase === 'windup') {
    enemy.velocity.set(0, 0, 0);
    if (!visible || enemy.mesh.position.distanceTo(player) > (state.aggressive ? MINE_SCOUT.cancelRange : 8)) {
      state.phase = 'approach'; state.since = now; state.readyAt = now + (state.aggressive ? MINE_SCOUT.retryMs : 300);
    } else {
      enemy.mesh.lookAt(player);
      if (now - state.since >= windup) {
        state.direction.copy(player).sub(enemy.mesh.position).normalize();
        state.phase = 'lunge'; state.since = now;
      }
    }
  } else if (state.phase === 'lunge') {
    const previous = enemy.mesh.position.clone();
    const remaining = Math.max(0, (SCOUT_LUNGE_MS - (now - state.since - delta * 1000)) / 1000);
    const velocity = state.direction.clone().multiplyScalar(state.aggressive ? MINE_SCOUT.lungeSpeed : 10);
    const movement = moveSphere(enemy.mesh.position, velocity, Math.min(delta, remaining), solids, enemy.collisionRadius);
    enemy.velocity.copy(velocity).divideScalar(60);
    const nearest = new Line3(previous, enemy.mesh.position).closestPointToPoint(player, true, new Vector3());
    hit = nearest.distanceTo(player) <= enemy.collisionRadius + playerRadius && hasLineOfSight(nearest, player, solids);
    if (hit || movement.collided || now - state.since >= SCOUT_LUNGE_MS) { state.phase = 'recover'; state.since = now; enemy.velocity.set(0, 0, 0); }
  } else if (state.phase === 'recover') {
    enemy.velocity.set(0, 0, 0);
    // Back away briefly, then hold still so the player can answer the attack.
    if (now - state.since < (state.aggressive ? MINE_SCOUT.withdrawMs : 600)) moveSphere(enemy.mesh.position, state.direction.clone().multiplyScalar(-3), delta, solids, enemy.collisionRadius);
    if (now - state.since >= recovery) { state.phase = 'approach'; state.since = now; state.readyAt = now + (state.aggressive ? MINE_SCOUT.retryMs : 500); }
  }
  presentScoutAttack(enemy, now);
  return { handled: state.phase !== 'approach', warning, hit };
}

/** @param {import('../combatContracts.js').EnemyInstance} enemy @param {number} now */
export function presentScoutAttack(enemy, now) {
  const state = enemy.scoutAttack; if (!state) return;
  const charging = state.phase === 'windup', lunging = state.phase === 'lunge', recovering = state.phase === 'recover';
  const wings = enemy.mesh.getObjectByName('scout_wings');
  if (wings) wings.scale.x = charging ? 0.8 + 0.2 * Math.min(1, (now - state.since) / (state.aggressive ? MINE_SCOUT.windupMs : SCOUT_WINDUP_MS)) : 1;
  for (const name of ['scout_eye_left', 'scout_eye_right']) {
    const eye = enemy.mesh.getObjectByName(name);
    if (eye instanceof Mesh && eye.material instanceof MeshStandardMaterial) {
      eye.material.emissive.setHex(lunging ? 0xffffff : charging ? 0xffbb44 : recovering ? 0x235268 : enemy.type.color);
      eye.material.emissiveIntensity = lunging ? 2 : charging ? 1.7 : recovering ? 0.3 : 0.8;
    }
  }
}
