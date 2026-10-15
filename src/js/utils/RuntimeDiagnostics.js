// Development-only status for the repeatable ?smoke=1 browser check.
// This never changes gameplay state or exposes a game object on window.
export default class RuntimeDiagnostics {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.frames = 0;
    this.updates = 0;
    this.errors = 0;
    this.lastRefresh = -Infinity;
    this.panel = null;
    this.lastError = '';
  }

  recordFrame(gameState) {
    if (!this.enabled) return;
    this.frames++;
    const now = performance.now();
    if (now - this.lastRefresh < 250) return;
    this.lastRefresh = now;
    this.refresh(gameState);
  }

  recordUpdate() {
    if (this.enabled) this.updates++;
  }

  reportError(error, stage) {
    if (!this.enabled) return;
    this.errors++;
    this.lastError = `${stage}: ${error.message || error}`;
    this.refresh();
  }

  refresh(gameState) {
    if (!this.enabled || !globalThis.document?.body) return;
    if (!this.panel) {
      this.panel = document.createElement('pre');
      this.panel.id = 'runtime-diagnostics';
      this.panel.setAttribute('role', 'status');
      Object.assign(this.panel.style, {
        position: 'fixed', bottom: '8px', left: '8px', margin: '0',
        padding: '8px', zIndex: '2000', background: '#00131ee8',
        color: '#b9efff', font: '12px monospace', pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)', whiteSpace: 'pre-wrap',
      });
      document.body.appendChild(this.panel);
    }
    if (gameState) {
      this.phase = !gameState.isGameStarted ? 'MENU'
        : gameState.isGameOver ? 'GAME OVER'
        : gameState.isPaused ? 'PAUSED' : 'RUNNING';
    }
    this.panel.textContent = [
      `SMOKE CHECK | ${this.phase || 'INITIALIZING'}`,
      `Frames: ${this.frames} | Updates: ${this.updates} | Errors: ${this.errors}`,
      this.lastError,
    ].filter(Boolean).join('\n');
  }
}
