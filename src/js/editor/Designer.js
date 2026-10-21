import connectionDialog from './ConnectionDialog.js';
import doorDialog from './DoorDialog.js';
import escapeDialog from './EscapeDialog.js';
import EditorDocument, { createDocument } from './EditorDocument.js';
import EditorViewport from './EditorViewport.js';
import { FACES, LIMITS, EXPANDED_LIMITS, MATERIALS, SURFACE_PATTERNS, openingRules } from '../core/levels/document/LevelContent.js';
import { connectableFace, portFrame } from '../core/levels/document/RoomMath.js';
import { overlappingRoomIds } from '../core/levels/document/RoomOverlap.js';
import openResizeDialog from './ResizeDialog.js';
import { enemyTypes } from '../entities/EnemyTypes.js';
import deepworks from '../core/levels/documents/asterion-deepworks.v12.json';
import sample from '../core/levels/documents/signal-breach.v8.json';
import ViewportMenu from './ViewportMenu.js';
import openContextActions from './ContextActions.js';
import EditorDraftStore from './EditorDraftStore.js';
import UserLevelLibrary from '../core/UserLevelLibrary.js';
import { serializeLevelDocument } from '../core/levels/document/validateLevelDocument.js';
import { faceLabel } from './EditorPicking.js';
import { validationTarget } from './ValidationNavigation.js';

