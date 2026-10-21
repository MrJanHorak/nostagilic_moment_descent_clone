import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import UserLevelLibrary, { USER_LEVELS_KEY, LIBRARY_LIMITS } from '../src/js/core/UserLevelLibrary.js';
import { createDocument } from '../src/js/editor/EditorDocument.js';
import { serializeLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';

function storageFixture() {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  return { data, storage, library: new UserLevelLibrary(() => storage) };
}

test('saved levels survive a reload and duplicate document IDs remain independent', () => {
  const { library, storage } = storageFixture();
  const first = library.save(createDocument()), second = library.save(createDocument());
  assert.notEqual(first.key, second.key);
  assert.equal(first.document.id, second.document.id);
  library.rename(second.key, 'Second mine');
  const reloaded = new UserLevelLibrary(() => storage);
  assert.deepEqual(reloaded.list().map(entry => entry.document.name), ['Untitled mine', 'Second mine']);
  reloaded.remove(first.key);
  assert.deepEqual(new UserLevelLibrary(() => storage).list().map(entry => entry.key), [second.key]);
});

test('library snapshots cannot mutate saved or subsequently loaded levels', () => {
  const { library, storage } = storageFixture(), source = createDocument();
  const saved = library.save(source); source.rooms[0].size[0] = 1000; saved.document.name = 'mutated';
  library.get(saved.key).document.rooms[0].position[0] = 200;
  library.list()[0].document.name = 'also mutated';
  const reloaded = new UserLevelLibrary(() => storage).get(saved.key);
  assert.equal(reloaded.document.name, 'Untitled mine');
  assert.deepEqual(reloaded.document.rooms[0].size, [16, 12, 16]);
  assert.deepEqual(reloaded.document.rooms[0].position, [0, 0, 0]);
});

test('invalid imports, renames and missing targets preserve the saved library', () => {
  const { library, data } = storageFixture(), saved = library.save(createDocument());
  const before = data.get(USER_LEVELS_KEY);
  const bad = createDocument(); bad.playerSpawn.roomId = 'missing';
  for (const input of ['{', '{"formatVersion":999}', 'x'.repeat(1_000_001), bad]) assert.throws(() => library.save(input));
  for (const name of ['', 'x'.repeat(81)]) assert.throws(() => library.rename(saved.key, name));
  assert.throws(() => library.save(createDocument(), 'missing'), /deleted/);
  assert.throws(() => library.remove('missing'), /no longer/);
  assert.equal(data.get(USER_LEVELS_KEY), before);
  assert.equal(library.list().length, 1);
});

test('modern Deepworks data survives save, rename and export without changing its objectives or geometry', () => {
  const source = readFileSync(new URL('../src/js/core/levels/documents/asterion-deepworks.v12.json', import.meta.url), 'utf8');
  const { library, storage } = storageFixture(), saved = library.save(source);
  library.rename(saved.key, 'My Deepworks');
  const document = new UserLevelLibrary(() => storage).get(saved.key).document;
  const expected = JSON.parse(source); expected.name = 'My Deepworks';
  assert.equal(serializeLevelDocument(document), serializeLevelDocument(expected));
  assert.equal(document.rooms.length, 48);
});

test('stale editor saves cannot overwrite a renamed or deleted level from another tab', () => {
  const { library, storage } = storageFixture(), saved = library.save(createDocument());
  const other = new UserLevelLibrary(() => storage), snapshot = serializeLevelDocument(saved.document);
  other.rename(saved.key, 'Changed elsewhere');
  assert.throws(() => library.save(saved.document, saved.key, snapshot), /another tab/);
  assert.equal(library.get(saved.key).document.name, 'Changed elsewhere');
  other.remove(saved.key);
  assert.throws(() => library.save(saved.document, saved.key, snapshot), /deleted/);
  const copy = library.save(saved.document);
  assert.notEqual(copy.key, saved.key); assert.equal(library.list().length, 1);
});

test('independent tab saves preserve unrelated levels and enforce bounded library size', () => {
  const { library, storage } = storageFixture(), other = new UserLevelLibrary(() => storage);
  const first = library.save(createDocument()), second = other.save(createDocument());
  for (let i = 2; i < LIBRARY_LIMITS.levels; i++) library.save(createDocument());
  assert.throws(() => other.save(createDocument()), /full/);
  assert.equal(library.get(first.key).document.id, 'custom-mine');
  assert.ok(other.get(second.key));
  assert.equal(new UserLevelLibrary(() => storage).list().length, LIBRARY_LIMITS.levels);
});

test('blocked reads or writes keep validated content usable temporarily and never claim persistence', () => {
  for (const provider of [() => undefined, () => { throw new Error('denied'); }]) {
    const library = new UserLevelLibrary(provider), entry = library.save(createDocument());
    assert.equal(library.persistent, false); assert.match(library.status, /Temporary/);
    assert.equal(library.get(entry.key).document.name, 'Untitled mine');
  }
  const { library, storage } = storageFixture(), saved = library.save(createDocument());
  storage.setItem = () => { throw new Error('quota'); };
  library.rename(saved.key, 'Temporary rename');
  assert.equal(library.persistent, false); assert.match(library.status, /lost on reload/);
  assert.equal(library.get(saved.key).document.name, 'Temporary rename');
  assert.equal(new UserLevelLibrary(() => storage).get(saved.key).document.name, 'Untitled mine');
});

test('unreadable or malformed saved libraries are preserved while temporary imports remain usable', () => {
  for (const record of ['{', JSON.stringify({ version: 999, entries: [] }), 'x'.repeat(LIBRARY_LIMITS.text + 1),
    JSON.stringify({ version: 1, entries: [{ key: 'bad', document: { formatVersion: 999 } }] })]) {
    const { data, storage } = storageFixture(); data.set(USER_LEVELS_KEY, record);
    const library = new UserLevelLibrary(() => storage);
    const entry = library.save(createDocument());
    assert.equal(library.persistent, false); assert.equal(library.list().length, 1);
    assert.equal(library.get(entry.key).document.id, 'custom-mine');
    assert.equal(data.get(USER_LEVELS_KEY), record);
  }
});

test('a temporary library cannot overwrite changes saved elsewhere before a retry', () => {
  const { library, storage } = storageFixture(), originalWrite = storage.setItem;
  library.save(createDocument()); storage.setItem = () => { throw new Error('quota'); };
  const temporary = library.save(createDocument());
  storage.setItem = originalWrite;
  const other = new UserLevelLibrary(() => storage), elsewhere = other.save({ ...createDocument(), name: 'Other tab' });
  library.rename(temporary.key, 'Keep temporarily');
  assert.equal(library.persistent, false);
  assert.ok(new UserLevelLibrary(() => storage).get(elsewhere.key));
});
