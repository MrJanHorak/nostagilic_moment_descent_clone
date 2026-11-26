/** The hangar screen: credits and the four ship upgrades. It opens on top of the
 * current screen and closes back to it. */
import { MAX_LEVEL, UPGRADES } from '../core/Hangar.js';

/** @param {import('../core/Hangar.js').default} hangar @param {{onClose?: () => void}} [options] @returns {HTMLElement} */
export default function openHangar(hangar, { onClose = () => {} } = {}) {
  document.getElementById('hangar-panel')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'hangar-panel'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-label', 'Hangar');
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2600', background: 'rgba(0, 8, 20, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#cafaff', font: '16px system-ui, sans-serif' });
  const panel = document.createElement('div');
  Object.assign(panel.style, { width: 'min(620px, 94vw)', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', padding: '20px 24px', boxSizing: 'border-box',
    border: '1px solid #ffcf5a', borderRadius: '10px', background: 'linear-gradient(rgba(0,0,0,0.7), rgba(20,12,0,0.85))', display: 'grid', gap: '12px' });
  overlay.append(panel);
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); onClose(); };
  /** @param {KeyboardEvent} event */
  const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);

  const render = (/** @type {string} */ message = '', /** @type {string | null} */ focusId = null) => {
    panel.replaceChildren();
    const heading = document.createElement('h2'); heading.textContent = 'KESTREL HANGAR';
    Object.assign(heading.style, { margin: '0', color: '#fff', letterSpacing: '2px', textShadow: '0 0 8px #ffaa00' });
    const credits = document.createElement('p'); credits.id = 'hangar-credits';
    credits.textContent = `${hangar.credits} credits · ${hangar.earned} earned in total`;
    Object.assign(credits.style, { margin: '0', color: '#ffe08a', fontWeight: 'bold' });
    const help = document.createElement('p');
    help.textContent = 'Earn credits by finishing missions: robots, rescued miners, data logs and medals all pay. Replays pay half. Upgrades apply in single player; the daily challenge and online matches always use the stock ship.';
    Object.assign(help.style, { margin: '0', color: '#9fd8ea', fontSize: '14px' });
    panel.append(heading, credits, help);
    for (const upgrade of UPGRADES) {
      const row = document.createElement('section'); row.dataset.upgrade = upgrade.id;
      Object.assign(row.style, { display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', alignItems: 'center', padding: '10px 12px', border: '1px solid #4b5f6b', borderRadius: '6px', background: 'rgba(10,25,35,0.7)' });
      const level = hangar.level(upgrade.id), price = hangar.price(upgrade.id);
      const title = document.createElement('strong'); title.textContent = `${upgrade.label} ${'■'.repeat(level)}${'□'.repeat(MAX_LEVEL - level)}`;
      const detail = document.createElement('span'); detail.textContent = `${upgrade.summary} · ${upgrade.perLevel} per level`; detail.style.color = '#9fd8ea'; detail.style.fontSize = '14px';
      const buy = document.createElement('button'); buy.id = `buy-${upgrade.id}`;
      buy.textContent = price === null ? 'MAXED' : `BUY · ${price}`;
      buy.disabled = price === null || price > hangar.credits;
      Object.assign(buy.style, { gridRow: 'span 2', padding: '8px 14px', font: 'bold 14px system-ui', cursor: buy.disabled ? 'default' : 'pointer', color: '#1a1000', background: buy.disabled ? '#6b6250' : '#ffcf5a', border: '1px solid #ffe7a8', borderRadius: '5px' });
      buy.onclick = () => {
        try { const next = hangar.buy(upgrade.id); render(`${upgrade.label} upgraded to level ${next}.`, buy.id); }
        catch (error) { render(error instanceof Error ? error.message : String(error), buy.id); }
      };
      row.append(title, buy, detail);
      panel.append(row);
    }
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = message; status.style.margin = '0'; status.style.minHeight = '1.2em';
    const actions = document.createElement('div'); Object.assign(actions.style, { display: 'flex', gap: '10px', flexWrap: 'wrap' });
    const back = document.createElement('button'); back.id = 'hangar-close'; back.textContent = 'BACK';
    const refund = document.createElement('button'); refund.textContent = 'SELL ALL UPGRADES';
    refund.disabled = UPGRADES.every(upgrade => hangar.level(upgrade.id) === 0);
    for (const button of [back, refund]) Object.assign(button.style, { padding: '10px 18px', font: '15px system-ui', cursor: 'pointer', color: '#dcf8ff', background: '#24485c', border: '1px solid #5e9cae', borderRadius: '5px' });
    back.onclick = close;
    refund.onclick = () => { if (window.confirm('Sell every upgrade back for its full price?')) { hangar.refund(); render('All upgrades sold. Your ship is stock again.'); } };
    actions.append(back, refund);
    panel.append(status, actions);
    /** @type {HTMLElement | null} */ (focusId ? panel.querySelector(`#${focusId}`) : back)?.focus();
  };
  render();
  document.body.append(overlay);
  /** @type {HTMLElement | null} */ (panel.querySelector('#hangar-close'))?.focus();
  return overlay;
}
