// Authored mines use more persistent pressure than the original training slice.
// Speeds are world units/second; all durations are simulation milliseconds.
export const MINE_FIGHTER = Object.freeze({
  speed: 4.8, decisionMs: 350, nearRange: 5.5, farRange: 9,
  windupMs: 450, recoveryMs: 400, firstReactionMs: 250,
  intervalMs: 1450, intervalVariationMs: 300,
  projectileSpeed: 18, inaccuracy: 0.025,
});
export const MINE_SCOUT = Object.freeze({
  speed: 5.4, windupMs: 450, recoveryMs: 700,
  strikeRange: 8, cancelRange: 10, lungeSpeed: 14,
  initialDelayMs: 250, retryMs: 250, withdrawMs: 350,
});

/** @param {import('../combatContracts.js').EnemyDefinition} type */
export function mineHealth(type) {
  return type.name === 'scout' ? 20 : type.name === 'fighter' ? 40 : type.health;
}

/** The definition's old speed is units/frame at 60 Hz. Keep that contract for
 * legacy fixtures and heavy types; only authored scouts/fighters use these speeds.
 * @param {import('../combatContracts.js').EnemyCombatTarget} enemy */
export function mineSpeed(enemy) {
  return enemy.type.name === 'fighter' ? MINE_FIGHTER.speed : enemy.type.name === 'scout' ? MINE_SCOUT.speed : enemy.type.speed * 60;
}
