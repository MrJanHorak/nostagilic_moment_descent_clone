import { parseLevelDocument } from '../core/levels/document/validateLevelDocument.js';

/** The frame owns an ordinary runtime, its listeners and rendering loop. Removing
 * the frame discards that session; no runtime state is returned to the designer.
 * @param {{startLevelDocument(input: unknown): boolean, endSession(): void, renderer: {dispose(): void}, uiManager: {hideStartScreen(): void}}} game */
export default function mountPlaytest(game) {
  game.uiManager.hideStartScreen();
  const panel = document.createElement('div');
  Object.assign(panel.style, { position: 'fixed', inset: '0', display: 'grid', placeContent: 'center', background: '#101923eb', zIndex: '5000', textAlign: 'center', padding: '24px' });
  const title = document.createElement('h1'); title.textContent = 'Mission preview';
  const status = document.createElement('p'); status.textContent = 'Waiting for the editing snapshot…';
  const help = document.createElement('p'); help.textContent = 'WASD: fly · Space/Shift: up/down · Mouse: look/fire · Q/E: roll · R: relay · Esc: release mouse / pause';
  const start = document.createElement('button'); start.textContent = 'Start playtest'; start.disabled = true;
  Object.assign(start.style, { font: 'inherit', padding: '14px 24px', cursor: 'pointer' });
  panel.append(title, status, help, start); document.body.append(panel);
  /** @type {import('../levelDocument.js').LevelDocument | null} */ let snapshot = null;
  let stopped = false;
  const stop = () => { if (!stopped) { stopped = true; game.endSession(); game.renderer.dispose(); } };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || parent === window) return;
    if (event.data?.type === 'designer-playtest-document' && !snapshot && !stopped) {
      try { snapshot = parseLevelDocument(event.data.text); status.textContent = snapshot.name; start.disabled = false; }
      catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    }
    if (event.data?.type === 'designer-playtest-stop') {
      stop(); parent.postMessage({ type: 'designer-playtest-stopped' }, location.origin);
    }
  });
  start.onclick = () => {
    try { if (snapshot && !stopped && game.startLevelDocument(snapshot)) panel.remove(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  };
  window.addEventListener('pagehide', stop, { once: true });
  if (parent !== window) parent.postMessage({ type: 'designer-playtest-ready' }, location.origin);
}
