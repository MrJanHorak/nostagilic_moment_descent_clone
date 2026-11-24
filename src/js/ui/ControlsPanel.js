import { CONTROL_ACTIONS, keyLabel } from '../core/ControlBindings.js';
import { GAMEPAD_LAYOUT } from '../core/GamepadInput.js';

/** Collapsible keyboard remapping and controller section for the settings dialog.
 * Click a binding, then press a key; Escape cancels; Delete/Backspace clears.
 * @param {import('../core/ControlBindings.js').default} controls */
export default function createControlsPanel(controls) {
  const root = document.createElement('details');
  root.className = 'controls-panel';
  const summary = document.createElement('summary'); summary.textContent = 'Controls: keyboard and controller';
  const style = document.createElement('style');
  style.textContent = `
    .controls-panel { margin: 20px 0 8px; border-top: 1px solid #1d4a63; padding-top: 12px; }
    .controls-panel summary { cursor: pointer; font-weight: bold; color: white; padding: 4px 0; }
    .controls-panel summary:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
    .controls-panel h3 { margin: 16px 0 6px; font-size: 14px; letter-spacing: .12em; color: #70d2db; }
    .controls-panel .binding-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; margin: 4px 0; }
    .controls-panel .binding-row button { min-width: 128px; padding: 6px 10px; font-size: 14px; text-align: center; }
    .controls-panel .binding-row button[data-listening="true"] { background: #6b4a00; border-color: #ffcc66; }
    .controls-panel .binding-row button[data-unbound="true"] { border-color: #ff8a6b; color: #ffc2b0; }
    .controls-panel table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .controls-panel td { padding: 3px 4px; vertical-align: top; border-bottom: 1px solid #12354a; }
    .controls-panel td:first-child { color: white; white-space: nowrap; padding-right: 10px; }
    .controls-panel .controls-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
  `;
  const status = document.createElement('p'); status.className = 'settings-hint'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const intro = document.createElement('p'); intro.className = 'settings-hint';
  intro.textContent = 'Select a control, then press a key. Escape cancels, Delete clears. Esc always pauses; the mouse always aims and fires. Keys moved from another control are reported here.';
  root.append(summary, style, intro);

  /** @type {Map<string, HTMLButtonElement>} */
  const buttons = new Map();
  /** @type {import('../core/ControlBindings.js').ControlAction | null} */
  let listening = null;
  let group = '';
  for (const action of CONTROL_ACTIONS) {
    if (action.group !== group) {
      group = action.group;
      const heading = document.createElement('h3'); heading.textContent = group.toUpperCase(); root.append(heading);
    }
    const row = document.createElement('div'); row.className = 'binding-row';
    const label = document.createElement('span'); label.id = `binding-label-${action.id}`; label.textContent = action.label;
    const button = document.createElement('button'); button.type = 'button'; button.dataset.action = action.id;
    button.setAttribute('aria-describedby', label.id);
    button.addEventListener('click', () => { listening = listening === action.id ? null : action.id; refresh(); });
    buttons.set(action.id, button);
    row.append(label, button); root.append(row);
  }

  const padHeading = document.createElement('h3'); padHeading.textContent = 'CONTROLLER (STANDARD LAYOUT)';
  const sensitivityLabel = document.createElement('label'); sensitivityLabel.htmlFor = 'stick-sensitivity';
  const sensitivityOutput = document.createElement('output'); sensitivityOutput.htmlFor.add('stick-sensitivity');
  sensitivityLabel.append('Stick look sensitivity ', sensitivityOutput);
  const sensitivity = document.createElement('input'); sensitivity.type = 'range'; sensitivity.id = 'stick-sensitivity';
  sensitivity.min = '0.25'; sensitivity.max = '3'; sensitivity.step = '0.05';
  sensitivity.addEventListener('input', () => { controls.update({ stickSensitivity: Number(sensitivity.value) }); refresh(); });
  const invertLabel = document.createElement('label'); const invert = document.createElement('input'); invert.type = 'checkbox'; invert.id = 'invert-stick-y';
  invert.addEventListener('change', () => { controls.update({ invertStickY: invert.checked }); refresh(); });
  invertLabel.append(invert, ' Invert stick Y (push up to pitch down)');
  const table = document.createElement('table');
  for (const [input, effect] of GAMEPAD_LAYOUT) {
    const tr = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td');
    a.textContent = input; b.textContent = effect; tr.append(a, b); table.append(tr);
  }
  const actions = document.createElement('div'); actions.className = 'controls-actions';
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset controls';
  reset.addEventListener('click', () => { listening = null; controls.reset(); status.textContent = 'Controls restored to the original layout.'; refresh(false); });
  actions.append(reset);
  root.append(padHeading, sensitivityLabel, sensitivity, invertLabel, table, actions, status);

  /** @param {boolean} [clearStatus] */
  function refresh(clearStatus = false) {
    for (const [id, button] of buttons) {
      const action = /** @type {import('../core/ControlBindings.js').ControlAction} */ (id);
      const active = listening === action;
      button.dataset.listening = String(active);
      button.dataset.unbound = String(controls.values.bindings[action].length === 0);
      button.textContent = active ? 'Press a key…' : controls.describe(action);
      const label = CONTROL_ACTIONS.find(entry => entry.id === action)?.label ?? action;
      button.setAttribute('aria-label', active ? `${label}: press a key, Escape to cancel` : `${label}: ${controls.describe(action)}. Select to change.`);
    }
    sensitivity.value = String(controls.values.stickSensitivity);
    sensitivityOutput.textContent = `${controls.values.stickSensitivity.toFixed(2)}×`;
    invert.checked = controls.values.invertStickY;
    if (clearStatus) status.textContent = '';
    if (controls.saveStatus === 'unavailable') status.textContent = 'Controls apply now but could not be saved in this browser.';
  }

  /** Called by the dialog before its own key handling. Returns true when consumed.
   * @param {KeyboardEvent} event */
  function handleKey(event) {
    if (!listening) return false;
    event.preventDefault();
    const action = listening;
    const label = CONTROL_ACTIONS.find(entry => entry.id === action)?.label ?? action;
    if (event.code === 'Escape') { listening = null; status.textContent = 'Change cancelled.'; }
    else if (event.code === 'Delete' || event.code === 'Backspace') {
      controls.clear(action); listening = null;
      status.textContent = `${label} has no key now. Select it to assign one.`;
    } else {
      const result = controls.bind(action, event.code);
      if (!result.ok) status.textContent = result.reason;
      else {
        listening = null;
        const moved = result.displaced ? CONTROL_ACTIONS.find(entry => entry.id === result.displaced)?.label : null;
        status.textContent = `${label}: ${keyLabel(event.code)}${moved ? ` (removed from ${moved}${controls.values.bindings[/** @type {import('../core/ControlBindings.js').ControlAction} */ (result.displaced)].length ? '' : ', which now has no key'})` : ''}.`;
      }
    }
    refresh();
    buttons.get(action)?.focus();
    return true;
  }

  refresh();
  return { element: root, handleKey, refresh, get listening() { return listening; } };
}
