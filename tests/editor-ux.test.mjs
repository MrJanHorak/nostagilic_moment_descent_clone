import test from 'node:test';
import assert from 'node:assert/strict';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import EditorDraftStore, { DRAFT_KEY } from '../src/js/editor/EditorDraftStore.js';
import { placementPosition, toLocal } from '../src/js/editor/EditorPicking.js';
import { toWorld, openingFrame } from '../src/js/core/levels/document/RoomMath.js';
import { validateLevelDraft, validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import { validationTarget } from '../src/js/editor/ValidationNavigation.js';

test('validation navigation resolves exact content, spawn and mission references without editing history', () => {
  const model = new EditorDocument();
  const room = model.attachRoom('room-1', 'negativeZ', 'box-room');
  const enemy = model.addContent(room, 'enemy', 'scout', [0, 0, 0]);
  const relay = model.addContent('room-1', 'relay', '', [0, 0, 0]);
  const before = model.export(), history = model.past.length;
  for (const path of ['$.playerSpawn', '$.playerSpawn.position[0]', '$.playerSpawn.rotation']) {
    assert.deepEqual(validationTarget(model.document, path), { roomId: 'room-1', contentId: '@spawn' });
  }
  for (const path of ['$.entities[1].position', '$.mission.requiredEnemyIds[0]']) {
    assert.deepEqual(validationTarget(model.document, path), { roomId: room, contentId: enemy });
  }
  for (const path of ['$.devices[0].roomId', '$.mission.requiredDeviceIds[0]']) {
    assert.deepEqual(validationTarget(model.document, path), { roomId: 'room-1', contentId: relay });
  }
  assert.deepEqual(validationTarget(model.document, '$.mission.exitId'), { roomId: 'room-1', contentId: 'exit-1' });
  assert.equal(model.export(), before); assert.equal(model.past.length, history);
});

test('validation navigation identifies room faces, connection endpoint B and the exact door passage', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.attachRoom('room-1', 'positiveX', 'box-room');
  const relay = model.addContent('room-1', 'relay', '', [0, 0, 0]); model.setDoor('connection-2', relay);
  assert.deepEqual(validationTarget(model.document, '$.rooms[1].position'), { roomId: 'room-2' });
  assert.deepEqual(validationTarget(model.document, '$.rooms[1].surfaces.negativeY.pattern'), { roomId: 'room-2', face: 'negativeY' });
  assert.deepEqual(validationTarget(model.document, '$.connections[0].b.offset[0]'), { roomId: 'room-2', face: 'positiveZ', connectionId: 'connection-1' });
  for (const path of ['$.doors[0].deviceId', '$.doors[0].connectionId']) {
    assert.deepEqual(validationTarget(model.document, path), { roomId: 'room-1', face: 'positiveX', connectionId: 'connection-2' });
  }
});

test('validation navigation tolerates legacy documents, absent paths and dangling references', () => {
  const model = new EditorDocument();
  for (const path of ['$', '$.formatVersion', '$.entities', '$.rooms[50]', '$.entities[50].position', '$.devices[0]', '$.doors[0]', '$.mission.requiredEnemyIds[0]', '$.mission.requiredDeviceIds[0]', '$.rooms[0]extra']) {
    assert.equal(validationTarget(model.document, path), null, path);
  }
  const document = structuredClone(model.document); document.entities[0].roomId = 'missing';
  assert.equal(validationTarget(document, '$.entities[0].position'), null);
  document.mission.exitId = 'missing'; assert.equal(validationTarget(document, '$.mission.exitId'), null);
  model.attachRoom('room-1', 'negativeZ', 'box-room');
  const dangling = structuredClone(model.document); dangling.connections[0].b.roomId = 'missing';
  assert.deepEqual(validationTarget(dangling, '$.connections[0].b.roomId'), { roomId: 'room-1', face: 'negativeZ', connectionId: 'connection-1' });
});

