import UserLevelLibrary from '../core/UserLevelLibrary.js';
import { LIMITS } from '../core/levels/document/LevelContent.js';
import { serializeLevelDocument } from '../core/levels/document/validateLevelDocument.js';

/** @param {(document: import('../levelDocument.js').LevelDocument) => void} play
 * @param {() => void} back @param {UserLevelLibrary} [library] */
export default function createUserLevels(play, back, library = new UserLevelLibrary()) {
  library.sync();
  const root = document.createElement('div'); root.className = 'user-level-library'; root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'user-levels-title');
  const style = document.createElement('style');
  style.textContent = `
    .user-level-library { position:fixed; inset:0; z-index:5000; display:grid; place-items:center; overflow:auto; box-sizing:border-box; padding:20px; background:#08131f; color:#deedf4; font:16px/1.5 system-ui,sans-serif; }
    .user-level-library * { box-sizing:border-box; }
    .user-level-library article { width:min(800px,100%); max-height:calc(100dvh - 40px); overflow:auto; }
    .user-level-library h1 { margin:0; font-size:30px; }
    .user-level-library p { color:#a9c0ce; }
    .user-level-library button,.user-level-library a { display:inline-block; font:inherit; color:#dcf8ff; background:#24485c; border:1px solid #5e9cae; border-radius:5px; padding:8px 12px; cursor:pointer; text-decoration:none; }
    .user-level-library button:focus-visible,.user-level-library a:focus-visible,.user-level-library input:focus-visible { outline:2px solid #a4edf3; outline-offset:3px; }
    .user-level-library .level-actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
    .user-level-library section { border:1px solid #345367; border-radius:8px; background:#152738; padding:16px; margin:14px 0; overflow-wrap:anywhere; }
    .user-level-library h2 { margin:0; font-size:21px; }
    .user-level-library input { font:inherit; max-width:100%; padding:7px; }
    .user-level-library [role=status] { color:#ffce86; }
  `;
  const article = document.createElement('article');
  const title = document.createElement('h1'); title.id = 'user-levels-title'; title.textContent = 'MY LEVELS';
  const help = document.createElement('p'); help.textContent = 'Play your own mines or import a shared JSON level. Levels stay in this browser; export a file to share or back them up.';
  const toolbar = document.createElement('div'); toolbar.className = 'level-actions';
  const importButton = document.createElement('button'); importButton.textContent = 'Import level JSON';
  const designer = document.createElement('a'); designer.href = '/editor.html'; designer.textContent = 'Create a level';
  const file = document.createElement('input'); file.id = 'user-level-file'; file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = library.status;
  const list = document.createElement('div'); list.id = 'user-level-list';
  const returnButton = document.createElement('button'); returnButton.textContent = 'RETURN TO MAIN MENU'; returnButton.onclick = back;
  toolbar.append(importButton, designer); article.append(title, help, toolbar, file, status, list, returnButton); root.append(style, article);

  /** @param {unknown} error */
  const report = error => { status.textContent = `${error instanceof Error ? error.message : String(error)} ${library.status}`; };
  /** @param {() => void} action */
  function run(action) { try { action(); } catch (error) { report(error); } }
  /** @param {string | null} [focusKey] */
  function render(focusKey = null) {
    list.replaceChildren();
    const entries = library.list();
    if (!entries.length) { const empty = document.createElement('p'); empty.textContent = 'No saved levels yet. Import a JSON file or create a level in the designer.'; list.append(empty); }
    for (const entry of entries) {
      const card = document.createElement('section'); card.dataset.levelKey = entry.key; card.setAttribute('aria-label', entry.document.name);
      const heading = document.createElement('h2'); heading.textContent = entry.document.name;
      const count = entry.document.rooms.length, enemies = entry.document.entities.filter(entity => entity.kind === 'enemy').length;
      const summary = document.createElement('p'); summary.textContent = `${count} ${count === 1 ? 'space' : 'spaces'} · ${enemies} ${enemies === 1 ? 'enemy' : 'enemies'}`;
      const actions = document.createElement('div'); actions.className = 'level-actions';
      /** @param {string} label @param {() => void} action */
      const button = (label, action) => { const node = document.createElement('button'); node.textContent = label; node.onclick = () => run(action); actions.append(node); return node; };
      button('Play level', () => play(entry.document));
      if (library.persistent) { const edit = document.createElement('a'); edit.textContent = 'Open in editor'; edit.href = `/editor.html?level=${encodeURIComponent(entry.key)}`; actions.append(edit); }
      button('Export JSON', () => {
        const url = URL.createObjectURL(new Blob([serializeLevelDocument(entry.document)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `${entry.document.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      const rename = document.createElement('form'); rename.hidden = true;
      const label = document.createElement('label'); label.textContent = 'Level name ';
      const name = document.createElement('input'); name.value = entry.document.name; name.required = true; name.maxLength = 80; name.setAttribute('aria-label', 'Level name');
      const save = document.createElement('button'); save.textContent = 'Save name'; save.type = 'submit';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel rename'; cancel.type = 'button';
      const renameButton = button('Rename', () => { rename.hidden = false; name.focus(); name.select(); });
      cancel.onclick = () => { rename.hidden = true; renameButton.focus(); };
      rename.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); rename.hidden = true; renameButton.focus(); } };
      rename.onsubmit = event => { event.preventDefault(); run(() => { library.rename(entry.key, name.value); status.textContent = library.status; render(entry.key); }); };
      label.append(name); rename.append(label, save, cancel);
      button('Delete', () => {
        if (!window.confirm(`Delete "${entry.document.name}" from My Levels? Export JSON first if you want to keep a copy.`)) return;
        library.remove(entry.key); status.textContent = library.status; render(); importButton.focus();
      });
      card.append(heading, summary, actions, rename); list.append(card);
      if (entry.key === focusKey) actions.querySelector('button')?.focus();
    }
  }
  importButton.onclick = () => file.click();
  file.onchange = async () => {
    const selected = file.files?.[0]; if (!selected) return;
    try {
      if (selected.size > LIMITS.text * 4) throw new Error('File exceeds the level size limit.');
      const entry = library.save(await selected.text());
      status.textContent = `${library.persistent ? 'Imported' : 'Opened temporarily'}: ${entry.document.name}. ${library.status}`; render(entry.key);
    } catch (error) { report(error); }
    finally { file.value = ''; }
  };
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); back(); }
    if (event.key !== 'Tab') return;
    const controls = [...root.querySelectorAll('button,a,input')].filter(node => node instanceof HTMLElement && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first && last instanceof HTMLElement) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last && first instanceof HTMLElement) { event.preventDefault(); first.focus(); }
  });
  render();
  return root;
}
