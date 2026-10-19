import test from 'node:test';
import assert from 'node:assert/strict';
import EditorDocument, { createDocument } from '../src/js/editor/EditorDocument.js';
import { toWorld } from '../src/js/core/levels/document/RoomMath.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';

for (const kind of ['spawn', 'exit', 'enemy', 'pickup', 'relay']) test(`direct ${kind} move previews without mutation, preserves metadata, and is one undo command`, () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'straight-corridor');
  const relay = model.addContent('room-1', 'relay', '', [-4, 0, -3]); model.setDoor('connection-1', relay);
  const enemy = model.addContent('room-1', 'enemy', 'scout', [3, 0, 3]);
  model.updateContent(enemy, 'room-1', [3, 0, 3], false);
  const pickup = model.addContent('room-1', 'pickup', 'health', [0, 0, 0]);
  // A drag preserves the complete imported quaternion, not just its yaw.
  model.document.playerSpawn.rotation = [0.5, 0.5, 0.5, 0.5];
  const id = { spawn: '@spawn', exit: 'exit-1', enemy, pickup, relay }[kind];
  const before = model.export(), history = model.past.length, item = model.content(id);
  const point = [...item.position]; point[1] = 1.24;
  const preview = model.previewContentMove(id, toWorld(model.room(item.roomId), point));
  assert.equal(preview.error, ''); assert.equal(model.export(), before); assert.equal(model.past.length, history);
  assert.deepEqual(preview.world, toWorld(model.room(item.roomId), [point[0], 1, point[2]]));
  model.moveContent(id, toWorld(model.room(item.roomId), point));
  assert.equal(model.past.length, history + 1); assert.deepEqual(model.content(id), { ...item, position: [point[0], 1, point[2]] });
  const expected = JSON.parse(before), actual = JSON.parse(model.export());
  const edited = id === '@spawn' ? expected.playerSpawn : expected.entities.find(item => item.id === id) ?? expected.devices.find(item => item.id === id);
  edited.position[1] = 1; assert.deepEqual(actual, expected);
  const moved = model.export(), restored = new EditorDocument(); restored.import(moved); assert.equal(restored.export(), moved);
  assert(compileLevelDocument(restored.document)); model.undo(); assert.equal(model.export(), before); model.redo(); assert.equal(model.export(), moved);
  model.moveContent(id, preview.world); assert.equal(model.past.length, history + 1, 'same grid position must not add history');
});

test('direct item moves snap in affine room coordinates for every orientation and retain the original room', () => {
  for (const yaw of [0, 90, 180, 270]) for (const pitch of [0, 90, 180, 270]) for (const roll of [0, 90, 180, 270]) {
    const doc = createDocument(); Object.assign(doc, { formatVersion: 6, devices: [], doors: [], mission: { ...doc.mission, type: 'relay-clear-and-exit', requiredDeviceIds: [] } });
    Object.assign(doc.rooms[0], { prefab: 'offset-corridor', endOffset: [8, 16], size: [16, 16, 32], position: [20.25, 10, -12], yaw, pitch, roll });
    doc.entities.push({ id: 'pickup-1', roomId: 'room-1', kind: 'pickup', type: 'health', position: [0, 0, 0] });
    const model = new EditorDocument(doc), room = structuredClone(model.room('room-1'));
    model.moveContent('pickup-1', toWorld(room, [0.74, 1.26, 0.26]));
    assert.deepEqual(model.content('pickup-1').position, [0.5, 1.5, 0.5]); assert.deepEqual(model.room('room-1'), room);
    assert.equal(model.document.formatVersion, 6); assert.equal(model.content('pickup-1').roomId, 'room-1');
  }
});

test('wall/placement conflicts, bad coordinates, unknown IDs and invalid drafts reject without mutating history', () => {
  const model = new EditorDocument(), id = model.addContent('room-1', 'pickup', 'health', [0, 0, 0]);
  model.moveContent(id, [0, 1, 0]); model.undo();
  const before = model.export(), past = model.past.length, future = JSON.stringify(model.future), dirty = model.dirty;
  for (const world of [[0, 6, 0], [3, 0, -3], [-3, 0, 3], [4097, 0, 0], [0, NaN, 0], [0, 0], []]) {
    assert.throws(() => model.moveContent(id, world), /clearance|fit|overlap|finite|4096/);
    assert.equal(model.export(), before); assert.equal(model.past.length, past); assert.equal(JSON.stringify(model.future), future); assert.equal(model.dirty, dirty);
  }
  assert.throws(() => model.moveContent('missing', [0, 0, 0]), /Select mission content/);
  const preview = model.previewContentMove(id, [0, 6, 0]); assert(preview.error.includes('does not fit')); assert.deepEqual(preview.world, [0, 6, 0]);
  model.updateRoom('room-1', { position: [0.5, 0, 0] }); model.attachRoom('room-1', 'negativeZ', 'box-room'); model.disconnect('connection-1');
  const broken = JSON.stringify(model.document); assert.throws(() => model.moveContent(id, [0.5, 1, 0]), /not connected/); assert.equal(JSON.stringify(model.document), broken);
});
