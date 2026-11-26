/** The daily challenge: one authored mission, one seed and one modifier per UTC day,
 * the same for everyone, with its own leaderboard on the game server. Local results
 * (best run per day and a streak of consecutive days) live in browser storage. */
import { DIFFICULTIES } from './Difficulty.js';
import { isMedal, bestMedal } from './MissionRating.js';

/** Missions that can be drawn: every campaign and team mission. */
export const DAILY_MISSIONS = Object.freeze(['signal-breach', 'vector-foundry', 'nightfall-reactor', 'asterion-deepworks', 'the-seal',
  'witness', 'fabricator', 'moving-day', 'dead-signal', 'breaker-yard', 'core-of-the-matter', 'team-twin-valves', 'team-deep-freight']);

/** Modifiers adjust the four difficulty multipliers on top of the Pilot balance. */
export const DAILY_MODIFIERS = Object.freeze([
  { id: 'ironclad', label: 'Ironclad robots', summary: 'Robots take 50% more hits', changes: { enemyHealth: 1.5 } },
  { id: 'glass-hull', label: 'Glass hull', summary: 'You take 80% more damage, but carry 20% more ammunition', changes: { incomingDamage: 1.8, ammo: 1.2 } },
  { id: 'ammo-drought', label: 'Ammo drought', summary: 'Half the ammunition', changes: { ammo: 0.5 } },
  { id: 'rapid-fire', label: 'Rapid fire', summary: 'Robots fire 40% more often', changes: { fireInterval: 0.6 } },
  { id: 'veteran-run', label: 'Veteran run', summary: 'The full Veteran balance', changes: { enemyHealth: DIFFICULTIES.veteran.enemyHealth, incomingDamage: DIFFICULTIES.veteran.incomingDamage,
    fireInterval: DIFFICULTIES.veteran.fireInterval, ammo: DIFFICULTIES.veteran.ammo } },
  { id: 'clean-run', label: 'Clean run', summary: 'The authored balance: just you and the clock', changes: {} },
]);

const DAILY_KEY = 'descended.daily.v1';
const DAY_MS = 86_400_000;

/** UTC day key, e.g. 2026-11-25. @param {Date} date */
export const dayKey = date => date.toISOString().slice(0, 10);

/** A stable 32-bit hash of a string (FNV-1a). @param {string} text */
export function hash32(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 0x01000193) >>> 0; }
  return value >>> 0;
}

/** The pool shuffled for one cycle (a seeded Fisher-Yates). @param {readonly string[]} pool @param {number} cycle */
function cycleOrder(pool, cycle) {
  const order = [...pool];
  let state = hash32(`cycle:${cycle}`) || 1;
  for (let i = order.length - 1; i > 0; i--) {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) >>> 0; state = (state ^ (state >>> 12)) >>> 0;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** The mission for a day: each cycle of `pool.length` days flies every mission once,
 * and a cycle never starts with the mission the previous one ended on.
 * @param {readonly string[]} pool @param {number} dayNumber days since 1970-01-01 (UTC) */
function missionForDay(pool, dayNumber) {
  const n = pool.length, cycle = Math.floor(dayNumber / n), order = cycleOrder(pool, cycle);
  if (n > 2 && order[0] === cycleOrder(pool, cycle - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  return order[dayNumber - cycle * n];
}

/** Today's challenge (or any day's). @param {Date} [date] @param {readonly string[]} [available] mission ids that exist in this build */
export function dailyChallenge(date = new Date(), available = DAILY_MISSIONS) {
  const key = dayKey(date), pool = DAILY_MISSIONS.filter(id => available.includes(id));
  const mission = missionForDay(pool, Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS));
  const modifier = DAILY_MODIFIERS[hash32(`modifier:${key}`) % DAILY_MODIFIERS.length];
  const base = modifier.id === 'veteran-run' ? DIFFICULTIES.veteran : DIFFICULTIES.pilot;
  return Object.freeze({
    id: `daily-${key}`, dayKey: key, missionId: mission, seed: hash32(`seed:${key}`), modifier,
    /** The difficulty tier the run uses (its id stays a real tier for saved progress). */
    difficulty: Object.freeze({ ...DIFFICULTIES.pilot, ...modifier.changes, id: base.id, rank: base.rank, label: `Daily · ${modifier.label}`, summary: modifier.summary }),
  });
}

/** Is a leaderboard id a daily board the server should accept now (yesterday, today or tomorrow in UTC, for time zones)?
 * @param {string} id @param {Date} [now] */
export function isCurrentDailyId(id, now = new Date()) {
  const match = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (!match) return false;
  const day = Date.parse(`${match[1]}T00:00:00Z`);
  return Number.isFinite(day) && Math.abs(day - Date.parse(`${dayKey(now)}T00:00:00Z`)) <= DAY_MS;
}

/** Local daily results: best time and medal per day, and the streak. */
export class DailyRecords {
  /** @param {() => Storage | undefined} [storageProvider] */
  constructor(storageProvider = () => globalThis.localStorage) {
    /** @type {Record<string, {timeMs: number, medal: string | null, runs: number}>} */ this.days = {};
    try { this.storage = storageProvider(); const saved = JSON.parse(this.storage?.getItem(DAILY_KEY) ?? '{}'); if (saved && typeof saved.days === 'object') this.days = saved.days; }
    catch { this.storage = undefined; }
  }

  /** Record a finished daily run. @param {string} key @param {{timeMs: number, medal?: string | null}} run */
  record(key, { timeMs, medal = null }) {
    const previous = this.days[key];
    const better = !previous || timeMs < previous.timeMs;
    this.days[key] = { timeMs: better ? Math.round(timeMs) : previous.timeMs, medal: bestMedal(/** @type {any} */ (previous?.medal ?? null), isMedal(medal) ? medal : null), runs: (previous?.runs ?? 0) + 1 };
    // Keep two months.
    for (const day of Object.keys(this.days).sort().slice(0, -60)) delete this.days[day];
    try { this.storage?.setItem(DAILY_KEY, JSON.stringify({ version: 1, days: this.days })); } catch { /* storage full or unavailable */ }
    return { record: this.days[key], newBest: better && !!previous, streak: this.streak(key) };
  }

  /** @param {string} key */
  get(key) { return this.days[key] ?? null; }

  /** Consecutive days finished up to and including `key`. @param {string} key */
  streak(key) {
    let count = 0, day = Date.parse(`${key}T00:00:00Z`);
    while (this.days[dayKey(new Date(day))]) { count++; day -= DAY_MS; }
    return count;
  }
}
