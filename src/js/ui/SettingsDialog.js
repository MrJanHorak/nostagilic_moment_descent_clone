// One modal at a time. Native modality supplies background inertness; Tab edges stay inside.
export default class SettingsDialog {
  /** @param {import('../core/UserSettings.js').default} settings */
  constructor(settings) {
    this.settings = settings;
    /** @type {HTMLDialogElement | null} */
    this.dialog = null;
    /** @type {HTMLElement | SVGElement | null} */
    this.returnFocus = null;
  }

  get isOpen() { return !!this.dialog?.open; }

  open() {
    if (this.isOpen) return;
    const active = document.activeElement;
    this.returnFocus = active instanceof HTMLElement || active instanceof SVGElement ? active : null;
    const dialog = document.createElement('dialog');
    dialog.className = 'control-settings';
    dialog.setAttribute('aria-labelledby', 'control-settings-title');
    dialog.innerHTML = `
      <style>
        .control-settings { box-sizing: border-box; width: min(440px, calc(100vw - 32px));
          max-height: calc(100dvh - 32px); overflow: auto; padding: 24px;
          background: #061a2b; color: #cafaff; border: 1px solid #00aaff; border-radius: 10px;
          box-shadow: 0 0 24px #0066aa80; font: 16px Arial, sans-serif; }
        .control-settings::backdrop { background: #000b; }
        .control-settings h2 { margin: 0 0 24px; color: white; font-size: 24px; }
        .control-settings label { display: block; margin: 16px 0 8px; }
        .control-settings input[type=range] { width: 100%; accent-color: #45e5ed; }
        .control-settings input[type=checkbox] { accent-color: #45e5ed; width: 18px; height: 18px; vertical-align: middle; }
        .control-settings input:focus-visible, .control-settings button:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
        .control-settings p { line-height: 1.45; }
        .control-settings .settings-hint { font-size: 14px; color: #a7c6d7; margin-top: 8px; }
        .control-settings .settings-actions { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-top: 24px; }
        .control-settings button { padding: 10px 16px; border: 1px solid #00aaff; border-radius: 5px; background: #003048; color: white; font: inherit; cursor: pointer; }
      </style>
      <h2 id="control-settings-title">CONTROL SETTINGS</h2>
      <label for="mouse-sensitivity">Mouse sensitivity <output id="sensitivity-value" for="mouse-sensitivity"></output></label>
      <input id="mouse-sensitivity" type="range" min="0.25" max="3" step="0.05" aria-describedby="sensitivity-hint" autofocus>
      <p id="sensitivity-hint" class="settings-hint">0.25× slow · 1× default · 3× fast</p>
      <label><input id="invert-mouse-y" type="checkbox" aria-describedby="invert-hint"> Invert mouse Y</label>
      <p id="invert-hint" class="settings-hint">When enabled, moving the mouse up pitches the ship down.</p>
      <p class="settings-save-status" role="status" aria-label="Settings saving status" aria-live="polite"></p>
      <div class="settings-actions"><button type="button" class="settings-reset">Reset to defaults</button>
        <button type="button" class="settings-done">Done</button></div>`;
    // These controls are owned by the fixed markup above; fail locally if it drifts.
    const sensitivity = dialog.querySelector('input#mouse-sensitivity');
    const invert = dialog.querySelector('input#invert-mouse-y');
    const output = dialog.querySelector('output#sensitivity-value');
    const status = dialog.querySelector('.settings-save-status');
    const reset = dialog.querySelector('button.settings-reset');
    const done = dialog.querySelector('button.settings-done');
    if (!(sensitivity instanceof HTMLInputElement) || !(invert instanceof HTMLInputElement) ||
      !output || !status || !(reset instanceof HTMLButtonElement) || !(done instanceof HTMLButtonElement)) {
      throw new Error('Settings dialog controls are missing');
    }
    const refresh = () => {
      sensitivity.value = String(this.settings.values.mouseSensitivity);
      invert.checked = this.settings.values.invertY;
      output.textContent = `${this.settings.values.mouseSensitivity.toFixed(2)}×`;
      status.textContent = this.settings.saveStatus === 'unavailable'
        ? 'Changes apply now, but could not be saved in this browser.'
        : this.settings.saveStatus === 'saved' ? 'Saved on this browser. Changes apply immediately.'
          : 'Changes apply immediately and are saved on this browser.';
    };
    sensitivity.addEventListener('input', () => { this.settings.update({ mouseSensitivity: Number(sensitivity.value) }); refresh(); });
    invert.addEventListener('change', () => { this.settings.update({ invertY: invert.checked }); refresh(); });
    reset.addEventListener('click', () => { this.settings.reset(); refresh(); });
    done.addEventListener('click', () => this.close());
    // Escape closes only this dialog; slider arrows and F never reach gameplay handlers.
    dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      if (!event.shiftKey && document.activeElement === done) {
        event.preventDefault(); sensitivity.focus();
      } else if (event.shiftKey && document.activeElement === sensitivity) {
        event.preventDefault(); done.focus();
      }
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    refresh();
    document.body.appendChild(dialog);
    this.dialog = dialog;
    dialog.showModal();
  }

  /** @param {boolean} [restoreFocus] */
  close(restoreFocus = true) {
    if (!this.dialog) return;
    this.dialog.close();
    this.dialog.remove();
    this.dialog = null;
    if (restoreFocus && this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
  }
}
