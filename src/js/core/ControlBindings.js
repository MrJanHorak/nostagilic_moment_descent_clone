export const CONTROLS_KEY = 'descended.controls.v1';

/** @typedef {'forward' | 'backward' | 'left' | 'right' | 'up' | 'down' | 'yawLeft' | 'yawRight' | 'pitchUp' | 'pitchDown'
 *   | 'rollLeft' | 'rollRight' | 'fire' | 'interact' | 'map' | 'cameraView' | 'headlights' | 'showHUD'
 *   | 'missionLog' | 'quickChat' | 'markTarget' | 'weapon1' | 'weapon2' | 'weapon3' | 'weapon4'} ControlAction */
/** @typedef {{ id: ControlAction, label: string, group: 'Flight' | 'Turning' | 'Actions' | 'Weapons', hold: boolean }} ControlDefinition */
/** @typedef {Readonly<Record<ControlAction, readonly string[]>>} KeyBindings */
/** @typedef {{ bindings: KeyBindings, stickSensitivity: number, invertStickY: boolean }} ControlValues */

/** Remappable actions, in display order. Escape (pause/back) and the mouse are fixed. */
/** @type {readonly ControlDefinition[]} */
export const CONTROL_ACTIONS = Object.freeze([
  { id: 'forward', label: 'Thrust forward', group: 'Flight', hold: true },
  { id: 'backward', label: 'Thrust backward', group: 'Flight', hold: true },
  { id: 'left', label: 'Slide left', group: 'Flight', hold: true },
  { id: 'right', label: 'Slide right', group: 'Flight', hold: true },
  { id: 'up', label: 'Slide up', group: 'Flight', hold: true },
  { id: 'down', label: 'Slide down', group: 'Flight', hold: true },
  { id: 'yawLeft', label: 'Turn left', group: 'Turning', hold: true },
  { id: 'yawRight', label: 'Turn right', group: 'Turning', hold: true },
  { id: 'pitchUp', label: 'Pitch up', group: 'Turning', hold: true },
  { id: 'pitchDown', label: 'Pitch down', group: 'Turning', hold: true },
  { id: 'rollLeft', label: 'Roll left', group: 'Turning', hold: true },
  { id: 'rollRight', label: 'Roll right', group: 'Turning', hold: true },
  { id: 'fire', label: 'Fire', group: 'Actions', hold: false },
  { id: 'interact', label: 'Activate relay', group: 'Actions', hold: false },
  { id: 'map', label: 'Expand map', group: 'Actions', hold: false },
  { id: 'cameraView', label: 'Cycle camera', group: 'Actions', hold: false },
  { id: 'headlights', label: 'Headlights', group: 'Actions', hold: false },
  { id: 'showHUD', label: 'Toggle HUD', group: 'Actions', hold: false },
  { id: 'missionLog', label: 'Mission log (pause)', group: 'Actions', hold: false },
  { id: 'quickChat', label: 'Quick-chat (then 1–8)', group: 'Actions', hold: false },
  { id: 'markTarget', label: 'Ping where you aim', group: 'Actions', hold: false },
  { id: 'weapon1', label: 'Pulse cannon', group: 'Weapons', hold: false },
  { id: 'weapon2', label: 'Laser', group: 'Weapons', hold: false },
  { id: 'weapon3', label: 'Missiles', group: 'Weapons', hold: false },
  { id: 'weapon4', label: 'Plasma', group: 'Weapons', hold: false },
].map(action => Object.freeze(/** @type {ControlDefinition} */ (action))));

