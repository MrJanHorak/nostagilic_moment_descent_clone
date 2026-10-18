import EditorDocument, { createDocument } from './EditorDocument.js';
import EditorViewport from './EditorViewport.js';
import { FACES, LIMITS, MATERIALS, SURFACE_PATTERNS } from '../core/levels/document/LevelContent.js';
import { portFrame, roomsOverlap } from '../core/levels/document/RoomMath.js';
import { enemyTypes } from '../entities/EnemyTypes.js';
import sample from '../core/levels/documents/mine-link.v1.json';
import ViewportMenu from './ViewportMenu.js';
import openContextActions from './ContextActions.js';
import EditorDraftStore from './EditorDraftStore.js';
import { FACE_LABELS } from './EditorPicking.js';

const host = document.querySelector('#designer');
if (!(host instanceof HTMLElement)) throw new Error('Designer host is missing.');
host.innerHTML = `
  <header>
    <div class="brand"><span>DESCENDED</span><h1>Level designer</h1></div>
    <nav aria-label="Document controls">
      <button id="new">New mine</button><button id="sample">Open example</button>
      <button id="import">Import JSON</button><button id="export" class="primary">Export JSON</button>
      <button id="playtest">Playtest level</button>
      <a href="/">Back to game</a>
    </nav>
    <input id="file" type="file" accept=".json,application/json" hidden />
  </header>
  <div id="recovery-banner" hidden role="region" aria-label="Draft recovery"><span id="recovery-description"></span><button id="restore-draft">Restore draft</button><button id="discard-draft">Discard saved draft</button></div>
  <div class="workspace">
    <aside class="left-panel">
      <section><h2>Mine</h2><label>Name<input id="name" maxlength="80" /></label><p id="save-state"></p><p id="draft-status" role="status"></p><p id="format-version"></p></section>
      <section><h2>Rooms <span id="room-count"></span></h2><div id="rooms" aria-label="Rooms"></div><div class="pair room-actions"><button id="duplicate-room">Duplicate room</button><button id="delete-room">Delete room</button></div><p id="room-delete-help"></p></section>
      <section><h2>Attach a prefab</h2><p>Grow from an unused face of the selected room. The new ports connect automatically.</p>
        <label>Attachment port<select id="attach-port"></select></label>
        <div class="stack"><button id="add-room">Attach room</button><button id="add-corridor">Attach corridor</button></div>
      </section>
      <section><h2>Mission content</h2><div id="entities"></div></section>
      <section><h2>Add mission content</h2><p>Place in the selected room using local coordinates.</p>
        <label>Content kind<select id="place-kind"><option value="enemy">Enemy</option><option value="health">Health pickup</option><option value="pulseAmmo">Pulse ammo pickup</option><option value="relay">Relay objective</option></select></label>
        <label>Enemy type<select id="enemy-type"></select></label>
        <div class="vector" id="place-position"></div><button id="add-content">Add content</button>
      </section>
    </aside>
    <main>
      <div class="viewport-toolbar" role="toolbar" aria-label="Viewport tools">
        <button id="select" aria-pressed="true">Select</button><button id="translate" aria-pressed="false">Move</button><button id="rotate" aria-pressed="false">Rotate Y</button>
        <button id="frame">Frame all</button><button id="undo">Undo</button><button id="redo">Redo</button>
        <button id="actions">Actions</button>
        <label class="view-label">View<select id="view"><option value="xray">X-ray edit</option><option value="cutaway" selected>Solid cutaway</option><option value="solid">Solid exterior</option></select></label>
      </div>
      <p id="geometry-status" role="status"></p>
      <div id="viewport"></div>
      <div class="viewport-help">Click a wall/item to select · Right-click or Shift+F10: actions · Right-drag: pan<br>Drag: orbit · Scroll: zoom · F: focus · Snap: 0.5 units / 90°</div>
      <div class="validation"><h2 id="validation-title">Validation</h2><p id="notice" role="status" aria-live="polite"></p><div id="issues"></div></div>
    </main>
    <aside class="right-panel">
      <div class="inspector-header"><strong id="inspector-selection" aria-live="polite"></strong><div id="inspector-tabs" role="tablist" aria-label="Inspector">
        <button id="tab-room" role="tab" aria-controls="inspector-room">Room</button><button id="tab-wall" role="tab" aria-controls="inspector-wall">Wall</button><button id="tab-content" role="tab" aria-controls="inspector-content">Content</button><button id="tab-connections" role="tab" aria-controls="inspector-connections">Connections</button>
      </div><button id="all-properties" aria-pressed="false">All properties</button></div>
      <section><h2>Room properties</h2><p id="selection"></p>
        <form id="properties">
          <fieldset><legend>World position</legend><div class="vector" id="position"></div></fieldset>
          <fieldset><legend>Local dimensions</legend><div class="vector" id="size"></div></fieldset>
          <label>Yaw<select id="yaw"><option>0</option><option>90</option><option>180</option><option>270</option></select></label>
          <label>Material<select id="material"></select></label><button type="submit">Apply properties</button>
        </form>
        <p>Moving a connected room can misalign its ports. Undo or reconnect the rooms before exporting.</p>
      </section>
      <section><h2>Face appearance</h2>
        <label>Wall face<select id="surface-face"></select></label><label>Face color<input id="surface-color" type="color" value="#405a6b" /></label>
        <label>Repeating pattern<select id="surface-pattern"></select></label><button id="apply-surface">Apply face style</button><button id="reset-surface">Reset face to preset</button>
        <p>Use Solid cutaway or Playtest to see surfaces. Custom image uploads are not included yet.</p>
        <p id="wall-connection-help"></p>
      </section>
      <section><h2>Content properties</h2><p id="content-selection"></p>
        <label>Content room<select id="content-room"></select></label><div class="vector" id="content-position"></div>
        <label>Spawn heading<select id="spawn-yaw"><option>0</option><option>90</option><option>180</option><option>270</option></select></label>
        <label class="checkbox"><input id="content-required" type="checkbox" />Required for completion</label>
        <button id="apply-content">Apply content</button><button id="delete-content">Delete content</button>
      </section>
      <section><h2>Connect existing rooms</h2><p>Join aligned unused ports to close a loop.</p>
        <label>Selected room port<select id="source-port"></select></label>
        <label>Target room<select id="target-room"></select></label><label>Target port<select id="target-port"></select></label>
        <button id="connect">Connect ports</button>
      </section>
      <section><h2>Connections</h2><div id="connections"></div></section>
      <section><h2>Opening and door</h2>
        <label>Connection<select id="opening-connection"></select></label><p id="opening-basis"></p>
        <div class="pair"><label>Opening width<input id="opening-width" type="number" min="2" max="62" step="0.5" /></label><label>Opening height/depth<input id="opening-height" type="number" min="2" max="62" step="0.5" /></label></div>
        <label>Opening position<select id="opening-anchor"><option value="custom">Custom offset</option><option value="center">Center</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
        <div class="pair"><label>U offset<input id="opening-u" type="number" step="0.5" /></label><label>V offset<input id="opening-v" type="number" step="0.5" /></label></div>
        <button id="apply-opening">Apply opening</button><label>Unlock relay<select id="door-relay"></select></label><button id="apply-door">Apply door</button>
        <p>Open passages have cyan frames. A linked door stays closed until its relay is activated.</p>
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
for (const id of ['attach-port', 'source-port', 'target-port', 'surface-face']) for (const option of select(id).options) {
  if (option.value !== 'all') option.textContent = `${FACE_LABELS[/** @type {import('../levelDocument.js').Face} */ (option.value)]} (${option.value.startsWith('negative') ? '−' : '+'}${option.value.slice(-1)})`;
}
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
  if (target.contentId) { selectedContentId = target.contentId; selectionKind = 'content'; setInspector('content'); }
  else { selectionKind = target.face ? 'wall' : 'room'; if (target.face) select('surface-face').value = target.face; setInspector(selectionKind); }
  refresh(false);
}
/** @type {ViewportMenu | null} */ let menu = null;
const viewport = new EditorViewport(element('viewport'), id => { selectedId = id; selectionKind = 'room'; selectedFace = null; refresh(false); }, (id, values) => perform(() => model.updateRoom(id, values)), {
  selectTarget,
  context: target => { selectTarget(target); if (menu) openContextActions(target, { model, viewport, menu, commit, select: selectTarget, inspect: () => setInspector(selectionKind) }); },
  dismiss: () => menu?.close(false),
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
  element('inspector-selection').textContent = selectionKind === 'wall' && selectedFace ? `${room.id} · ${FACE_LABELS[selectedFace]}` : selectionKind === 'content' ? `${selectedContentId === '@spawn' ? 'Player spawn' : selectedContentId} · ${room.id}` : `${room.id} · Room`;
  input('name').value = model.document.name;
  element('save-state').textContent = model.dirty ? 'Unsaved changes · Export a backup' : 'No unsaved changes';
  element('format-version').textContent = `Format ${model.document.formatVersion}${model.document.formatVersion === 3 ? ' · Supports offset openings and face styles' : ''}`;
  element('room-count').textContent = `${model.document.rooms.length} / ${LIMITS.rooms}`;
  button('undo').disabled = !model.past.length; button('redo').disabled = !model.future.length;
  element('rooms').replaceChildren(...model.document.rooms.map(room => {
    const node = document.createElement('button'); node.textContent = `${room.id} · ${room.prefab === 'box-room' ? 'room' : 'corridor'}`;
    node.setAttribute('aria-pressed', String(room.id === selectedId));
    node.onclick = () => { selectedId = room.id; selectionKind = 'room'; selectedFace = null; if (inspector !== 'all') setInspector('room'); refresh(false); }; return node;
  }));
  element('selection').textContent = `${room.id} · ${room.prefab}`;
  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
    input(`position-${axis}`).value = String(room.position[index]); input(`size-${axis}`).value = String(room.size[index]);
  }
  select('yaw').value = String(room.yaw); select('material').value = room.materialPreset;
  const freeFace = FACES.find(face => !model.document.connections.some(connection => [connection.a, connection.b].some(end => end.roomId === room.id && end.port === face)));
  button('duplicate-room').disabled = !freeFace;
  button('delete-room').disabled = model.document.rooms.length === 1 || model.document.playerSpawn.roomId === room.id || model.document.entities.some(entity => entity.kind === 'exit' && entity.roomId === room.id);
  element('room-delete-help').textContent = button('delete-room').disabled ? 'Move the spawn/exit elsewhere before deleting their room. Keep at least one room.' : 'Deleting also removes its content and connections. Undo restores them.';
  options(select('target-room'), model.document.rooms.filter(room => room.id !== selectedId).map(room => room.id));
  button('connect').disabled = model.document.rooms.length < 2;
  const content = [
    { id: '@spawn', text: `Spawn · ${model.document.playerSpawn.roomId}` },
    ...model.document.entities.map(entity => ({ id: entity.id, text: `${entity.id} · ${entity.kind} · ${entity.roomId}` })),
    ...(model.document.formatVersion !== 1 ? model.document.devices.map(device => ({ id: device.id, text: `${device.id} · relay · ${device.roomId}` })) : []),
  ];
  if (!content.some(value => value.id === selectedContentId)) selectedContentId = '@spawn';
  element('entities').replaceChildren(...content.map(value => {
    const node = document.createElement('button'); node.textContent = value.text; node.setAttribute('aria-pressed', String(selectedContentId === value.id));
    node.onclick = () => { selectedContentId = value.id; selectedId = model.content(value.id).roomId; selectedFace = null; selectionKind = 'content'; if (inspector !== 'all') setInspector('content'); refresh(false); }; return node;
  }));
  element('connections').replaceChildren(...model.document.connections.map(connection => {
    const door = model.document.formatVersion !== 1 ? model.document.doors.find(door => door.connectionId === connection.id) : null;
    const row = document.createElement('p'); row.textContent = `${connection.a.roomId}/${connection.a.port} ↔ ${connection.b.roomId}/${connection.b.port} · ${door ? `CLOSED until ${door.deviceId}` : 'OPEN passage'}`;
    const edit = document.createElement('button'); edit.textContent = 'Edit opening'; edit.setAttribute('aria-label', `Edit opening ${connection.id}`);
    edit.onclick = () => { select('opening-connection').value = connection.id; selectedId = connection.a.roomId; selectedFace = connection.a.port; selectionKind = 'wall'; setInspector('wall'); refresh(false); element('opening-connection').scrollIntoView({ block: 'nearest' }); };
    const remove = document.createElement('button'); remove.textContent = 'Disconnect'; remove.setAttribute('aria-label', `Disconnect ${connection.id}`);
    remove.onclick = () => perform(() => model.disconnect(connection.id));
    row.append(edit, remove); return row;
  }));
  const result = model.validation;
  element('validation-title').textContent = result.valid ? 'Valid level · Ready to export' : `${result.errors.length} validation issue(s) · Export blocked · Outline preview`;
  button('export').disabled = !result.valid;
  button('playtest').disabled = !result.valid;
  const overlaps = model.document.rooms.filter(room => model.document.rooms.some(other => other.id !== room.id && roomsOverlap(room, other)));
  element('geometry-status').textContent = overlaps.length ? `OVERLAP: ${overlaps.map(room => room.id).join(', ')}. Red rooms intersect; this does not create an opening. Preview and playtest are blocked until fixed.`
    : !result.valid ? 'Invalid draft: outlines only. Fix the listed issues before solid preview or playtest.'
    : `${room.id}: ${model.document.connections.filter(connection => connection.a.roomId === room.id || connection.b.roomId === room.id).length} connected face(s). Other faces are solid. ${select('view').value === 'cutaway' ? 'Cutaway hides three outside faces for inspection.' : 'Cyan frames mark passages; amber doors are closed until unlocked.'}`;
  element('geometry-status').classList.toggle('invalid', !result.valid);
  element('issues').replaceChildren(...(result.valid ? [] : result.errors.map(issue => {
    const node = document.createElement('button'); node.textContent = `${issue.path}: ${issue.message}`;
    node.onclick = () => {
      const match = issue.path.match(/^\$\.rooms\[(\d+)\]/);
      const connection = issue.path.match(/^\$\.connections\[(\d+)\]/);
      const entity = issue.path.match(/^\$\.(entities|devices)\[(\d+)\]/);
      if (match) selectedId = model.document.rooms[Number(match[1])]?.id ?? selectedId;
      if (connection) selectedId = model.document.connections[Number(connection[1])]?.a.roomId ?? selectedId;
      if (entity) {
        const values = entity[1] === 'entities' ? model.document.entities : model.document.formatVersion !== 1 ? model.document.devices : [];
        selectedId = values[Number(entity[2])]?.roomId ?? selectedId;
      }
      refresh(false); viewport.frame(true);
    };
    return node;
  })));
  refreshPanels();
  if (rebuild) viewport.show(model.document);
  viewport.setSelection(selectedId);
  viewport.setDetailSelection(selectionKind === 'wall' ? selectedFace : null, selectionKind === 'content' ? selectedContentId : '');
}

function refreshPanels() {
  const room = model.room(selectedId), face = select('surface-face').value;
  const style = room.surfaces?.[/** @type {import('../levelDocument.js').Face} */ (face)];
  const frame = face === 'all' ? null : portFrame(room, /** @type {import('../levelDocument.js').Face} */ (face));
  const preset = MATERIALS[room.materialPreset];
  const color = style?.color ?? (frame?.axis === 1 ? frame.direction < 0 ? preset.floor : preset.ceiling : preset.wall);
  input('surface-color').value = `#${color.toString(16).padStart(6, '0')}`; select('surface-pattern').value = style?.pattern ?? 'plain';
  const content = model.content(selectedContentId);
  element('content-selection').textContent = `${content.id} · ${content.kind}`;
  options(select('content-room'), model.document.rooms.map(room => room.id)); select('content-room').value = content.roomId;
  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) input(`content-position-${axis}`).value = String(content.position[index]);
  select('spawn-yaw').disabled = content.kind !== 'spawn';
  if ('rotation' in content) select('spawn-yaw').value = String((Math.round(2 * Math.atan2(content.rotation[1], content.rotation[3]) * 180 / Math.PI / 90) * 90 + 360) % 360);
  input('content-required').checked = content.kind === 'relay' || model.document.mission.requiredEnemyIds.includes(content.id);
  input('content-required').disabled = content.kind !== 'enemy'; button('delete-content').disabled = content.kind === 'spawn' || content.kind === 'exit';
  options(select('opening-connection'), model.document.connections.map(connection => connection.id));
  const wallConnection = selectedFace && model.document.connections.find(connection => [connection.a, connection.b].some(end => end.roomId === selectedId && end.port === selectedFace));
  if (inspector !== 'all' && selectionKind === 'wall') select('opening-connection').value = wallConnection ? wallConnection.id : '';
  const openingSection = element('opening-connection').closest('section');
  if (openingSection) openingSection.hidden = inspector !== 'all' && selectionKind === 'wall' && !wallConnection;
  element('wall-connection-help').textContent = selectionKind === 'wall' ? wallConnection ? 'This wall has a connected passage. Edit it below or right-click its position.' : 'This wall is solid. Right-click it to attach a neighboring room or corridor and create a passage.' : '';
  const connection = model.document.connections.find(connection => connection.id === select('opening-connection').value);
  button('apply-opening').disabled = !connection; button('apply-door').disabled = !connection;
  const devices = model.document.formatVersion !== 1 ? model.document.devices : [];
  select('door-relay').replaceChildren(new Option('Always open (no door)', ''), ...devices.map(device => new Option(device.label, device.id)));
  if (connection) {
    input('opening-width').value = String(connection.openingSize[0]); input('opening-height').value = String(connection.openingSize[1]);
    input('opening-u').value = String(connection.a.offset?.[0] ?? 0); input('opening-v').value = String(connection.a.offset?.[1] ?? 0);
    const source = model.document.rooms.find(room => room.id === connection.a.roomId);
    const frame = source && portFrame(source, connection.a.port);
    element('opening-basis').textContent = frame ? `${connection.a.roomId}: U = world ${'XYZ'[frame.u]}, V = world ${'XYZ'[frame.v]}. Offsets are measured from this face's center.` : 'This connection needs a valid source room.';
    select('door-relay').value = model.document.formatVersion !== 1 ? model.document.doors.find(door => door.connectionId === connection.id)?.deviceId ?? '' : '';
  } else element('opening-basis').textContent = 'Attach or connect two rooms first.';
}

