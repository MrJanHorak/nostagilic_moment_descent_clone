import { parseLevelDocument, serializeLevelDocument } from './levels/document/validateLevelDocument.js';

export const USER_CAMPAIGNS_KEY = 'descended.campaigns.v1';
export const CAMPAIGN_BUNDLE_FORMAT = 'descended-campaign';
export const CAMPAIGN_LIMITS = Object.freeze({ campaigns: 16, missions: 16, name: 80, description: 400, briefing: 800, text: 400_000, bundle: 8_000_000 });
const KEY = /^[a-zA-Z0-9-]{1,80}$/;

/** @typedef {{id: string, levelKey: string, briefing: string}} CampaignMission */
/** @typedef {{key: string, name: string, description: string, missions: CampaignMission[], completed: string[]}} UserCampaign */
/** @template T @param {T} value @returns {T} */
const copy = value => JSON.parse(JSON.stringify(value));
const newKey = () => globalThis.crypto.randomUUID();

/** @param {unknown} value @param {string} label @param {number} limit @param {boolean} [required] */
function text(value, label, limit, required = false) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`Enter a ${label.toLowerCase()}.`);
  if (trimmed.length > limit) throw new Error(`${label} is limited to ${limit} characters.`);
  return trimmed;
}

/** Validate one stored campaign; reject the whole record on any problem.
 * @param {unknown} value @returns {UserCampaign} */
function readCampaign(value) {
  const campaign = /** @type {Record<string, unknown>} */ (value);
  if (!campaign || typeof campaign !== 'object' || typeof campaign.key !== 'string' || !KEY.test(campaign.key)) throw new Error('Invalid saved campaign key.');
  if (!Array.isArray(campaign.missions) || campaign.missions.length > CAMPAIGN_LIMITS.missions || !Array.isArray(campaign.completed)) throw new Error('Invalid saved campaign.');
  const ids = new Set();
  const missions = campaign.missions.map(entry => {
    const mission = /** @type {Record<string, unknown>} */ (entry);
    if (!mission || typeof mission.id !== 'string' || !KEY.test(mission.id) || ids.has(mission.id) || typeof mission.levelKey !== 'string' || !KEY.test(mission.levelKey)) throw new Error('Invalid saved campaign mission.');
    ids.add(mission.id);
    return { id: mission.id, levelKey: mission.levelKey, briefing: text(mission.briefing ?? '', 'Briefing', CAMPAIGN_LIMITS.briefing) };
  });
  return { key: campaign.key, name: text(campaign.name, 'Campaign name', CAMPAIGN_LIMITS.name, true), description: text(campaign.description ?? '', 'Description', CAMPAIGN_LIMITS.description),
    missions, completed: campaign.completed.filter(id => typeof id === 'string' && ids.has(id)) };
}

/** User campaigns: an ordered list of My Levels entries with briefings and
 * per-campaign progress. Stored separately from the levels themselves, so
 * editing a level updates every campaign that uses it. */
export default class UserCampaignLibrary {
  /** @param {() => Pick<Storage, 'getItem' | 'setItem'> | undefined} [provider] */
  constructor(provider = () => globalThis.window?.localStorage) {
    /** @type {UserCampaign[]} */ this.campaigns = [];
    /** @type {Pick<Storage, 'getItem' | 'setItem'> | undefined} */ this.storage = undefined;
    this.persistent = true; this.readable = true;
    /** @type {string | null} */ this.storedRaw = null;
    this.status = 'Campaigns are saved in this browser.';
    try {
      this.storage = provider();
      if (!this.storage) throw new Error('Storage unavailable');
      this.reload();
    } catch {
      this.readable = false; this.persistent = false;
      this.status = 'Temporary campaigns: browser saving is unavailable or saved campaigns cannot be read. Export campaigns to keep them.';
    }
  }

  reload() {
    if (!this.storage || !this.persistent) return;
    const raw = this.storage.getItem(USER_CAMPAIGNS_KEY);
    if (!raw) { this.campaigns = []; this.storedRaw = raw; return; }
    if (raw.length > CAMPAIGN_LIMITS.text) throw new Error('Saved campaigns exceed their size limit.');
    const record = JSON.parse(raw);
    if (record?.version !== 1 || !Array.isArray(record.campaigns) || record.campaigns.length > CAMPAIGN_LIMITS.campaigns) throw new Error('Invalid saved campaigns.');
    const campaigns = /** @type {unknown[]} */ (record.campaigns).map(readCampaign), keys = new Set(campaigns.map(campaign => campaign.key));
    if (keys.size !== campaigns.length) throw new Error('Duplicate saved campaign key.');
    this.campaigns = campaigns; this.storedRaw = raw;
  }

