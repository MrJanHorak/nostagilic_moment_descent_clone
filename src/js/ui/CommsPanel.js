/** Radio and data-log panel. Messages queue and show one at a time for a duration
 * based on their length. Presentation only: timers never touch simulation state, and
 * clear() cancels everything when a session ends. */
export default class CommsPanel {
  constructor() {
    /** @type {HTMLElement | null} */ this.root = null;
    /** @type {{ label: string, text: string, tone: 'radio' | 'log' }[]} */ this.queue = [];
    /** @type {ReturnType<typeof setTimeout> | null} */ this.timer = null;
    /** @type {{ label: string, text: string, tone: 'radio' | 'log' } | null} */ this.showing = null;
    this.paused = false;
  }

  /** @private */
  ensure() {
    if (this.root?.isConnected) return this.root;
    const root = document.createElement('section');
    root.id = 'comms-panel'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite'); root.hidden = true;
    Object.assign(root.style, { position: 'fixed', left: '16px', top: '186px', maxWidth: 'min(280px, calc(100vw - 32px))', zIndex: '850',
      padding: '10px 14px', background: '#06141fdd', borderLeft: '3px solid #59d7e6', color: '#d7f6fb', font: '14px/1.4 system-ui, sans-serif',
      boxShadow: '0 0 12px #0008', pointerEvents: 'none' });
    const label = document.createElement('div'); label.className = 'comms-label';
    Object.assign(label.style, { font: 'bold 12px system-ui, sans-serif', letterSpacing: '.14em', color: '#7fe3ef', marginBottom: '4px' });
    const text = document.createElement('div'); text.className = 'comms-text';
    root.append(label, text); document.body.append(root); this.root = root;
    return root;
  }

  /** @param {string} label @param {string} text @param {'radio' | 'log'} [tone] */
  push(label, text, tone = 'radio') {
    this.queue.push({ label, text, tone });
    if (!this.timer && !this.paused) this.next();
  }

  /** @private */
  next() {
    this.timer = null;
    const root = this.ensure(), item = this.queue.shift() ?? null;
    this.showing = item;
    if (!item) { root.hidden = true; return; }
    root.hidden = false;
    root.style.borderLeftColor = item.tone === 'log' ? '#ffc04d' : '#59d7e6';
    const label = root.querySelector('.comms-label'), text = root.querySelector('.comms-text');
    if (label) { label.textContent = item.label; /** @type {HTMLElement} */ (label).style.color = item.tone === 'log' ? '#ffd27a' : '#7fe3ef'; }
    if (text) text.textContent = item.text;
    const duration = Math.min(14000, Math.max(3500, 1500 + item.text.length * 55));
    this.timer = setTimeout(() => this.next(), duration);
  }

  /** Hold the current message while the game is paused. @param {boolean} paused */
  setPaused(paused) {
    this.paused = paused;
    // Re-show the interrupted message in full on resume.
    if (paused && this.timer) { clearTimeout(this.timer); this.timer = null; if (this.showing) this.queue.unshift(this.showing); }
    else if (!paused && !this.timer && this.queue.length) this.next();
  }

  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.queue = []; this.paused = false; this.showing = null;
    if (this.root) this.root.hidden = true;
  }
}
