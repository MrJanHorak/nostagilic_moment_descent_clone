import EditorDocument, { createDocument } from './EditorDocument.js';
import EditorViewport from './EditorViewport.js';
import { FACES, LIMITS, MATERIALS } from '../core/levels/document/LevelContent.js';
import sample from '../core/levels/documents/mine-link.v1.json';

const host = document.querySelector('#designer');
if (!(host instanceof HTMLElement)) throw new Error('Designer host is missing.');
host.innerHTML = `
  <header>
    <div class="brand"><span>DESCENDED</span><h1>Level designer</h1></div>
    <nav aria-label="Document controls">
      <button id="new">New mine</button><button id="sample">Open example</button>
      <button id="import">Import JSON</button><button id="export" class="primary">Export JSON</button>
      <a href="/">Back to game</a>
    </nav>
    <input id="file" type="file" accept=".json,application/json" hidden />
  </header>
  <div class="workspace">
    <aside class="left-panel">
      <section><h2>Mine</h2><label>Name<input id="name" maxlength="80" /></label><p id="save-state"></p></section>
      <section><h2>Rooms <span id="room-count"></span></h2><div id="rooms" aria-label="Rooms"></div></section>
      <section><h2>Attach a prefab</h2><p>Grow from an unused face of the selected room. The new ports connect automatically.</p>
        <label>Attachment port<select id="attach-port"></select></label>
        <div class="stack"><button id="add-room">Attach room</button><button id="add-corridor">Attach corridor</button></div>
      </section>
      <section><h2>Mission content</h2><p>Markers are read-only in this checkpoint.</p><div id="entities"></div></section>
    </aside>
    <main>
      <div class="viewport-toolbar" role="toolbar" aria-label="Viewport tools">
        <button id="select" aria-pressed="true">Select</button><button id="translate" aria-pressed="false">Move</button><button id="rotate" aria-pressed="false">Rotate Y</button>
        <button id="frame">Frame all</button><button id="undo">Undo</button><button id="redo">Redo</button>
      </div>
      <div id="viewport"></div>
      <div class="viewport-help">Drag: orbit · Right drag: pan · Scroll: zoom · F: focus selection<br>Snap: 0.5 units / 90° · Blue: spawn · Red: enemy · Green: pickup · Amber: exit · Purple: relay</div>
      <div class="validation"><h2 id="validation-title">Validation</h2><p id="notice" role="status" aria-live="polite"></p><div id="issues"></div></div>
    </main>
    <aside class="right-panel">
      <section><h2>Room properties</h2><p id="selection"></p>
        <form id="properties">
          <fieldset><legend>World position</legend><div class="vector" id="position"></div></fieldset>
          <fieldset><legend>Local dimensions</legend><div class="vector" id="size"></div></fieldset>
          <label>Yaw<select id="yaw"><option>0</option><option>90</option><option>180</option><option>270</option></select></label>
          <label>Material<select id="material"></select></label><button type="submit">Apply properties</button>
        </form>
        <p>Moving a connected room can misalign its ports. Undo or reconnect the rooms before exporting.</p>
      </section>
      <section><h2>Connect existing rooms</h2><p>Join aligned unused ports to close a loop.</p>
        <label>Selected room port<select id="source-port"></select></label>
        <label>Target room<select id="target-room"></select></label><label>Target port<select id="target-port"></select></label>
        <button id="connect">Connect ports</button>
      </section>
      <section><h2>Connections</h2><div id="connections"></div></section>
    </aside>
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
for (const key of ['position', 'size']) {
  for (const axis of ['X', 'Y', 'Z']) {
    const label = document.createElement('label'); label.textContent = axis;
    const field = document.createElement('input'); field.type = 'number'; field.step = '0.5'; field.required = true;
    field.id = `${key}-${axis}`; field.setAttribute('aria-label', `${key} ${axis}`);
    field.min = key === 'position' ? '-4096' : '4'; field.max = key === 'position' ? '4096' : '64';
    label.append(field); element(key).append(label);
  }
}

let model = new EditorDocument();
let selectedId = model.document.rooms[0].id;
/** @param {unknown} error */
function report(error) { element('notice').textContent = error instanceof Error ? error.message : String(error); }
/** @param {() => void} action */
function perform(action) {
  try { action(); element('notice').textContent = ''; refresh(); }
  catch (error) { report(error); viewport.show(model.document); }
}
const viewport = new EditorViewport(element('viewport'), id => { selectedId = id; refresh(false); }, (id, values) => perform(() => model.updateRoom(id, values)));

/** @param {boolean} [rebuild] */
function refresh(rebuild = true) {
  if (!model.document.rooms.some(room => room.id === selectedId)) selectedId = model.document.rooms[0].id;
  const room = model.room(selectedId);
  input('name').value = model.document.name;
  element('save-state').textContent = model.dirty ? 'Unsaved changes · Export a backup' : 'No unsaved changes';
  element('room-count').textContent = `${model.document.rooms.length} / ${LIMITS.rooms}`;
  button('undo').disabled = !model.past.length; button('redo').disabled = !model.future.length;
  element('rooms').replaceChildren(...model.document.rooms.map(room => {
    const node = document.createElement('button'); node.textContent = `${room.id} · ${room.prefab === 'box-room' ? 'room' : 'corridor'}`;
    node.setAttribute('aria-pressed', String(room.id === selectedId));
    node.onclick = () => { selectedId = room.id; refresh(false); }; return node;
  }));
  element('selection').textContent = `${room.id} · ${room.prefab}`;
  for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
    input(`position-${axis}`).value = String(room.position[index]); input(`size-${axis}`).value = String(room.size[index]);
  }
  select('yaw').value = String(room.yaw); select('material').value = room.materialPreset;
  options(select('target-room'), model.document.rooms.filter(room => room.id !== selectedId).map(room => room.id));
  button('connect').disabled = model.document.rooms.length < 2;
  element('entities').replaceChildren(...[
    `Spawn · ${model.document.playerSpawn.roomId}`,
    ...model.document.entities.map(entity => `${entity.id} · ${entity.kind} · ${entity.roomId}`),
    ...(model.document.formatVersion === 2 ? model.document.devices.map(device => `${device.id} · relay · ${device.roomId}`) : []),
  ].map(text => { const node = document.createElement('p'); node.textContent = text; return node; }));
  element('connections').replaceChildren(...model.document.connections.map(connection => {
    const row = document.createElement('p'); row.textContent = `${connection.a.roomId}/${connection.a.port} ↔ ${connection.b.roomId}/${connection.b.port}`;
    const remove = document.createElement('button'); remove.textContent = 'Disconnect'; remove.setAttribute('aria-label', `Disconnect ${connection.id}`);
    remove.onclick = () => perform(() => model.change(draft => {
      draft.connections = draft.connections.filter(value => value.id !== connection.id);
      // Doors belong to their connection. Undo restores the whole command.
      if (draft.formatVersion === 2) draft.doors = draft.doors.filter(door => door.connectionId !== connection.id);
    }));
    row.append(remove); return row;
  }));
  const result = model.validation;
  element('validation-title').textContent = result.valid ? 'Valid level · Ready to export' : `${result.errors.length} validation issue(s) · Export blocked · Outline preview`;
  button('export').disabled = !result.valid;
  element('issues').replaceChildren(...(result.valid ? [] : result.errors.map(issue => {
    const node = document.createElement('button'); node.textContent = `${issue.path}: ${issue.message}`;
    node.onclick = () => {
      const match = issue.path.match(/^\$\.rooms\[(\d+)\]/);
      const connection = issue.path.match(/^\$\.connections\[(\d+)\]/);
      const entity = issue.path.match(/^\$\.(entities|devices)\[(\d+)\]/);
      if (match) selectedId = model.document.rooms[Number(match[1])]?.id ?? selectedId;
      if (connection) selectedId = model.document.connections[Number(connection[1])]?.a.roomId ?? selectedId;
      if (entity) {
        const values = entity[1] === 'entities' ? model.document.entities : model.document.formatVersion === 2 ? model.document.devices : [];
        selectedId = values[Number(entity[2])]?.roomId ?? selectedId;
      }
      refresh(false); viewport.frame(true);
    };
    return node;
  })));
  if (rebuild) viewport.show(model.document);
  viewport.setSelection(selectedId);
}

for (const mode of /** @type {const} */ (['select', 'translate', 'rotate'])) {
  element(mode).onclick = () => {
    viewport.setMode(mode);
    for (const id of ['select', 'translate', 'rotate']) element(id).setAttribute('aria-pressed', String(id === mode));
  };
}
element('frame').onclick = () => viewport.frame();
element('undo').onclick = () => perform(() => model.undo()); element('redo').onclick = () => perform(() => model.redo());
element('add-room').onclick = () => perform(() => { selectedId = model.attachRoom(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('attach-port').value), 'box-room'); });
element('add-corridor').onclick = () => perform(() => { selectedId = model.attachRoom(selectedId, /** @type {import('../levelDocument.js').Face} */ (select('attach-port').value), 'straight-corridor'); });
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
    model.markSaved(); refresh(false); element('notice').textContent = 'JSON exported. Keep this file as your portable backup.';
  } catch (error) { report(error); }
};
window.addEventListener('beforeunload', event => { if (model.dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', event => { if (!event.persisted) viewport.dispose(); });
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); perform(() => event.key.toLowerCase() === 'y' || event.shiftKey ? model.redo() : model.undo());
  } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'f') { event.preventDefault(); viewport.frame(true); }
});
refresh(); viewport.frame();
