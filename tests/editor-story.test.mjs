import test from 'node:test';
import assert from 'node:assert/strict';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import { describeTrigger, parseTrigger, storyPlacements, triggerOptions, triggerValue } from '../src/js/editor/StoryContent.js';
import { validationTarget } from '../src/js/editor/ValidationNavigation.js';
import { placementPosition } from '../src/js/editor/EditorPicking.js';
import { toWorld } from '../src/js/core/levels/document/RoomMath.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import { STORY_LIMITS } from '../src/js/core/levels/document/LevelContent.js';

/** A two-room mine with a relay and a robot to hang triggers on. */
function mine() {
  const model = new EditorDocument();
  model.attachRoom('room-1', 'negativeZ', 'box-room');
  const relay = model.addContent('room-1', 'relay', '', [-4, 0, -3]);
  const enemy = model.addContent('room-2', 'enemy', 'scout', [0, 0, 0]);
  return { model, relay, enemy };
}

test('the first radio message upgrades to format 13 and is one undo step', () => {
  const { model } = mine();
  const before = model.export(), history = model.past.length;
  const id = model.addStoryMessage({ speaker: '  Control ', text: ' Go. ', trigger: { on: 'start' } });
  assert.equal(model.document.formatVersion, 13);
  assert.deepEqual(model.document.formatVersion === 13 && model.document.story?.messages, [{ id, speaker: 'Control', text: 'Go.', trigger: { on: 'start' } }]);
  assert.equal(model.past.length, history + 1);
  assert(model.validation.valid);
  model.undo(); assert.equal(model.export(), before);
});

test('messages accept every trigger kind and reject missing targets without history', () => {
  const { model, relay, enemy } = mine();
  for (const trigger of [{ on: 'enter', roomId: 'room-2' }, { on: 'device', deviceId: relay }, { on: 'defeat', enemyId: enemy }]) {
    model.addStoryMessage({ speaker: 'Vey', text: 'Noted.', trigger: /** @type {any} */ (trigger) });
  }
  assert(model.validation.valid);
  const history = model.past.length, text = model.export();
  assert.throws(() => model.addStoryMessage({ speaker: 'Vey', text: 'x', trigger: { on: 'enter', roomId: 'room-9' } }), /Unknown room/);
  assert.throws(() => model.addStoryMessage({ speaker: '', text: 'x', trigger: { on: 'start' } }), /speaker/);
  assert.throws(() => model.addStoryMessage({ speaker: 'Vey', text: 'x'.repeat(STORY_LIMITS.message + 1), trigger: { on: 'start' } }), /limited/);
  assert.equal(model.past.length, history); assert.equal(model.export(), text);
});

test('messages can be edited, reordered and deleted', () => {
  const { model } = mine();
  const a = model.addStoryMessage({ speaker: 'A', text: 'one', trigger: { on: 'start' } });
  const b = model.addStoryMessage({ speaker: 'B', text: 'two', trigger: { on: 'start' } });
  const ids = () => model.document.formatVersion === 13 ? model.document.story?.messages.map(message => message.id) : [];
  model.moveStoryMessage(b, -1); assert.deepEqual(ids(), [b, a]);
  const history = model.past.length; model.moveStoryMessage(b, -1); assert.equal(model.past.length, history, 'moving past the top is a no-op');
  model.updateStoryMessage(a, { speaker: 'A2', text: 'changed', trigger: { on: 'enter', roomId: 'room-2' } });
  assert.deepEqual(model.document.formatVersion === 13 && model.document.story?.messages[1], { id: a, speaker: 'A2', text: 'changed', trigger: { on: 'enter', roomId: 'room-2' } });
  model.deleteStoryMessage(b); assert.deepEqual(ids(), [a]);
  assert.throws(() => model.deleteStoryMessage(b), /radio message/);
});

