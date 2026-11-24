// Standard-mapping controller support (Xbox / PlayStation / most USB pads in browsers).
// Polling is pure and testable: a snapshot of axes/buttons becomes analog flight values
// and edge-triggered actions. The layout is fixed for now and listed in GAMEPAD_LAYOUT.

/** @typedef {{ axes: readonly number[], buttons: readonly ({ pressed: boolean, value: number } | undefined)[], mapping?: string, connected?: boolean, id?: string, index?: number }} GamepadSnapshot */
/** @typedef {'fire' | 'interact' | 'up' | 'down' | 'rollLeft' | 'rollRight' | 'weaponPrevious' | 'weaponNext'
 *   | 'map' | 'headlights' | 'cameraView' | 'showHUD' | 'pause'} GamepadButtonAction */
/** @typedef {{ forward: number, backward: number, left: number, right: number, up: number, down: number,
 *   yawLeft: number, yawRight: number, pitchUp: number, pitchDown: number, rollLeft: number, rollRight: number }} AnalogFlight */

export const STICK_DEADZONE = 0.15;
export const TRIGGER_THRESHOLD = 0.5;

/** Standard Gamepad button indices. */
/** @type {Readonly<Record<number, GamepadButtonAction>>} */
export const GAMEPAD_BUTTONS = Object.freeze({
  0: 'up', 1: 'down', 2: 'interact', 3: 'weaponNext', 4: 'rollLeft', 5: 'rollRight',
  6: 'weaponPrevious', 7: 'fire', 8: 'map', 9: 'pause', 12: 'map', 13: 'headlights', 14: 'cameraView', 15: 'showHUD',
});

/** Every standard button index whose presses are reported (flight actions and menu navigation). */
export const TRACKED_BUTTONS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15]);
/** Menu navigation: D-pad up/down move focus, A activates, B or Menu goes back/resumes. */
export const MENU_BUTTONS = Object.freeze({ confirm: 0, back: 1, previous: 12, next: 13, pause: 9 });

/** Player-facing reference, in display order. */
export const GAMEPAD_LAYOUT = Object.freeze([
  ['Left stick', 'Thrust forward/back, slide left/right'],
  ['Right stick', 'Turn and pitch'],
  ['A / Cross · B / Circle', 'Slide up · slide down'],
  ['LB / L1 · RB / R1', 'Roll left · roll right'],
  ['RT / R2', 'Fire'],
  ['LT / L2 · Y / Triangle', 'Previous · next weapon'],
  ['X / Square', 'Activate relay'],
  ['D-pad ↑ ↓ ← →', 'Map · headlights · camera · HUD'],
  ['Menu / Options', 'Pause / resume'],
  ['View / Share', 'Expand map'],
  ['In menus', 'D-pad ↑ ↓ to move · A / Cross to select · B / Circle to go back'],
]);

/** Radial deadzone with rescaling, so small drift is ignored and full deflection stays 1.
 * @param {number} x @param {number} y */
export function applyDeadzone(x, y, deadzone = STICK_DEADZONE) {
  const fx = Number.isFinite(x) ? x : 0, fy = Number.isFinite(y) ? y : 0;
  const magnitude = Math.hypot(fx, fy);
  if (magnitude <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (magnitude - deadzone) / (1 - deadzone)) / magnitude;
  return { x: fx * scaled, y: fy * scaled };
}

/** @param {GamepadSnapshot} pad @param {number} index */
function buttonValue(pad, index) {
  const button = pad.buttons[index];
  if (!button) return 0;
  const value = Number.isFinite(button.value) ? button.value : 0;
  return Math.max(button.pressed ? 1 : 0, Math.min(1, Math.max(0, value)));
}

/** @param {GamepadSnapshot} pad @param {number} index */
function isPressed(pad, index) {
  // Analog triggers count as pressed past half travel; digital buttons use their state.
  return index === 6 || index === 7 ? buttonValue(pad, index) >= TRIGGER_THRESHOLD : !!pad.buttons[index]?.pressed;
}

/** Choose the first connected standard-mapping pad, falling back to any connected pad.
 * @param {readonly (GamepadSnapshot | null | undefined)[]} pads */
export function choosePad(pads) {
  const connected = pads.filter(pad => pad && pad.connected !== false);
  return /** @type {GamepadSnapshot | null} */ (connected.find(pad => pad?.mapping === 'standard') ?? connected[0] ?? null);
}

/** Convert a pad snapshot into flight values (0..1 per direction).
 * @param {GamepadSnapshot} pad @param {{ invertY?: boolean }} [options] @returns {AnalogFlight} */
export function readFlight(pad, options = {}) {
  const move = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  const look = applyDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
  // Stick up is negative Y. By default pushing up pitches the nose up, matching the mouse
  // default; invertY gives flight-stick style (push up = nose down).
  const pitch = options.invertY ? look.y : -look.y;
  return {
    forward: Math.max(0, -move.y), backward: Math.max(0, move.y),
    left: Math.max(0, -move.x), right: Math.max(0, move.x),
    up: buttonValue(pad, 0), down: buttonValue(pad, 1),
    yawLeft: Math.max(0, -look.x), yawRight: Math.max(0, look.x),
    pitchUp: Math.max(0, pitch), pitchDown: Math.max(0, -pitch),
    rollLeft: buttonValue(pad, 4), rollRight: buttonValue(pad, 5),
  };
}

/** Tracks button edges between polls so a press triggers its action once. */
export class GamepadTracker {
  constructor() {
    /** @type {Set<number>} */
    this.held = new Set();
    /** @type {string | null} */
    this.padId = null;
  }

  reset() { this.held.clear(); }

  /** @param {GamepadSnapshot | null} pad @returns {number[]} newly pressed standard button indices */
  presses(pad) {
    if (!pad) { this.held.clear(); this.padId = null; return []; }
    const id = `${pad.index ?? 0}:${pad.id ?? ''}`;
    if (id !== this.padId) {
      // A newly connected pad must not fire whatever it already has held.
      this.padId = id; this.held.clear();
      for (const index of TRACKED_BUTTONS) if (isPressed(pad, index)) this.held.add(index);
      return [];
    }
    /** @type {number[]} */
    const pressed = [];
    for (const index of TRACKED_BUTTONS) {
      const down = isPressed(pad, index);
      if (down && !this.held.has(index)) { this.held.add(index); pressed.push(index); }
      else if (!down) this.held.delete(index);
    }
    return pressed;
  }
}

/** Neutral analog state. @returns {AnalogFlight} */
export function neutralFlight() {
  return { forward: 0, backward: 0, left: 0, right: 0, up: 0, down: 0, yawLeft: 0, yawRight: 0, pitchUp: 0, pitchDown: 0, rollLeft: 0, rollRight: 0 };
}