function storage(initial = null) {
  let value = initial;
  return { getItem(key) { assert.equal(key, DRAFT_KEY); return value; }, setItem(key, next) { assert.equal(key, DRAFT_KEY); value = next; }, removeItem(key) { assert.equal(key, DRAFT_KEY); value = null; } };
}

for (const yaw of [0, 90, 180, 270]) test(`picked points convert to room local coordinates at yaw ${yaw}`, () => {
  const model = new EditorDocument(); model.updateRoom('room-1', { position: [20, -12, 34], yaw });
  const room = model.room('room-1');
  for (const point of [[0, 0, 0], [-3, -5.5, 2], [7.5, 2, -4]]) assert(toLocal(room, toWorld(room, point)).every((value, axis) => value === point[axis]));
});

test('direct placements inset/snap body clearance, preserve heading and reject overlap atomically', () => {
  const model = new EditorDocument();
  const id = model.placeAt('room-1', [-3.1, -5.5, -1.1], 'health');
  assert.deepEqual(model.content(id).position, [-3, -5, -1]); assert.equal(model.validation.valid, true);
  const before = model.export(), history = model.past.length;
  assert.throws(() => model.placeAt('room-1', [3, 0, -3], 'health'), /overlap/);
  assert.equal(model.export(), before); assert.equal(model.past.length, history);
  model.updateContent('@spawn', 'room-1', [-3, 0, 3], false, 90);
  const heading = [...model.document.playerSpawn.rotation]; model.placeAt('room-1', [-6, 0, 0], 'spawn');
  assert.deepEqual(model.document.playerSpawn.rotation, heading);
  assert.deepEqual(placementPosition(model.room('room-1'), [0, -6, 0], 'exit'), [0, -3, 0]);
  assert.throws(() => placementPosition(model.room('room-1'), [0, 0, 0], 'enemy', 'boss'), /too large/);
});

test('wall attachment places the connected corridor at the clicked opening as one command', () => {
  const model = new EditorDocument(); const id = model.attachAt('room-1', 'negativeZ', [4, 2, -7.5], 'straight-corridor');
  assert.deepEqual(model.room(id).position, [4, 2, -16]); assert.equal(model.validation.valid, true);
  const connection = model.document.connections[0]; assert.deepEqual(connection.a.offset, [4, 2]); assert.deepEqual(connection.b.offset, [0, 0]);
  assert.deepEqual(openingFrame(model.room('room-1'), connection.a).center, openingFrame(model.room(id), connection.b).center);
  assert.equal(model.past.length, 1); model.undo(); assert.equal(model.document.rooms.length, 1); model.redo(); assert.equal(model.document.rooms.length, 2);
  const before = model.export(); assert.throws(() => model.attachAt('room-1', 'negativeZ', [0, 0, -8], 'box-room'), /overlap/); assert.equal(model.export(), before);
});

test('room duplication copies styles and ordinary content with fresh references, leaving unique spawn/exit intact', () => {
  const model = new EditorDocument();
  const enemy = model.addContent('room-1', 'enemy', 'scout', [0, 0, 0]);
  model.addContent('room-1', 'pickup', 'health', [3, 0, 3]); model.addContent('room-1', 'relay', '', [-3, 0, -3]);
  model.setSurface('room-1', 'all', 0x246785, 'panels'); const before = model.export();
  const id = model.duplicateRoom('room-1', 'positiveX');
  assert.equal(model.validation.valid, true); assert.equal(model.document.entities.filter(entity => entity.kind === 'exit').length, 1);
  assert.deepEqual(model.room(id).surfaces, model.room('room-1').surfaces); assert.notEqual(model.room(id).surfaces, model.room('room-1').surfaces);
  const duplicateEnemy = model.document.entities.find(entity => entity.kind === 'enemy' && entity.roomId === id);
  assert.notEqual(duplicateEnemy.id, enemy); assert(model.document.mission.requiredEnemyIds.includes(duplicateEnemy.id));
  assert.equal(model.document.devices.length, 2); assert.equal(new Set([...model.document.entities, ...model.document.devices].map(value => value.id)).size, model.document.entities.length + model.document.devices.length);
  assert.notEqual(model.document.devices[0].label, model.document.devices[1].label);
  model.undo(); assert.equal(model.export(), before); model.redo(); assert.equal(model.document.rooms.length, 2);
});