const host = document.querySelector('#designer');
if (!(host instanceof HTMLElement)) throw new Error('Designer host is missing.');
host.innerHTML = `
  <header>
    <div class="brand"><span>DESCENDED</span><h1>Level designer</h1></div>
    <nav aria-label="Document controls">
      <button id="new">New mine</button><button id="sample">Open example</button><button id="deepworks">Open Deepworks</button>
      <button id="import">Import JSON</button><button id="export" class="primary">Export JSON</button>
      <button id="save-library">Save to My Levels</button><button id="save-library-copy" hidden>Save a copy</button>
      <button id="playtest">Playtest level</button>
      <button id="escape-settings">Reactor escape…</button>
      <a href="/">Back to game</a>
    </nav>
    <input id="file" type="file" accept=".json,application/json" hidden />
  </header>
  <div class="document-strip"><label>Mine name<input id="name" maxlength="80" /></label><p id="save-state"></p><details><summary>Save details</summary><p id="draft-status" role="status"></p><p id="format-version"></p></details></div>
  <div id="recovery-banner" hidden role="region" aria-label="Draft recovery"><span id="recovery-description"></span><button id="restore-draft">Restore draft</button><button id="discard-draft">Discard saved draft</button></div>
  <div class="workspace">
    <aside class="left-panel" id="library-panel" hidden aria-label="Authoring library">
      <div id="build-panel" hidden>
      <section><h2>Build from a face</h2><p>Select a wall, then attach a space. Right-click that wall to build at a specific point.</p>
        <label>Attachment port<select id="attach-port"></select></label>
        <div class="stack"><button id="add-room">Attach room</button><button id="add-corridor">Attach corridor</button></div>
        <label>Sloped / diagonal shape<select id="corridor-shape"><option value="up">Ramp up</option><option value="down">Ramp down</option><option value="right">Diagonal right</option><option value="left">Diagonal left</option></select></label>
        <button id="add-shaped">Attach shaped corridor</button>
        <p>Shape offsets follow the new corridor's local right/up axes. Continue from either end face.</p>
      </section>
      <section><h2>Add mission content</h2><p>Place in the selected room using local coordinates.</p>
        <label>Content kind<select id="place-kind"><option value="enemy">Enemy</option><option value="health">Health pickup</option><option value="pulseAmmo">Pulse ammo pickup</option><option value="relay">Relay objective</option><option value="reactor">Destructible reactor</option></select></label>
        <label>Enemy type<select id="enemy-type"></select></label>
        <div class="vector" id="place-position"></div><button id="add-content">Add content</button>
      </section>
      </div>
      <div id="scene-panel" hidden>
        <section><h2>Scene browser</h2><label>Search scene<input id="scene-search" type="search" placeholder="Room, item or relay…" /></label><p>Find hidden objects or select directly in the view. F focuses your selection.</p><p id="scene-results" role="status"></p></section>
        <section><h2>Rooms <span id="room-count"></span></h2><div id="rooms" aria-label="Rooms"></div><div class="pair room-actions"><button id="duplicate-room">Duplicate room</button><button id="delete-room">Delete room</button></div><p id="room-delete-help"></p></section>
        <section><h2>Mission content</h2><div id="entities"></div></section>
      </div>
    </aside>
    <main>
      <div class="viewport-toolbar" role="toolbar" aria-label="Viewport tools">
        <button id="toggle-build" aria-pressed="false" aria-controls="build-panel">Build tools</button><button id="toggle-scene" aria-pressed="false" aria-controls="scene-panel">Scene browser</button>
        <button id="select" aria-pressed="true">Select</button><button id="translate" aria-pressed="false">Move</button><button id="resize" aria-pressed="false" title="Drag a local axis to stretch; the first connected opening stays fixed">Stretch</button><button id="rotate" aria-pressed="false">Rotate XYZ</button>
        <button id="frame">Frame all</button><button id="undo">Undo</button><button id="redo">Redo</button>
        <button id="actions">Actions</button>
        <label class="view-label">View<select id="view"><option value="xray">X-ray edit</option><option value="cutaway" selected>Solid cutaway</option><option value="solid">Solid exterior</option></select></label>
      </div>
      <p id="geometry-status" role="status"></p><p id="tool-status" role="status" aria-live="polite"></p>
      <div id="viewport"></div>
      <div class="viewport-help">Select a wall or item → right-click for build, style and placement tools · Shift+F10: keyboard actions<br>Drag: orbit · Right-drag: pan · Scroll: zoom · F: focus · Build tools / Scene browser: optional panels</div>
      <div class="validation"><h2 id="validation-title">Validation</h2><p id="validation-help" hidden>Choose an issue to focus its room, opening or item and open the relevant properties. Fix it here or Undo the edit.</p><p id="notice" role="status" aria-live="polite"></p><div id="issues"></div></div>
    </main>
    <aside class="right-panel">
      <div class="inspector-header"><strong id="inspector-selection" aria-live="polite"></strong><div id="inspector-tabs" role="tablist" aria-label="Inspector">
        <button id="tab-room" role="tab" aria-controls="inspector-room">Room</button><button id="tab-wall" role="tab" aria-controls="inspector-wall">Wall</button><button id="tab-content" role="tab" aria-controls="inspector-content">Content</button><button id="tab-connections" role="tab" aria-controls="inspector-connections">Connections</button>
      </div><button id="all-properties" aria-pressed="false">All properties</button></div>
      <section><h2>Room properties</h2><p id="selection"></p><button id="resize-room">Resize and keep connections…</button><button id="snap-connections" title="Realign an existing connection after a manual move or an older resize">Snap connections</button><p id="stretch-status" role="status"></p>
        <form id="properties">
          <fieldset><legend>World position</legend><div class="vector" id="position"></div></fieldset>
          <fieldset><legend>Local dimensions</legend><div class="vector" id="size"></div></fieldset>
          <label>Yaw<select id="yaw"><option>0</option><option>90</option><option>180</option><option>270</option></select></label>
          <div class="pair"><label>Pitch (X)<select id="pitch"><option>0</option><option>90</option><option>180</option><option>270</option></select></label><label>Roll (Z)<select id="roll"><option>0</option><option>90</option><option>180</option><option>270</option></select></label></div>
          <p id="orientation-status"></p>
          <div id="offset-properties" hidden><div class="pair"><label>Far end sideways<input id="shape-side" type="number" min="-32" max="32" step="1" /></label><label>Far end rise<input id="shape-rise" type="number" min="-32" max="32" step="1" /></label></div><p>Whole units in the corridor's local frame. Combined offset ≤ length. Changing these moves its openings; reconnect neighbors or Undo if needed.</p></div>
          <label>Material<select id="material"></select></label><button type="submit">Apply properties</button>
        </form>
        <p>Rotation uses quarter turns. Shaped corridors add sloped floors and diagonal walls through end offsets. Size edits keep connections aligned. Position, rotation and end-offset edits can require Snap connections or Undo.</p>
      </section>
      <section><h2>Face appearance</h2>
        <label>Wall face<select id="surface-face"></select></label><label>Face color<input id="surface-color" type="color" value="#405a6b" /></label>
        <label>Surface pattern<select id="surface-pattern"></select></label><p>Lava damages on contact. Water is a safe animated surface. Both remain solid; fly above them.</p><button id="apply-surface">Apply face style</button><button id="reset-surface">Reset face to preset</button>
        <p>Use Solid cutaway or Playtest to see surfaces. Custom image uploads are not included yet.</p>
        <p id="wall-connection-help"></p><button id="join-wall">Connect this face to an existing room…</button>
      </section>
      <section><h2>Content properties</h2><p id="content-selection"></p><button id="move-content">Move selected item</button><p>Drag the world axes to move this item within its room. Positions snap to the room’s half-unit grid; Esc cancels. Use Content room below to transfer it.</p>
        <label>Content room<select id="content-room"></select></label><div class="vector" id="content-position"></div>
        <label>Spawn heading<select id="spawn-yaw"><option>0</option><option>90</option><option>180</option><option>270</option></select></label>
        <label class="checkbox"><input id="content-required" type="checkbox" />Required for completion</label>
        <label id="reactor-integrity-row" hidden>Reactor integrity<input id="reactor-integrity" type="number" min="10" max="1000" step="1" /></label><button id="apply-content">Apply content</button><button id="delete-content">Delete content</button>
      </section>
      <section><h2>Connect existing rooms</h2><p>Join opposing wall faces to close loops. Faces can meet off center. Fit corridor length or snap a separate branch when needed.</p>
        <label>Selected room port<select id="source-port"></select></label>
        <label>Target room<select id="target-room"></select></label><label>Target port<select id="target-port"></select></label>
        <button id="connect">Connect ports</button><button id="join-dialog">Connect / snap existing rooms…</button>
      </section>
      <section><h2>Connections</h2><div id="connections"></div></section>
      <section><h2>Opening and door</h2>
        <label>Connection<select id="opening-connection"></select></label><p id="opening-basis"></p>
        <div class="pair"><label>Opening width<input id="opening-width" type="number" min="2" max="62" step="0.5" /></label><label>Opening height/depth<input id="opening-height" type="number" min="2" max="62" step="0.5" /></label></div>
        <label>Opening position<select id="opening-anchor"><option value="custom">Custom offset</option><option value="center">Center</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
        <div class="pair"><label>U offset<input id="opening-u" type="number" step="0.5" /></label><label>V offset<input id="opening-v" type="number" step="0.5" /></label></div>
        <button id="apply-opening">Apply opening</button><button id="fit-opening">Use full shared opening</button><button id="door-dialog">Add or edit door…</button><label>Door control<select id="door-relay"></select></label><button id="apply-door">Apply door</button>
        <p>Cyan frames mark passages. Add a sliding shot door, concealed wall panel or relay gate above, or right-click a frame. R activates a visible nearby relay in Playtest; player shots open shot doors.</p>
      </section>
    </aside>
  </div>
  <div id="playtest-panel" hidden role="dialog" aria-modal="true" aria-label="Level playtest">
    <div class="playtest-bar"><strong>Mission preview</strong><span>Esc releases the mouse. Your editing document stays intact.</span><button id="return-edit">Return to editor</button></div>
    <div id="playtest-host"></div>
  </div>`;

