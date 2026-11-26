import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import EditorDocument from '../src/js/editor/EditorDocument.js';

const load = file => { const model = new EditorDocument(); model.import(readFileSync(new URL(`../src/js/core/levels/documents/${file}`, import.meta.url), 'utf8')); return model; };

test('editor authors linked relay pairs (format 15) and clears them', () => {
  const model = load('witness.v16.json');
  model.setRelayRules({ linked: [{ ids: ['archive-power', 'ledger-download'], windowSeconds: 20 }] });
  assert.deepEqual(model.document.mission.linkedRelays, [{ ids: ['archive-power', 'ledger-download'], windowSeconds: 20 }]);
  assert.equal(model.validation.valid, true);
  assert.throws(() => model.setRelayRules({ linked: [{ ids: ['archive-power', ''], windowSeconds: 20 }] }), /both relays/);
  assert.throws(() => model.setRelayRules({ linked: [{ ids: ['archive-power', 'uplink'], windowSeconds: 90 }] }), /1 to 60/);
  model.setRelayRules({});
  assert.equal('linkedRelays' in model.document.mission, false);
  model.undo();
  assert.equal(model.document.mission.linkedRelays.length, 1, 'undo restores the pair');
});

test('editor authors a choice (format 17): choice relays leave the required list and come back when removed', () => {
  const model = load('witness.v16.json');
  model.setRelayRules({ choice: ['ledger-download', 'uplink'] });
  assert.equal(model.document.formatVersion, 17);
  assert.deepEqual(model.document.mission.choice, { deviceIds: ['ledger-download', 'uplink'] });
  assert.deepEqual(model.document.mission.requiredDeviceIds, ['archive-power']);
  assert.equal(model.validation.valid, true);
  assert.throws(() => model.setRelayRules({ choice: ['uplink'] }), /two or three/);
  // Deleting a choice relay ends a two-way choice; the other relay is required again.
  model.deleteContent('uplink');
  assert.equal('choice' in model.document.mission, false);
  assert.deepEqual([...model.document.mission.requiredDeviceIds].sort(), ['archive-power', 'ledger-download']);
  model.undo();
  model.setRelayRules({ choice: [] });
  assert.deepEqual([...model.document.mission.requiredDeviceIds].sort(), ['archive-power', 'ledger-download', 'uplink']);
});

test('editor places and removes robot generators (format 16), pruned with their room', () => {
  const model = load('relay-gate.v2.json');
  const room = model.document.rooms[0].id;
  const id = model.placeGenerator(room, [0, 0, 0], { enemyType: 'fighter', count: 3, intervalSeconds: 9, maxAlive: 1 });
  assert.equal(model.document.formatVersion, 16);
  assert.deepEqual(model.document.generators[0], { id, roomId: room, position: [0, 0, 0], enemyType: 'fighter', count: 3, intervalSeconds: 9, maxAlive: 1 });
  assert.throws(() => model.placeGenerator(room, [0, 0, 0], { enemyType: 'boss', count: 3, intervalSeconds: 9 }), /scouts, fighters/);
  assert.throws(() => model.placeGenerator(room, [0, 0, 0], { enemyType: 'scout', count: 30, intervalSeconds: 9 }), /1 to 12/);
  model.removeGenerators([id]);
  assert.equal('generators' in model.document, false);
  model.undo();
  assert.equal(model.document.generators.length, 1);
});
