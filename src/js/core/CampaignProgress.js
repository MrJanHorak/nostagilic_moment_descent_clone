import { DIFFICULTIES, isDifficultyId } from './Difficulty.js';
import { bestMedal, isMedal } from './MissionRating.js';

export const CAMPAIGN_PROGRESS_KEY = 'descended.campaign.v1';

/** @typedef {{ completions: number, bestScore: number, bestTimeMs: number, lastCompletedAt: string,
 *   hardestDifficulty: import('./Difficulty.js').DifficultyId, mostRescued: number, logIds: readonly string[], bestMedal?: import('./MissionRating.js').Medal }} MissionRecord */
/** @typedef {{ id: string, campaignOrder: number }} CampaignMission */

const MAX_COUNT = 1e6, MAX_SCORE = 1e9, MAX_TIME_MS = 864e5, MAX_LOGS = 32;
const ID = /^[a-zA-Z][a-zA-Z0-9:_-]{0,63}$/;

/** @param {unknown} value @returns {readonly string[]} */
function logList(value) {
  return Object.freeze(Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && ID.test(id)))].slice(0, MAX_LOGS) : []);
}

/** @param {unknown} value @param {number} max */
function bounded(value, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(max, Math.floor(value)) : null;
}

/** @param {unknown} source @returns {MissionRecord | null} */
function normalizeRecord(source) {
  if (source === null || typeof source !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (source);
  const completions = bounded(record.completions, MAX_COUNT), bestScore = bounded(record.bestScore, MAX_SCORE);
  const bestTimeMs = bounded(record.bestTimeMs, MAX_TIME_MS);
  if (!completions || bestScore === null || bestTimeMs === null) return null;
  const when = typeof record.lastCompletedAt === 'string' && !Number.isNaN(Date.parse(record.lastCompletedAt)) ? record.lastCompletedAt : new Date(0).toISOString();
  // Records written before difficulty tiers existed were played at the authored (Pilot) balance.
  const saved = record.hardestDifficulty;
  const hardestDifficulty = isDifficultyId(saved) ? saved : 'pilot';
  return Object.freeze({ completions, bestScore, bestTimeMs, lastCompletedAt: when, hardestDifficulty,
    mostRescued: bounded(record.mostRescued, 64) ?? 0, logIds: logList(record.logIds), ...(isMedal(record.bestMedal) ? { bestMedal: record.bestMedal } : {}) });
}

/** @param {unknown} source @returns {Readonly<Record<string, MissionRecord>>} */
function normalizeMissions(source) {
  /** @type {Record<string, MissionRecord>} */
  const missions = {};
  if (source !== null && typeof source === 'object' && !Array.isArray(source)) {
    for (const [id, value] of Object.entries(source)) {
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) continue;
      const record = normalizeRecord(value);
      if (record) missions[id] = record;
    }
  }
  return Object.freeze(missions);
}

/** Built-in campaign progress outlives sessions. Only campaign missions are recorded;
 * imported, playtest and practice levels never change it. Storage failures keep the
 * progress in memory for this page and never prevent play. */
export default class CampaignProgress {
  /** @param {() => import('../contracts.js').SettingsStorage | undefined} [storageProvider] */
  constructor(storageProvider = () => globalThis.window?.localStorage) {
    /** @type {Readonly<Record<string, MissionRecord>>} */
    this.missions = Object.freeze({});
    /** @type {import('../contracts.js').SettingsSaveStatus} */
    this.saveStatus = 'ready';
    /** @type {import('../contracts.js').SettingsStorage | undefined} */
    this.storage = undefined;
    let raw = null;
    try {
      this.storage = storageProvider();
      if (!this.storage) this.saveStatus = 'unavailable';
      else raw = this.storage.getItem(CAMPAIGN_PROGRESS_KEY);
    } catch {
      this.saveStatus = 'unavailable';
    }
    if (!raw) return;
    try {
      /** @type {unknown} */
      const saved = JSON.parse(raw);
      if (saved !== null && typeof saved === 'object' && 'version' in saved && saved.version === 1 && 'missions' in saved) {
        this.missions = normalizeMissions(saved.missions);
      }
    } catch { /* A malformed record starts a fresh campaign without overwriting it until the next completion. */ }
  }

