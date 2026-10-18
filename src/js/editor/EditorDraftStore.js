import { LIMITS } from '../core/levels/document/LevelContent.js';
import { validateLevelDraft } from '../core/levels/document/validateLevelDocument.js';

export const DRAFT_KEY = 'descended.designer.draft.v1';
export default class EditorDraftStore {
  /** @param {() => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined} [provider] */
  constructor(provider = () => window.localStorage) {
    /** @type {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined} */ this.storage = undefined;
    /** @type {{document: import('../levelDocument.js').LevelDocument, savedAt: string} | null} */ this.pending = null;
    this.status = 'No local draft yet.'; this.blocked = false;
    try {
      this.storage = provider(); if (!this.storage) throw new Error('unavailable');
      const raw = this.storage.getItem(DRAFT_KEY); if (!raw) return;
      if (raw.length > LIMITS.text + 200) throw new Error('invalid');
      const record = JSON.parse(raw);
      if (record?.version !== 1 || typeof record.savedAt !== 'string' || !Number.isFinite(Date.parse(record.savedAt))) throw new Error('invalid');
      const result = validateLevelDraft(record.document); if (!result.valid) throw new Error('invalid');
      this.pending = { document: result.document, savedAt: record.savedAt };
      this.blocked = true; this.status = 'Choose Restore or Discard for the previous local draft.';
    } catch {
      this.blocked = !!this.storage;
      this.status = this.storage ? 'The saved draft could not be read. Discard it or import your JSON backup.' : 'Local draft saving is unavailable. Export JSON to keep your work.';
    }
  }
  /** @param {unknown} document */
  save(document) {
    if (this.blocked) return false; // Never overwrite a recovery candidate silently.
    try {
      if (!this.storage) throw new Error('unavailable');
      const result = validateLevelDraft(document); if (!result.valid) throw new Error('invalid');
      const record = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), document: result.document });
      if (record.length > LIMITS.text + 200) throw new Error('limit');
      this.storage.setItem(DRAFT_KEY, record); this.status = 'Draft saved locally · Export JSON for a portable backup.'; return true;
    } catch { this.status = 'Local draft saving failed. Export JSON to keep your work.'; return false; }
  }
  restored() { this.pending = null; this.blocked = false; }
  discard() {
    try { if (!this.storage) throw new Error('unavailable'); this.storage.removeItem(DRAFT_KEY); }
    catch { this.status = 'The saved draft could not be removed. JSON export is still available.'; return false; }
    this.restored(); this.status = 'Local draft discarded.'; return true;
  }
}
