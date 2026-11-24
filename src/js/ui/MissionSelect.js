import { formatMissionTime } from '../core/CampaignProgress.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../core/Difficulty.js';

/** @typedef {{ completions: number, bestScore: number, bestTimeMs: number, hardestDifficulty?: import('../core/Difficulty.js').DifficultyId, logIds?: readonly string[], mostRescued?: number }} MissionProgress */
/** @param {readonly {name: string, id?: string, campaignOrder?: number, briefing?: string, story?: { logs: readonly { id: string, title: string, text: string }[], survivors: readonly unknown[] }}[]} levels
 * @param {(index: number) => void} choose @param {() => void} back
 * @param {{userLevels?: () => void, hiddenIndex?: number | null,
 *   progress?: (level: {name: string, id?: string, campaignOrder?: number}) => MissionProgress | null,
 *   resetProgress?: () => void,
 *   difficulty?: { value: import('../core/Difficulty.js').DifficultyId, onChange: (value: string) => void }}} [options] */
export default function createMissionSelect(levels, choose, back, options = {}) {
  const root = document.createElement('div'); root.className = 'mission-library'; root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'mission-library-title');
  const style = document.createElement('style');
  style.textContent = `
    .mission-library { position:fixed; inset:0; z-index:5000; display:grid; place-items:center; overflow:auto; padding:24px; background:#08131ff5; color:#deedf4; font:16px/1.5 system-ui,sans-serif; }
    .mission-library * { box-sizing:border-box; }
    .mission-library article { width:min(760px,100%); max-height:calc(100dvh - 48px); overflow:auto; }
    .mission-library h1 { font-size:32px; margin:0 0 8px; }
    .mission-library .eyebrow { color:#70d2db; letter-spacing:.18em; font-size:12px; }
    .mission-library p { color:#9fb8c9; margin:8px 0 20px; }
    .mission-library .mission-card { border:1px solid #345367; background:#152738; border-radius:8px; padding:18px; margin:12px 0; }
    .mission-library button { font:inherit; text-align:left; color:#d9f8ff; background:#24485c; border:1px solid #5e9cae; border-radius:5px; padding:10px 16px; cursor:pointer; }
    .mission-library .mission-card button { font-size:20px; font-weight:600; width:100%; }
    .mission-library .mission-card p { margin:12px 0 0; font-size:14px; }
    .mission-library details { margin:24px 0; color:#9fb8c9; }
    .mission-library summary { cursor:pointer; padding:8px 0; }
    .mission-library details button { display:block; width:100%; margin:8px 0; font-size:14px; }
    .mission-library button:hover { background:#315b70; }
    .mission-library .mission-status { margin:10px 0 0; color:#8fe3a8; font-size:13px; letter-spacing:.06em; }
    .mission-library .difficulty-row { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:0 0 6px; }
    .mission-library .difficulty-row select { font:inherit; color:#d9f8ff; background:#24485c; border:1px solid #5e9cae; border-radius:5px; padding:8px 10px; }
    .mission-library .difficulty-row select:focus-visible { outline:2px solid #a4edf3; outline-offset:4px; }
    .mission-library .difficulty-summary { margin:0 0 16px; font-size:14px; }
    .mission-library .log-archive { margin-top:10px; font-size:14px; }
    .mission-library .log-archive summary { color:#ffd27a; padding:4px 0; }
    .mission-library .log-archive article { border-left:3px solid #ffc04d; padding:2px 0 2px 10px; margin:8px 0; width:auto; max-height:none; }
    .mission-library .log-archive b { display:block; color:#ffd27a; font-size:13px; letter-spacing:.06em; }
    .mission-library .reset-progress { margin-top:12px; font-size:14px; background:#3a2a2a; border-color:#9a6a6a; }
    .mission-library .reset-progress:hover { background:#4d3434; }
    .mission-library button:focus-visible, .mission-library summary:focus-visible { outline:2px solid #a4edf3; outline-offset:4px; }
  `;
  const article = document.createElement('article');
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'DESCENDED / OPERATIONS';
  const title = document.createElement('h1'); title.id = 'mission-library-title'; title.textContent = 'SELECT MISSION';
  const help = document.createElement('p'); help.textContent = 'Authored missions: find the route, restore systems, and get out. C: camera · L: lights · H: HUD.';
  article.append(eyebrow, title, help);
  if (options.difficulty) {
    const current = options.difficulty;
    const row = document.createElement('div'); row.className = 'difficulty-row';
    const label = document.createElement('label'); label.htmlFor = 'mission-difficulty'; label.textContent = 'Difficulty';
    const select = document.createElement('select'); select.id = 'mission-difficulty';
    for (const id of DIFFICULTY_ORDER) {
      const option = document.createElement('option'); option.value = id; option.textContent = DIFFICULTIES[id].label; select.append(option);
    }
    select.value = current.value;
    const summary = document.createElement('p'); summary.className = 'difficulty-summary'; summary.id = 'mission-difficulty-summary';
    summary.textContent = DIFFICULTIES[current.value].summary;
    select.setAttribute('aria-describedby', summary.id);
    select.onchange = () => { current.onChange(select.value); summary.textContent = DIFFICULTIES[DIFFICULTY_ORDER.find(id => id === select.value) ?? 'pilot'].summary; };
    row.append(label, select); article.append(row, summary);
  }
  if (options.userLevels) {
    const userLevels = document.createElement('button'); userLevels.textContent = 'MY LEVELS'; userLevels.onclick = options.userLevels; article.append(userLevels);
  }
  const practice = document.createElement('details'), summary = document.createElement('summary');
  summary.textContent = 'Practice & prototypes'; practice.append(summary);
  for (const [index, level] of levels.entries()) {
    if (index === options.hiddenIndex) continue;
    const button = document.createElement('button'); button.textContent = level.name; button.onclick = () => choose(index);
    if (level.campaignOrder) {
      const card = document.createElement('section'); card.className = 'mission-card';
      const number = document.createElement('div'); number.className = 'eyebrow'; number.textContent = `MISSION ${String(level.campaignOrder).padStart(2, '0')}`;
      const briefing = document.createElement('p'); briefing.textContent = level.briefing ?? '';
      card.append(number, button);
      const record = options.progress?.(level);
      if (record) {
        const status = document.createElement('div'); status.className = 'mission-status';
        const hardest = record.hardestDifficulty && record.hardestDifficulty !== 'pilot' ? ` on ${DIFFICULTIES[record.hardestDifficulty].label}` : '';
        status.textContent = `✓ COMPLETED${hardest}${record.completions > 1 ? ` ×${record.completions}` : ''} · Best time ${formatMissionTime(record.bestTimeMs)} · Best score ${record.bestScore}`;
        button.setAttribute('aria-description', 'Completed');
        const survivors = level.story?.survivors.length ?? 0;
        if (survivors) status.textContent += ` · Rescued ${record.mostRescued ?? 0}/${survivors}`;
        card.append(status);
        const logs = level.story?.logs ?? [];
        if (logs.length) {
          const found = logs.filter(log => record.logIds?.includes(log.id));
          const archive = document.createElement('details'); archive.className = 'log-archive';
          const title = document.createElement('summary'); title.textContent = `Data logs recovered ${found.length}/${logs.length}`;
          archive.append(title);
          if (!found.length) { const none = document.createElement('p'); none.textContent = 'None yet. Logs count once you extract with them.'; archive.append(none); }
          for (const log of found) {
            const entry = document.createElement('article'), heading = document.createElement('b');
            heading.textContent = log.title; entry.append(heading, log.text); archive.append(entry);
          }
          card.append(archive);
        }
      }
      card.append(briefing); article.append(card);
    } else {
      practice.append(button);
      if (level.briefing) { const briefing = document.createElement('p'); briefing.textContent = level.briefing; practice.append(briefing); }
    }
  }
  const returnButton = document.createElement('button'); returnButton.textContent = 'RETURN TO MAIN MENU'; returnButton.onclick = back;
  article.append(practice, returnButton);
  const anyProgress = options.progress && levels.some((level, index) => index !== options.hiddenIndex && options.progress?.(level));
  if (options.resetProgress && anyProgress) {
    const reset = document.createElement('button'); reset.className = 'reset-progress'; reset.textContent = 'Reset campaign progress';
    let armed = false;
    reset.onclick = () => {
      if (!armed) { armed = true; reset.textContent = 'Click again to erase saved campaign progress'; return; }
      options.resetProgress?.();
    };
    reset.onblur = () => { armed = false; reset.textContent = 'Reset campaign progress'; };
    article.append(document.createElement('br'), reset);
  }
  root.append(style, article);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); back(); }
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll('button, summary')].filter(node => node instanceof HTMLElement && node.getClientRects().length);
    const first = /** @type {HTMLElement | undefined} */ (focusable[0]), last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first && last instanceof HTMLElement) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  return root;
}