/** The original key layout. Each action holds at most two keys. */
/** @type {KeyBindings} */
export const DEFAULT_BINDINGS = Object.freeze({
  forward: Object.freeze(['KeyW']), backward: Object.freeze(['KeyS']), left: Object.freeze(['KeyA']), right: Object.freeze(['KeyD']),
  up: Object.freeze(['Space']), down: Object.freeze(['ShiftLeft', 'ControlLeft']),
  yawLeft: Object.freeze(['ArrowLeft']), yawRight: Object.freeze(['ArrowRight']),
  pitchUp: Object.freeze(['ArrowUp']), pitchDown: Object.freeze(['ArrowDown']),
  rollLeft: Object.freeze(['KeyQ']), rollRight: Object.freeze(['KeyE']),
  fire: Object.freeze(['KeyF']), interact: Object.freeze(['KeyR']), map: Object.freeze(['KeyM']),
  cameraView: Object.freeze(['KeyC']), headlights: Object.freeze(['KeyL']), showHUD: Object.freeze(['KeyH']), missionLog: Object.freeze(['KeyJ']),
  quickChat: Object.freeze(['KeyT']), markTarget: Object.freeze(['KeyG']),
  weapon1: Object.freeze(['Digit1']), weapon2: Object.freeze(['Digit2']), weapon3: Object.freeze(['Digit3']), weapon4: Object.freeze(['Digit4']),
});

/** @type {Readonly<ControlValues>} */
export const DEFAULT_CONTROLS = Object.freeze({ bindings: DEFAULT_BINDINGS, stickSensitivity: 1, invertStickY: false });

