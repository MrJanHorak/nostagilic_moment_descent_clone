export const SETTINGS_KEY = 'descended.settings.v1';
export const DEFAULT_SETTINGS = Object.freeze({ mouseSensitivity: 1, invertY: false });

function normalize(source, fallback = DEFAULT_SETTINGS) {
  const sensitivity = source?.mouseSensitivity;
  return Object.freeze({
    mouseSensitivity: typeof sensitivity === 'number' && Number.isFinite(sensitivity)
      ? Math.round(Math.max(0.25, Math.min(3, sensitivity)) * 20) / 20 : fallback.mouseSensitivity,
    invertY: typeof source?.invertY === 'boolean' ? source.invertY : fallback.invertY,
  });
}

// Preferences outlive sessions. Storage failures never prevent flight or applying a change.
export default class UserSettings {
  constructor(storageProvider = () => globalThis.window?.localStorage) {
    this.values = DEFAULT_SETTINGS;
    this.saveStatus = 'ready';
    let raw;
    try {
      this.storage = storageProvider();
      if (!this.storage) this.saveStatus = 'unavailable';
      else raw = this.storage.getItem(SETTINGS_KEY);
    } catch {
      this.saveStatus = 'unavailable';
    }
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (saved?.version === 1) this.values = normalize(saved);
      } catch { /* A malformed preference record falls back to defaults. */ }
    }
  }

  update(patch) {
    this.values = normalize(patch, this.values);
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, ...this.values }));
      this.saveStatus = 'saved';
    } catch {
      this.saveStatus = 'unavailable';
    }
    return this.values;
  }

  reset() { return this.update(DEFAULT_SETTINGS); }
}
