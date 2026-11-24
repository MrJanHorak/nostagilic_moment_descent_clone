import { Mesh, MeshStandardMaterial, MathUtils } from 'three';
import { createFighterAttack, advanceFighterAttack } from './FighterAttack.js';

// Bomber area denial in authored mines. A bomber hangs back, charges visibly, then lobs
// a slow bomb at where the player was. The bomb lands, shows its blast radius while it
// arms, and detonates: the player must leave the marked area or break line of sight.
// Speeds are world units/second; durations are simulation milliseconds.
export const MINE_BOMBER = Object.freeze({
  speed: 2.4, holdRange: 11, firingRange: 18,
  windupMs: 900, recoveryMs: 1100, firstReactionMs: 400, intervalMs: 3600, intervalVariationMs: 600,
  bombSpeed: 8, flightMs: 3000, armMs: 1000,
  blastRadius: 3.6, blastDamage: 24, edgeFactor: 0.4,
  health: 60,
});

/** @param {number} now */
export function createBomberAttack(now) {
  return createFighterAttack(now, MINE_BOMBER.windupMs + MINE_BOMBER.firstReactionMs,
    { windupMs: MINE_BOMBER.windupMs, recoveryMs: MINE_BOMBER.recoveryMs });
}

/** Same guarantees as the fighter cycle: a full uninterrupted wind-up before every
 * launch, a recovery window, and no catch-up bursts after long frames.
 * @param {import('../combatContracts.js').FighterAttackState} state
 * @param {number} now @param {boolean} eligible @param {number} interval */
export function advanceBomberAttack(state, now, eligible, interval) {
  return advanceFighterAttack(state, now, eligible, interval);
}

/** @param {import('../combatContracts.js').EnemyCombatTarget} enemy */
export function bomberCommitted(enemy) {
  return enemy.bomberAttack?.phase === 'windup' || enemy.bomberAttack?.phase === 'recover';
}

/** Blast damage falls off linearly from full at the centre to edgeFactor at the rim;
 * nothing outside the radius. The caller handles line of sight.
 * @param {number} distance @param {{ blastRadius: number, blastDamage: number, edgeFactor: number }} [rules] */
export function blastDamage(distance, rules = MINE_BOMBER) {
  if (!Number.isFinite(distance) || distance < 0 || distance > rules.blastRadius) return 0;
  return rules.blastDamage * (1 - (1 - rules.edgeFactor) * (distance / rules.blastRadius));
}

/** Warning lights and launch pods glow amber while charging and cool blue in recovery.
 * Presentation only: it never moves the combat body.
 * @param {import('../combatContracts.js').EnemyInstance} enemy @param {number} now */
export function presentBomberAttack(enemy, now) {
  const state = enemy.bomberAttack; if (!state) return;
  const charging = state.phase === 'windup', recovering = state.phase === 'recover';
  const charge = MathUtils.clamp((now - state.since) / MINE_BOMBER.windupMs, 0, 1);
  // Pulse faster as the launch approaches so the timing is readable.
  const pulse = charging ? 0.5 + 0.5 * Math.sin(now / (120 - charge * 70)) : 0;
  enemy.mesh.traverse(part => {
    if (!(part instanceof Mesh) || !/^bomber_(warning_light|left_pod|right_pod)/.test(part.name)) return;
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.userData.baseEmissive ??= material.emissive.getHex();
      material.userData.baseIntensity ??= material.emissiveIntensity;
      if (charging) { material.emissive.setHex(0xffa030); material.emissiveIntensity = 0.8 + charge * 1.2 + pulse * 0.8; }
      else if (recovering) { material.emissive.setHex(0x2a6f8f); material.emissiveIntensity = 0.4; }
      else { material.emissive.setHex(material.userData.baseEmissive); material.emissiveIntensity = material.userData.baseIntensity; }
    }
  });
}
