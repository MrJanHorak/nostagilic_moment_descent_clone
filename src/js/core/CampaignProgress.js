export const CAMPAIGN_PROGRESS_KEY = 'descended.campaign.v1';

/** @typedef {{ completions: number, bestScore: number, bestTimeMs: number, lastCompletedAt: string }} MissionRecord */
/** @typedef {{ id: string, campaignOrder: number }} CampaignMission */

const MAX_COUNT = 1e6, MAX_SCORE = 1e9, MAX_TIME_MS = 864e5;

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
  return Object.freeze({ completions, bestScore, bestTimeMs, lastCompletedAt: when });
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
   * @param {CampaignMission} mission @param {{ score: number, timeMs: number }} result
   * @param {Date} [now] */
  recordCompletion(mission, result, now = new Date()) {
    if (!mission || !Number.isInteger(mission.campaignOrder) || mission.campaignOrder < 1 || typeof mission.id !== 'string') return null;
    const score = bounded(result.score, MAX_SCORE) ?? 0, timeMs = bounded(result.timeMs, MAX_TIME_MS) ?? MAX_TIME_MS;
    const previous = this.get(mission.id);
    const record = Object.freeze({
      completions: Math.min(MAX_COUNT, (previous?.completions ?? 0) + 1),
      bestScore: Math.max(previous?.bestScore ?? 0, score),
      bestTimeMs: previous ? Math.min(previous.bestTimeMs, timeMs) : timeMs,
      lastCompletedAt: now.toISOString(),
    });
    this.missions = Object.freeze({ ...this.missions, [mission.id]: record });
    this.save();
    return {
      record, firstCompletion: !previous,
      newBestScore: !!previous && score > previous.bestScore,
      newBestTime: !!previous && timeMs < previous.bestTimeMs,
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