for (const mode of /** @type {const} */ (['select', 'translate', 'rotate'])) {
  element(mode).onclick = () => {
    viewport.setMode(mode);
    for (const id of ['select', 'translate', 'rotate']) element(id).setAttribute('aria-pressed', String(id === mode));
  };
}
element('frame').onclick = () => viewport.frame();
element('actions').onclick = () => { const target = viewport.keyboardTarget(); if (target) { selectTarget(target); if (menu) openContextActions(target, { model, viewport, menu, commit, select: selectTarget, inspect: () => setInspector(selectionKind) }); } };
element('duplicate-room').onclick = () => perform(() => {
  const face = FACES.find(face => !model.document.connections.some(connection => [connection.a, connection.b].some(end => end.roomId === selectedId && end.port === face)));
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
  selectedContentId = model.addContent(selectedId, kind === 'enemy' ? 'enemy' : kind === 'relay' ? 'relay' : 'pickup', kind === 'enemy' ? select('enemy-type').value : kind, ['X', 'Y', 'Z'].map(axis => Number(input(`place-position-${axis}`).value)));
  selectionKind = 'content'; selectedFace = null; if (inspector !== 'all') setInspector('content');
});
element('apply-content').onclick = () => perform(() => model.updateContent(selectedContentId, select('content-room').value, ['X', 'Y', 'Z'].map(axis => Number(input(`content-position-${axis}`).value)), input('content-required').checked, Number(select('spawn-yaw').value)));
element('delete-content').onclick = () => perform(() => { model.deleteContent(selectedContentId); selectedContentId = '@spawn'; });
select('opening-connection').onchange = refreshPanels;
element('apply-opening').onclick = () => perform(() => {
  const id = select('opening-connection').value, width = Number(input('opening-width').value), height = Number(input('opening-height').value), anchor = select('opening-anchor').value;
  if (anchor === 'custom') model.updateOpening(id, width, height, [Number(input('opening-u').value), Number(input('opening-v').value)]);
  else model.anchorOpening(id, width, height, anchor);
});
element('apply-door').onclick = () => perform(() => model.setDoor(select('opening-connection').value, select('door-relay').value));
element('undo').onclick = () => perform(() => model.undo()); element('redo').onclick = () => perform(() => model.redo());
element('add-room').onclick = () => perform(() => { selectedId = model.attachRoom(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('attach-port').value), 'box-room'); selectionKind = 'room'; selectedFace = null; if (inspector !== 'all') setInspector('room'); });
element('add-corridor').onclick = () => perform(() => { selectedId = model.attachRoom(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('attach-port').value), 'straight-corridor'); selectionKind = 'room'; selectedFace = null; if (inspector !== 'all') setInspector('room'); });
element('connect').onclick = () => perform(() => model.connect(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('source-port').value), select('target-room').value, /** @type {import('../levelDocument.js').Face} */ (select('target-port').value)));
element('properties').onsubmit = event => {
  event.preventDefault();
  perform(() => model.updateRoom(selectedId, {
    position: ['X', 'Y', 'Z'].map(axis => Number(input(`position-${axis}`).value)),
    size: ['X', 'Y', 'Z'].map(axis => Number(input(`size-${axis}`).value)),
    yaw: Number(select('yaw').value), materialPreset: select('material').value,
  }));
};
input('name').onchange = () => perform(() => {
  const name = input('name').value.trim(); if (!name) throw new Error('Enter a mine name.');
  model.change(draft => { draft.name = name; });
});
const mayReplace = () => !model.dirty || window.confirm('Discard the current unsaved changes? Export JSON first to keep a backup.');
element('new').onclick = () => { if (mayReplace()) { perform(() => { model = new EditorDocument(createDocument()); selectedId = model.document.rooms[0].id; }); viewport.frame(); } };
element('sample').onclick = () => {
  if (mayReplace()) perform(() => { model.import(JSON.stringify(sample)); selectedId = model.document.rooms[0].id; });
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
    if (mayReplace()) perform(() => { model = candidate; selectedId = model.document.rooms[0].id; });
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
window.addEventListener('beforeunload', event => { if (model.dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', event => { if (!event.persisted) { menu?.dispose(); viewport.dispose(); } });
element('restore-draft').onclick = () => {
  if (!drafts.pending || !mayReplace()) return;
  try { model.restoreDraft(drafts.pending.document); drafts.restored(); selectedId = model.document.rooms[0].id; selectedFace = null; selectionKind = 'room'; setInspector('room'); refresh(); saveDraft(); viewport.frame(); }
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
    playtestFrame = document.createElement('iframe'); playtestFrame.title = 'Mission playtest'; playtestFrame.src = '/playtest.html';
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
