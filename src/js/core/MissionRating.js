/** Mission medals (Phase 5): bronze for getting out, silver for a quick run that
 * brought at least half the miners home, gold for beating par with every miner and
 * every data log. Par times are set per mission; other levels get a par from their
 * objectives. Pure functions: no storage, no UI. */

/** @typedef {'bronze' | 'silver' | 'gold'} Medal */
export const MEDALS = /** @type {const} */ (['bronze', 'silver', 'gold']);
export const MEDAL_LABELS = Object.freeze({ bronze: 'Bronze', silver: 'Silver', gold: 'Gold' });
export const MEDAL_ICONS = Object.freeze({ bronze: '🥉', silver: '🥈', gold: '🥇' });

/** Hand-set par times (seconds) for the authored missions: a confident, clean run.
 * Tune these from playtests. */
export const PAR_SECONDS = Object.freeze({
  'signal-breach': 150, 'vector-foundry': 150, 'nightfall-reactor': 180, 'asterion-deepworks': 420, 'the-seal': 360,
  witness: 300, fabricator: 330, 'moving-day': 360,
  'dead-signal': 300, 'breaker-yard': 330, 'core-of-the-matter': 420,
  'team-twin-valves': 240, 'team-deep-freight': 330,
});
/** Silver allows this much over par. */
export const SILVER_PAR_FACTOR = 1.5;

/** Par for a level: the hand-set value, else one minute plus time per objective.
 * @param {{id?: string, mission?: {requiredDeviceIds?: readonly string[], requiredEnemyIds?: readonly string[]} | null}} level @returns {number} ms */
export function parTimeMs(level) {
  const authored = level.id ? /** @type {Record<string, number>} */ (PAR_SECONDS)[level.id] : undefined;
  if (authored) return authored * 1000;
  const devices = level.mission?.requiredDeviceIds?.length ?? 0, enemies = level.mission?.requiredEnemyIds?.length ?? 0;
  return (60 + 30 * devices + 20 * enemies) * 1000;
}

/** @param {{timeMs: number, parMs: number, rescued?: number, survivorsTotal?: number, logsFound?: number, logsTotal?: number}} run
 * @returns {{medal: Medal, next: string | null}} the medal and what the next one needs */
export function rateMission({ timeMs, parMs, rescued = 0, survivorsTotal = 0, logsFound = 0, logsTotal = 0 }) {
  const allMiners = rescued >= survivorsTotal, allLogs = logsFound >= logsTotal, halfMiners = rescued * 2 >= survivorsTotal;
  if (timeMs <= parMs && allMiners && allLogs) return { medal: 'gold', next: null };
  const silver = timeMs <= parMs * SILVER_PAR_FACTOR && halfMiners;
  const goldNeeds = [timeMs > parMs && `beat par (${formatSeconds(parMs)})`, !allMiners && 'rescue every miner', !allLogs && 'find every data log'].filter(Boolean).join(', ');
  if (silver) return { medal: 'silver', next: `Gold: ${goldNeeds}` };
  const silverNeeds = [timeMs > parMs * SILVER_PAR_FACTOR && `finish within ${formatSeconds(parMs * SILVER_PAR_FACTOR)}`, !halfMiners && 'rescue at least half the miners'].filter(Boolean).join(', ');
  return { medal: 'bronze', next: `Silver: ${silverNeeds}` };
}

/** The better of two medals (null-safe). @param {Medal | null | undefined} a @param {Medal | null | undefined} b @returns {Medal | null} */
export function bestMedal(a, b) {
  const rank = /** @param {Medal | null | undefined} m */ m => (m ? MEDALS.indexOf(m) : -1);
  return rank(a) >= rank(b) ? (a ?? null) : (b ?? null);
}

/** @param {unknown} value @returns {value is Medal} */
export const isMedal = value => typeof value === 'string' && /** @type {readonly string[]} */ (MEDALS).includes(value);

/** @param {number} ms */
function formatSeconds(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
