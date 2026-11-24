// Difficulty tiers scale combat around the authored balance. Pilot is the reference
// tuning and leaves every value exactly as authored. A tier is snapshotted when a
// mission starts, so changing it mid-run takes effect on the next start or restart.

/** @typedef {'trainee' | 'pilot' | 'veteran' | 'insane'} DifficultyId */
/** @typedef {{ id: DifficultyId, label: string, rank: number, summary: string,
 *   enemyHealth: number, incomingDamage: number, fireInterval: number, ammo: number }} DifficultyTier */

/** @type {Readonly<Record<DifficultyId, Readonly<DifficultyTier>>>} */
export const DIFFICULTIES = Object.freeze({
  trainee: Object.freeze({ id: 'trainee', label: 'Trainee', rank: 0, summary: 'Weaker robots, half damage taken, slower enemy fire, 50% more ammunition',
    enemyHealth: 0.6, incomingDamage: 0.5, fireInterval: 1.4, ammo: 1.5 }),
  pilot: Object.freeze({ id: 'pilot', label: 'Pilot', rank: 1, summary: 'The authored balance',
    enemyHealth: 1, incomingDamage: 1, fireInterval: 1, ammo: 1 }),
  veteran: Object.freeze({ id: 'veteran', label: 'Veteran', rank: 2, summary: 'Tougher robots, 40% more damage taken, faster enemy fire, 20% less ammunition',
    enemyHealth: 1.35, incomingDamage: 1.4, fireInterval: 0.8, ammo: 0.8 }),
  insane: Object.freeze({ id: 'insane', label: 'Insane', rank: 3, summary: 'Robots take 75% more hits, double damage taken, rapid enemy fire, 35% less ammunition',
    enemyHealth: 1.75, incomingDamage: 2, fireInterval: 0.65, ammo: 0.65 }),
});

export const DEFAULT_DIFFICULTY = 'pilot';
/** @type {readonly DifficultyId[]} */
export const DIFFICULTY_ORDER = Object.freeze(/** @type {DifficultyId[]} */ (['trainee', 'pilot', 'veteran', 'insane']));

/** @param {unknown} value @returns {value is DifficultyId} */
export function isDifficultyId(value) {
  return typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);
}

/** @param {unknown} value */
export function getDifficulty(value) {
  return DIFFICULTIES[isDifficultyId(value) ? value : DEFAULT_DIFFICULTY];
}

/** Robot health for a tier, never below one hit point.
 * @param {number} health @param {DifficultyTier} tier */
export function scaleEnemyHealth(health, tier) {
  return Number.isFinite(health) ? Math.max(1, Math.round(health * tier.enemyHealth)) : health;
}

/** Damage the player takes from any source.
 * @param {number} amount @param {DifficultyTier} tier */
export function scaleIncomingDamage(amount, tier) {
  return Number.isFinite(amount) && amount > 0 ? amount * tier.incomingDamage : amount;
}

/** Time between authored fighter shots. Never shorter than the readable warning and
 * recovery windows, so every shot keeps its full telegraph.
 * @param {number} intervalMs @param {DifficultyTier} tier @param {number} [minimumMs] */
export function scaleFireInterval(intervalMs, tier, minimumMs = 0) {
  return Math.max(minimumMs, intervalMs * tier.fireInterval);
}

/** Mission starting pulse ammunition and capacity. Capacity always holds the start amount.
 * @param {number} initial @param {number} capacity @param {DifficultyTier} tier */
export function scaleAmmo(initial, capacity, tier) {
  const start = Math.max(1, Math.round(initial * tier.ammo));
  return { initial: start, capacity: Number.isFinite(capacity) ? Math.max(start, Math.round(capacity * tier.ammo)) : capacity };
}
