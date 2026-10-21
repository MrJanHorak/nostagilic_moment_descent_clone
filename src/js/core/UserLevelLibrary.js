import { parseLevelDocument, serializeLevelDocument } from './levels/document/validateLevelDocument.js';

export const USER_LEVELS_KEY = 'descended.levels.v1';
export const LIBRARY_LIMITS = Object.freeze({ levels: 32, text: 2_000_000 });
/** @typedef {{key: string, document: import('../levelDocument.js').LevelDocument}} LibraryEntry */
/** @template T @param {T} value @returns {T} */
const copy = value => JSON.parse(JSON.stringify(value));

/** Saved content stays separate from the built-in catalog and live game state.
 * Independent library keys allow two imported files with the same document ID.
 */
export default class UserLevelLibrary {
  /** @param {() => Pick<Storage, 'getItem' | 'setItem'> | undefined} [provider] */
  constructor(provider = () => globalThis.window?.localStorage) {
    /** @type {LibraryEntry[]} */ this.entries = [];
    /** @type {Pick<Storage, 'getItem' | 'setItem'> | undefined} */ this.storage = undefined;
    this.persistent = true;
    this.readable = true;
    /** @type {string | null} */ this.storedRaw = null;
    this.status = 'Saved in this browser. Export JSON to share or keep a backup.';
    try {
      this.storage = provider();
      if (!this.storage) throw new Error('Storage unavailable');
      this.reload();
    } catch {
      this.readable = false; this.persistent = false;
      this.status = 'Temporary library: browser saving is unavailable or the saved library cannot be read. Export JSON to keep your levels.';
    }
  }

  reload() {
    if (!this.storage || !this.persistent) return;
    const raw = this.storage.getItem(USER_LEVELS_KEY);
    if (!raw) { this.entries = []; this.storedRaw = raw; return; }
    if (raw.length > LIBRARY_LIMITS.text) throw new Error('Saved library exceeds its size limit.');
    const record = JSON.parse(raw);
    if (record?.version !== 1 || !Array.isArray(record.entries) || record.entries.length > LIBRARY_LIMITS.levels) throw new Error('Invalid saved library.');
    const keys = new Set();
    /** @type {LibraryEntry[]} */ const entries = [];
    for (const entry of record.entries) {
      if (!entry || typeof entry.key !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.key) || keys.has(entry.key)) throw new Error('Invalid saved level key.');
      keys.add(entry.key);
      entries.push({ key: entry.key, document: parseLevelDocument(serializeLevelDocument(entry.document)) });
    }
    this.entries = entries;
    this.storedRaw = raw;
  }

  /** Re-read before a mutation so another tab's unrelated saves are retained. */
  sync() {
    try { this.reload(); }
    catch {
      this.readable = false; this.persistent = false;
      this.status = 'Temporary library: saved levels could not be read. Export JSON to keep changes made here.';
    }
  }

  list() { return copy(this.entries); }
  /** @param {string} key */
  get(key) { const entry = this.entries.find(value => value.key === key); return entry ? copy(entry) : null; }

  /** @param {LibraryEntry[]} entries */
  write(entries) {
    const raw = JSON.stringify({ version: 1, entries });
    if (entries.length > LIBRARY_LIMITS.levels || raw.length > LIBRARY_LIMITS.text) throw new Error('My Levels is full. Export and delete a level before adding more.');
    try {
      if (!this.storage || !this.readable) throw new Error('Storage unavailable');
      if (this.storage.getItem(USER_LEVELS_KEY) !== this.storedRaw) throw new Error('Library changed in another tab');
      this.storage.setItem(USER_LEVELS_KEY, raw);
      this.storedRaw = raw;
      this.persistent = true;
      this.status = 'Saved in this browser. Export JSON to share or keep a backup.';
    } catch {
      this.persistent = false;
      this.status = 'Temporary library: changes could not be saved and will be lost on reload. Export JSON to keep your levels.';
    }
    this.entries = entries;
  }

  /** Validate before touching either the library or browser storage.
   * @param {unknown} input @param {string | null} [key]
   * @param {string | null} [expectedSnapshot] */
  save(input, key = null, expectedSnapshot = null) {
    const document = typeof input === 'string' ? parseLevelDocument(input) : parseLevelDocument(serializeLevelDocument(input));
    this.sync();
    if (key) {
      const existing = this.entries.find(entry => entry.key === key);
      if (!existing) throw new Error('This saved level was deleted. Use Save a copy to keep your work.');
      if (expectedSnapshot !== null && serializeLevelDocument(existing.document) !== expectedSnapshot) throw new Error('This level changed in another tab. Reopen it or use Save a copy to keep both versions.');
    }
    const entry = { key: key ?? globalThis.crypto.randomUUID(), document };
    this.write(key ? this.entries.map(value => value.key === key ? entry : value) : [...this.entries, entry]);
    return copy(entry);
  }

  /** @param {string} key @param {string} name */
  rename(key, name) {
    this.sync();
    const entry = this.get(key); if (!entry) throw new Error('This level is no longer in My Levels.');
    return this.save({ ...entry.document, name: name.trim() }, key, serializeLevelDocument(entry.document));
  }

  /** @param {string} key */
  remove(key) {
    this.sync();
    if (!this.entries.some(entry => entry.key === key)) throw new Error('This level is no longer in My Levels.');
    this.write(this.entries.filter(entry => entry.key !== key));
  }
}