test('room deletion cascades connections, content, objective IDs and relay doors in one undo', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.addContent('room-2', 'enemy', 'scout', [0, 0, 0]); const relay = model.addContent('room-2', 'relay', '', [-3, 0, 3]);
  // Relay is accessible through the ungated connection; door links are cleaned even in a draft.
  model.setDoor('connection-1', relay); const before = structuredClone(model.document);
  model.deleteRoom('room-2'); assert.equal(model.validation.valid, true);
  assert.equal(model.document.connections.length, 0); assert.equal(model.document.devices.length, 0); assert.equal(model.document.doors.length, 0);
  assert.deepEqual(model.document.mission.requiredEnemyIds, []); assert.deepEqual(model.document.mission.requiredDeviceIds, []);
  model.undo(); assert.deepEqual(model.document, before);
  assert.throws(() => model.deleteRoom('room-1'), /spawn and exit/);
  const single = new EditorDocument(); assert.throws(() => single.deleteRoom('room-1'), /at least one/);
});

test('disconnected drafts recover safely but remain rejected by runtime compilation and export', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room'); model.attachRoom('room-2', 'negativeZ', 'box-room');
  model.deleteRoom('room-2'); assert.equal(model.validation.valid, false); assert.equal(validateLevelDraft(model.document).valid, true);
  const memory = storage(), drafts = new EditorDraftStore(() => memory); assert(drafts.save(model.document));
  const reopened = new EditorDraftStore(() => memory), recovered = new EditorDocument(); recovered.restoreDraft(reopened.pending.document);
  assert.equal(recovered.dirty, true); assert.deepEqual(recovered.document, model.document);
  assert.equal(validateLevelDocument(recovered.document).valid, false); assert.throws(() => compileLevelDocument(recovered.document)); assert.throws(() => recovered.export());
});

test('a pending recovery record cannot be overwritten until restored or explicitly discarded', () => {
  const model = new EditorDocument(), memory = storage(), first = new EditorDraftStore(() => memory);
  model.attachRoom('room-1', 'positiveY', 'box-room'); assert(first.save(model.document)); const saved = memory.getItem(DRAFT_KEY);
  const next = new EditorDraftStore(() => memory); assert(next.pending); assert.equal(next.save(new EditorDocument().document), false); assert.equal(memory.getItem(DRAFT_KEY), saved);
  next.restored(); assert(next.save(model.document)); assert(next.discard()); assert.equal(memory.getItem(DRAFT_KEY), null);
});

test('malformed, future, oversized or executable recovery data cannot replace editing state', () => {
  for (const raw of ['{', '{"version":999}', 'x'.repeat(1_000_201), JSON.stringify({ version: 1, savedAt: '2026-10-18T00:00:00Z', document: { formatVersion: 3, script: 'execute()' } })]) {
    const memory = storage(raw), drafts = new EditorDraftStore(() => memory); assert.equal(drafts.pending, null); assert.equal(drafts.blocked, true); assert.equal(memory.getItem(DRAFT_KEY), raw);
    assert.equal(drafts.save(new EditorDocument().document), false); assert(drafts.discard());
  }
  const model = new EditorDocument(), before = model.export(); assert.throws(() => model.restoreDraft({ formatVersion: 999 })); assert.equal(model.export(), before);
  assert.equal(validateLevelDraft({ ...model.document, health: 99 }).valid, false);
});

test('unavailable and quota-limited storage never prevent editing or exporting portable backups', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  const unavailable = new EditorDraftStore(() => { throw new Error('blocked'); }); assert.equal(unavailable.save(model.document), false);
  const quota = new EditorDraftStore(() => ({ getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() {} }));
  assert.equal(quota.save(model.document), false); assert.match(quota.status, /failed/); assert(model.export().includes('room-2'));
});
