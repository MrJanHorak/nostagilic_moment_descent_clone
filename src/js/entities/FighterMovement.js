import { Vector3 } from 'three';
import { fighterCommitted } from './FighterAttack.js';
import { traceShot } from '../utils/combatTrace.js';
import { moveSphere } from '../utils/sphereMovement.js';
import { MINE_FIGHTER } from './EnemyTactics.js';

export const FIGHTER_DECISION_MS = 750;
export const FIGHTER_NEAR_RANGE = 7;
export const FIGHTER_FAR_RANGE = 12;

/** Stable spawn identities stagger decisions without frame-dependent randomness.
 * @param {import('../combatContracts.js').EnemyInstance} enemy */
function seedFor(enemy) {
  const id = String(enemy.mesh.userData.spawnPointId ?? enemy.mesh.position.toArray().join(','));
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  return seed;
}

/** Local movement only: the manager owns perception, room routing and attacks.
 * Targets are chosen at a bounded cadence, using physical body clearance and
 * sight, then followed at the selected movement speed. No projectile/player-input reads.
 * @param {import('../combatContracts.js').EnemyInstance} enemy
 * @param {Vector3} player @param {readonly import('../contracts.js').SolidCollider[]} solids
 * @param {import('../core/levels/document/RoomNavigation.js').default} navigation
 * @param {number} now @param {number} delta @param {boolean} [aggressive] */
export default function updateFighterMovement(enemy, player, solids, navigation, now, delta, aggressive = false) {
  if (!enemy.isActive || !Number.isFinite(now) || !Number.isFinite(delta) || delta <= 0) return;
  const position = enemy.mesh.position;
  const speed = aggressive ? MINE_FIGHTER.speed : enemy.type.speed * 60;
  if (!enemy.fighterMovement) {
    const seed = seedFor(enemy);
    enemy.fighterMovement = {
      target: position.clone(), nextDecisionAt: now + seed % 180, interval: (aggressive ? MINE_FIGHTER.decisionMs : FIGHTER_DECISION_MS) + seed % 151,
      side: seed & 1 ? 1 : -1, lift: seed & 2 ? 1 : -1, decisions: 0, mode: 'hold',
    };
  }
  const state = enemy.fighterMovement;
  enemy.velocity.set(0, 0, 0);
  if (fighterCommitted(enemy)) { state.mode = 'brace'; return; }
  if (now >= state.nextDecisionAt) {
    state.nextDecisionAt = now + state.interval;
    const forward = player.clone().sub(position), distance = forward.length();
    if (distance < 1e-6) { state.mode = 'hold'; return; }
    forward.divideScalar(distance);
    const right = forward.clone().cross(Math.abs(forward.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)).normalize();
    const up = right.clone().cross(forward).normalize();
    const radial = distance < (aggressive ? MINE_FIGHTER.nearRange : FIGHTER_NEAR_RANGE) ? -1.6 : distance > (aggressive ? MINE_FIGHTER.farRange : FIGHTER_FAR_RANGE) ? 1.4 : 0;
    const room = navigation.roomAt(position);
    state.target.copy(position); state.mode = 'blocked';
    // Alternate the preferred side/height across decisions, not every frame.
    if (++state.decisions % 2 === 0) { state.side *= -1; state.lift *= -1; }
    for (const [side, lift] of [[state.side, state.lift * 0.5], [-state.side, state.lift * 0.5],
      [state.side, -state.lift * 0.5], [-state.side, -state.lift * 0.5], [state.side, 0], [0, 0]]) {
      const offset = forward.clone().multiplyScalar(radial).addScaledVector(right, side).addScaledVector(up, lift);
      if (offset.lengthSq() < 1e-6) continue;
      const desired = position.clone().addScaledVector(offset.normalize(), speed * (aggressive ? 0.7 : 1));
      if (navigation.roomAt(desired) !== room) continue;
      const target = navigation.destination(desired, enemy.collisionRadius);
      if (!target || target.distanceToSquared(position) < 0.04) continue;
      if (traceShot(position, target, { colliders: solids, radius: enemy.collisionRadius + 0.03 }) ||
          traceShot(target, player, { colliders: solids, radius: 0.05 })) continue;
      state.target.copy(target); state.mode = radial < 0 ? 'retreat' : radial > 0 ? 'approach' : 'strafe';
      break;
    }
  }
  const travel = state.target.clone().sub(position);
  if (travel.lengthSq() < 1e-6) return;
  const velocity = travel.normalize().multiplyScalar(Math.min(speed, position.distanceTo(state.target) / delta));
  const movement = moveSphere(position, velocity, delta, solids, enemy.collisionRadius);
  enemy.velocity.copy(velocity).divideScalar(60);
  if (movement.collided) {
    state.target.copy(position); state.side *= -1; state.mode = 'blocked';
    state.nextDecisionAt = now + 250;
  }
}