/** @param {string} id @returns {HTMLElement} */
function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing designer control: ${id}`);
  return node;
}
/** @param {string} id */ const input = id => /** @type {HTMLInputElement} */ (element(id));
/** @param {string} id */ const select = id => /** @type {HTMLSelectElement} */ (element(id));
/** @param {string} id */ const button = id => /** @type {HTMLButtonElement} */ (element(id));
/** @param {HTMLSelectElement} node @param {readonly string[]} values */
function options(node, values) {
  const previous = node.value;
  node.replaceChildren(...values.map(value => new Option(value, value)));
  if (values.includes(previous)) node.value = previous;
}
for (const id of ['attach-port', 'source-port', 'target-port']) { options(select(id), FACES); select(id).value = 'negativeZ'; }
select('target-port').value = 'positiveZ';
options(select('material'), Object.keys(MATERIALS));
options(select('surface-face'), ['all', ...FACES]); options(select('surface-pattern'), SURFACE_PATTERNS);
options(select('enemy-type'), enemyTypes.map(enemy => enemy.name));
for (const key of ['position', 'size', 'place-position', 'content-position']) {
  for (const axis of ['X', 'Y', 'Z']) {
    const label = document.createElement('label'); label.textContent = axis;
    const field = document.createElement('input'); field.type = 'number'; field.step = '0.5'; field.required = true;
    field.id = `${key}-${axis}`; field.setAttribute('aria-label', `${key} ${axis}`);
    field.min = key === 'size' ? '4' : '-4096'; field.max = key === 'size' ? '64' : '4096';
    if (key === 'place-position') field.value = '0';
    label.append(field); element(key).append(label);
  }
}

let model = new EditorDocument();
const userLevels = new UserLevelLibrary();
let libraryKey = new URLSearchParams(location.search).get('level');
/** @type {string | null} */ let librarySnapshot = null;
let libraryNotice = '';
if (libraryKey) {
  const entry = userLevels.get(libraryKey);
  if (entry) { model = new EditorDocument(entry.document); librarySnapshot = serializeLevelDocument(entry.document); }
  else { libraryKey = null; libraryNotice = 'This saved level could not be opened. Import a JSON backup or return to My Levels.'; }
}
/** @param {string | null} key */
function linkLibrary(key) {
  libraryKey = key;
  if (!key) librarySnapshot = null;
  const url = new URL(location.href);
  if (key && userLevels.persistent) url.searchParams.set('level', key); else url.searchParams.delete('level');
  history.replaceState(null, '', url);
  element('save-library-copy').hidden = !key;
}
for (const key of ['build', 'scene']) element(`toggle-${key}`).onclick = () => {
  const panel = element(`${key}-panel`); panel.hidden = !panel.hidden;
  element(`toggle-${key}`).setAttribute('aria-pressed', String(!panel.hidden));
  element('library-panel').hidden = element('build-panel').hidden && element('scene-panel').hidden;
  document.querySelector('.workspace')?.classList.toggle('has-library', !element('library-panel').hidden);
  if (key === 'scene' && !panel.hidden) input('scene-search').focus();
};
function filterScene() {
  const query = input('scene-search').value.trim().toLowerCase();
  const nodes = [...element('rooms').children, ...element('entities').children];
  for (const node of nodes) if (node instanceof HTMLElement) node.hidden = !node.textContent?.toLowerCase().includes(query);
  element('scene-results').textContent = `${nodes.filter(node => node instanceof HTMLElement && !node.hidden).length} of ${nodes.length} objects`;
}
input('scene-search').oninput = filterScene;
let selectedId = model.document.rooms[0].id;
let selectedContentId = '@spawn';
/** @type {'room' | 'wall' | 'content'} */ let selectionKind = 'room';
/** @type {import('../levelDocument.js').Face | null} */ let selectedFace = null;
/** @type {'room' | 'wall' | 'content' | 'connections' | 'all'} */ let inspector = 'room';
const drafts = new EditorDraftStore();
const panelContainer = document.createElement('div'); panelContainer.id = 'inspector-panels'; document.querySelector('.right-panel')?.append(panelContainer);
for (const [key, ids] of Object.entries({ room: ['properties'], wall: ['surface-face', 'opening-connection'], content: ['content-selection'], connections: ['source-port', 'connections'] })) {
  const panel = document.createElement('div'); panel.id = `inspector-${key}`; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `tab-${key}`);
  for (const id of ids) { const section = element(id).closest('section'); if (section) panel.append(section); }
  panelContainer.append(panel);
}
/** @param {'room' | 'wall' | 'content' | 'connections' | 'all'} key */
function setInspector(key) {
  inspector = key;
  for (const pane of ['room', 'wall', 'content', 'connections']) {
    element(`inspector-${pane}`).hidden = key !== 'all' && key !== pane;
    element(`tab-${pane}`).setAttribute('aria-selected', String(key === pane));
    element(`tab-${pane}`).tabIndex = key === pane ? 0 : -1;
  }
  element('all-properties').setAttribute('aria-pressed', String(key === 'all'));
  if (key === 'all') { const section = element('opening-connection').closest('section'); if (section) section.hidden = false; }
}
for (const key of /** @type {const} */ (['room', 'wall', 'content', 'connections'])) element(`tab-${key}`).onclick = () => setInspector(key);
element('all-properties').onclick = () => setInspector(inspector === 'all' ? 'room' : 'all');
element('inspector-tabs').onkeydown = event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const keys = /** @type {const} */ (['room', 'wall', 'content', 'connections']);
  const current = Math.max(0, keys.findIndex(key => `tab-${key}` === document.activeElement?.id));
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (current + (event.key === 'ArrowRight' ? 1 : -1) + 4) % 4;
  setInspector(keys[index]); element(`tab-${keys[index]}`).focus();
};
function refreshDraftStatus() {
  element('draft-status').textContent = drafts.status;
  element('recovery-banner').hidden = !drafts.blocked;
  element('recovery-description').textContent = drafts.pending ? `Local draft available: ${drafts.pending.document.name} · ${new Date(drafts.pending.savedAt).toLocaleString()}` : drafts.status;
  button('restore-draft').disabled = !drafts.pending;
}
function saveDraft() { drafts.save(model.document); refreshDraftStatus(); }
/** @param {unknown} error */
function report(error) { element('notice').textContent = error instanceof Error ? error.message : String(error); }
/** @param {() => void} action */
function perform(action) {
  try { commit(action); }
  catch (error) { report(error); viewport.show(model.document); }
}
/** @param {() => void} action */
function commit(action) { action(); element('notice').textContent = ''; refresh(); saveDraft(); }
/** @param {import('./EditorPicking.js').ViewportTarget} target */
function selectTarget(target) {
  selectedId = target.roomId; selectedFace = target.face ?? null;
  if (target.connectionId) select('opening-connection').value = target.connectionId;
  if (target.contentId) { selectedContentId = target.contentId; selectionKind = 'content'; setInspector('content'); }
  else { selectionKind = target.face ? 'wall' : 'room'; if (target.face) select('surface-face').value = target.face; setInspector(selectionKind); }
  refresh(false);
}
/** @type {ViewportMenu | null} */ let menu = null;
const viewport = new EditorViewport(element('viewport'), id => { selectedId = id; selectionKind = 'room'; selectedFace = null; refresh(false); }, (id, values) => perform(() => model.updateRoom(id, values)), {
  selectTarget,
  context: target => { selectTarget(target); if (menu) openContextActions(target, { model, viewport, menu, commit, select: selectTarget, inspect: () => setInspector(selectionKind), moveSelected: () => setToolMode('translate') }); },
  dismiss: () => menu?.close(false),
  moveContent: (id, world) => perform(() => model.moveContent(id, world)),
  contentPreview: (id, world) => { const preview = model.previewContentMove(id, world); element('tool-status').textContent = preview.error ? `Cannot move ${id}: ${preview.error}` : `Moving ${id} · half-unit room grid · release to apply · Esc cancels`; element('tool-status').classList.toggle('invalid', !!preview.error); return preview; },
  cancel: () => { refresh(false); element('notice').textContent = 'Drag cancelled. No changes.'; },
  resize: (id, size) => perform(() => model.resizeRoom(id, size)),
  resizePreview: (size, error) => { element('stretch-status').textContent = error ? `Cannot apply: ${error}` : `Width ${size[0]} · Height ${size[1]} · Length ${size[2]} — release to apply; attached branches follow. Undo reverses the whole edit.`; },
});
menu = new ViewportMenu(viewport.renderer.domElement, () => { viewport.controls.enabled = true; viewport.showPlacement(selectedId, null); });
viewport.setView('cutaway');

/** @param {boolean} [rebuild] */
function refresh(rebuild = true) {
  if (selectionKind === 'content') {
    const exists = selectedContentId === '@spawn' || model.document.entities.some(value => value.id === selectedContentId) || (model.document.formatVersion !== 1 && model.document.devices.some(value => value.id === selectedContentId));
    if (!exists) selectedContentId = '@spawn';
    const roomId = model.content(selectedContentId).roomId;
    if (model.document.rooms.some(room => room.id === roomId)) selectedId = roomId;
  }
  if (!model.document.rooms.some(room => room.id === selectedId)) selectedId = model.document.rooms[0].id;
  const room = model.room(selectedId);
  if (selectionKind === 'wall' && selectedFace) select('surface-face').value = selectedFace;
  element('inspector-selection').textContent = selectionKind === 'wall' && selectedFace ? `${room.id} · ${faceLabel(room, selectedFace)}` : selectionKind === 'content' ? `${selectedContentId === '@spawn' ? 'Player spawn' : selectedContentId} · ${room.id}` : `${room.id} · Room`;
  input('name').value = model.document.name;
  element('save-state').textContent = model.dirty ? 'Unsaved changes · Export a backup' : 'No unsaved changes';
  element('format-version').textContent = `Format ${model.document.formatVersion}${model.document.formatVersion >= 12 ? ' · Destructible reactors and escape' : model.document.formatVersion >= 11 ? ' · Relay force fields and reactor escape' : model.document.formatVersion >= 10 ? ' · Reactor escape countdown' : model.document.formatVersion >= 9 ? ' · Lava, water and sliding doors' : model.document.formatVersion >= 8 ? ' · Sliding and concealed doors' : model.document.formatVersion === 7 ? ' · Shared openings and loop connections' : model.document.formatVersion >= 6 ? ' · Expanded dimensions and 256 rooms' : model.document.formatVersion === 5 ? ' · Supports sloped and diagonal corridors' : model.document.formatVersion === 4 ? ' · Supports pitch, roll, offset openings and face styles' : model.document.formatVersion === 3 ? ' · Supports offset openings and face styles' : ''}`;
  element('room-count').textContent = `${model.document.rooms.length} / ${EXPANDED_LIMITS.rooms}`;
  button('undo').disabled = !model.past.length; button('redo').disabled = !model.future.length;
  element('rooms').replaceChildren(...model.document.rooms.map(room => {
    const node = document.createElement('button'); node.textContent = `${room.id} · ${room.prefab === 'box-room' ? 'room' : room.prefab === 'offset-corridor' ? 'shaped corridor' : portFrame(room, 'positiveZ').axis === 1 ? 'vertical shaft' : 'corridor'}`;
    node.setAttribute('aria-pressed', String(room.id === selectedId));
    node.onclick = () => { selectedId = room.id; selectionKind = 'room'; selectedFace = null; if (inspector !== 'all') setInspector('room'); refresh(false); }; return node;
  }));
  element('selection').textContent = `${room.id} · ${room.prefab}`;
  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
    input(`position-${axis}`).value = String(room.position[index]); input(`position-${axis}`).step = model.document.formatVersion >= 6 ? '0.25' : '0.5'; input(`size-${axis}`).value = String(room.size[index]); input(`size-${axis}`).max = '256';
  }
  select('yaw').value = String(room.yaw); select('pitch').value = String(room.pitch ?? 0); select('roll').value = String(room.roll ?? 0); select('material').value = room.materialPreset;
  const firstLink = model.document.connections.find(link => link.a.roomId === room.id || link.b.roomId === room.id);
  button('snap-connections').disabled = !firstLink;
  element('stretch-status').textContent = firstLink ? `Stretch fixes the opening to ${firstLink.a.roomId === room.id ? firstLink.b.roomId : firstLink.a.roomId}; attached branches follow. Resize lets you choose another anchor.` : 'Stretch keeps the room center fixed. Dimensions snap to half units.';
  const corridorAxis = portFrame(room, 'positiveZ').axis;
  element('orientation-status').textContent = room.prefab === 'offset-corridor' ? `Shaped corridor: far end ${room.endOffset?.[0]} sideways, ${room.endOffset?.[1]} rise in its local frame. Only the two end faces connect; sloped sides stay solid.` : room.prefab === 'straight-corridor' ? `Corridor length follows world ${'XYZ'[corridorAxis]}${corridorAxis === 1 ? ' · Vertical shaft (up/down)' : ' · Horizontal passage'}. Dimensions and content coordinates stay local to the corridor.` : 'Yaw turns around Y; pitch tips around X; roll banks around Z. Dimensions and content coordinates stay local to the room.';
  for (const id of ['shape-side', 'shape-rise']) { input(id).min = model.document.formatVersion >= 6 ? '-256' : '-32'; input(id).max = model.document.formatVersion >= 6 ? '256' : '32'; }
  element('offset-properties').hidden = room.prefab !== 'offset-corridor'; input('shape-side').value = String(room.endOffset?.[0] ?? 0); input('shape-rise').value = String(room.endOffset?.[1] ?? 0);
  const freeFace = FACES.find(face => connectableFace(room, face) && !model.document.connections.some(connection => [connection.a, connection.b].some(end => end.roomId === room.id && end.port === face)));
  button('duplicate-room').disabled = !freeFace;
  button('delete-room').disabled = model.document.rooms.length === 1 || model.document.playerSpawn.roomId === room.id || model.document.entities.some(entity => entity.kind === 'exit' && entity.roomId === room.id);
  element('room-delete-help').textContent = button('delete-room').disabled ? 'Move the spawn/exit elsewhere before deleting their room. Keep at least one room.' : 'Deleting also removes its content and connections. Undo restores them.';
  options(select('target-room'), model.document.rooms.filter(room => room.id !== selectedId).map(room => room.id));
  refreshFaceLabels();
  button('connect').disabled = model.document.rooms.length < 2;
  const content = [
    { id: '@spawn', text: `Spawn · ${model.document.playerSpawn.roomId}` },
    ...model.document.entities.map(entity => ({ id: entity.id, text: `${entity.id} · ${entity.kind} · ${entity.roomId}` })),
    ...(model.document.formatVersion !== 1 ? model.document.devices.map(device => ({ id: device.id, text: `${device.id} · ${device.kind ?? 'relay'} · ${device.roomId}` })) : []),
  ];
  if (!content.some(value => value.id === selectedContentId)) selectedContentId = '@spawn';
  element('entities').replaceChildren(...content.map(value => {
    const node = document.createElement('button'); node.textContent = value.text; node.setAttribute('aria-pressed', String(selectionKind === 'content' && selectedContentId === value.id));
    node.onclick = () => { selectedContentId = value.id; selectedId = model.content(value.id).roomId; selectedFace = null; selectionKind = 'content'; if (inspector !== 'all') setInspector('content'); refresh(false); }; return node;
  }));
  filterScene();
  element('connections').replaceChildren(...model.document.connections.map(connection => {
    const door = model.document.formatVersion !== 1 ? model.document.doors.find(door => door.connectionId === connection.id) : null;
    const row = document.createElement('p'); row.textContent = `${connection.a.roomId}/${connection.a.port} ↔ ${connection.b.roomId}/${connection.b.port} · ${door ? `${door.kind === 'force-field' ? 'FORCE FIELD' : door.concealed ? 'CONCEALED' : 'CLOSED'} · ${door.activation === 'shot' ? 'shoot to open' : `relay ${door.deviceId}`}` : 'OPEN passage'}`;
    const edit = document.createElement('button'); edit.textContent = 'Edit opening'; edit.setAttribute('aria-label', `Edit opening ${connection.id}`);
    edit.onclick = () => { select('opening-connection').value = connection.id; selectedId = connection.a.roomId; selectedFace = connection.a.port; selectionKind = 'wall'; setInspector('wall'); refresh(false); element('opening-connection').scrollIntoView({ block: 'nearest' }); };
    const remove = document.createElement('button'); remove.textContent = 'Disconnect'; remove.setAttribute('aria-label', `Disconnect ${connection.id}`);
    remove.onclick = () => perform(() => model.disconnect(connection.id));
    row.append(edit, remove); return row;
  }));
  const result = model.validation;
  element('validation-title').textContent = result.valid ? 'Valid level · Ready to export' : `${result.errors.length} validation issue(s) · Export blocked · Outline preview`;
  button('export').disabled = !result.valid;
  button('save-library').disabled = !result.valid;
  button('save-library-copy').disabled = !result.valid;
  button('playtest').disabled = !result.valid;
  const overlappingIds = overlappingRoomIds(model.document.rooms), overlaps = model.document.rooms.filter(room => overlappingIds.has(room.id));
  element('geometry-status').textContent = overlaps.length ? `OVERLAP: ${overlaps.map(room => room.id).join(', ')}. Red rooms intersect; this does not create an opening. Preview and playtest are blocked until fixed.`
    : !result.valid ? 'Invalid draft: outlines only. Fix the listed issues before solid preview or playtest.'
    : `${room.id}: ${model.document.connections.filter(connection => connection.a.roomId === room.id || connection.b.roomId === room.id).length} passage(s). Other wall areas stay solid. ${select('view').value === 'cutaway' ? 'Cutaway hides three outside faces for inspection.' : 'Cyan frames mark passages; amber doors are closed until unlocked.'}`;
  element('geometry-status').classList.toggle('invalid', !result.valid);
  element('validation-help').hidden = result.valid;
  element('issues').replaceChildren(...(result.valid ? [] : result.errors.map(issue => {
    const target = validationTarget(model.document, issue.path);
    const node = document.createElement(target ? 'button' : 'p'); node.textContent = issue.message;
    if (!target) { node.textContent = `${issue.path}: ${issue.message}`; return node; }
    const detail = document.createElement('span');
    detail.textContent = `Show ${target.contentId === '@spawn' ? 'player spawn' : target.contentId ?? target.connectionId ?? target.roomId} · ${issue.path}`;
    node.append(detail);
    node.onclick = () => {
      selectTarget({ ...target, localPoint: [0, 0, 0], clientX: 0, clientY: 0 });
      viewport.frame(true);
      const control = target.contentId ? 'content-position-X' : target.connectionId ? issue.path.startsWith('$.doors') ? 'door-dialog' : 'opening-width'
        : target.face ? 'surface-color' : issue.path.includes('.size') ? 'size-X' : 'position-X';
      element(control).focus(); element(control).scrollIntoView({ block: 'nearest' });
    };
    return node;
  })));
  refreshPanels();
  if (rebuild) viewport.show(model.document);
  viewport.setSelection(selectedId);
  viewport.setDetailSelection(selectionKind === 'wall' ? selectedFace : null, selectionKind === 'content' ? selectedContentId : '', selectionKind === 'wall' ? select('opening-connection').value : '');
  refreshToolStatus();
}

function refreshFaceLabels() {
  for (const id of ['attach-port', 'source-port', 'target-port', 'surface-face']) {
    const room = model.document.rooms.find(room => room.id === (id === 'target-port' ? select('target-room').value : selectedId));
    if (!room) continue;
    for (const option of select(id).options) if (option.value !== 'all') {
      const face = /** @type {import('../levelDocument.js').Face} */ (option.value);
      option.textContent = `${faceLabel(room, face)} (local ${face.startsWith('negative') ? '−' : '+'}${face.slice(-1)})`;
      option.disabled = id !== 'surface-face' && !connectableFace(room, face);
    }
    if (select(id).selectedOptions[0]?.disabled) select(id).value = [...select(id).options].find(option => !option.disabled)?.value ?? '';
  }
}

function refreshPanels() {
  const room = model.room(selectedId), face = select('surface-face').value;
  const style = room.surfaces?.[/** @type {import('../levelDocument.js').Face} */ (face)];
  const frame = face === 'all' ? null : portFrame(room, /** @type {import('../levelDocument.js').Face} */ (face));
  const preset = MATERIALS[room.materialPreset];
  const color = style?.color ?? (frame?.axis === 1 ? frame.direction < 0 ? preset.floor : preset.ceiling : preset.wall);
  input('surface-color').value = `#${color.toString(16).padStart(6, '0')}`; select('surface-pattern').value = style?.pattern ?? 'plain';
  const content = model.content(selectedContentId);
  element('reactor-integrity-row').hidden = content.kind !== 'reactor';
  input('reactor-integrity').value = String('health' in content ? content.health : 100);
  element('content-selection').textContent = `${content.id} · ${content.kind}`;
  options(select('content-room'), model.document.rooms.map(room => room.id)); select('content-room').value = content.roomId;
  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) input(`content-position-${axis}`).value = String(content.position[index]);
  select('spawn-yaw').disabled = content.kind !== 'spawn';
  if ('rotation' in content) select('spawn-yaw').value = String((Math.round(2 * Math.atan2(content.rotation[1], content.rotation[3]) * 180 / Math.PI / 90) * 90 + 360) % 360);
  input('content-required').checked = content.kind === 'relay' || content.kind === 'reactor' || model.document.mission.requiredEnemyIds.includes(content.id);
  input('content-required').disabled = content.kind !== 'enemy'; button('delete-content').disabled = content.kind === 'spawn' || content.kind === 'exit';
  options(select('opening-connection'), model.document.connections.map(connection => connection.id));
  const wallConnections = selectedFace ? model.document.connections.filter(connection => [connection.a, connection.b].some(end => end.roomId === selectedId && end.port === selectedFace)) : [];
  const wallConnection = wallConnections.find(link => link.id === select('opening-connection').value) ?? wallConnections[0];
  button('join-wall').disabled = !selectedFace || !connectableFace(room, selectedFace);
  if (inspector !== 'all' && selectionKind === 'wall') select('opening-connection').value = wallConnection ? wallConnection.id : '';
  const openingSection = element('opening-connection').closest('section');
  if (openingSection) openingSection.hidden = inspector !== 'all' && selectionKind === 'wall' && !wallConnection;
  element('wall-connection-help').textContent = selectionKind === 'wall' ? wallConnection ? `${wallConnections.length} passage(s) on this wall. Choose Connection below, or right-click a cyan frame to edit its door.` : selectedFace && !connectableFace(room, selectedFace) ? 'This sloped side stays solid. Continue from one of the corridor’s rectangular end faces.' : 'This wall is solid. Right-click it to attach a neighboring room or corridor and create a passage.' : '';
  const connection = model.document.connections.find(connection => connection.id === select('opening-connection').value);
  button('apply-opening').disabled = !connection; button('apply-door').disabled = !connection; button('door-dialog').disabled = !connection; button('fit-opening').disabled = !connection;
  const devices = model.document.formatVersion !== 1 ? model.document.devices : [];
  select('door-relay').replaceChildren(new Option('Always open (no door)', ''), new Option('Shoot door to open', '@shot'), ...devices.map(device => new Option(device.label, device.id)));
  if (connection) {
    const rules = openingRules(model.document.formatVersion);
    input('opening-width').max = input('opening-height').max = String(rules.maxSize);
    for (const id of ['opening-width', 'opening-height', 'opening-u', 'opening-v']) input(id).step = String(rules.grid);
    input('opening-width').value = String(connection.openingSize[0]); input('opening-height').value = String(connection.openingSize[1]);
    input('opening-u').value = String(connection.a.offset?.[0] ?? 0); input('opening-v').value = String(connection.a.offset?.[1] ?? 0);
    const source = model.document.rooms.find(room => room.id === connection.a.roomId);
    const frame = source && portFrame(source, connection.a.port);
    element('opening-basis').textContent = frame ? `${connection.a.roomId}: U = world ${'XYZ'[frame.u]}, V = world ${'XYZ'[frame.v]}. Offsets are measured from this face's center.` : 'This connection needs a valid source room.';
    const door = model.document.formatVersion !== 1 ? model.document.doors.find(door => door.connectionId === connection.id) : null;
    select('door-relay').value = door?.activation === 'shot' ? '@shot' : door?.deviceId ?? '';
  } else element('opening-basis').textContent = 'Attach or connect two rooms first.';
}