  /** Re-read before a mutation so another tab's saves are retained. */
  sync() {
    try { this.reload(); }
    catch { this.readable = false; this.persistent = false; this.status = 'Temporary campaigns: saved campaigns could not be read. Export campaigns to keep changes made here.'; }
  }

  list() { return copy(this.campaigns); }
  /** @param {string} key */
  get(key) { const campaign = this.campaigns.find(value => value.key === key); return campaign ? copy(campaign) : null; }

  /** @param {UserCampaign[]} campaigns */
  write(campaigns) {
    const raw = JSON.stringify({ version: 1, campaigns });
    if (campaigns.length > CAMPAIGN_LIMITS.campaigns || raw.length > CAMPAIGN_LIMITS.text) throw new Error(`Campaign storage is full (${CAMPAIGN_LIMITS.campaigns} campaigns). Export and delete one first.`);
    try {
      if (!this.storage || !this.readable) throw new Error('Storage unavailable');
      if (this.storage.getItem(USER_CAMPAIGNS_KEY) !== this.storedRaw) throw new Error('Campaigns changed in another tab');
      this.storage.setItem(USER_CAMPAIGNS_KEY, raw);
      this.storedRaw = raw; this.persistent = true; this.status = 'Campaigns are saved in this browser.';
    } catch {
      this.persistent = false;
      this.status = 'Temporary campaigns: changes could not be saved and will be lost on reload. Export campaigns to keep them.';
    }
    this.campaigns = campaigns;
  }

  /** Apply one change to a fresh copy of a campaign and save it.
   * @param {string} key @param {(campaign: UserCampaign) => void} edit */
  change(key, edit) {
    this.sync();
    const campaign = this.get(key); if (!campaign) throw new Error('This campaign is no longer saved.');
    edit(campaign);
    const valid = readCampaign(campaign);
    this.write(this.campaigns.map(value => value.key === key ? valid : value));
    return copy(valid);
  }

  /** @param {string} name @param {string} [description] @param {Omit<CampaignMission, 'id'>[]} [missions] */
  create(name, description = '', missions = []) {
    this.sync();
    if (missions.length > CAMPAIGN_LIMITS.missions) throw new Error(`A campaign holds at most ${CAMPAIGN_LIMITS.missions} missions.`);
    const campaign = readCampaign({ key: newKey(), name, description, missions: missions.map(mission => ({ ...mission, id: newKey() })), completed: [] });
    this.write([...this.campaigns, campaign]);
    return copy(campaign);
  }

  /** @param {string} key @param {{name?: string, description?: string}} values */
  update(key, values) {
    return this.change(key, campaign => {
      if (values.name !== undefined) campaign.name = text(values.name, 'Campaign name', CAMPAIGN_LIMITS.name, true);
      if (values.description !== undefined) campaign.description = text(values.description, 'Description', CAMPAIGN_LIMITS.description);
    });
  }

  /** @param {string} key @param {string} levelKey @param {string} [briefing] */
  addMission(key, levelKey, briefing = '') {
    if (!KEY.test(levelKey)) throw new Error('Choose a level from My Levels.');
    return this.change(key, campaign => {
      if (campaign.missions.length >= CAMPAIGN_LIMITS.missions) throw new Error(`A campaign holds at most ${CAMPAIGN_LIMITS.missions} missions.`);
      campaign.missions.push({ id: newKey(), levelKey, briefing: text(briefing, 'Briefing', CAMPAIGN_LIMITS.briefing) });
    });
  }

  /** @param {string} key @param {string} missionId @param {string} briefing */
  setBriefing(key, missionId, briefing) {
    return this.change(key, campaign => {
      const mission = campaign.missions.find(mission => mission.id === missionId); if (!mission) throw new Error('This mission is no longer in the campaign.');
      mission.briefing = text(briefing, 'Briefing', CAMPAIGN_LIMITS.briefing);
    });
  }

  /** Progress follows the mission, not its position, so reordering keeps it.
   * @param {string} key @param {string} missionId @param {-1 | 1} step */
  moveMission(key, missionId, step) {
    return this.change(key, campaign => {
      const index = campaign.missions.findIndex(mission => mission.id === missionId), target = index + step;
      if (index < 0) throw new Error('This mission is no longer in the campaign.');
      if (target < 0 || target >= campaign.missions.length) return;
      [campaign.missions[index], campaign.missions[target]] = [campaign.missions[target], campaign.missions[index]];
    });
  }

