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
      <h2 id="control-settings-title">GAME SETTINGS</h2>
      <label for="mouse-sensitivity">Mouse sensitivity <output id="sensitivity-value" for="mouse-sensitivity"></output></label>
      <input id="mouse-sensitivity" type="range" min="0.25" max="3" step="0.05" aria-describedby="sensitivity-hint" autofocus>
      <p id="sensitivity-hint" class="settings-hint">0.25× slow · 1× default · 3× fast</p>
      <label><input id="invert-mouse-y" type="checkbox" aria-describedby="invert-hint"> Invert mouse Y</label>
      <p id="invert-hint" class="settings-hint">When enabled, moving the mouse up pitches the ship down.</p>
      <label for="camera-view">Ship camera</label><select id="camera-view"><option value="hud">HUD / first person</option><option value="external">External chase camera</option></select>
      <label><input id="ship-headlights" type="checkbox"> Ship headlights</label>
      <label><input id="show-flight-hud" type="checkbox"> Show flight HUD</label>
      <p class="settings-hint">During flight: C switches camera · L toggles headlights · H toggles HUD. Mission objectives stay visible.</p>
      <label for="music-volume">Music volume <output id="music-volume-value" for="music-volume"></output></label>
      <input id="music-volume" type="range" min="0" max="100" step="1">
      <label for="effects-volume">Effects volume <output id="effects-volume-value" for="effects-volume"></output></label>
      <input id="effects-volume" type="range" min="0" max="100" step="1">
      <label><input id="mute-audio" type="checkbox" aria-describedby="mute-hint"> Mute all audio</label>
      <p id="mute-hint" class="settings-hint">Mute keeps your volume levels. Audio stays silent while the game is paused.</p>
      <p class="settings-save-status" role="status" aria-label="Settings saving status" aria-live="polite"></p>
      <div class="settings-actions"><button type="button" class="settings-reset">Reset to defaults</button>
        <button type="button" class="settings-done">Done</button></div>`;
    // These controls are owned by the fixed markup above; fail locally if it drifts.
    const sensitivity = dialog.querySelector('input#mouse-sensitivity');
    const invert = dialog.querySelector('input#invert-mouse-y');
    const music = dialog.querySelector('input#music-volume');
    const effects = dialog.querySelector('input#effects-volume');
    const mute = dialog.querySelector('input#mute-audio');
    const cameraView = dialog.querySelector('select#camera-view');
    const headlights = dialog.querySelector('input#ship-headlights');
    const showHUD = dialog.querySelector('input#show-flight-hud');
    const musicOutput = dialog.querySelector('output#music-volume-value');
    const effectsOutput = dialog.querySelector('output#effects-volume-value');
    const output = dialog.querySelector('output#sensitivity-value');
    const status = dialog.querySelector('.settings-save-status');
    const reset = dialog.querySelector('button.settings-reset');
    const done = dialog.querySelector('button.settings-done');
    if (!(sensitivity instanceof HTMLInputElement) || !(invert instanceof HTMLInputElement) ||
      !(music instanceof HTMLInputElement) || !(effects instanceof HTMLInputElement) ||
      !(mute instanceof HTMLInputElement) || !(cameraView instanceof HTMLSelectElement) || !(headlights instanceof HTMLInputElement) || !(showHUD instanceof HTMLInputElement) || !musicOutput || !effectsOutput ||
      !output || !status || !(reset instanceof HTMLButtonElement) || !(done instanceof HTMLButtonElement)) {
      throw new Error('Settings dialog controls are missing');
    }
    const refresh = () => {
      sensitivity.value = String(this.settings.values.mouseSensitivity);
      invert.checked = this.settings.values.invertY;
      music.value = String(Math.round(this.settings.values.musicVolume * 100));
      effects.value = String(Math.round(this.settings.values.effectsVolume * 100));
      mute.checked = this.settings.values.muted;
      cameraView.value = this.settings.values.cameraView; headlights.checked = this.settings.values.headlights; showHUD.checked = this.settings.values.showHUD;
      musicOutput.textContent = `${music.value}%`;
      effectsOutput.textContent = `${effects.value}%`;
      output.textContent = `${this.settings.values.mouseSensitivity.toFixed(2)}×`;
      status.textContent = this.settings.saveStatus === 'unavailable'
        ? 'Changes apply now, but could not be saved in this browser.'
        : this.settings.saveStatus === 'saved' ? 'Saved on this browser. Changes apply immediately.'
          : 'Changes apply immediately and are saved on this browser.';
    };
    sensitivity.addEventListener('input', () => { this.settings.update({ mouseSensitivity: Number(sensitivity.value) }); refresh(); });
    invert.addEventListener('change', () => { this.settings.update({ invertY: invert.checked }); refresh(); });
    music.addEventListener('input', () => { this.settings.update({ musicVolume: Number(music.value) / 100 }); refresh(); });
    effects.addEventListener('input', () => { this.settings.update({ effectsVolume: Number(effects.value) / 100 }); refresh(); });
    mute.addEventListener('change', () => { this.settings.update({ muted: mute.checked }); refresh(); });
    cameraView.addEventListener('change', () => { this.settings.update({ cameraView: cameraView.value }); refresh(); });
    headlights.addEventListener('change', () => { this.settings.update({ headlights: headlights.checked }); refresh(); });
    showHUD.addEventListener('change', () => { this.settings.update({ showHUD: showHUD.checked }); refresh(); });
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
