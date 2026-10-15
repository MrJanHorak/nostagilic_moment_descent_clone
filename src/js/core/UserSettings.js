export const SETTINGS_KEY = 'descended.settings.v1';
/** @type {import('../contracts.js').UserPreferences} */
export const DEFAULT_SETTINGS = Object.freeze({
  mouseSensitivity: 1, invertY: false, musicVolume: 0.4, effectsVolume: 0.6, muted: false,
});

/** @param {unknown} source @param {number} fallback */
function volume(source, fallback) {
  return typeof source === 'number' && Number.isFinite(source)
    ? Math.round(Math.max(0, Math.min(1, source)) * 100) / 100 : fallback;
}

/** @param {unknown} source @param {import('../contracts.js').UserPreferences} [fallback] */
function normalize(source, fallback = DEFAULT_SETTINGS) {
  const record = source !== null && typeof source === 'object' ? source : {};
  const sensitivity = 'mouseSensitivity' in record ? record.mouseSensitivity : undefined;
  const invertY = 'invertY' in record ? record.invertY : undefined;
  const muted = 'muted' in record ? record.muted : undefined;
  return Object.freeze({
    mouseSensitivity: typeof sensitivity === 'number' && Number.isFinite(sensitivity)
      ? Math.round(Math.max(0.25, Math.min(3, sensitivity)) * 20) / 20 : fallback.mouseSensitivity,
    invertY: typeof invertY === 'boolean' ? invertY : fallback.invertY,
    musicVolume: volume('musicVolume' in record ? record.musicVolume : undefined, fallback.musicVolume),
    effectsVolume: volume('effectsVolume' in record ? record.effectsVolume : undefined, fallback.effectsVolume),
    muted: typeof muted === 'boolean' ? muted : fallback.muted,
  });
}

// Preferences outlive sessions. Storage failures never prevent flight or applying a change.
export default class UserSettings {
  /** @param {() => import('../contracts.js').SettingsStorage | undefined} [storageProvider]
   * @param {(values: import('../contracts.js').UserPreferences) => void} [onChange]
   */
  constructor(storageProvider = () => globalThis.window?.localStorage, onChange = () => {}) {
    this.onChange = onChange;
    this.values = DEFAULT_SETTINGS;
    /** @type {import('../contracts.js').SettingsSaveStatus} */
    this.saveStatus = 'ready';
    /** @type {import('../contracts.js').SettingsStorage | undefined} */
    this.storage = undefined;
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
        /** @type {unknown} */
        const saved = JSON.parse(raw);
        if (saved !== null && typeof saved === 'object' && 'version' in saved && saved.version === 1) this.values = normalize(saved);
      } catch { /* A malformed preference record falls back to defaults. */ }
    }
    this.onChange(this.values);
  }

  /** Untrusted saved/user data is validated here, rather than asserted to be settings.
   * @param {unknown} patch
   */
  update(patch) {
    this.values = normalize(patch, this.values);
    this.onChange(this.values);
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
