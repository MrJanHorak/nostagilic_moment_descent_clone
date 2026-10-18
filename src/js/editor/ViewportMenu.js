/** @typedef {{label: string, action: () => void, disabled?: boolean, reason?: string, preview?: () => void}} MenuAction */
/** @typedef {{id: string, label: string, value: string, type?: 'text' | 'color' | 'number', options?: {value: string, label: string}[], min?: string, max?: string, step?: string}} MenuField */

/** An anchored, keyboard-operable menu/editor. All dynamic labels are text.
 * Failing actions leave the menu and its error visible beside the clicked point. */
export default class ViewportMenu {
  /** @param {HTMLElement} opener @param {() => void} onClose */
  constructor(opener, onClose) {
    this.opener = opener; this.onClose = onClose;
    /** @type {HTMLElement | null} */ this.root = null;
    this.x = 0; this.y = 0;
    this.events = new AbortController();
    document.addEventListener('pointerdown', event => { if (this.root && event.target instanceof Node && !this.root.contains(event.target)) this.close(false); }, { signal: this.events.signal });
    window.addEventListener('resize', () => this.close(false), { signal: this.events.signal });
  }
  /** @param {boolean} [focus] */
  close(focus = false) {
    if (!this.root) return;
    this.root.remove(); this.root = null; this.onClose(); if (focus) this.opener.focus();
  }
  /** @param {string} title @param {string} detail @param {'menu' | 'dialog'} role */
  panel(title, detail, role) {
    this.root?.remove();
    const root = document.createElement('div'); root.className = 'viewport-popover'; root.id = 'viewport-context-menu'; root.setAttribute('role', role); root.setAttribute('aria-label', title);
    const heading = document.createElement('strong'); heading.textContent = title;
    const description = document.createElement('p'); description.textContent = detail;
    const error = document.createElement('p'); error.className = 'popover-error'; error.setAttribute('role', 'alert');
    root.append(heading, description, error); this.root = root; document.body.append(root);
    root.addEventListener('keydown', event => {
      event.stopPropagation();
      const controls = [...root.querySelectorAll('button:not(:disabled), input, select')].filter(node => node instanceof HTMLElement);
      const current = controls.indexOf(/** @type {HTMLElement} */ (document.activeElement));
      if (event.key === 'Escape') { event.preventDefault(); this.close(true); }
      else if (role === 'menu' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const index = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length;
        controls[index]?.focus();
      } else if (event.key === 'Tab') {
        if (role === 'menu') { event.preventDefault(); this.close(true); }
        else if (controls.length) { event.preventDefault(); controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus(); }
      }
    });
    return root;
  }
  position() {
    if (!this.root) return;
    const bounds = this.root.getBoundingClientRect();
    this.root.style.left = `${Math.max(12, Math.min(this.x, window.innerWidth - bounds.width - 12))}px`;
    this.root.style.top = `${Math.max(12, Math.min(this.y, window.innerHeight - bounds.height - 12))}px`;
  }
  /** @param {unknown} error */
  error(error) {
    const node = this.root?.querySelector('[role="alert"]'); if (node) node.textContent = error instanceof Error ? error.message : String(error);
    this.position();
  }
  /** @param {number} x @param {number} y @param {string} title @param {string} detail @param {MenuAction[]} actions */
  open(x, y, title, detail, actions) {
    this.x = x; this.y = y; const root = this.panel(title, detail, 'menu');
    for (const action of actions) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = action.label; button.setAttribute('role', 'menuitem'); button.disabled = !!action.disabled;
      button.addEventListener('pointerenter', () => action.preview?.()); button.addEventListener('focus', () => action.preview?.());
      button.onclick = () => { try { action.action(); if (this.root === root) this.close(true); } catch (error) { this.error(error); } };
      root.append(button);
      if (action.reason) { const reason = document.createElement('p'); reason.className = 'menu-reason'; reason.textContent = action.reason; root.append(reason); }
    }
    this.position(); const first = root.querySelector('button:not(:disabled)'); if (first instanceof HTMLElement) first.focus();
  }
  /** @param {string} title @param {string} detail @param {MenuField[]} fields
   * @param {(values: Record<string, string>) => void} apply @param {string} [applyLabel]
   * @param {(values: Record<string, string>) => void} [preview] */
  form(title, detail, fields, apply, applyLabel = 'Apply', preview = () => {}) {
    const root = this.panel(title, detail, 'dialog'), form = document.createElement('form');
    /** @type {Record<string, HTMLInputElement | HTMLSelectElement>} */ const controls = {};
    const values = () => Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
    for (const field of fields) {
      const label = document.createElement('label'); label.textContent = field.label;
      const control = field.options ? document.createElement('select') : document.createElement('input');
      if (control instanceof HTMLSelectElement) for (const option of field.options ?? []) control.add(new Option(option.label, option.value));
      else { control.type = field.type ?? 'text'; control.required = true; if (field.min) control.min = field.min; if (field.max) control.max = field.max; if (field.step) control.step = field.step; }
      control.value = field.value; controls[field.id] = control; label.append(control); form.append(label);
      control.addEventListener('input', () => preview(values()));
    }
    const buttons = document.createElement('div'); buttons.className = 'popover-buttons';
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = applyLabel; submit.className = 'primary';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.onclick = () => this.close(true);
    buttons.append(submit, cancel); form.append(buttons); root.append(form);
    form.onsubmit = event => { event.preventDefault(); try { apply(values()); if (this.root === root) this.close(true); } catch (error) { this.error(error); } };
    this.position(); const first = root.querySelector('input, select'); if (first instanceof HTMLElement) first.focus(); preview(values());
  }
  dispose() { this.close(); this.events.abort(); }
}