/** Keys that can never be bound: they own pause/back or browser/OS behavior. */
const RESERVED = new Set(['Escape', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu', 'F5', 'F11', 'F12']);
const MAX_KEYS = 2;

/** @param {unknown} code */
export function isBindableKey(code) {
  return typeof code === 'string' && /^[A-Za-z][A-Za-z0-9]{0,31}$/.test(code) && !RESERVED.has(code);
}

/** @param {unknown} value @returns {value is ControlAction} */
export function isControlAction(value) {
  return typeof value === 'string' && CONTROL_ACTIONS.some(action => action.id === value);
}

/** Readable key names for menus and prompts.
 * @param {string} code */
export function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  /** @type {Record<string, string>} */
  const names = { Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
    ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', Enter: 'Enter', Backspace: 'Backspace',
    CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
    Quote: "'", Comma: ',', Period: '.', Slash: '/', PageUp: 'Page Up', PageDown: 'Page Down', Home: 'Home', End: 'End', Insert: 'Insert', Delete: 'Delete' };
  return names[code] ?? code;
}

/** Keep a binding set valid: known actions only, bindable keys, at most two per action,
 * and every key owned by one action (the first action in display order wins).
 * @param {unknown} source @returns {KeyBindings} */
export function normalizeBindings(source) {
  const record = source !== null && typeof source === 'object' && !Array.isArray(source) ? /** @type {Record<string, unknown>} */ (source) : {};
  const used = new Set();
  /** @type {Record<string, readonly string[]>} */
  const result = {};
  for (const { id } of CONTROL_ACTIONS) {
    const raw = Object.hasOwn(record, id) ? record[id] : DEFAULT_BINDINGS[id];
    const keys = Array.isArray(raw) ? raw.filter(isBindableKey).filter(code => !used.has(code) && (used.add(code), true)).slice(0, MAX_KEYS) : [];
    result[id] = Object.freeze(keys);
  }
  return /** @type {KeyBindings} */ (Object.freeze(result));
}

/** @param {unknown} source @param {Readonly<ControlValues>} fallback @returns {Readonly<ControlValues>} */
function normalize(source, fallback) {
  const record = source !== null && typeof source === 'object' ? /** @type {Record<string, unknown>} */ (source) : {};
  const sensitivity = record.stickSensitivity, invert = record.invertStickY;
  return Object.freeze({
    bindings: 'bindings' in record ? normalizeBindings(record.bindings) : fallback.bindings,
    stickSensitivity: typeof sensitivity === 'number' && Number.isFinite(sensitivity)
      ? Math.round(Math.max(0.25, Math.min(3, sensitivity)) * 20) / 20 : fallback.stickSensitivity,
    invertStickY: typeof invert === 'boolean' ? invert : fallback.invertStickY,
  });
}

/** Saved keyboard bindings and controller preferences, stored apart from general settings.
 * Storage failures keep changes for this page and never block play. */
export default class ControlBindings {
  /** @param {() => import('../contracts.js').SettingsStorage | undefined} [storageProvider]
   * @param {(values: Readonly<ControlValues>) => void} [onChange] */
  constructor(storageProvider = () => globalThis.window?.localStorage, onChange = () => {}) {
    this.onChange = onChange;
    /** @type {Readonly<ControlValues>} */
    this.values = DEFAULT_CONTROLS;
    /** @type {import('../contracts.js').SettingsSaveStatus} */
    this.saveStatus = 'ready';
    /** @type {import('../contracts.js').SettingsStorage | undefined} */
    this.storage = undefined;
    /** @type {Map<string, ControlAction>} */
    this.actionByKey = new Map();
    let raw = null;
    try {
      this.storage = storageProvider();
      if (!this.storage) this.saveStatus = 'unavailable';
      else raw = this.storage.getItem(CONTROLS_KEY);
    } catch {
      this.saveStatus = 'unavailable';
    }
    if (raw) {
      try {
        /** @type {unknown} */
        const saved = JSON.parse(raw);
        if (saved !== null && typeof saved === 'object' && 'version' in saved && saved.version === 1) this.values = normalize(saved, DEFAULT_CONTROLS);
      } catch { /* Malformed controls fall back to the original layout. */ }
    }
    this.rebuild();
  }

  rebuild() {
    this.actionByKey = new Map();
    for (const { id } of CONTROL_ACTIONS) for (const code of this.values.bindings[id]) this.actionByKey.set(code, id);
  }

  /** @param {string} code @returns {ControlAction | null} */
  actionFor(code) { return this.actionByKey.get(code) ?? null; }

  /** @param {ControlAction} action @param {Partial<Record<string, boolean>>} keyStates */
  isHeld(action, keyStates) { return this.values.bindings[action].some(code => !!keyStates[code]); }

  /** Bind a key as the action's primary key. The key leaves any other action that used it;
   * the action keeps its previous primary as a secondary key.
   * @param {ControlAction} action @param {string} code
   * @returns {{ ok: true, displaced: ControlAction | null } | { ok: false, reason: string }} */
  bind(action, code) {
    if (!isControlAction(action)) return { ok: false, reason: 'Unknown control' };
    if (!isBindableKey(code)) return { ok: false, reason: `${keyLabel(String(code))} is reserved and cannot be bound` };
    const displaced = this.actionFor(code);
    /** @type {Record<string, readonly string[]>} */
    const next = { ...this.values.bindings };
    if (displaced && displaced !== action) next[displaced] = next[displaced].filter(key => key !== code);
    next[action] = [code, ...next[action].filter(key => key !== code)].slice(0, MAX_KEYS);
    this.update({ bindings: next });
    return { ok: true, displaced: displaced && displaced !== action ? displaced : null };
  }

  /** @param {ControlAction} action */
  clear(action) {
    if (!isControlAction(action)) return;
    this.update({ bindings: { ...this.values.bindings, [action]: [] } });
  }

  /** @param {unknown} patch */
  update(patch) {
    this.values = normalize(patch, this.values);
    this.rebuild();
    this.onChange(this.values);
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(CONTROLS_KEY, JSON.stringify({ version: 1, ...this.values }));
      this.saveStatus = 'saved';
    } catch {
      this.saveStatus = 'unavailable';
    }
    return this.values;
  }

  reset() { return this.update(DEFAULT_CONTROLS); }

  /** Actions with no key at all, so menus can warn about them. */
  unboundActions() { return CONTROL_ACTIONS.filter(({ id }) => this.values.bindings[id].length === 0).map(({ id }) => id); }

  /** @param {ControlAction} action */
  describe(action) {
    const keys = this.values.bindings[action];
    return keys.length ? keys.map(keyLabel).join(' / ') : 'Unbound';
  }
}