  /** @param {string} id */
  get(id) { return Object.hasOwn(this.missions, id) ? this.missions[id] : null; }

  /** @param {string} id */
  isCompleted(id) { return this.get(id) !== null; }

  /** First campaign mission, in order, that has not been completed; null when all are done.
   * @param {readonly CampaignMission[]} campaign */
  nextMission(campaign) {
    return [...campaign].sort((a, b) => a.campaignOrder - b.campaignOrder).find(mission => !this.isCompleted(mission.id)) ?? null;
  }

  /** @param {readonly CampaignMission[]} campaign */
  completedCount(campaign) { return campaign.filter(mission => this.isCompleted(mission.id)).length; }

  /** Record a successful extraction.
   * @param {CampaignMission} mission
   * @param {{ score: number, timeMs: number, difficulty?: import('./Difficulty.js').DifficultyId, rescued?: number, logIds?: readonly string[], medal?: import('./MissionRating.js').Medal }} result
   * @param {Date} [now] */
  recordCompletion(mission, result, now = new Date()) {
    if (!mission || !Number.isInteger(mission.campaignOrder) || mission.campaignOrder < 1 || typeof mission.id !== 'string') return null;
    const score = bounded(result.score, MAX_SCORE) ?? 0, timeMs = bounded(result.timeMs, MAX_TIME_MS) ?? MAX_TIME_MS;
    const previous = this.get(mission.id);
    const difficulty = isDifficultyId(result.difficulty) ? result.difficulty : 'pilot';
    const hardestDifficulty = previous && DIFFICULTIES[previous.hardestDifficulty].rank >= DIFFICULTIES[difficulty].rank
      ? previous.hardestDifficulty : difficulty;
    const record = Object.freeze({
      completions: Math.min(MAX_COUNT, (previous?.completions ?? 0) + 1),
      bestScore: Math.max(previous?.bestScore ?? 0, score),
      bestTimeMs: previous ? Math.min(previous.bestTimeMs, timeMs) : timeMs,
      lastCompletedAt: now.toISOString(),
      hardestDifficulty,
      // Best rescue count and every data log ever recovered in this mission.
      mostRescued: Math.max(previous?.mostRescued ?? 0, bounded(result.rescued, 64) ?? 0),
      logIds: logList([...(previous?.logIds ?? []), ...(result.logIds ?? [])]),
      // The best medal ever earned here (Phase 5 ratings).
      ...(bestMedal(previous?.bestMedal, isMedal(result.medal) ? result.medal : null) ? { bestMedal: /** @type {import('./MissionRating.js').Medal} */ (bestMedal(previous?.bestMedal, isMedal(result.medal) ? result.medal : null)) } : {}),
    });
    this.missions = Object.freeze({ ...this.missions, [mission.id]: record });
    this.save();
    return {
      record, firstCompletion: !previous,
      newBestScore: !!previous && score > previous.bestScore,
      newBestTime: !!previous && timeMs < previous.bestTimeMs,
      newHardestDifficulty: !!previous && hardestDifficulty !== previous.hardestDifficulty,
      newBestMedal: isMedal(result.medal) && result.medal !== previous?.bestMedal && bestMedal(previous?.bestMedal, result.medal) === result.medal,
    };
  }

  reset() {
    this.missions = Object.freeze({});
    this.save();
  }

  save() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify({ version: 1, missions: this.missions }));
      this.saveStatus = 'saved';
    } catch {
      this.saveStatus = 'unavailable';
    }
  }
}

/** @param {number} ms */
export function formatMissionTime(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