function refreshToolStatus() {
  const content = selectionKind === 'content';
  if (content && ['rotate', 'resize'].includes(viewport.mode)) viewport.setMode('select');
  for (const id of ['rotate', 'resize']) button(id).disabled = content;
  for (const id of ['select', 'translate', 'rotate', 'resize']) element(id).setAttribute('aria-pressed', String(id === viewport.mode));
  element('tool-status').classList.remove('invalid');
  element('tool-status').textContent = content ? `${selectedContentId === '@spawn' ? 'Player spawn' : selectedContentId} selected · Move edits this item in ${selectedId}. Select a room to rotate or stretch.` : `${selectedId} selected · Move, Rotate and Stretch edit this room. Esc cancels a drag.`;
}
/** @param {'select' | 'translate' | 'rotate' | 'resize'} mode */
function setToolMode(mode) { viewport.setMode(mode); refreshToolStatus(); }
for (const mode of /** @type {const} */ (['select', 'translate', 'rotate', 'resize'])) element(mode).onclick = () => setToolMode(mode);
element('move-content').onclick = () => { selectedId = model.content(selectedContentId).roomId; selectedFace = null; selectionKind = 'content'; refresh(false); setToolMode('translate'); };

element('snap-connections').onclick = () => perform(() => model.snapConnections(selectedId));
element('resize-room').onclick = () => { if (menu) { const bounds = element('viewport').getBoundingClientRect(); menu.x = bounds.left + bounds.width / 2; menu.y = bounds.top + 24; openResizeDialog(selectedId, model, viewport, menu, commit); } };
element('frame').onclick = () => viewport.frame();
element('actions').onclick = () => { const target = viewport.keyboardTarget(); if (target) { selectTarget(target); if (menu) openContextActions(target, { model, viewport, menu, commit, select: selectTarget, inspect: () => setInspector(selectionKind), moveSelected: () => setToolMode('translate') }); } };
element('duplicate-room').onclick = () => perform(() => {
  const face = FACES.find(face => connectableFace(model.room(selectedId), face) && !model.document.connections.some(connection => [connection.a, connection.b].some(end => end.roomId === selectedId && end.port === face)));
  if (!face) throw new Error('No unused face is available for a duplicate.');
  selectedId = model.duplicateRoom(selectedId, face); selectedFace = null; selectionKind = 'room';
});
element('delete-room').onclick = () => perform(() => { model.deleteRoom(selectedId); selectedId = model.document.rooms[0].id; selectedFace = null; selectionKind = 'room'; });
select('view').onchange = () => { viewport.setView(/** @type {'xray' | 'cutaway' | 'solid'} */ (select('view').value)); refresh(false); };
select('surface-face').onchange = () => { selectedFace = select('surface-face').value === 'all' ? null : /** @type {import('../levelDocument.js').Face} */ (select('surface-face').value); selectionKind = selectedFace ? 'wall' : 'room'; refresh(false); };
element('apply-surface').onclick = () => perform(() => model.setSurface(selectedId, /** @type {import('../levelDocument.js').Face | 'all'} */ (select('surface-face').value), Number.parseInt(input('surface-color').value.slice(1), 16), /** @type {import('../levelDocument.js').SurfacePattern} */ (select('surface-pattern').value)));
element('reset-surface').onclick = () => perform(() => model.resetSurface(selectedId, /** @type {import('../levelDocument.js').Face | 'all'} */ (select('surface-face').value)));
element('add-content').onclick = () => perform(() => {
  const kind = select('place-kind').value;
  selectedContentId = model.addContent(selectedId, kind === 'enemy' ? 'enemy' : kind === 'reactor' ? 'reactor' : kind === 'relay' ? 'relay' : 'pickup', kind === 'enemy' ? select('enemy-type').value : kind, ['X', 'Y', 'Z'].map(axis => Number(input(`place-position-${axis}`).value)));
  selectionKind = 'content'; selectedFace = null; if (inspector !== 'all') setInspector('content');
});
element('apply-content').onclick = () => perform(() => model.checked(candidate => { candidate.updateContent(selectedContentId, select('content-room').value, ['X', 'Y', 'Z'].map(axis => Number(input(`content-position-${axis}`).value)), input('content-required').checked, Number(select('spawn-yaw').value)); if (candidate.content(selectedContentId).kind === 'reactor') candidate.setReactorIntegrity(selectedContentId, Number(input('reactor-integrity').value)); }));
element('delete-content').onclick = () => perform(() => { model.deleteContent(selectedContentId); selectedContentId = '@spawn'; });
select('opening-connection').onchange = refreshPanels;
element('apply-opening').onclick = () => perform(() => {
  const id = select('opening-connection').value, width = Number(input('opening-width').value), height = Number(input('opening-height').value), anchor = select('opening-anchor').value;
  if (anchor === 'custom') model.updateOpening(id, width, height, [Number(input('opening-u').value), Number(input('opening-v').value)]);
  else model.anchorOpening(id, width, height, anchor);
});
element('apply-door').onclick = () => perform(() => model.setDoor(select('opening-connection').value, select('door-relay').value, { sliding: true }));
element('undo').onclick = () => perform(() => model.undo()); element('redo').onclick = () => perform(() => model.redo());
element('add-room').onclick = () => perform(() => { selectedId = model.attachRoom(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('attach-port').value), 'box-room'); selectionKind = 'room'; selectedFace = null; if (inspector !== 'all') setInspector('room'); });
element('add-corridor').onclick = () => perform(() => { selectedId = model.attachRoom(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('attach-port').value), 'straight-corridor'); selectionKind = 'room'; selectedFace = null; if (inspector !== 'all') setInspector('room'); });
element('add-shaped').onclick = () => perform(() => {
  const offsets = { up: [0, 8], down: [0, -8], right: [8, 0], left: [-8, 0] };
  selectedId = model.attachRoom(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('attach-port').value), 'offset-corridor', offsets[/** @type {keyof typeof offsets} */ (select('corridor-shape').value)]);
  selectionKind = 'room'; selectedFace = null; if (inspector !== 'all') setInspector('room');
});
function positionMenu() { const bounds = element('viewport').getBoundingClientRect(); if (menu) { menu.x = bounds.left + 16; menu.y = bounds.top + 16; } }
element('join-dialog').onclick = () => { try { positionMenu(); if (menu) { connectionDialog(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('source-port').value), model, menu, commit); viewport.controls.enabled = false; } } catch (error) { report(error); } };
element('join-wall').onclick = () => { try { positionMenu(); if (menu && selectedFace) { connectionDialog(selectedId, selectedFace, model, menu, commit); viewport.controls.enabled = false; } } catch (error) { report(error); } };
element('door-dialog').onclick = () => { positionMenu(); if (menu) { doorDialog(select('opening-connection').value, model, menu, commit); viewport.controls.enabled = false; } };
element('escape-settings').onclick = () => { positionMenu(); if (menu) { escapeDialog(model, menu, commit); viewport.controls.enabled = false; } };
element('fit-opening').onclick = () => perform(() => model.fitOpening(select('opening-connection').value));
element('connect').onclick = () => perform(() => model.connectFaces(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('source-port').value), select('target-room').value, /** @type {import('../levelDocument.js').Face} */ (select('target-port').value)));
select('target-room').onchange = refreshFaceLabels;
element('properties').onsubmit = event => {
  event.preventDefault();
  perform(() => model.applyRoomProperties(selectedId, {
    position: ['X', 'Y', 'Z'].map(axis => Number(input(`position-${axis}`).value)),
    size: ['X', 'Y', 'Z'].map(axis => Number(input(`size-${axis}`).value)),
    yaw: Number(select('yaw').value), pitch: Number(select('pitch').value), roll: Number(select('roll').value), materialPreset: select('material').value,
    ...(model.room(selectedId).prefab === 'offset-corridor' ? { endOffset: [Number(input('shape-side').value), Number(input('shape-rise').value)] } : {}),
  }));
};
input('name').onchange = () => perform(() => {
  const name = input('name').value.trim(); if (!name) throw new Error('Enter a mine name.');
  model.change(draft => { draft.name = name; });
});
const mayReplace = () => !model.dirty || window.confirm('Discard the current unsaved changes? Export JSON first to keep a backup.');
element('new').onclick = () => { if (mayReplace()) { perform(() => { model = new EditorDocument(createDocument()); linkLibrary(null); selectedId = model.document.rooms[0].id; }); viewport.frame(); } };
element('deepworks').onclick = () => { if (mayReplace()) perform(() => { model.import(JSON.stringify(deepworks)); linkLibrary(null); selectedId = model.document.rooms[0].id; selectedContentId = '@spawn'; }); viewport.frame(); };
element('sample').onclick = () => {
  if (mayReplace()) perform(() => { model.import(JSON.stringify(sample)); linkLibrary(null); selectedId = model.document.rooms[0].id; });
  viewport.frame();
};
element('import').onclick = () => input('file').click();
input('file').onchange = async () => {
  const file = input('file').files?.[0]; if (!file) return;
  try {
    if (file.size > LIMITS.text * 4) throw new Error('File exceeds the level document size limit.');
    const text = await file.text();
    // Validate before asking to discard anything; import itself is transactional.
    const candidate = new EditorDocument(); candidate.import(text);
    if (mayReplace()) perform(() => { model = candidate; linkLibrary(null); selectedId = model.document.rooms[0].id; });
    viewport.frame();
  } catch (error) { report(error); }
  finally { input('file').value = ''; }
};
element('export').onclick = () => {
  try {
    const url = URL.createObjectURL(new Blob([model.export()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${model.document.id}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    model.markSaved(); refresh(false); saveDraft(); element('notice').textContent = 'JSON exported. Keep this file as your portable backup.';
  } catch (error) { report(error); }
};
/** @param {boolean} asCopy */
function saveToLibrary(asCopy) {
  try {
    const entry = userLevels.save(model.export(), asCopy ? null : libraryKey, asCopy ? null : librarySnapshot);
    librarySnapshot = serializeLevelDocument(entry.document); linkLibrary(entry.key);
    if (userLevels.persistent) model.markSaved();
    refresh(false); saveDraft();
    element('notice').textContent = `${userLevels.persistent ? 'Saved to My Levels.' : 'Not saved to My Levels.'} ${userLevels.status}`;
  } catch (error) { report(error); }
}
element('save-library').onclick = () => saveToLibrary(false);
element('save-library-copy').onclick = () => saveToLibrary(true);
window.addEventListener('beforeunload', event => { if (model.dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', event => { if (!event.persisted) { menu?.dispose(); viewport.dispose(); } });
element('restore-draft').onclick = () => {
  if (!drafts.pending || !mayReplace()) return;
  try { model.restoreDraft(drafts.pending.document); linkLibrary(null); drafts.restored(); selectedId = model.document.rooms[0].id; selectedFace = null; selectionKind = 'room'; setInspector('room'); refresh(); saveDraft(); viewport.frame(); }
  catch (error) { report(error); }
};
element('discard-draft').onclick = () => { if (drafts.discard() && model.dirty) saveDraft(); refreshDraftStatus(); };
/** @type {HTMLIFrameElement | null} */ let playtestFrame = null;
let playtestSnapshot = '';
/** @type {number | undefined} */ let closeTimer;
function closePlaytest() {
  window.clearTimeout(closeTimer); playtestFrame?.remove(); playtestFrame = null; playtestSnapshot = '';
  element('playtest-panel').hidden = true; button('return-edit').disabled = false; button('playtest').focus();
}
element('playtest').onclick = () => {
  try {
    playtestSnapshot = model.export();
    playtestFrame = document.createElement('iframe'); playtestFrame.title = 'Mission playtest';
    // Preserve explicit smoke opt-in; the game still gates diagnostics on DEV.
    playtestFrame.src = `/playtest.html${new URLSearchParams(location.search).has('smoke') ? '?smoke=1' : ''}`;
    element('playtest-host').replaceChildren(playtestFrame); element('playtest-panel').hidden = false;
  } catch (error) { report(error); }
};
element('return-edit').onclick = () => {
  button('return-edit').disabled = true;
  playtestFrame?.contentWindow?.postMessage({ type: 'designer-playtest-stop' }, location.origin);
  closeTimer = window.setTimeout(closePlaytest, 1500);
};
window.addEventListener('message', event => {
  if (event.origin !== location.origin || !playtestFrame || event.source !== playtestFrame.contentWindow) return;
  if (event.data?.type === 'designer-playtest-ready') playtestFrame.contentWindow?.postMessage({ type: 'designer-playtest-document', text: playtestSnapshot }, location.origin);
  if (event.data?.type === 'designer-playtest-stopped') closePlaytest();
});
window.addEventListener('keydown', event => {
  if (playtestFrame) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); perform(() => event.key.toLowerCase() === 'y' || event.shiftKey ? model.redo() : model.undo());
  } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'f') { event.preventDefault(); viewport.frame(true); }
});
setInspector('room'); refreshDraftStatus(); refresh(); viewport.frame();
element('save-library-copy').hidden = !libraryKey;
if (libraryNotice) element('notice').textContent = libraryNotice;
