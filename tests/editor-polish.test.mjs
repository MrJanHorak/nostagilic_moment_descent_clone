import test from 'node:test';
import assert from 'node:assert/strict';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import { playtestFromRoom } from '../src/js/editor/PlaytestStart.js';
import { parseLevelDocument, validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import MineGuide from '../src/js/core/levels/document/MineGuide.js';
import { toWorld } from '../src/js/core/levels/document/RoomMath.js';
import { triggerOptions } from '../src/js/editor/StoryContent.js';

function mine() {
  const model = new EditorDocument();
  model.attachRoom('room-1', 'negativeZ', 'box-room');
  return model;
}

test('undo and redo name the edit they revert', () => {
  const model = mine();
  assert.equal(model.undoLabel, 'Add room');
  const enemy = model.addContent('room-2', 'enemy', 'scout', [3, 0, 3]);
  assert.equal(model.undoLabel, 'Place enemy');
  model.updateContent(enemy, 'room-2', [2, 0, 2], true); assert.equal(model.undoLabel, `Move ${enemy}`);
  model.updateContent(enemy, 'room-2', [2, 0, 2], false); assert.equal(model.undoLabel, 'Edit mission');
  model.setSurface('room-1', 'all', 0x334455, 'panels'); assert.equal(model.undoLabel, 'Style room-1 walls');
  model.change(draft => { draft.name = 'Renamed'; }); assert.equal(model.undoLabel, 'Rename mine');
  model.placeAt('room-1', [4, 0, 4], 'log', 'scout', { title: 'T', text: 'x' }); assert.equal(model.undoLabel, 'Place data log');
  assert.equal(model.undo(), 'Place data log'); assert.equal(model.redoLabel, 'Place data log');
  assert.equal(model.redo(), 'Place data log'); assert.equal(model.redoLabel, '');
  model.deleteContent(enemy); assert.equal(model.undoLabel, 'Delete enemy');
  model.undo(); model.undo(); assert.equal(model.undoLabel, 'Rename mine');
});

test('group delete and group move are single, validated undo steps', () => {
  const model = mine();
  const a = model.addContent('room-2', 'pickup', 'health', [-3, 0, -3]), b = model.addContent('room-2', 'pickup', 'pulseAmmo', [3, 0, -3]);
  const relay = model.addContent('room-1', 'relay', '', [-4, 0, -4]);
  const before = model.past.length, positions = [a, b, relay].map(id => toWorld(model.room(model.content(id).roomId), model.content(id).position));
  model.moveContentGroup([a, b, relay], [1, 0, 1]);
  assert.equal(model.past.length, before + 1); assert.equal(model.undoLabel, 'Edit 3 items');
  for (const [index, id] of [a, b, relay].entries()) assert.deepEqual(toWorld(model.room(model.content(id).roomId), model.content(id).position), positions[index].map((value, axis) => axis === 1 ? value : value + 1));
  const text = model.export();
  assert.throws(() => model.moveContentGroup([a, b], [0, 0, 40]), /fit|inside|clearance|outside/i);
  assert.equal(model.export(), text, 'a rejected group move changes nothing');
  assert.throws(() => model.deleteContents([a, '@spawn']), /spawn or exit/);
  model.deleteContents([a, b, relay]);
  assert.equal(model.past.length, before + 2); assert.equal(model.undoLabel, 'Delete 3 items');
  model.undo(); assert.equal(model.export(), text);
});

test('several rooms move and delete together', () => {
  const model = mine(), third = model.attachRoom('room-2', 'negativeZ', 'box-room');
  const before = model.document.rooms.map(room => [...room.position]);
  model.moveRooms(['room-2', third], [0, 4, 0]);
  assert.deepEqual(model.document.rooms.map(room => room.position[1]), [before[0][1], before[1][1] + 4, before[2][1] + 4]);
  assert.equal(model.undoLabel, 'Move 2 rooms');
  assert.throws(() => model.moveRooms(['room-2'], [0, 0.1, 0]), /steps/);
  model.undo();
  model.deleteRooms(['room-2', third]);
  assert.deepEqual(model.document.rooms.map(room => room.id), ['room-1']); assert.equal(model.undoLabel, 'Delete 2 rooms');
  assert.throws(() => model.deleteRooms(['room-1']), /at least one room/);
});

test('room names upgrade to format 14, validate, compile and reach the pilot guide', () => {
  const model = mine();
  model.setRoomLabel('room-2', '  Pump hall ');
  assert.equal(model.document.formatVersion, 14); assert.equal(model.room('room-2').label, 'Pump hall');
  assert.equal(model.undoLabel, 'Rename room-2');
  assert.throws(() => model.setRoomLabel('room-2', 'x'.repeat(41)), /40/);
  const document = parseLevelDocument(model.export());
  assert.equal(document.rooms[1].label, 'Pump hall'); assert(compileLevelDocument(document));
  assert.equal(new MineGuide(document).roomName('room-2'), 'Pump hall');
  assert.match(new MineGuide(document).roomName('room-1'), /Room 1/);
  assert.match(triggerOptions(document).find(option => option.value === 'enter:room-2')?.label ?? '', /Pump hall \(room-2\)/);
  model.setRoomLabel('room-2', ''); assert.equal('label' in model.room('room-2'), false);
  const old = JSON.parse(model.export()); old.formatVersion = 13; old.rooms[0].label = 'Too early';
  assert.equal(validateLevelDocument(old).valid, false, 'labels need format 14');
  old.formatVersion = 14; old.rooms[0].label = ''; assert.equal(validateLevelDocument(old).valid, false, 'labels cannot be empty');
});

test('stories keep working after the upgrade to format 14', () => {
  const model = mine(); model.setRoomLabel('room-1', 'Arrival');
  const id = model.addStoryMessage({ speaker: 'Vey', text: 'Go.', trigger: { on: 'enter', roomId: 'room-2' } });
  assert.equal(model.document.formatVersion, 14);
  const miner = model.placeAt('room-2', [3, 0, 3], 'survivor', 'scout', { name: 'Ana' });
  assert(model.validation.valid);
  const compiled = compileLevelDocument(parseLevelDocument(model.export()));
  assert.equal(compiled.story?.messages[0].id, id); assert.equal(compiled.story?.survivors[0].id, miner);
  model.deleteRoom('room-2');
  assert.deepEqual(model.document.formatVersion === 14 && model.document.story, { messages: [], logs: [], survivors: [] });
});

test('playtest from a room moves only the exported copy', () => {
  const model = mine(), before = model.export();
  const copy = JSON.parse(playtestFromRoom(model, 'room-2'));
  assert.equal(copy.playerSpawn.roomId, 'room-2'); assert.equal(model.export(), before);
  assert(validateLevelDocument(copy).valid);
  assert.equal(playtestFromRoom(model, 'room-1'), before, 'the spawn room plays as authored');
});

test('every tutorial check ticks only once its step is done', async () => {
  const { TUTORIAL_STEPS } = await import('../src/js/editor/Tutorial.js');
  const model = new EditorDocument(), progress = { playtested: false, saved: false };
  const done = () => TUTORIAL_STEPS.map(step => step.done ? step.done(model.document, progress) : null);
  assert.deepEqual(done(), [null, false, false, false, false, false, false, false, false, false]);
  const steps = [
    () => model.attachRoom('room-1', 'negativeZ', 'box-room'),
    () => model.setRoomLabel('room-2', 'Pump hall'),
    () => model.addContent('room-2', 'enemy', 'scout', [3, 0, 3]),
    () => model.createRelayDoor('connection-1'),
    () => model.placeAt('room-2', [-3, 0, -3], 'exit'),
    () => model.addStoryMessage({ speaker: 'Vey', text: 'Go.', trigger: { on: 'start' } }),
    () => model.placeAt('room-2', [3, 0, -3], 'log', 'scout', { title: 'T', text: 'x' }),
    () => { progress.playtested = true; },
    () => { progress.saved = true; },
  ];
  for (const [index, step] of steps.entries()) {
    step();
    assert.equal(done()[index + 1], true, `step ${index + 2} (${TUTORIAL_STEPS[index + 1].title}) ticks`);
    assert.equal(model.validation.valid, true, `the level stays playable after step ${index + 2}`);
  }
});

test('placing a reactor never downgrades a newer level', () => {
  const model = new EditorDocument(); model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.setRoomLabel('room-2', 'Core'); model.addStoryMessage({ speaker: 'V', text: 'Go.', trigger: { on: 'start' } });
  model.placeAt('room-2', [3, 0, 3], 'reactor');
  assert.equal(model.document.formatVersion, 14); assert.equal(model.validation.valid, true);
  const old = new EditorDocument(); old.addContent('room-1', 'reactor', '', [3, 0, 3]); assert.equal(old.document.formatVersion, 12);
});
