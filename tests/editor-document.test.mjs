import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import { portFrame } from '../src/js/core/levels/document/RoomMath.js';

test('starter exports a valid mission without runtime or editor state', () => {
  const model = new EditorDocument();
  const level = compileLevelDocument(JSON.parse(model.export()));
  assert.equal(level.sourceDocument.rooms.length, 1);
  assert.equal(level.mission.exit.id, 'exit-1');
  assert.equal(model.dirty, false);
  assert.equal('past' in level.sourceDocument, false);
});

for (const yaw of [0, 90, 180, 270]) for (const face of ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']) {
  test(`attachment shares the runtime port plane: yaw ${yaw}, face ${face}`, () => {
    const model = new EditorDocument();
    model.updateRoom('room-1', { yaw });
    const id = model.attachRoom('room-1', face, 'straight-corridor');
    const connection = model.document.connections[0];
    const a = portFrame(model.room('room-1'), face), b = portFrame(model.room(id), connection.b.port);
    assert.deepEqual(a.center, b.center);
    assert(a.normal.every((value, axis) => value === -b.normal[axis]));
    assert.equal(model.validation.valid, true);
    const compiled = compileLevelDocument(model.document);
    assert(compiled.solids.some(solid => solid.id.includes(`/${face}/left`)), 'compiler creates a real opening');
  });
}

test('three spaces export/reload with identical compiled walls, spawn and exit', () => {
  const model = new EditorDocument();
  const corridor = model.attachRoom('room-1', 'negativeZ', 'straight-corridor');
  model.attachRoom(corridor, 'negativeZ', 'box-room');
  const serialized = model.export(), original = compileLevelDocument(model.document);
  const reloaded = new EditorDocument(); reloaded.import(serialized);
  assert.equal(reloaded.export(), serialized);
  const restored = compileLevelDocument(reloaded.document);
  assert.deepEqual(restored.solids, original.solids);
  assert.deepEqual(restored.spawn, original.spawn);
  assert.deepEqual(restored.mission, original.mission);
  assert.equal(reloaded.dirty, false);
});

test('overlapping attachments and occupied ports fail atomically', () => {
  const model = new EditorDocument();
  const east = model.attachRoom('room-1', 'positiveX', 'box-room');
  const northEast = model.attachRoom(east, 'negativeZ', 'box-room');
  model.attachRoom(northEast, 'negativeX', 'box-room');
  const before = model.export(), history = model.past.length;
  assert.throws(() => model.attachRoom('room-1', 'negativeZ', 'box-room'), /overlap/);
  assert.throws(() => model.attachRoom('room-1', 'positiveX', 'box-room'), /No clear space/);
  assert.equal(model.export(), before); assert.equal(model.past.length, history);
  // Close the square using existing aligned ports instead of placing a duplicate.
  model.connect('room-4', 'positiveZ', 'room-1', 'negativeZ');
  assert.equal(model.validation.valid, true);
  assert.equal(model.document.connections.length, 4);
});

test('misaligned connection attempts preserve history and report an actionable error', () => {
  const model = new EditorDocument(); const id = model.attachRoom('room-1', 'negativeZ', 'box-room');
  const before = model.export();
  assert.throws(() => model.connect('room-1', 'positiveX', id, 'negativeX'), /shared area/);
  assert.equal(model.export(), before);
});

test('semantic errors stay editable, block export and undo back to the saved layout', () => {
  const model = new EditorDocument(); const id = model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.markSaved(); const saved = model.export();
  model.updateRoom(id, { position: [0, 0, -17] });
  assert.equal(model.validation.valid, false); assert.equal(model.dirty, true);
  assert.throws(() => model.export(), /ports/);
  model.undo(); assert.equal(model.export(), saved); assert.equal(model.dirty, false);
  model.redo(); assert.equal(model.validation.valid, false);
  model.undo(); model.updateRoom(id, { materialPreset: 'industrial-green' });
  assert.equal(model.future.length, 0);
});

test('bounded properties reject non-finite, off-grid and unsupported prefab transforms', () => {
  const model = new EditorDocument(); const original = model.export();
  for (const values of [{ position: [NaN, 0, 0] }, { position: [0.1, 0, 0] }, { position: [5000, 0, 0] }, { size: [2, 12, 16] }, { yaw: 45 }, { materialPreset: '<script>' }]) {
    assert.throws(() => model.updateRoom('room-1', values)); assert.equal(model.export(), original);
  }
  const corridor = model.attachRoom('room-1', 'negativeZ', 'straight-corridor');
  assert.throws(() => model.updateRoom(corridor, { size: [16, 8, 16] }), /Corridor/);
});

test('malformed, malicious and unsupported imports preserve unsaved work and history', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'positiveY', 'box-room');
  const before = model.export(), history = model.past.length;
  for (const text of ['{', '{"formatVersion":999}', '{"__proto__":{"polluted":true}}', 'x'.repeat(1_000_001)]) {
    assert.throws(() => model.import(text)); assert.equal(model.export(), before);
    assert.equal(model.past.length, history); assert.equal(model.dirty, true);
  }
  assert.equal({}.polluted, undefined);
});

test('v2 Deep Relay survives editor material edits and export without losing mission content', () => {
  const text = readFileSync(new URL('../src/js/core/levels/documents/deep-relay.v2.json', import.meta.url), 'utf8');
  const model = new EditorDocument(); model.import(text);
  const before = compileLevelDocument(model.document);
  model.updateRoom(model.document.rooms[0].id, { materialPreset: 'industrial-red' });
  const after = compileLevelDocument(JSON.parse(model.export()));
  assert.deepEqual(after.devices, before.devices); assert.deepEqual(after.doors, before.doors);
  assert.deepEqual(after.mission, before.mission); assert.deepEqual(after.enemySpawns, before.enemySpawns);
});
