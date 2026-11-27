/** A portable backup of built-in progression. Settings and authored levels have
 * their own device-local storage and are deliberately not part of this file. */
export const PROGRESS_KEYS = Object.freeze(['descended.campaign.v1', 'descended.hangar.v1', 'descended.daily.v1']);
export const MAX_BACKUP_BYTES = 1_000_000;

/** @param {Storage} storage */
export function exportProgress(storage) {
  /** @type {Record<string, any>} */ const records = {};
  for (const key of PROGRESS_KEYS) {
    const raw = storage.getItem(key);
    records[key] = raw === null ? null : JSON.parse(raw);
  }
  return JSON.stringify({ format: 'descended-progress', version: 1, records }, null, 2);
}

/** Validate before touching storage. @param {string} text */
export function parseProgress(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('This progress file is too large.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This is not a valid progress file.'); }
  if (!data || data.format !== 'descended-progress' || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw new Error('This is not a supported DESCENDED progress file.');
  /** @type {Record<string, string | null>} */ const records = {};
  for (const key of PROGRESS_KEYS) {
    const value = data.records[key];
    if (value !== null && (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1)) throw new Error('The progress file is incomplete or invalid.');
    if (value !== null && key === 'descended.campaign.v1' && (!value.missions || typeof value.missions !== 'object' || Array.isArray(value.missions))) throw new Error('The campaign progress is invalid.');
    if (value !== null && key === 'descended.daily.v1' && (!value.days || typeof value.days !== 'object' || Array.isArray(value.days))) throw new Error('The daily records are invalid.');
    if (value !== null && key === 'descended.hangar.v1' && (!Number.isFinite(value.credits) || !value.levels || typeof value.levels !== 'object' || Array.isArray(value.levels) || !Array.isArray(value.cleared))) throw new Error('The hangar progress is invalid.');
    records[key] = value === null ? null : JSON.stringify(value);
  }
  return records;
}

/** Replace progression only after validation; restore previous values if a write fails.
 * @param {Storage} storage @param {string} text */
export function importProgress(storage, text) {
  const records = parseProgress(text);
  const previous = Object.fromEntries(PROGRESS_KEYS.map(key => [key, storage.getItem(key)]));
  try {
    for (const key of PROGRESS_KEYS) {
      if (records[key] === null) storage.removeItem(key);
      else storage.setItem(key, /** @type {string} */ (records[key]));
    }
  } catch (error) {
    for (const key of PROGRESS_KEYS) {
      try { if (previous[key] === null) storage.removeItem(key); else storage.setItem(key, /** @type {string} */ (previous[key])); } catch { /* Storage may be unavailable. */ }
    }
    throw error;
  }
}