test('data logs and miners are placed, edited, moved and deleted like content', () => {
  const { model } = mine();
  const log = model.placeAt('room-2', [3, -20, 3], 'log', 'scout', { title: 'Shift 4', text: 'Seal held.' });
  const miner = model.placeAt('room-2', [-3, 0, -3], 'survivor', 'scout', { name: 'Ana Ruiz' });
  assert.equal(model.document.formatVersion, 13);
  assert.deepEqual(model.content(log), { id: log, roomId: 'room-2', position: placementPosition(model.room('room-2'), [3, -20, 3], 'log'), title: 'Shift 4', text: 'Seal held.', kind: 'log' });
  assert.equal(model.content(miner).kind, 'survivor');
  assert.deepEqual(storyPlacements(model.document).map(item => item.id), [log, miner]);
  model.updateStoryItem(log, { title: 'Shift 5', text: 'Seal failed.' }); model.updateStoryItem(miner, { name: 'Ana R.' });
  assert.equal(model.content(log).kind === 'log' && model.content(log).title, 'Shift 5');
  assert.throws(() => model.updateStoryItem(miner, { name: ' ' }), /name/);
  const point = [...model.content(miner).position]; point[0] += 1;
  model.moveContent(miner, toWorld(model.room('room-2'), point));
  assert.deepEqual(model.content(miner).position, point);
  model.updateContent(log, 'room-1', [2, 0, 2], false); assert.equal(model.content(log).roomId, 'room-1');
  assert(model.validation.valid);
  const compiled = compileLevelDocument(model.document);
  assert.equal(compiled.story?.logs.length, 1); assert.equal(compiled.story?.survivors[0].name, 'Ana R.');
  model.deleteContent(log); assert.throws(() => model.content(log), /Select mission content/);
  assert.deepEqual(storyPlacements(model.document).map(item => item.id), [miner]);
});

test('overlapping story placements are rejected atomically', () => {
  const { model } = mine();
  const before = model.export();
  assert.throws(() => model.placeAt('room-1', [-4, 0, -3], 'survivor', 'scout', { name: 'Blocked' }), /overlaps/);
  assert.equal(model.export(), before);
});

test('deleting a room or its relay prunes dependent story content', () => {
  const { model, relay, enemy } = mine();
  model.addStoryMessage({ speaker: 'V', text: 'enter', trigger: { on: 'enter', roomId: 'room-2' } });
  model.addStoryMessage({ speaker: 'V', text: 'relay', trigger: { on: 'device', deviceId: relay } });
  model.addStoryMessage({ speaker: 'V', text: 'kill', trigger: { on: 'defeat', enemyId: enemy } });
  model.placeAt('room-2', [3, 0, 3], 'log', 'scout', { title: 't', text: 'x' });
  model.deleteContent(relay);
  assert.deepEqual(model.document.formatVersion === 13 && model.document.story?.messages.map(message => message.text), ['enter', 'kill']);
  model.deleteRoom('room-2');
  assert.deepEqual(model.document.formatVersion === 13 && model.document.story, { messages: [], logs: [], survivors: [] });
  assert(model.validation.valid);
});

test('trigger helpers round-trip and describe the current document', () => {
  const { model, relay, enemy } = mine();
  for (const trigger of [{ on: 'start' }, { on: 'enter', roomId: 'room-2' }, { on: 'device', deviceId: relay }, { on: 'defeat', enemyId: enemy }]) {
    assert.deepEqual(parseTrigger(triggerValue(/** @type {any} */ (trigger))), trigger);
  }
  const values = triggerOptions(model.document).map(option => option.value);
  assert.deepEqual(values, ['start', 'enter:room-1', 'enter:room-2', `device:${relay}`, `defeat:${enemy}`]);
  assert.match(describeTrigger({ on: 'device', deviceId: relay }, model.document), /Relay activated/);
  assert.match(describeTrigger({ on: 'enter', roomId: 'gone' }, model.document), /Missing target/);
  assert.throws(() => parseTrigger('enter:'), /Choose when/);
});

test('validation issues on story collectibles focus the item', () => {
  const { model } = mine();
  const miner = model.placeAt('room-2', [3, 0, 3], 'survivor', 'scout', { name: 'M' });
  assert.deepEqual(validationTarget(model.document, '$.story.survivors[0].position'), { roomId: 'room-2', contentId: miner });
  assert.equal(validationTarget(model.document, '$.story.messages[0].trigger.roomId'), null);
});

test('story limits are enforced before history changes', () => {
  const { model } = mine();
  for (let index = 0; index < STORY_LIMITS.messages; index++) model.addStoryMessage({ speaker: 'S', text: `m${index}`, trigger: { on: 'start' } });
  const history = model.past.length;
  assert.throws(() => model.addStoryMessage({ speaker: 'S', text: 'over', trigger: { on: 'start' } }), /limit/);
  assert.equal(model.past.length, history);
});