  /** @param {string} key @param {string} missionId */
  removeMission(key, missionId) {
    return this.change(key, campaign => {
      if (!campaign.missions.some(mission => mission.id === missionId)) throw new Error('This mission is no longer in the campaign.');
      campaign.missions = campaign.missions.filter(mission => mission.id !== missionId);
    });
  }

  /** @param {string} key */
  remove(key) {
    this.sync();
    if (!this.campaigns.some(campaign => campaign.key === key)) throw new Error('This campaign is no longer saved.');
    this.write(this.campaigns.filter(campaign => campaign.key !== key));
  }

  /** @param {string} key @param {string} missionId */
  recordCompletion(key, missionId) {
    const campaign = this.change(key, campaign => { if (!campaign.completed.includes(missionId)) campaign.completed.push(missionId); });
    return { completed: campaign.completed.length, total: campaign.missions.length, saved: this.persistent };
  }

  /** @param {string} key */
  resetProgress(key) { return this.change(key, campaign => { campaign.completed = []; }); }

  /** Names of campaigns that use a level, for delete warnings.
   * @param {string} levelKey */
  usage(levelKey) { return this.campaigns.filter(campaign => campaign.missions.some(mission => mission.levelKey === levelKey)).map(campaign => campaign.name); }
}

/** First mission not yet extracted, or null when every mission is complete.
 * @param {UserCampaign} campaign */
export function nextCampaignMission(campaign) {
  const index = campaign.missions.findIndex(mission => !campaign.completed.includes(mission.id));
  return index < 0 ? null : index;
}

/** A self-contained, shareable campaign file with every level embedded.
 * @param {UserCampaign} campaign @param {import('./UserLevelLibrary.js').default} levels */
export function exportCampaignBundle(campaign, levels) {
  if (!campaign.missions.length) throw new Error('Add at least one mission before exporting.');
  const missions = campaign.missions.map((mission, index) => {
    const entry = levels.get(mission.levelKey);
    if (!entry) throw new Error(`Mission ${index + 1} uses a level that is no longer in My Levels. Remove or replace it first.`);
    return { briefing: mission.briefing, level: JSON.parse(serializeLevelDocument(entry.document)) };
  });
  return `${JSON.stringify({ format: CAMPAIGN_BUNDLE_FORMAT, version: 1, name: campaign.name, description: campaign.description, missions }, null, 2)}\n`;
}

/** Validate a bundle completely before anything is saved.
 * @param {string} input */
export function parseCampaignBundle(input) {
  if (input.length > CAMPAIGN_LIMITS.bundle) throw new Error('Campaign file exceeds its size limit.');
  /** @type {unknown} */ let value;
  try { value = JSON.parse(input); } catch (error) { throw new Error('This file is not valid JSON.', { cause: error }); }
  const bundle = /** @type {Record<string, unknown>} */ (value);
  if (!bundle || bundle.format !== CAMPAIGN_BUNDLE_FORMAT) throw new Error('This is not a DESCENDED campaign file. Use Import level JSON for single levels.');
  if (bundle.version !== 1) throw new Error('This campaign file needs a newer version of the game.');
  if (!Array.isArray(bundle.missions) || !bundle.missions.length || bundle.missions.length > CAMPAIGN_LIMITS.missions) throw new Error(`A campaign file holds 1–${CAMPAIGN_LIMITS.missions} missions.`);
  const missions = bundle.missions.map((entry, index) => {
    const mission = /** @type {Record<string, unknown>} */ (entry);
    try {
      return { briefing: text(mission?.briefing ?? '', 'Briefing', CAMPAIGN_LIMITS.briefing), document: parseLevelDocument(JSON.stringify(mission?.level)) };
    } catch (error) { throw new Error(`Mission ${index + 1}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
  });
  return { name: text(bundle.name, 'Campaign name', CAMPAIGN_LIMITS.name, true), description: text(bundle.description ?? '', 'Description', CAMPAIGN_LIMITS.description), missions };
}

/** Add a bundle's levels to My Levels and create its campaign. Levels are added
 * in one write; if that fails, nothing is created.
 * @param {string} input @param {import('./UserLevelLibrary.js').default} levels @param {UserCampaignLibrary} campaigns */
export function importCampaignBundle(input, levels, campaigns) {
  const bundle = parseCampaignBundle(input);
  campaigns.sync();
  if (campaigns.campaigns.length >= CAMPAIGN_LIMITS.campaigns) throw new Error(`Campaign storage is full (${CAMPAIGN_LIMITS.campaigns} campaigns). Export and delete one first.`);
  const entries = levels.saveMany(bundle.missions.map(mission => mission.document));
  return campaigns.create(bundle.name, bundle.description, bundle.missions.map((mission, index) => ({ levelKey: entries[index].key, briefing: mission.briefing })));
}
